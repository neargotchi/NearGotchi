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

fn team() -> AccountId {
    accounts(2)
}

fn new_contract(base_uri: Option<String>, limit: Option<u32>) -> Contract {
    Contract::new(owner(), team(), None, base_uri, "sha256:abc".into(), limit)
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
    let mut c = new_contract(Some("https://example.org/drop1/".into()), None);
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
fn split_is_50_50_and_exact() {
    let d = PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear();
    let (t, h) = split(d);
    assert_eq!(t + h, d);
    assert_eq!(h, d / 2);
    assert!(t >= h, "the team takes the odd yocto");
    for amount in [0u128, 1, 7, 99, 101, 1_999_999_999_999_999_999_999_997, u128::MAX / 100] {
        let (t, h) = split(amount);
        assert_eq!(t + h, amount, "{amount}");
    }
    // 1.99 NEAR → 0.995 / 0.995
    assert_eq!(t, 995_000_000_000_000_000_000_000);
    assert_eq!(h, 995_000_000_000_000_000_000_000);
}

#[test]
fn per_token_divides_and_keeps_the_remainder() {
    assert_eq!(per_token(100, 0), (0, 100));
    assert_eq!(per_token(100, 3), (33, 1));
    assert_eq!(per_token(0, 5), (0, 0));
    for (share, n) in [(995_000_000_000_000_000_000_000u128, 299u128), (7, 300), (1, 1)] {
        let (each, dust) = per_token(share, n);
        assert_eq!(each * n + dust, share);
        assert!(dust < n);
    }
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
    // everything paid in (net of the reserve) is accounted: team + credited holders' share (+ the dust that went to the team)
    let net = PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear() * 300;
    let a = c.accrued();
    assert_eq!(a.team.0 + a.holders_credited.0, net);
    assert!(a.holders_credited.0 <= net / 2);
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
    let mut c = new_contract(None, None);
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
    let mut c = new_contract(None, None);
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
    let (t, h) = split(PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear());
    // first mint: nobody holds a token yet, so the holders' half goes to the team
    assert_eq!(c.accrued(), Accrued { team: U128(t + h), ..Default::default() });
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
    let mut c = new_contract(None, None);
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

// ---------- holder rewards ----------

fn at(account: AccountId, block: u64) {
    testing_env!(context(account, NearToken::from_yoctonear(0), block, 1).build());
}

fn net() -> u128 {
    PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear()
}

#[test]
fn first_mint_goes_to_team_and_the_token_collects_nothing_of_its_own_payment() {
    let mut c = ready();
    let t1 = mint(&mut c, accounts(1), 10, 1);
    assert_eq!(c.reward_per_token(), U128(0));
    assert_eq!(c.accrued().team, U128(net()));
    assert_eq!(c.pending_rewards(t1.token_id.clone()), U128(0));
    // second payment: token 1 is the only earlier holder and gets the whole holder half
    let t2 = mint(&mut c, accounts(2), 20, 2);
    assert_eq!(c.pending_rewards(t1.token_id.clone()), U128(net() / 2));
    assert_eq!(c.pending_rewards(t2.token_id), U128(0), "a new token never collects older payments");
    assert_eq!(c.accrued().team.0, net() + net() - net() / 2);
}

#[test]
fn rewards_split_equally_between_earlier_tokens() {
    let mut c = ready();
    let a = mint(&mut c, accounts(1), 10, 1);
    let b = mint(&mut c, accounts(2), 20, 2);
    let d = mint(&mut c, accounts(3), 30, 3); // paid for by 2 earlier tokens: a, b
    let each = (net() / 2) / 2;
    assert_eq!(c.pending_rewards(a.token_id.clone()).0, net() / 2 + each);
    assert_eq!(c.pending_rewards(b.token_id.clone()).0, each);
    assert_eq!(c.pending_rewards(d.token_id.clone()).0, 0);
    assert_eq!(c.pending_rewards_for_owner(accounts(1)).0, net() / 2 + each);
}

#[test]
fn claim_pays_the_owner_once() {
    let mut c = ready();
    let a = mint(&mut c, accounts(1), 10, 1);
    mint(&mut c, accounts(2), 20, 2);
    at(accounts(1), 30);
    let paid = c.claim_rewards(vec![a.token_id.clone()]);
    assert_eq!(paid, U128(net() / 2));
    assert_eq!(c.pending_rewards(a.token_id.clone()), U128(0));
    assert_eq!(c.claim_rewards(vec![a.token_id.clone()]), U128(0), "no double claim");
    assert_eq!(c.claim_rewards(vec![a.token_id.clone(), a.token_id.clone()]), U128(0), "no double claim in one call");
    assert_eq!(c.accrued().holders_claimed, U128(net() / 2));
}

#[test]
#[should_panic(expected = "not the owner of this token")]
fn nobody_claims_for_someone_else() {
    let mut c = ready();
    let a = mint(&mut c, accounts(1), 10, 1);
    mint(&mut c, accounts(2), 20, 2);
    at(accounts(3), 30);
    c.claim_rewards(vec![a.token_id]);
}

#[test]
#[should_panic(expected = "token not found")]
fn claiming_an_unminted_token_panics() {
    let mut c = ready();
    at(accounts(1), 30);
    c.claim_rewards(vec!["7".into()]);
}

#[test]
fn rewards_follow_the_token_after_a_transfer() {
    let mut c = ready();
    let a = mint(&mut c, accounts(1), 10, 1);
    mint(&mut c, accounts(2), 20, 2);
    // transfer with a pending reward: the new owner collects it, the old one can't
    testing_env!(context(accounts(1), NearToken::from_yoctonear(1), 25, 1).build());
    c.nft_transfer(accounts(4), a.token_id.clone(), None, None);
    let old = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        at(accounts(1), 26);
        c.claim_rewards(vec![a.token_id.clone()])
    }));
    assert!(old.is_err(), "the previous owner is no longer the owner");
    at(accounts(4), 27);
    assert_eq!(c.claim_rewards(vec![a.token_id]).0, net() / 2);
}

#[test]
fn claimed_before_a_transfer_leaves_nothing_for_the_buyer() {
    let mut c = ready();
    let a = mint(&mut c, accounts(1), 10, 1);
    mint(&mut c, accounts(2), 20, 2);
    at(accounts(1), 22);
    c.claim_rewards(vec![a.token_id.clone()]);
    testing_env!(context(accounts(1), NearToken::from_yoctonear(1), 25, 1).build());
    c.nft_transfer(accounts(4), a.token_id.clone(), None, None);
    assert_eq!(c.pending_rewards(a.token_id).0, 0);
}

#[test]
fn payouts_never_exceed_payments_over_300_mints() {
    let mut c = ready();
    let mut ids = Vec::new();
    for i in 0..TOTAL as u64 {
        let t = mint(&mut c, accounts(1 + (i % 4) as usize), 10 + i * 2, (i % 251) as u8);
        ids.push((t.token_id, t.owner_id));
    }
    let mut claimed = 0u128;
    for (n, (id, owner_id)) in ids.iter().enumerate() {
        at(owner_id.clone(), 5000 + n as u64);
        claimed += c.claim_rewards(vec![id.clone()]).0;
    }
    let a = c.accrued();
    assert_eq!(a.holders_claimed.0, claimed);
    assert!(claimed <= a.holders_credited.0);
    assert!(claimed + a.team.0 <= net() * 300, "paid out ≤ paid in");
    assert_eq!(claimed, a.holders_credited.0, "every credited yocto was claimable");
    // token 1 minted first → earns from 299 payments; the last token earns nothing
    assert!(ids.iter().all(|(id, _)| c.pending_rewards(id.clone()).0 == 0));
    assert_eq!(a.team.0 + a.holders_credited.0, net() * 300);
}

#[test]
fn pending_tickets_do_not_count_as_holders() {
    let mut c = ready();
    // two payments in the same block, no token exists yet: both go to the team
    testing_env!(context(accounts(1), PRICE, 10, 3).build());
    let _ = c.nft_mint();
    testing_env!(context(accounts(2), PRICE, 10, 3).build());
    let _ = c.nft_mint();
    assert_eq!(c.reward_per_token(), U128(0));
    assert_eq!(c.accrued().team, U128(net() * 2));
}

#[test]
fn withdraw_surplus_leaves_rewards_team_share_and_future_storage() {
    let mut c = ready();
    mint(&mut c, accounts(1), 10, 1);
    mint(&mut c, accounts(2), 20, 2);
    let locked = c.locked_balance().0;
    let unclaimed = c.accrued().holders_credited.0 - c.accrued().holders_claimed.0;
    assert!(locked >= c.accrued().team.0 + unclaimed + STORAGE_RESERVE.as_yoctonear() * 298);
    // the mocked balance is 1000 NEAR: exactly `balance − locked` is free
    at(owner(), 30);
    let free = NearToken::from_near(1000).as_yoctonear() - locked;
    let _ = c.withdraw_surplus(U128(free), None);
}

fn ready_from_snapshot() -> Contract {
    let mut c = ready();
    mint(&mut c, accounts(1), 10, 1);
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 30, 1).build());
    c
}

#[test]
#[should_panic(expected = "only")]
fn withdraw_surplus_over_free_panics() {
    let mut c = ready_from_snapshot();
    let _ = c.withdraw_surplus(U128(NearToken::from_near(1000).as_yoctonear()), None);
}

#[test]
fn owner_change_is_two_step() {
    let mut c = ready();
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 3, 1).build());
    c.propose_owner(accounts(4));
    assert_eq!(c.owner(), owner());
    let wrong = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        at(accounts(5), 4);
        c.accept_owner();
    }));
    assert!(wrong.is_err());
    at(accounts(4), 5);
    c.accept_owner();
    assert_eq!(c.owner(), accounts(4));
    assert_eq!(c.proposed_owner(), None);
}

#[test]
#[should_panic(expected = "owner only")]
fn old_owner_loses_access_after_accept() {
    let mut c = ready();
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 3, 1).build());
    c.propose_owner(accounts(4));
    at(accounts(4), 5);
    c.accept_owner();
    at(owner(), 6);
    c.pause();
}

#[test]
fn per_account_limit_of_5_from_init() {
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 1, 1).build());
    let mut c = new_contract(None, Some(5));
    for start in (1..=TOTAL).step_by(50) {
        c.load_catalog((start..start + 50).map(entry).collect());
    }
    c.unpause();
    assert_eq!(c.drop_status().max_per_account, Some(5));
    for i in 0..5 {
        mint(&mut c, accounts(1), 10 + i * 2, 7);
    }
    // the limit is per account: another account still mints
    mint(&mut c, accounts(2), 100, 7);
    let sixth = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        testing_env!(context(accounts(1), PRICE, 200, 7).build());
        let _ = c.nft_mint();
    }));
    assert!(sixth.is_err(), "6th mint of one account must fail");
    assert_eq!(c.drop_status().minted, 6);
}

#[test]
fn team_account_is_paid_by_distribute_and_changeable() {
    let mut c = ready();
    mint(&mut c, accounts(1), 10, 1);
    testing_env!(context(owner(), NearToken::from_yoctonear(0), 20, 1).build());
    c.set_team(accounts(5));
    assert_eq!(c.team(), accounts(5));
    c.distribute();
    assert_eq!(c.accrued().team, U128(0));
}
