//! Drop 1 on NEAR testnet without near-cli (task 057). Idempotent; run from contracts/drop1 after ./build.sh:
//!   cargo run --example testnet            # accounts → deploy → new → catalog → unpause → 1 test mint → drop_status
//!   SUFFIX=abc cargo run --example testnet # other account names
//! Accounts are created by the testnet faucet helper; their keys are written ONLY to
//! ~/.near-credentials/testnet/<account>.json (near-cli format, chmod 600) — never into the repo.

use std::path::PathBuf;

use near_workspaces::network::Testnet;
use near_workspaces::types::{Gas, KeyType, NearToken, SecretKey};
use near_workspaces::{Account, Worker};
use serde_json::{json, Value};

const BASE_URI: &str = "https://neargochi.vercel.app/drop1-full/";
const HELPER: &str = "https://helper.testnet.near.org";

fn creds(id: &str) -> PathBuf {
    let home = std::env::var("HOME").expect("HOME");
    PathBuf::from(home).join(".near-credentials/testnet").join(format!("{id}.json"))
}

async fn ensure_account(worker: &Worker<Testnet>, id: &str) -> anyhow::Result<Account> {
    let path = creds(id);
    if path.exists() {
        return Ok(Account::from_file(&path, worker)?);
    }
    // the testnet faucet helper (what near-cli's sponsor-by-faucet-service and near-workspaces use)
    let sk = SecretKey::from_random(KeyType::ED25519);
    let res = reqwest::Client::new()
        .post(format!("{HELPER}/account"))
        .json(&json!({ "newAccountId": id, "newAccountPublicKey": sk.public_key().to_string() }))
        .send()
        .await?;
    anyhow::ensure!(res.status().is_success(), "faucet refused {id}: {} {}", res.status(), res.text().await?);
    let account = Account::from_secret_key(id.parse()?, sk.clone(), worker);
    std::fs::create_dir_all(path.parent().unwrap())?;
    let body = json!({ "account_id": id, "public_key": sk.public_key().to_string(), "private_key": sk.to_string() });
    std::fs::write(&path, serde_json::to_string_pretty(&body)?)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
    }
    println!("created {id} (key in {})", path.display());
    Ok(account)
}

fn metadata_dir() -> PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../metadata/drop1")
}

fn json_file(name: &str) -> anyhow::Result<Value> {
    Ok(serde_json::from_str(&std::fs::read_to_string(metadata_dir().join(name))?)?)
}

fn tx(hash: impl std::fmt::Display) -> String {
    format!("https://testnet.nearblocks.io/txns/{hash}")
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let suffix = std::env::var("SUFFIX").unwrap_or_else(|_| "ng67".into());
    let name = |role: &str| format!("neargotchi-{role}-{suffix}.testnet");
    let worker = near_workspaces::testnet().await?;

    let contract_acc = ensure_account(&worker, &name("drop1")).await?;
    let cid = contract_acc.id().clone();
    let admin = ensure_account(&worker, &name("admin")).await?;
    let team = ensure_account(&worker, &name("team")).await?;

    // deploy when there is no contract yet (or REDEPLOY=1)
    let wasm = std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("res/neargotchi_drop1.wasm"))?;
    let has_contract = contract_acc.view(&cid, "drop_status").await.is_ok();
    if !has_contract || std::env::var("REDEPLOY").is_ok() {
        let out = contract_acc.deploy(&wasm).await?;
        println!("deployed {} bytes: {}", wasm.len(), tx(out.details.outcome().transaction_hash));
        anyhow::ensure!(out.details.is_success(), "deploy: {:?}", out.details.failures());
    }
    let storage_code = contract_acc.view_account().await?.storage_usage;

    // init once
    let status: Option<Value> = contract_acc.view(&cid, "drop_status").await.ok().and_then(|r| r.json().ok());
    if status.is_none() {
        let provenance = json_file("collection.json")?["summary"]["manifest"].as_str().unwrap().to_string();
        let out = contract_acc
            .call(&cid, "new")
            .args_json(json!({
                "owner_id": admin.id(),
                "team_id": team.id(),
                "base_uri": BASE_URI,
                "provenance": provenance,
                // testnet: no limit unless LIMIT=5 is set (mainnet uses 5, docs/MAINNET-RUNBOOK.md)
                "max_per_account": std::env::var("LIMIT").ok().and_then(|l| l.parse::<u32>().ok()),
            }))
            .max_gas()
            .transact()
            .await?;
        println!("new: {} {}", out.is_success(), tx(out.outcome().transaction_hash));
        anyhow::ensure!(out.is_success(), "{:?}", out.failures());
    }
    let storage_init = contract_acc.view_account().await?.storage_usage;

    // catalog in batches of 50 (skips what is already loaded)
    let status: Value = contract_acc.view(&cid, "drop_status").await?.json()?;
    let loaded = status["catalog_loaded"].as_u64().unwrap_or(0) as u16;
    let mut catalog_gas = Vec::new();
    for start in ((loaded + 1)..=300).step_by(50) {
        let end = (start + 49).min(300);
        let entries: Vec<Value> = (start..=end)
            .map(|id| Ok(json!({ "token_id": id, "metadata": json_file(&format!("{id}.json"))? })))
            .collect::<anyhow::Result<_>>()?;
        let out = admin.call(&cid, "load_catalog").args_json(json!({ "entries": entries })).max_gas().transact().await?;
        anyhow::ensure!(out.is_success(), "load_catalog {start}: {:?}", out.failures());
        catalog_gas.push(out.total_gas_burnt.as_gas() as f64 / 1e12);
        println!("catalog {start}–{end}: {:.1} Tgas", catalog_gas.last().unwrap());
    }
    let storage_catalog = contract_acc.view_account().await?.storage_usage;

    let status: Value = contract_acc.view(&cid, "drop_status").await?.json()?;
    if status["paused"].as_bool() == Some(true) {
        admin.call(&cid, "unpause").transact().await?.into_result()?;
    }

    // one test mint (the admin buys), only if nothing is minted yet
    let status: Value = contract_acc.view(&cid, "drop_status").await?.json()?;
    if status["minted"].as_u64() == Some(0) {
        let out = admin
            .call(&cid, "nft_mint")
            .deposit(NearToken::from_near(2))
            .gas(Gas::from_tgas(100))
            .transact()
            .await?;
        anyhow::ensure!(out.is_success(), "mint: {:?}", out.failures());
        let (mint_gas, mint_hash) = (out.total_gas_burnt.as_gas() as f64 / 1e12, out.outcome().transaction_hash);
        let token: Value = out.json()?;
        println!(
            "TEST MINT token #{} \"{}\" to {} — {:.1} Tgas — {}",
            token["token_id"].as_str().unwrap_or("?"),
            token["metadata"]["title"].as_str().unwrap_or("?"),
            token["owner_id"].as_str().unwrap_or("?"),
            mint_gas,
            tx(mint_hash)
        );
    }
    let storage_minted = contract_acc.view_account().await?.storage_usage;

    let status: Value = contract_acc.view(&cid, "drop_status").await?.json()?;
    println!("drop_status: {status}");
    println!(
        "STATS storage: code+account {storage_code} B, after new {storage_init} B, catalog +{} B, after test mint {storage_minted} B (+{} B) | balance {} NEAR",
        storage_catalog.saturating_sub(storage_init),
        storage_minted.saturating_sub(storage_catalog),
        contract_acc.view_account().await?.balance.as_yoctonear() / 10u128.pow(24)
    );
    println!("contract: https://testnet.nearblocks.io/address/{cid}");
    println!("accounts: {} | admin {} | team {}", cid, admin.id(), team.id());
    Ok(())
}
