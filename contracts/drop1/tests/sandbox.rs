//! near-workspaces sandbox: the real wasm on a local node (task 057).
//! Loads the 300 real metadata files, mints all 300 (unique, equal to metadata/drop1), checks the 301st panics and
//! refunds, the reveal fallback, distribute() to the yocto, the private callback, and prints gas / storage numbers
//! for docs/PLAN-CONTRACT-NFT.md. Run: `./build.sh && cargo test --test sandbox -- --nocapture`.

use std::collections::{HashMap, HashSet};

use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};

const TOTAL: u16 = 300;
const PRICE: NearToken = NearToken::from_near(2);

fn metadata_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../metadata/drop1")
}

fn token_metadata(id: u16) -> Value {
    let raw = std::fs::read_to_string(metadata_dir().join(format!("{id}.json"))).unwrap();
    serde_json::from_str(&raw).unwrap()
}

fn provenance() -> String {
    let raw = std::fs::read_to_string(metadata_dir().join("collection.json")).unwrap();
    let v: Value = serde_json::from_str(&raw).unwrap();
    v["summary"]["manifest"].as_str().unwrap().to_string()
}

async fn account(root: &Account, name: &str, near: u128) -> anyhow::Result<Account> {
    Ok(root.create_subaccount(name).initial_balance(NearToken::from_near(near)).transact().await?.into_result()?)
}

async fn balance(a: &Account) -> anyhow::Result<u128> {
    Ok(a.view_account().await?.balance.as_yoctonear())
}

fn token_id_of(token: &Value) -> u16 {
    token["token_id"].as_str().unwrap().parse().unwrap()
}

#[tokio::test]
#[cfg_attr(
    all(target_os = "macos", target_arch = "x86_64"),
    ignore = "near-sandbox has no Intel macOS binary; runs in CI (.github/workflows/contract-drop1.yml)"
)]
async fn drop1_end_to_end() -> anyhow::Result<()> {
    let wasm = std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("res/neargotchi_drop1.wasm"))
        .expect("run ./build.sh first (res/neargotchi_drop1.wasm)");
    println!("wasm: {} bytes", wasm.len());
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let owner = account(&root, "owner", 50).await?;
    let team = account(&root, "team", 10).await?;
    let stranger = account(&root, "stranger", 10).await?;
    let mut buyers = Vec::new();
    for i in 0..8 {
        buyers.push(account(&root, &format!("buyer{i}"), 120).await?);
    }
    let contract: Contract = account(&root, "drop1", 30).await?.deploy(&wasm).await?.into_result()?;
    let storage_code = contract.view_account().await?.storage_usage;

    contract
        .call("new")
        .args_json(json!({
            "owner_id": owner.id(),
            "team_id": team.id(),
            "base_uri": "https://neargochi.vercel.app/drop1-full/",
            "provenance": provenance(),
            "max_per_account": null,
        }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    let storage_init = contract.view_account().await?.storage_usage;

    // catalog: 6 batches of 50, owner only
    let mut catalog_gas = Vec::new();
    for start in (1..=TOTAL).step_by(50) {
        let entries: Vec<Value> =
            (start..start + 50).map(|id| json!({ "token_id": id, "metadata": token_metadata(id) })).collect();
        let out = owner.call(contract.id(), "load_catalog").args_json(json!({ "entries": entries })).max_gas().transact().await?;
        assert!(out.is_success(), "{:?}", out.failures());
        catalog_gas.push(out.total_gas_burnt.as_gas() as f64 / 1e12);
    }
    let storage_catalog = contract.view_account().await?.storage_usage;
    let out = stranger.call(contract.id(), "load_catalog").args_json(json!({ "entries": [] })).transact().await?;
    assert!(!out.is_success(), "catalog is owner only");
    owner.call(contract.id(), "unpause").transact().await?.into_result()?;

    // 1. gas gate (task 102, audit A-01): below the floor nft_mint is rejected with a full refund and no ticket; at or
    //    above it the reveal always runs in the same mint, so no gas level leaves a pending ticket behind (the old
    //    "attach just enough gas" window, where the draw ran out for some results, no longer exists)
    let floor = 35u64;
    let mut probe = Vec::new();
    for tgas in (5u64..=60).step_by(5).chain([34, 35, 36]) {
        let before: Value = contract.view("drop_status").await?.json()?;
        let money_before = balance(&buyers[0]).await?;
        let out = buyers[0].call(contract.id(), "nft_mint").deposit(PRICE).gas(Gas::from_tgas(tgas)).transact().await?;
        let after: Value = contract.view("drop_status").await?.json()?;
        let spent = money_before as i128 - balance(&buyers[0]).await? as i128;
        probe.push(format!("{tgas}T → ok {} pending {} spent {:.4}N", out.is_success(), after["pending"], spent as f64 / 1e24));
        assert_eq!(after["pending"], json!(0), "no gas level may leave a ticket pending (attached {tgas} Tgas)");
        if tgas < floor {
            assert!(!out.is_success(), "{tgas} Tgas must be rejected");
            assert!(format!("{:?}", out.failures()).contains("attach more gas"), "{tgas} Tgas: {:?}", out.failures());
            assert_eq!(after["minted"], before["minted"], "{tgas} Tgas: nothing minted");
            assert!(spent < NearToken::from_millinear(20).as_yoctonear() as i128, "{tgas} Tgas: the 2 NEAR came back, spent {spent}");
        } else {
            assert!(out.is_success(), "{tgas} Tgas must work: {:?}", out.failures());
            assert_eq!(after["minted"].as_u64(), Some(before["minted"].as_u64().unwrap() + 1));
        }
    }
    println!("gas gate probe: {}", probe.join(" | "));
    // the public reveal has the same gate, and it comes first: a low-gas call is refused for the gate's reason, not
    // because the ticket is missing; with plenty of gas the same ticket id answers "no such ticket" (already revealed)
    let out = stranger.call(contract.id(), "reveal").args_json(json!({ "ticket_id": 0 })).gas(Gas::from_tgas(10)).transact().await?;
    assert!(!out.is_success() && format!("{:?}", out.failures()).contains("attach more gas"), "{:?}", out.failures());
    let out = stranger.call(contract.id(), "reveal").args_json(json!({ "ticket_id": 0 })).max_gas().transact().await?;
    assert!(!out.is_success() && format!("{:?}", out.failures()).contains("no such ticket"), "{:?}", out.failures());
    // buyer0 owns what the probe minted
    let early: Vec<Value> = contract.view("nft_tokens_for_owner").args_json(json!({ "account_id": buyers[0].id(), "limit": 50 })).await?.json()?;
    assert_eq!(early.len(), probe.iter().filter(|line| line.contains("ok true")).count());
    // 2. the private callback can't be called from outside
    let out = stranger.call(contract.id(), "on_reveal").args_json(json!({ "ticket_id": 1 })).max_gas().transact().await?;
    assert!(!out.is_success(), "on_reveal must not be callable from outside");
    assert!(format!("{:?}", out.failures()).contains("Method on_reveal is private"), "{:?}", out.failures());
    println!("private on_reveal from a stranger: {:?}", out.failures().iter().map(|f| { let d = format!("{f:?}"); d[d.find("status").unwrap_or(0)..].to_string() }).collect::<Vec<_>>());

    // 3. mint the rest (8 buyers in parallel, 100 Tgas like the front)
    let left = TOTAL as usize - early.len();
    let mut handles = Vec::new();
    for (i, buyer) in buyers.iter().cloned().enumerate() {
        let id = contract.id().clone();
        let count = left / 8 + usize::from(i < left % 8);
        handles.push(tokio::spawn(async move {
            let mut out_tokens = Vec::new();
            let mut gas = Vec::new();
            let mut reveal_gas = Vec::new();
            for _ in 0..count {
                let out = buyer.call(&id, "nft_mint").deposit(PRICE).gas(Gas::from_tgas(100)).transact().await.unwrap();
                assert!(out.is_success(), "{:?}", out.failures());
                gas.push(out.total_gas_burnt.as_gas());
                // every receipt after the nft_mint one: the on_reveal draw (+ zero-gas refunds)
                reveal_gas.push(out.receipt_outcomes().iter().skip(1).map(|o| o.gas_burnt.as_gas()).max().unwrap_or(0));
                out_tokens.push(out.json::<Value>().unwrap());
            }
            (out_tokens, gas, reveal_gas)
        }));
    }
    let mut tokens = early;
    let mut gas = Vec::new();
    let mut reveal_gas: Vec<u64> = Vec::new();
    for h in handles {
        let (t, g, r) = h.await?;
        tokens.extend(t);
        gas.extend(g);
        reveal_gas.extend(r);
    }
    // the gate's floor (18 Tgas = 1.5 x the worst reveal) must be far above what any of the 300 draws burns
    let worst_reveal = reveal_gas.iter().copied().max().unwrap();
    println!("REVEAL GAS over {} draws: worst {:.2} Tgas (floor 18 Tgas, margin x{:.2})", reveal_gas.len(), worst_reveal as f64 / 1e12, 18e12 / worst_reveal as f64);
    assert!(worst_reveal as f64 * 1.5 <= 18e12, "a reveal burned {worst_reveal} gas: raise GAS_REVEAL_MIN (lib.rs) to 1.5x this");
    let storage_minted = contract.view_account().await?.storage_usage;

    // all 300 unique, metadata equal to metadata/drop1/{id}.json
    let ids: HashSet<u16> = tokens.iter().map(token_id_of).collect();
    assert_eq!(ids.len(), TOTAL as usize);
    assert!(ids.iter().all(|id| (1..=TOTAL).contains(id)));
    for t in &tokens {
        let id = token_id_of(t);
        let expected = token_metadata(id);
        for key in ["title", "description", "media", "media_hash", "extra"] {
            assert_eq!(t["metadata"][key], expected[key], "#{id} {key}");
        }
    }
    let status: Value = contract.view("drop_status").await?.json()?;
    assert_eq!((status["minted"].as_u64(), status["sold_out"].as_bool()), (Some(300), Some(true)));
    let supply: Value = contract.view("nft_total_supply").await?.json()?;
    assert_eq!(supply, json!("300"));
    let mut per_owner: HashMap<String, usize> = HashMap::new();
    for t in &tokens {
        *per_owner.entry(t["owner_id"].as_str().unwrap().to_string()).or_default() += 1;
    }
    let listed: Vec<Value> = contract
        .view("nft_tokens_for_owner")
        .args_json(json!({ "account_id": buyers[1].id(), "limit": 100 }))
        .await?
        .json()?;
    assert_eq!(listed.len(), per_owner[buyers[1].id().as_str()]);

    // 4. the 301st panics and the 2 NEAR come back (only gas is spent)
    let before = balance(&buyers[2]).await?;
    let out = buyers[2].call(contract.id(), "nft_mint").deposit(PRICE).gas(Gas::from_tgas(100)).transact().await?;
    assert!(!out.is_success());
    println!("301st mint failure: {:?}", out.failures().iter().map(|f| { let d = format!("{f:?}"); d[d.find("status").unwrap_or(0)..].to_string() }).collect::<Vec<_>>());
    assert!(format!("{:?}", out.failures()).contains("sold out"), "{:?}", out.failures());
    let spent = before as i128 - balance(&buyers[2]).await? as i128; // signed: late gas refunds from earlier mints can raise the balance
    assert!(spent < NearToken::from_millinear(10).as_yoctonear() as i128, "301st mint: spent {spent} yocto, the 2 NEAR deposit should have come back");

    // 5. money: team half + holders' half (÷ earlier tokens) account for every yocto paid in; distribute pays the team
    let net = NearToken::from_millinear(1990).as_yoctonear() * 300;
    let accrued: Value = contract.view("accrued").await?.json()?;
    let team_due: u128 = accrued["team"].as_str().unwrap().parse()?;
    let credited: u128 = accrued["holders_credited"].as_str().unwrap().parse()?;
    assert_eq!(team_due + credited, net);
    assert!(credited <= net / 2);
    let tb = balance(&team).await?;
    let out = stranger.call(contract.id(), "distribute").max_gas().transact().await?;
    assert!(out.is_success(), "{:?}", out.failures());
    assert_eq!(balance(&team).await? as i128 - tb as i128, team_due as i128, "team payout");
    let accrued: Value = contract.view("accrued").await?.json()?;
    assert_eq!(accrued["team"], json!("0"));
    // every holder claims all their tokens: payouts == credited, a second claim pays 0, a stranger can't claim
    let mut claimed_total = 0u128;
    for buyer in &buyers {
        let mine: Vec<String> = tokens.iter().filter(|t| t["owner_id"] == json!(buyer.id())).map(|t| t["token_id"].as_str().unwrap().to_string()).collect();
        if mine.is_empty() { continue; }
        let out = stranger.call(contract.id(), "claim_rewards").args_json(json!({ "token_ids": mine })).max_gas().transact().await?;
        assert!(!out.is_success(), "a stranger can't claim for someone else");
        let pending: String = contract.view("pending_rewards_for_owner").args_json(json!({ "account_id": buyer.id() })).await?.json()?;
        let before = balance(buyer).await?;
        let out = buyer.call(contract.id(), "claim_rewards").args_json(json!({ "token_ids": mine })).max_gas().transact().await?;
        assert!(out.is_success(), "{:?}", out.failures());
        let paid: String = out.json()?;
        assert_eq!(paid, pending);
        let gained = balance(buyer).await? as i128 + 20_000_000_000_000_000_000_000 - before as i128; // + gas allowance
        assert!(gained >= paid.parse::<i128>()?, "claim paid out");
        claimed_total += paid.parse::<u128>()?;
        let again: String = buyer.call(contract.id(), "claim_rewards").args_json(json!({ "token_ids": mine })).max_gas().transact().await?.json()?;
        assert_eq!(again, "0", "no double claim");
    }
    assert_eq!(claimed_total, credited);
    let accrued: Value = contract.view("accrued").await?.json()?;
    assert_eq!(accrued["holders_claimed"], accrued["holders_credited"]);

    // 6. surplus: the owner can't take storage money, can take what's above it
    let out = owner.call(contract.id(), "withdraw_surplus").args_json(json!({ "amount": NearToken::from_near(1000).as_yoctonear().to_string() })).transact().await?;
    assert!(!out.is_success());
    let locked: String = contract.view("locked_balance").await?.json()?;
    let free = contract.view_account().await?.balance.as_yoctonear().saturating_sub(locked.parse::<u128>()?);
    let ob = balance(&owner).await?;
    let out = owner.call(contract.id(), "withdraw_surplus").args_json(json!({ "amount": free.to_string() })).transact().await?;
    assert!(out.is_success(), "{:?}", out.failures());
    assert!(balance(&owner).await? > ob);
    // after the withdrawal the contract still covers its storage
    let acc = contract.view_account().await?;
    assert!(acc.balance.as_yoctonear() >= acc.storage_usage as u128 * 10_000_000_000_000_000_000);

    gas.sort_unstable();
    let tg = |g: u64| g as f64 / 1e12;
    println!(
        "STATS wasm {} B | storage: code+account {} B, after init {} B, catalog {} B ({} B/token), after 300 mints {} B ({:+} B/mint vs catalog) | gas: load_catalog/50 {:?} Tgas | nft_mint+reveal min {:.1} median {:.1} max {:.1} Tgas",
        wasm.len(),
        storage_code,
        storage_init,
        storage_catalog as i64 - storage_init as i64,
        (storage_catalog as i64 - storage_init as i64) / TOTAL as i64,
        storage_minted,
        (storage_minted as i64 - storage_catalog as i64) / TOTAL as i64,
        catalog_gas.iter().map(|g| (g * 10.0).round() / 10.0).collect::<Vec<_>>(),
        tg(gas[0]),
        tg(gas[gas.len() / 2]),
        tg(gas[gas.len() - 1]),
    );
    Ok(())
}

#[tokio::test]
#[cfg_attr(
    all(target_os = "macos", target_arch = "x86_64"),
    ignore = "near-sandbox has no Intel macOS binary; runs in CI (.github/workflows/contract-drop1.yml)"
)]
async fn holder_rewards_limit_and_transfer() -> anyhow::Result<()> {
    let wasm = std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("res/neargotchi_drop1.wasm"))?;
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let owner = account(&root, "owner", 50).await?;
    let team = account(&root, "team", 10).await?;
    let a = account(&root, "alice", 100).await?;
    let b = account(&root, "bob", 100).await?;
    let c = account(&root, "carol", 100).await?;
    let contract: Contract = account(&root, "drop1", 30).await?.deploy(&wasm).await?.into_result()?;
    // mainnet configuration: limit 5 per account set in init
    contract
        .call("new")
        .args_json(json!({ "owner_id": owner.id(), "team_id": team.id(), "base_uri": "ipfs://x/", "provenance": provenance(), "max_per_account": 5 }))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    for start in (1..=TOTAL).step_by(50) {
        let entries: Vec<Value> = (start..start + 50).map(|id| json!({ "token_id": id, "metadata": token_metadata(id) })).collect();
        owner.call(contract.id(), "load_catalog").args_json(json!({ "entries": entries })).max_gas().transact().await?.into_result()?;
    }
    owner.call(contract.id(), "unpause").transact().await?.into_result()?;
    let status: Value = contract.view("drop_status").await?.json()?;
    assert_eq!(status["max_per_account"], json!(5));

    let mint = |who: &Account| {
        let who = who.clone();
        let id = contract.id().clone();
        async move {
            let out = who.call(&id, "nft_mint").deposit(PRICE).gas(Gas::from_tgas(100)).transact().await?;
            anyhow::ensure!(out.is_success(), "{:?}", out.failures());
            Ok::<Value, anyhow::Error>(out.json()?)
        }
    };
    let pending = |id: String| {
        let c = contract.clone();
        async move { c.view("pending_rewards").args_json(json!({ "token_id": id })).await.unwrap().json::<String>().unwrap().parse::<u128>().unwrap() }
    };
    let net = NearToken::from_millinear(1990).as_yoctonear();

    let t1 = mint(&a).await?; // nobody holds a token: the holders' half goes to the team
    let id1 = t1["token_id"].as_str().unwrap().to_string();
    assert_eq!(pending(id1.clone()).await, 0);
    let t2 = mint(&b).await?; // paid for by token 1 alone
    let id2 = t2["token_id"].as_str().unwrap().to_string();
    assert_eq!(pending(id1.clone()).await, net / 2);
    assert_eq!(pending(id2.clone()).await, 0, "a new token doesn't collect older payments");
    let t3 = mint(&c).await?; // paid for by tokens 1 and 2
    let id3 = t3["token_id"].as_str().unwrap().to_string();
    assert_eq!(pending(id1.clone()).await, net / 2 + net / 4);
    assert_eq!(pending(id2.clone()).await, net / 4);
    assert_eq!(pending(id3.clone()).await, 0);

    // transfer token 1 (with its pending reward) to carol: she claims it, alice no longer can
    let out = a.call(contract.id(), "nft_transfer").args_json(json!({ "receiver_id": c.id(), "token_id": id1 })).deposit(NearToken::from_yoctonear(1)).transact().await?;
    assert!(out.is_success(), "{:?}", out.failures());
    let out = a.call(contract.id(), "claim_rewards").args_json(json!({ "token_ids": [id1] })).max_gas().transact().await?;
    assert!(!out.is_success(), "the previous owner can't claim");
    let before = balance(&c).await?;
    let out = c.call(contract.id(), "claim_rewards").args_json(json!({ "token_ids": [id1] })).max_gas().transact().await?;
    assert!(out.is_success(), "{:?}", out.failures());
    assert_eq!(out.json::<String>()?, (net / 2 + net / 4).to_string());
    let gained = balance(&c).await? as i128 + NearToken::from_millinear(20).as_yoctonear() as i128 - before as i128;
    assert!(gained >= (net / 2 + net / 4) as i128);
    assert_eq!(pending(id1.clone()).await, 0);
    let out = c.call(contract.id(), "claim_rewards").args_json(json!({ "token_ids": [id1] })).max_gas().transact().await?;
    assert_eq!(out.json::<String>()?, "0");

    // limit 5: alice minted 1, mints 4 more, the 6th is refused and the 2 NEAR come back
    for _ in 0..4 {
        mint(&a).await?;
    }
    let before = balance(&a).await?;
    let out = a.call(contract.id(), "nft_mint").deposit(PRICE).gas(Gas::from_tgas(100)).transact().await?;
    assert!(!out.is_success());
    assert!(format!("{:?}", out.failures()).contains("mint limit reached"), "{:?}", out.failures());
    // signed: late gas refunds of the previous mints can even raise the balance
    let spent = before as i128 - balance(&a).await? as i128;
    assert!(spent < NearToken::from_millinear(10).as_yoctonear() as i128, "deposit refunded (spent {spent})");
    // another account is unaffected
    mint(&b).await?;

    // the owner can't pull funds the holders are owed
    let accrued: Value = contract.view("accrued").await?.json()?;
    let credited: u128 = accrued["holders_credited"].as_str().unwrap().parse()?;
    let claimed: u128 = accrued["holders_claimed"].as_str().unwrap().parse()?;
    let locked: String = contract.view("locked_balance").await?.json()?;
    assert!(locked.parse::<u128>()? as i128 >= credited as i128 - claimed as i128);
    let out = owner.call(contract.id(), "withdraw_surplus").args_json(json!({ "amount": contract.view_account().await?.balance.as_yoctonear().to_string() })).transact().await?;
    assert!(!out.is_success(), "can't withdraw rewards, team share, storage or the reserve of unminted tokens");
    Ok(())
}
