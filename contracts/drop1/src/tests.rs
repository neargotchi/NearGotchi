use super::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use std::collections::HashSet;

fn contract_id() -> AccountId {
    "drop1.testnet".parse().unwrap()
}

fn context(predecessor: AccountId, deposit: NearToken, block: u64, seed: u8) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .predecessor_account_id(predecessor)
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(1000))
        .block_height(block)
        .random_seed([seed; 32]);
    b
}

fn owner() -> AccountId {
    accounts(0)
}

fn treasuries() -> Treasuries {
    Treasuries { team: accounts(2), stakers: accounts(3), buyback: accounts(4) }
}

fn entry(id: u16) -> CatalogEntry {
    CatalogEntry {
        token_id: id,
        metadata: TokenMetadata {
            title: Some(format!("token #{id:03}")),
            media: Some(format!("{id}.png")),
            ..Default::default()
        },
    }
}

/// Contract with the full catalog, unpaused.
fn ready() -> Contract {
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 1, 1).build());
    let mut c = Contract::new(owner(), treasuries(), None, Some("https://example.org/drop1/".into()), "sha256:abc".into());
    for start in (1..=TOTAL).step_by(50) {
        c.load_catalog((start..start + 50).map(entry).collect());
    }
    c.unpause();
    c
}

/// Buyer pays in block `block`, the callback runs in `block + 1` with `seed`.
fn mint(c: &mut Contract, buyer: AccountId, block: u64, seed: u8) -> Token {
    testing_env!(context(buyer, PRICE, block, seed).build());
    let _ = c.nft_mint();
    let ticket = c.next_ticket - 1;
    testing_env!(context(contract_id(), NearToken::from_yoctonear(0), block + 1, seed).build());
    c.on_reveal(ticket)
}

#[test]
fn split_is_33_33_rest_and_exact() {
    let d = PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear();
    let (t, s, b) = split(d);
    assert_eq!(t, d * 33 / 100);
    assert_eq!(t, s);
    assert_eq!(t + s + b, d);
    assert!(b >= t, "buyback takes the remainder (34 %)");
    for amount in [0u128, 1, 7, 99, 101, 1_999_999_999_999_999_999_999_997, u128::MAX / 100] {
        let (t, s, b) = split(amount);
        assert_eq!(t + s + b, amount, "{amount}");
    }
    // 1.99 NEAR → 0.6567 / 0.6567 / 0.6766 NEAR
    assert_eq!(t, 656_700_000_000_000_000_000_000);
    assert_eq!(b, 676_600_000_000_000_000_000_000);
}

#[test]
fn mints_all_300_unique_then_sold_out() {
    let mut c = ready();
    let mut seen = HashSet::new();
    for i in 0..TOTAL as u64 {
        let token = mint(&mut c, accounts(1 + (i % 4) as usize), 10 + i * 2, (i % 251) as u8);
        let id: u16 = token.token_id.parse().unwrap();
        assert!((1..=TOTAL).contains(&id));
        assert!(seen.insert(id), "duplicate {id}");
        assert_eq!(token.metadata.unwrap().title.unwrap(), format!("token #{id:03}"), "catalog metadata");
    }
    assert_eq!(seen.len(), TOTAL as usize);
    let status = c.drop_status();
    assert_eq!((status.minted, status.pending, status.sold_out), (300, 0, true));
    assert_eq!(c.nft_total_supply(), U128(300));
    let (t, s, b) = split(PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear());
    assert_eq!(c.accrued(), Accrued { team: U128(t * 300), stakers: U128(s * 300), buyback: U128(b * 300) });
}

#[test]
#[should_panic(expected = "sold out")]
fn mint_301_panics() {
    let mut c = ready();
    for i in 0..TOTAL as u64 {
        mint(&mut c, accounts(1), 10 + i * 2, 3);
    }
    testing_env!(context(accounts(1), PRICE, 5000, 3).build());
    let _ = c.nft_mint();
}

#[test]
#[should_panic(expected = "sold out")]
fn open_tickets_hold_their_place() {
    let mut c = ready();
    for _ in 0..TOTAL {
        testing_env!(context(accounts(1), PRICE, 10, 3).build());
        let _ = c.nft_mint();
    }
    assert_eq!(c.drop_status().pending, 300);
    testing_env!(context(accounts(1), PRICE, 11, 3).build());
    let _ = c.nft_mint();
}

#[test]
#[should_panic(expected = "minting is paused")]
fn paused_by_default() {
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 1, 1).build());
    let mut c = Contract::new(owner(), treasuries(), None, None, "x".into());
    testing_env!(context(accounts(1), PRICE, 2, 1).build());
    let _ = c.nft_mint();
}

#[test]
#[should_panic(expected = "minting is paused")]
fn pause_stops_minting() {
    let mut c = ready();
    c.pause();
    testing_env!(context(accounts(1), PRICE, 2, 1).build());
    let _ = c.nft_mint();
}

#[test]
#[should_panic(expected = "attach 2 NEAR to hatch")]
fn short_deposit_panics() {
    let mut c = ready();
    testing_env!(context(accounts(1), NearToken::from_millinear(1999), 2, 1).build());
    let _ = c.nft_mint();
}

#[test]
#[should_panic(expected = "catalog not loaded")]
fn needs_the_full_catalog() {
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 1, 1).build());
    let mut c = Contract::new(owner(), treasuries(), None, None, "x".into());
    c.load_catalog((1..=299).map(entry).collect());
    c.unpause();
    testing_env!(context(accounts(1), PRICE, 2, 1).build());
    let _ = c.nft_mint();
}

#[test]
fn overpay_accrues_only_the_price() {
    let mut c = ready();
    testing_env!(context(accounts(1), NearToken::from_near(5), 2, 1).build());
    let _ = c.nft_mint();
    let (t, s, b) = split(PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear());
    assert_eq!(c.accrued(), Accrued { team: U128(t), stakers: U128(s), buyback: U128(b) });
}

#[test]
fn reveal_fallback_once_and_not_in_the_same_block() {
    let mut c = ready();
    testing_env!(context(accounts(1), PRICE, 20, 9).build());
    let _ = c.nft_mint();
    assert_eq!(c.ticket(0).unwrap().buyer, accounts(1));
    // the callback "failed": anyone finishes it from a later block
    testing_env!(context(accounts(3), NearToken::from_yoctonear(0), 22, 9).build());
    let token = c.reveal(0);
    assert_eq!(token.owner_id, accounts(1));
    assert!(c.ticket(0).is_none());
    assert_eq!(c.drop_status().minted, 1);
}

#[test]
#[should_panic(expected = "too early")]
fn reveal_not_in_the_mint_block() {
    let mut c = ready();
    testing_env!(context(accounts(1), PRICE, 20, 9).build());
    let _ = c.nft_mint();
    c.reveal(0);
}

#[test]
#[should_panic(expected = "no such ticket")]
fn reveal_twice_panics() {
    let mut c = ready();
    let _ = mint(&mut c, accounts(1), 20, 9);
    testing_env!(context(accounts(3), NearToken::from_yoctonear(0), 30, 9).build());
    c.reveal(0);
}

#[test]
fn no_limit_by_default_optional_limit_works() {
    let mut c = ready();
    for i in 0..5 {
        mint(&mut c, accounts(1), 10 + i * 2, 5);
    }
    c.set_max_per_account_for_test(Some(1));
    mint(&mut c, accounts(2), 100, 5);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        testing_env!(context(accounts(2), PRICE, 110, 5).build());
        let _ = c.nft_mint();
    }));
    assert!(result.is_err(), "second mint over the limit must fail");
}

#[test]
#[should_panic(expected = "metadata is frozen")]
fn freeze_locks_base_uri() {
    let mut c = ready();
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 3, 1).build());
    c.set_base_uri("ipfs://cid".into());
    assert_eq!(c.nft_metadata().base_uri.unwrap(), "ipfs://cid");
    c.freeze_metadata();
    c.set_base_uri("ipfs://other".into());
}

#[test]
#[should_panic(expected = "owner only")]
fn admin_is_owner_only() {
    let mut c = ready();
    testing_env!(context(accounts(1), NearToken::from_yoctonear(0), 3, 1).build());
    c.pause();
}

#[test]
#[should_panic(expected = "token id already loaded")]
fn catalog_ids_load_once() {
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 1, 1).build());
    let mut c = Contract::new(owner(), treasuries(), None, None, "x".into());
    c.load_catalog(vec![entry(7)]);
    c.load_catalog(vec![entry(7)]);
}

#[test]
fn royalty_is_5_percent_to_the_team() {
    let mut c = ready();
    let token = mint(&mut c, accounts(1), 20, 4);
    let payout = c.nft_payout(token.token_id.clone(), U128(1_000_000), Some(10)).payout;
    assert_eq!(payout.get(&accounts(2)), Some(&U128(50_000)));
    assert_eq!(payout.get(&accounts(1)), Some(&U128(950_000)));
    testing_env!(context(accounts(1), NearToken::from_yoctonear(1), 30, 4).build());
    let paid = c.nft_transfer_payout(accounts(5), token.token_id.clone(), None, None, U128(2_000), Some(10)).payout;
    assert_eq!(paid.values().map(|v| v.0).sum::<u128>(), 2_000);
    assert_eq!(c.nft_token(token.token_id).unwrap().owner_id, accounts(5));
}

#[test]
fn distribute_empties_accrued() {
    let mut c = ready();
    mint(&mut c, accounts(1), 20, 4);
    testing_env!(context(accounts(5), NearToken::from_yoctonear(0), 30, 4).build());
    c.distribute();
    assert_eq!(c.accrued(), Accrued::default());
}

impl Contract {
    fn set_max_per_account_for_test(&mut self, limit: Option<u32>) {
        testing_env!(context(owner(), NearToken::from_yoctonear(0), 99, 1).build());
        self.set_max_per_account(limit);
    }
}
