//! NEARGOTCHI drop 1 NFT (docs/PLAN-CONTRACT-NFT.md, task 057).
//!
//! 300 tokens, catalog of NEP-177 metadata loaded by the owner (metadata/drop1). `nft_mint` (2 NEAR) takes the payment
//! and stores a *ticket*; a self-callback `on_reveal` draws the token from the remaining pool with the random seed of a
//! **later block** (unknown when the buyer signed), mints it and emits the NEP-297 `nft_mint` event. If the callback
//! fails, anyone can finish it with `reveal(ticket_id)`. Proceeds accrue 33 % team / 33 % stakers / rest buyback and are
//! paid out by `distribute()` (pull payment: the mint path never transfers). NEP-171/177/178/181/297 come from
//! near-contract-standards; NEP-199 royalty (5 %) is implemented here.

use std::collections::HashMap;

use near_contract_standards::non_fungible_token::core::{NonFungibleTokenCore, NonFungibleTokenResolver};
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::refund_approved_account_ids;
use near_contract_standards::non_fungible_token::{
    NonFungibleToken, NonFungibleTokenApproval, NonFungibleTokenEnumeration, Token, TokenId,
};
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};

/// Tokens in drop 1.
pub const TOTAL: u16 = 300;
/// Mint price.
pub const PRICE: NearToken = NearToken::from_near(2);
/// Kept in the contract per mint to pay for the token's storage (owner, enumeration, metadata ≈ 1 KB worst case).
pub const STORAGE_RESERVE: NearToken = NearToken::from_millinear(10);
/// Royalty in basis points (NEP-199): 5 %.
pub const ROYALTY_BPS: u128 = 500;
/// Gas reserved for the reveal callback; it also gets all gas left over from `nft_mint` (front attaches 100 Tgas).
/// Too little gas → the callback fails, the ticket stays and `reveal()` finishes it (tested in the sandbox).
pub const GAS_FOR_REVEAL: Gas = Gas::from_tgas(2);

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    OwnerById,
    TokenMetadata,
    Enumeration,
    Approval,
    Catalog,
    Pool,
    Tickets,
    MintedBy,
}

/// A paid mint waiting for its draw.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Ticket {
    pub buyer: AccountId,
    pub block_height: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Treasuries {
    pub team: AccountId,
    pub stakers: AccountId,
    pub buyback: AccountId,
}

/// Proceeds waiting for `distribute()`, in yoctoNEAR.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Accrued {
    pub team: U128,
    pub stakers: U128,
    pub buyback: U128,
}

/// NEP-199 payout.
#[near(serializers = [json])]
#[derive(Debug, PartialEq)]
pub struct Payout {
    pub payout: HashMap<AccountId, U128>,
}

#[near(serializers = [json])]
#[derive(Debug, PartialEq)]
pub struct DropStatus {
    pub minted: u16,
    pub total: u16,
    /// Paid tickets not drawn yet (they hold a place in the pool).
    pub pending: u16,
    pub price: U128,
    pub paused: bool,
    pub sold_out: bool,
    pub catalog_loaded: u16,
    pub max_per_account: Option<u32>,
    pub metadata_frozen: bool,
}

/// One catalog entry for `load_catalog`.
#[near(serializers = [json])]
pub struct CatalogEntry {
    pub token_id: u16,
    pub metadata: TokenMetadata,
}

/// 33 / 33 / rest split of `amount` (yoctoNEAR). The buyback share takes every rounding remainder, so the three
/// parts always sum to `amount` exactly.
pub fn split(amount: u128) -> (u128, u128, u128) {
    let team = amount * 33 / 100;
    let stakers = amount * 33 / 100;
    (team, stakers, amount - team - stakers)
}

/// Index into a pool of `len` from a 32-byte seed mixed with the ticket id (two tickets in one block differ).
pub fn draw_index(seed: &[u8], ticket_id: u64, len: u32) -> u32 {
    let mut input = seed.to_vec();
    input.extend_from_slice(&ticket_id.to_le_bytes());
    let hash = env::sha256(&input);
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash[..8]);
    (u64::from_le_bytes(bytes) % len as u64) as u32
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    tokens: NonFungibleToken,
    metadata: NFTContractMetadata,
    /// sha256 of data/collection-drop1.json, published before the sale.
    provenance: String,
    catalog: LookupMap<u16, TokenMetadata>,
    catalog_loaded: u16,
    /// ids not drawn yet.
    pool: Vector<u16>,
    tickets: LookupMap<u64, Ticket>,
    next_ticket: u64,
    pending: u16,
    minted: u16,
    treasuries: Treasuries,
    royalty_account: AccountId,
    accrued: Accrued,
    paused: bool,
    metadata_frozen: bool,
    max_per_account: Option<u32>,
    minted_by: LookupMap<AccountId, u32>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(
        owner_id: AccountId,
        treasuries: Treasuries,
        royalty_account: Option<AccountId>,
        base_uri: Option<String>,
        provenance: String,
    ) -> Self {
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "NEARGOTCHI".to_string(),
            symbol: "NGOTCHI".to_string(),
            icon: None,
            base_uri,
            reference: None,
            reference_hash: None,
        };
        metadata.assert_valid();
        let mut pool = Vector::new(StorageKey::Pool);
        for id in 1..=TOTAL {
            pool.push(id);
        }
        Self {
            royalty_account: royalty_account.unwrap_or_else(|| treasuries.team.clone()),
            tokens: NonFungibleToken::new(
                StorageKey::OwnerById,
                owner_id.clone(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            owner_id,
            metadata,
            provenance,
            catalog: LookupMap::new(StorageKey::Catalog),
            catalog_loaded: 0,
            pool,
            tickets: LookupMap::new(StorageKey::Tickets),
            next_ticket: 0,
            pending: 0,
            minted: 0,
            treasuries,
            accrued: Accrued::default(),
            paused: true,
            metadata_frozen: false,
            max_per_account: None,
            minted_by: LookupMap::new(StorageKey::MintedBy),
        }
    }

    // ---------- minting ----------

    /// Pay 2 NEAR for one random token. Returns the ticket id; the token arrives in the `on_reveal` callback
    /// (a later block). A panic here (paused / sold out / short deposit / over the limit) refunds the deposit.
    #[payable]
    pub fn nft_mint(&mut self) -> Promise {
        require!(!self.paused, "minting is paused");
        require!(self.catalog_loaded == TOTAL, "catalog not loaded");
        require!(self.minted + self.pending < TOTAL, "sold out");
        let deposit = env::attached_deposit();
        require!(deposit >= PRICE, "attach 2 NEAR to hatch");
        let buyer = env::predecessor_account_id();
        if let Some(limit) = self.max_per_account {
            let count = self.minted_by.get(&buyer).copied().unwrap_or(0);
            require!(count < limit, "mint limit reached for this account");
            self.minted_by.insert(buyer.clone(), count + 1);
        }
        // proceeds (minus the storage reserve) accrue for distribute()
        let (team, stakers, buyback) = split(PRICE.saturating_sub(STORAGE_RESERVE).as_yoctonear());
        self.accrued.team = U128(self.accrued.team.0 + team);
        self.accrued.stakers = U128(self.accrued.stakers.0 + stakers);
        self.accrued.buyback = U128(self.accrued.buyback.0 + buyback);
        let ticket_id = self.next_ticket;
        self.next_ticket += 1;
        self.pending += 1;
        self.tickets.insert(ticket_id, Ticket { buyer: buyer.clone(), block_height: env::block_height() });
        let excess = deposit.saturating_sub(PRICE);
        if !excess.is_zero() {
            Promise::new(buyer).transfer(excess).detach();
        }
        Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_REVEAL).with_unused_gas_weight(1).on_reveal(ticket_id)
    }

    /// The draw, in a receipt after the mint's block. Private: only the contract schedules it.
    #[private]
    pub fn on_reveal(&mut self, ticket_id: u64) -> Token {
        self.internal_reveal(ticket_id)
    }

    /// Fallback when `on_reveal` didn't run (e.g. out of gas): anyone may finish a ticket from an earlier block.
    pub fn reveal(&mut self, ticket_id: u64) -> Token {
        let ticket = self.tickets.get(&ticket_id).unwrap_or_else(|| env::panic_str("no such ticket"));
        require!(env::block_height() > ticket.block_height, "too early");
        self.internal_reveal(ticket_id)
    }

    fn internal_reveal(&mut self, ticket_id: u64) -> Token {
        let ticket = self.tickets.remove(&ticket_id).unwrap_or_else(|| env::panic_str("no such ticket"));
        let len = self.pool.len();
        require!(len > 0, "pool is empty");
        let index = draw_index(&env::random_seed(), ticket_id, len);
        let id = self.pool.swap_remove(index);
        let metadata = self.catalog.remove(&id).unwrap_or_else(|| env::panic_str("catalog entry missing"));
        let token = self.tokens.internal_mint_with_refund(id.to_string(), ticket.buyer, Some(metadata), None);
        NftMint { owner_id: &token.owner_id, token_ids: &[&token.token_id], memo: None }.emit();
        self.pending -= 1;
        self.minted += 1;
        token
    }

    // ---------- views ----------

    pub fn drop_status(&self) -> DropStatus {
        DropStatus {
            minted: self.minted,
            total: TOTAL,
            pending: self.pending,
            price: U128(PRICE.as_yoctonear()),
            paused: self.paused,
            sold_out: self.minted + self.pending >= TOTAL,
            catalog_loaded: self.catalog_loaded,
            max_per_account: self.max_per_account,
            metadata_frozen: self.metadata_frozen,
        }
    }

    pub fn ticket(&self, ticket_id: u64) -> Option<Ticket> {
        self.tickets.get(&ticket_id).cloned()
    }

    pub fn accrued(&self) -> Accrued {
        self.accrued.clone()
    }

    pub fn treasuries(&self) -> Treasuries {
        self.treasuries.clone()
    }

    pub fn provenance(&self) -> String {
        self.provenance.clone()
    }

    pub fn owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    // ---------- payouts ----------

    /// Pays the accrued shares to the 3 treasuries. Anyone may call it.
    pub fn distribute(&mut self) {
        let Accrued { team, stakers, buyback } = std::mem::take(&mut self.accrued);
        for (account, amount) in [
            (self.treasuries.team.clone(), team.0),
            (self.treasuries.stakers.clone(), stakers.0),
            (self.treasuries.buyback.clone(), buyback.0),
        ] {
            if amount > 0 {
                Promise::new(account).transfer(NearToken::from_yoctonear(amount)).detach();
            }
        }
    }

    // ---------- owner ----------

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
    }

    /// Load catalog entries (batches). Only before `freeze_metadata`; an id can't be loaded twice.
    pub fn load_catalog(&mut self, entries: Vec<CatalogEntry>) -> u16 {
        self.assert_owner();
        require!(!self.metadata_frozen, "metadata is frozen");
        for CatalogEntry { token_id, metadata } in entries {
            require!((1..=TOTAL).contains(&token_id), "token id out of range");
            require!(!self.catalog.contains_key(&token_id), "token id already loaded");
            self.catalog.insert(token_id, metadata);
            self.catalog_loaded += 1;
        }
        self.catalog_loaded
    }

    pub fn set_base_uri(&mut self, base_uri: String) {
        self.assert_owner();
        require!(!self.metadata_frozen, "metadata is frozen");
        self.metadata.base_uri = Some(base_uri);
    }

    /// One way: base_uri, catalog and treasuries can't change any more.
    pub fn freeze_metadata(&mut self) {
        self.assert_owner();
        self.metadata_frozen = true;
    }

    pub fn set_treasuries(&mut self, treasuries: Treasuries) {
        self.assert_owner();
        require!(!self.metadata_frozen, "metadata is frozen");
        self.treasuries = treasuries;
    }

    pub fn pause(&mut self) {
        self.assert_owner();
        self.paused = true;
    }

    pub fn unpause(&mut self) {
        self.assert_owner();
        self.paused = false;
    }

    /// `None` = no limit (the default, owner decision 2026-11-09).
    pub fn set_max_per_account(&mut self, max_per_account: Option<u32>) {
        self.assert_owner();
        self.max_per_account = max_per_account;
    }

    pub fn set_owner(&mut self, owner_id: AccountId) {
        self.assert_owner();
        self.owner_id = owner_id;
    }

    /// Withdraw what is above storage + accrued proceeds (e.g. faucet top-ups, unused reserves).
    pub fn withdraw_surplus(&mut self, amount: U128, receiver_id: Option<AccountId>) -> Promise {
        self.assert_owner();
        let locked = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128).as_yoctonear()
            + self.accrued.team.0
            + self.accrued.stakers.0
            + self.accrued.buyback.0;
        let free = env::account_balance().as_yoctonear().saturating_sub(locked);
        require!(amount.0 <= free, format!("only {} yoctoNEAR is free", free));
        Promise::new(receiver_id.unwrap_or_else(|| self.owner_id.clone())).transfer(NearToken::from_yoctonear(amount.0))
    }

    // ---------- NEP-199 royalty ----------

    pub fn nft_payout(&self, token_id: TokenId, balance: U128, max_len_payout: Option<u32>) -> Payout {
        let owner = self.tokens.owner_by_id.get(&token_id).unwrap_or_else(|| env::panic_str("Token not found"));
        self.payout_for(owner, balance.0, max_len_payout)
    }

    #[payable]
    pub fn nft_transfer_payout(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        balance: U128,
        max_len_payout: Option<u32>,
    ) -> Payout {
        assert_one_yocto();
        let sender_id = env::predecessor_account_id();
        let (previous_owner, approvals) =
            self.tokens.internal_transfer(&sender_id, &receiver_id, &token_id, approval_id, memo);
        if let Some(approvals) = approvals {
            refund_approved_account_ids(previous_owner.clone(), &approvals).detach();
        }
        self.payout_for(previous_owner, balance.0, max_len_payout)
    }

    fn payout_for(&self, owner: AccountId, balance: u128, max_len_payout: Option<u32>) -> Payout {
        let royalty = balance * ROYALTY_BPS / 10_000;
        let mut payout = HashMap::new();
        if royalty > 0 && owner != self.royalty_account {
            require!(max_len_payout.unwrap_or(2) >= 2, "max_len_payout too small");
            payout.insert(self.royalty_account.clone(), U128(royalty));
            payout.insert(owner, U128(balance - royalty));
        } else {
            payout.insert(owner, U128(balance));
        }
        Payout { payout }
    }
}

// ---------- standards (near-contract-standards) ----------

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo);
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl NonFungibleTokenApproval for Contract {
    #[payable]
    fn nft_approve(&mut self, token_id: TokenId, account_id: AccountId, msg: Option<String>) -> Option<Promise> {
        self.tokens.nft_approve(token_id, account_id, msg)
    }

    #[payable]
    fn nft_revoke(&mut self, token_id: TokenId, account_id: AccountId) {
        self.tokens.nft_revoke(token_id, account_id);
    }

    #[payable]
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        self.tokens.nft_revoke_all(token_id);
    }

    fn nft_is_approved(&self, token_id: TokenId, approved_account_id: AccountId, approval_id: Option<u64>) -> bool {
        self.tokens.nft_is_approved(token_id, approved_account_id, approval_id)
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.clone()
    }
}

#[cfg(test)]
mod tests;
