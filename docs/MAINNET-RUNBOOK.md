# Drop 1 on NEAR mainnet: runbook

For the owner. **Real NEAR, unaudited contract.** Nothing in the repo has sent anything to mainnet: every step below is
yours, signed with your Ledger / wallet. Never paste a seed phrase or private key anywhere (chat, repo, issue, `.env`).

Contract: `contracts/drop1` (commit `6cf910f` and later). Split: **50 % team / 50 % holder rewards** (per mint:
2 NEAR − 0.01 NEAR storage reserve = 1.99 NEAR → 0.995 team, 0.995 to the tokens minted before this payment, equally;
first mint and rounding dust → team). Limit **5 mints per account** (set in `new`). Review: `docs/REPORT.md` → DONE: 067.

Commands use **near-cli-rs** (`cargo install near-cli-rs --locked`, or the installer from its GitHub releases).
Running plain `near` opens an interactive builder that produces the same commands, use it if a flag below was renamed in your version.
Placeholders: `YOU.near` = your Ledger account (admin, owner after step 10), `drop1.YOU.near` = the contract,
`TEAM.near` = the account that receives the team half and the 5 % royalty (may be `YOU.near`), `<CID>` = the IPFS folder.

## 0. Decide before you start

| decision | recommendation | why it must be decided now |
|---|---|---|
| media: PNG or WebP | **PNG** (1024 px, `images/drop1`, 154.5 MB) | every token's `media` = `{id}.png` and `media_hash` = sha256 of the PNG are in `metadata/drop1` and go into the contract with `load_catalog`. Loaded entries can't be changed (not even before the freeze). WebP would mean regenerating metadata + hashes **before step 6**. |
| gateway in `base_uri` | `https://ipfs.io/ipfs/<CID>` (no trailing slash) | NEP-177 `base_uri` is an https gateway; wallets build `base_uri + "/" + media`. Can be changed until `freeze_metadata`. |
| team account | an account you control with a Ledger | receives `distribute()` and the royalty; changeable later with `set_team` (owner only, only the team half). |
| contract account name | `drop1.YOU.near` (sub-account) | the front's `NEXT_PUBLIC_DROP1_CONTRACT`. |

## 1. Costs (measured in the sandbox, CI run 43052461862, and on testnet ng67)

| item | bytes | NEAR (1 B = 0.00001 NEAR) |
|---|---|---|
| wasm + account (code) | 376 168 | 3.76 |
| after `new` | 390 747 | 3.91 |
| catalog (300 entries, 313 B/token) | +93 972 | +0.94 → **4.85** before the first mint |
| each mint (token + checkpoint + per-account counter) | +357 (sandbox) … +526 (first testnet mint) | +0.0036 … 0.0053, covered by the 0.01 reserve kept per mint |
| after 300 mints | 591 895 | **5.92** |

Fund the contract account with **8 NEAR** (4.85 needed at once, the rest headroom; `withdraw_surplus` can take back what is
above `locked_balance()` later). Gas: deploy ≈ 0.01 NEAR, each `load_catalog` ≈ 14–16 Tgas (≈ 0.0015 NEAR), a mint
7.5–11.7 Tgas. Plus **2 NEAR** for your own test mint (step 8; as the first mint its whole 1.99 NEAR goes to the team).

## 2. Build and check the code (on your machine)

```sh
cd contracts/drop1
./build.sh                       # → res/neargotchi_drop1.wasm
shasum -a 256 res/neargotchi_drop1.wasm   # write this down: you compare it on chain in step 5
cargo test --lib                 # 34 unit tests
```
The sandbox suite (300 mints, rewards, limit, transfer) runs in GitHub Actions (`contract-drop1`); make sure the last run on
the commit you deploy is green. Build output depends on the toolchain: the hash that counts is the one of the file you deploy.

## 3. Images to IPFS (Pinata, by hand)

```sh
python3 scripts/ipfs_drop1.py prepare        # → ipfs/drop1/: 300 × {id}.png + {id}.json, every PNG checked against media_hash
```
Upload the **folder** `ipfs/drop1` to Pinata (Upload → Folder), so the CID is the folder and `<CID>/1.png` works. Then:
```sh
python3 scripts/ipfs_drop1.py verify-url https://ipfs.io/ipfs/<CID>        # 14 tokens incl. #1 and #300, sha256 = media_hash
python3 scripts/ipfs_drop1.py verify-url https://gateway.pinata.cloud/ipfs/<CID> 30
```
Both must print `ok`. Keep the pin (Pinata free plan is enough for 155 MB; unpinning later breaks the images).

## 4. Accounts

```sh
# the contract account, funded 8 NEAR by your Ledger account; its key goes to the macOS keychain (deleted in step 11)
near account create-account fund-myself drop1.YOU.near '8 NEAR' autogenerate-new-keypair save-to-keychain \
  sign-as YOU.near network-config mainnet sign-with-ledger send
```
`TEAM.near`: an existing account (can be `YOU.near`). No other accounts: there are no buyback / stakers treasuries.

Why the contract account (keychain key) is the owner during setup: `load_catalog` arguments are ~24 KB each, which a
Ledger may refuse or need blind signing for. The big setup transactions are signed by the temporary key; ownership then
moves to your Ledger account (step 10) and the temporary key is deleted (step 11).

## 5. Deploy + init (one transaction)

```sh
python3 scripts/mainnet_args.py --owner drop1.YOU.near --team TEAM.near --base-uri https://ipfs.io/ipfs/<CID>
# → contracts/drop1/res/mainnet/init.json (limit 5, provenance) + catalog-1..6.json

near contract deploy drop1.YOU.near use-file contracts/drop1/res/neargotchi_drop1.wasm \
  with-init-call new file-args contracts/drop1/res/mainnet/init.json \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-keychain send

near account view-account-summary drop1.YOU.near network-config mainnet now
```
Check: the contract's SHA-256 in the summary = the hash from step 2. Then:
```sh
near contract call-function as-read-only drop1.YOU.near drop_status json-args '{}' network-config mainnet now
#   paused: true, catalog_loaded: 0, max_per_account: 5, metadata_frozen: false
near contract call-function as-read-only drop1.YOU.near owner json-args '{}' network-config mainnet now   # drop1.YOU.near
near contract call-function as-read-only drop1.YOU.near team json-args '{}' network-config mainnet now    # TEAM.near
```

## 6. Load the metadata (6 transactions)

```sh
for i in 1 2 3 4 5 6; do
  near contract call-function as-transaction drop1.YOU.near load_catalog file-args contracts/drop1/res/mainnet/catalog-$i.json \
    prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as drop1.YOU.near network-config mainnet sign-with-keychain send
done
near contract call-function as-read-only drop1.YOU.near drop_status json-args '{}' network-config mainnet now   # catalog_loaded: 300
```
A batch that fails can be re-sent; an id that is already loaded makes the whole batch fail ("token id already loaded"),
so re-send only the batch that is missing (`catalog_loaded` tells you how many are in).

## 7. base_uri

If you passed `--base-uri` in step 5 it is already set. Otherwise / to change it (only until step 9):
```sh
near contract call-function as-transaction drop1.YOU.near set_base_uri json-args '{"base_uri":"https://ipfs.io/ipfs/<CID>"}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as drop1.YOU.near network-config mainnet sign-with-keychain send
near contract call-function as-read-only drop1.YOU.near nft_metadata json-args '{}' network-config mainnet now
```

## 8. Test mint (paused the whole time except a few seconds)

```sh
near contract call-function as-transaction drop1.YOU.near unpause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as drop1.YOU.near network-config mainnet sign-with-keychain send
near contract call-function as-transaction drop1.YOU.near nft_mint json-args '{}' prepaid-gas '100.0 Tgas' attached-deposit '2 NEAR' \
  sign-as YOU.near network-config mainnet sign-with-ledger send
near contract call-function as-transaction drop1.YOU.near pause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as drop1.YOU.near network-config mainnet sign-with-keychain send
```
Check: the mint result shows a token; `drop_status` → minted 1, pending 0, paused true; `accrued` → team 1.99 NEAR
(first mint: no earlier holder); `nft_token` of that id → `media` `{id}.png`; open `https://ipfs.io/ipfs/<CID>/{id}.png`;
the token appears in your wallet (Meteor / MyNearWallet NFT tab) with the image; on nearblocks the `nft_mint` event.

## 9. Freeze the metadata (irreversible)

```sh
near contract call-function as-transaction drop1.YOU.near freeze_metadata json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as drop1.YOU.near network-config mainnet sign-with-keychain send
```
After this `base_uri` and the catalog never change (`metadata_frozen: true`).

## 10. Ownership to the Ledger (two steps)

```sh
near contract call-function as-transaction drop1.YOU.near propose_owner json-args '{"owner_id":"YOU.near"}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as drop1.YOU.near network-config mainnet sign-with-keychain send
near contract call-function as-transaction drop1.YOU.near accept_owner json-args '{}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as YOU.near network-config mainnet sign-with-ledger send
near contract call-function as-read-only drop1.YOU.near owner json-args '{}' network-config mainnet now    # YOU.near
```

## 11. Delete the contract account's keys (makes the code final)

Whoever holds a full-access key of `drop1.YOU.near` can deploy different code and take everything in it (holders'
rewards included). The contract has no upgrade method on purpose. Delete the key **before** unpausing:
```sh
near account list-keys drop1.YOU.near network-config mainnet now
near account delete-keys drop1.YOU.near public-keys ed25519:<the key from list-keys> network-config mainnet sign-with-keychain send
near account list-keys drop1.YOU.near network-config mainnet now      # must be empty
```
After this nobody (you included) can change the code or touch the account outside the contract's own methods. A bug
found later can only be handled with `pause` + a new contract (see "Rollback"). If you decide **not** to delete the key,
say so publicly (README / site): holders then have to trust the key holder.

## 12. Front (production = mainnet: one deployment)

Owner decision: the public site (https://neargochi.vercel.app) becomes the mainnet build; there is no hosted testnet
copy. Judges try it without real funds locally (README → "Try it without real funds": demo or testnet mode).
Set the variables in Vercel (Production), redeploy, and only then announce. Environment variables:
```
NEXT_PUBLIC_CHAIN=mainnet
NEXT_PUBLIC_DROP1_CONTRACT=drop1.YOU.near
NEXT_PUBLIC_TREASURY=TEAM.near           # snack / energy-pack payments go here (real NEAR)
NEAR_AI_API_KEY=...                       # server-only, as on testnet
# optional: NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.near.org (the default)
```
Without the two account variables a mainnet build refuses to open the wallet (no defaults for mainnet). Check on a
preview deployment first (Vercel → the same variables on Preview), then on production: header shows "mainnet", /mint shows the counter `1 / 300` and the red "unaudited contract. real funds."
box; the hatch button stays disabled until the checkbox is ticked; /pet → stats tab shows "holder rewards".

## 13. Go live

```sh
near contract call-function as-transaction drop1.YOU.near unpause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as YOU.near network-config mainnet sign-with-ledger send
```
Verify on https://nearblocks.io/address/drop1.YOU.near: code hash, no access keys, `owner` = YOU.near, the first public
mint. Mint one from the live site with a second account (≥ 2.1 NEAR) and check that your test token now shows ≈ 0.995
NEAR in `pending_rewards`.

## 14. Running it

- **Team payout:** anyone may call `distribute` (it can only pay `TEAM.near`):
  `near contract call-function as-transaction drop1.YOU.near distribute json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as YOU.near network-config mainnet sign-with-ledger send`
- **Holder rewards:** holders claim on /pet (stats tab → claim), or `claim_rewards {"token_ids":["12","40"]}`. Views:
  `pending_rewards {"token_id":"12"}`, `pending_rewards_for_owner {"account_id":"x.near"}`, `accrued`, `reward_per_token`.
- **Stuck ticket** (a buyer attached too little gas, `drop_status.pending` > 0 for minutes): anyone finishes it with
  `reveal {"ticket_id":N}` (the token goes to the buyer). `ticket {"ticket_id":N}` shows who paid. The site doesn't call `reveal`.
- **Per-account limit:** `set_max_per_account {"max_per_account":5}` (owner; `null` = no limit). It is a speed bump, not
  Sybil protection: one person can use many accounts.

## Rollback / incident plan

| situation | action | what it does / doesn't |
|---|---|---|
| anything wrong in the sale (front bug, wrong image, exploit suspicion) | `pause` (owner, Ledger) | stops `nft_mint` only. Reveals of paid tickets, `claim_rewards`, `distribute`, transfers keep working, so holders are never locked out. |
| wrong `base_uri` before step 9 | `set_base_uri` | after `freeze_metadata` impossible. |
| wrong team account | `set_team` | works any time, also after the freeze; only redirects the team half. |
| money sent to the contract by mistake, refunds that bounced | `withdraw_surplus {"amount":"<yocto>"}` | only what is above `locked_balance()` = storage + unpaid team share + unclaimed holder rewards + 0.01 NEAR × unminted tokens. It can never take holders' rewards. |
| bug in the contract after step 11 | `pause`, announce, deploy a fixed contract on a **new** account for future sales | the old contract can't be changed: existing tokens and their rewards stay there, claimable. There is no way to refund mints. |
| lost Ledger | nothing on chain helps | the owner can't be recovered (two-step transfer only from the current owner). Holders still claim and the team share still goes to `TEAM.near` via `distribute`. Keep the Ledger seed backup offline. |
