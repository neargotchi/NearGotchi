//! Holder rewards on testnet (task 067): run after `cargo run --example testnet` (SUFFIX as there, default ng67).
//! The team account mints one token → the earlier tokens' owners have pending rewards → the admin claims them.
//! Keys are read from ~/.near-credentials/testnet (written by examples/testnet.rs), never from the repo.

use near_workspaces::types::{Gas, NearToken};
use near_workspaces::Account;
use serde_json::{json, Value};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let suffix = std::env::var("SUFFIX").unwrap_or_else(|_| "ng67".into());
    let worker = near_workspaces::testnet().await?;
    let home = std::env::var("HOME")?;
    let load = |role: &str| {
        let id = format!("neargotchi-{role}-{suffix}.testnet");
        Account::from_file(format!("{home}/.near-credentials/testnet/{id}.json"), &worker)
    };
    let (contract, admin, team) = (load("drop1")?, load("admin")?, load("team")?);
    let cid = contract.id().clone();
    let tx = |h: &dyn std::fmt::Display| format!("https://testnet.nearblocks.io/txns/{h}");

    let mine: Vec<Value> = admin.view(&cid, "nft_tokens_for_owner").args_json(json!({ "account_id": admin.id() })).await?.json()?;
    let ids: Vec<String> = mine.iter().map(|t| t["token_id"].as_str().unwrap().to_string()).collect();
    let before: String = admin.view(&cid, "pending_rewards_for_owner").args_json(json!({ "account_id": admin.id() })).await?.json()?;
    println!("admin holds {ids:?}, pending before: {before} yocto");

    let out = team.call(&cid, "nft_mint").deposit(NearToken::from_near(2)).gas(Gas::from_tgas(100)).transact().await?;
    anyhow::ensure!(out.is_success(), "mint: {:?}", out.failures());
    let hash = out.outcome().transaction_hash;
    let token: Value = out.json()?;
    println!("team minted #{} — {}", token["token_id"].as_str().unwrap_or("?"), tx(&hash));
    let pending: String = admin.view(&cid, "pending_rewards_for_owner").args_json(json!({ "account_id": admin.id() })).await?.json()?;
    let new_pending: String = admin.view(&cid, "pending_rewards").args_json(json!({ "token_id": token["token_id"] })).await?.json()?;
    println!("admin pending after: {pending} yocto | new token pending: {new_pending}");

    let out = team.call(&cid, "claim_rewards").args_json(json!({ "token_ids": ids })).max_gas().transact().await?;
    println!("team tries to claim the admin's tokens: success={} (expected false)", out.is_success());
    let out = admin.call(&cid, "claim_rewards").args_json(json!({ "token_ids": ids })).max_gas().transact().await?;
    anyhow::ensure!(out.is_success(), "claim: {:?}", out.failures());
    let hash = out.outcome().transaction_hash;
    let paid: String = out.json()?;
    println!("admin claimed {paid} yocto — {}", tx(&hash));
    let out = admin.call(&cid, "claim_rewards").args_json(json!({ "token_ids": ids })).max_gas().transact().await?;
    println!("second claim pays {}", out.json::<String>()?);
    let accrued: Value = admin.view(&cid, "accrued").await?.json()?;
    println!("accrued: {accrued}");
    Ok(())
}
