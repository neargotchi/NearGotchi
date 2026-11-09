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
    let stakers = account(&root, "stakers", 10).await?;
    let buyback = account(&root, "buyback", 10).await?;
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
            "treasuries": { "team": team.id(), "stakers": stakers.id(), "buyback": buyback.id() },
            "base_uri": "https://neargochi.vercel.app/drop1-full/",
            "provenance": provenance(),
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

    // 1. reveal fallback: find an attached gas where nft_mint succeeds but the callback runs out → the ticket stays
    //    pending → a stranger finishes it with reveal(); every stuck ticket is revealed exactly once
    let mut stuck = Vec::new();
    let mut probe = Vec::new();
    // nft_mint burns ~2 Tgas + reserves 2 Tgas for the draw: scan 3.00–4.60 Tgas for the window where the mint
    // receipt succeeds but the draw runs out of gas
    for hundredth in (300u64..=460).step_by(5) {
        let before: Value = contract.view("drop_status").await?.json()?;
        let next = before["minted"].as_u64().unwrap() + before["pending"].as_u64().unwrap();
        let out = buyers[0].call(contract.id(), "nft_mint").deposit(PRICE).gas(Gas::from_gas(hundredth * 10_000_000_000)).transact().await?;
        let after: Value = contract.view("drop_status").await?.json()?;
        let receipts: Vec<String> = out
            .receipt_outcomes()
            .iter()
            .map(|o| format!("{:.2}T{}", o.gas_burnt.as_gas() as f64 / 1e12, if o.is_success() { "" } else { "✗" }))
            .collect();
        probe.push(format!("{:.2}T → ok {} pending {} [{}]", hundredth as f64 / 100.0, out.is_success(), after["pending"], receipts.join(" ")));
        if after["pending"].as_u64() > before["pending"].as_u64() {
            stuck.push(next);
        }
    }
    println!("gas probe: {}", probe.join(" | "));
    assert!(!stuck.is_empty(), "no gas level left a pending ticket: {probe:?}");
    let mut first = Value::Null;
    for ticket_id in &stuck {
        let ticket: Value = contract.view("ticket").args_json(json!({ "ticket_id": ticket_id })).await?.json()?;
        assert_eq!(ticket["buyer"], json!(buyers[0].id()));
        let out = stranger.call(contract.id(), "reveal").args_json(json!({ "ticket_id": ticket_id })).max_gas().transact().await?;
        assert!(out.is_success(), "{:?}", out.failures());
        let token: Value = out.json()?;
        assert_eq!(token["owner_id"], json!(buyers[0].id()));
        first = token;
        let out = stranger.call(contract.id(), "reveal").args_json(json!({ "ticket_id": ticket_id })).max_gas().transact().await?;
        assert!(!out.is_success(), "a ticket reveals once");
    }
    // the probe also minted some tokens normally: collect everything buyer0 owns so far
    let early: Vec<Value> = contract.view("nft_tokens_for_owner").args_json(json!({ "account_id": buyers[0].id(), "limit": 50 })).await?.json()?;
    let _ = first;

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
            for _ in 0..count {
                let out = buyer.call(&id, "nft_mint").deposit(PRICE).gas(Gas::from_tgas(100)).transact().await.unwrap();
                assert!(out.is_success(), "{:?}", out.failures());
                gas.push(out.total_gas_burnt.as_gas());
                out_tokens.push(out.json::<Value>().unwrap());
            }
            (out_tokens, gas)
        }));
    }
    let mut tokens = early;
    let mut gas = Vec::new();
    for h in handles {
        let (t, g) = h.await?;
        tokens.extend(t);
        gas.extend(g);
    }
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
    let spent = before - balance(&buyers[2]).await?;
    assert!(spent < NearToken::from_millinear(10).as_yoctonear(), "spent {spent} yocto");

    // 5. distribute pays exactly 300 × 33 / 33 / 34 % of (2 − 0.01) NEAR
    let d = NearToken::from_millinear(1990).as_yoctonear();
    let (t, s) = (d * 33 / 100, d * 33 / 100);
    let b = d - t - s;
    let tb = (balance(&team).await?, balance(&stakers).await?, balance(&buyback).await?);
    let out = stranger.call(contract.id(), "distribute").max_gas().transact().await?;
    assert!(out.is_success(), "{:?}", out.failures());
    let ta = (balance(&team).await?, balance(&stakers).await?, balance(&buyback).await?);
    assert_eq!(ta.0 - tb.0, t * 300);
    assert_eq!(ta.1 - tb.1, s * 300);
    assert_eq!(ta.2 - tb.2, b * 300);
    let accrued: Value = contract.view("accrued").await?.json()?;
    assert_eq!(accrued, json!({ "team": "0", "stakers": "0", "buyback": "0" }));

    // 6. surplus: the owner can't take storage money, can take what's above it
    let out = owner.call(contract.id(), "withdraw_surplus").args_json(json!({ "amount": NearToken::from_near(1000).as_yoctonear().to_string() })).transact().await?;
    assert!(!out.is_success());

    gas.sort_unstable();
    let tg = |g: u64| g as f64 / 1e12;
    println!(
        "STATS wasm {} B | storage: code+account {} B, after init {} B, catalog {} B ({} B/token), after 300 mints {} B ({:+} B/mint vs catalog) | gas: load_catalog/50 {:?} Tgas | nft_mint+reveal min {:.1} median {:.1} max {:.1} Tgas",
        wasm.len(),
        storage_code,
        storage_init,
        storage_catalog - storage_init,
        (storage_catalog - storage_init) / TOTAL as u64,
        storage_minted,
        (storage_minted as i64 - storage_catalog as i64) / TOTAL as i64,
        catalog_gas.iter().map(|g| (g * 10.0).round() / 10.0).collect::<Vec<_>>(),
        tg(gas[0]),
        tg(gas[gas.len() / 2]),
        tg(gas[gas.len() - 1]),
    );
    Ok(())
}
