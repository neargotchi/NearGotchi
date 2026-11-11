# Drop 1 on NEAR mainnet: runbook (no Ledger)

For the owner. **Real NEAR, unaudited contract.** Nothing in the repo has sent anything to mainnet: every step below is
yours. Never paste a seed phrase or private key anywhere: not in a chat, the repo, an issue, a `.env` file or a shell
command line (shell history keeps it). The only places a seed phrase goes: paper, and the hidden prompt of a wallet or
of near-cli-rs on your own computer.

Contract: `contracts/drop1`. Split: **50 % team / 50 % holder rewards** (per mint: 2 NEAR − 0.01 NEAR storage reserve =
1.99 NEAR → 0.995 team, 0.995 to the tokens minted before this payment, equally; first mint and rounding dust → team).
Limit **5 mints per account** (set in `new`). Review: `docs/REPORT.md` → DONE: 067. No Ledger (owner decision, task 069):
a fresh project account with its seed phrase on paper; ownership can move to a Ledger later (optional step L).

## Accounts

| role | account | what it does | funds |
|---|---|---|---|
| **OWNER** | a fresh project account, e.g. `neargotchi.near`, created in Meteor or MyNearWallet; seed phrase on paper only | after step 10 the contract's `owner`: `pause` / `unpause`, `set_team`, `withdraw_surplus`, `set_max_per_account`, `propose_owner`. Pays for creating the contract account. | ≥ 11 NEAR before step 4 (8 for the contract, 2 for the test mint, gas) |
| **CONTRACT** | `drop1.OWNER.near` (sub-account of OWNER, so nobody can squat the name) | the drop contract. Its own key exists only during setup (macOS keychain) and is deleted in step 11. | 8 NEAR, sent by OWNER in step 4 |
| **TEAM** | OWNER itself **or** a separate account of yours | receives the team half via `distribute()` and the 5 % royalty | none needed |

No buyback / stakers / burn accounts: they don't exist in this contract.

TEAM = OWNER: one account and one seed to guard, simplest. TEAM = separate account (recommended if you can keep a second
seed safe): money and admin rights are split, so a leaked owner key can pause the sale or redirect *future* team income
with `set_team`, but can't spend what TEAM already received; the team account can be one you rarely use online (it only
receives). `set_team` (owner) can switch it later; it never touches the holders' half.

## Before you start: tools and variables

```sh
near --version || echo "near-cli-rs missing"
```
near-cli-rs (the `near` command) is not installed by this repo (it was not installed on the machine this runbook was
written on, so the commands were checked against docs.near.org/tools/cli and the near-cli-rs guide, not executed).
Install it with one of: `brew install near` · `npm install -g near-cli-rs@latest` · `cargo install near-cli-rs` · or the
installer script from https://github.com/near/near-cli-rs/releases. Running plain `near` opens an interactive menu that
builds the same commands step by step: use it whenever a command below is rejected by your version.

near-cli-rs's default mainnet RPC may be the deprecated `rpc.mainnet.near.org` (it answers HTTP 429). Check and switch:
```sh
near config show-connections
near config edit-connection mainnet --key rpc_url --value https://free.rpc.fastnear.com
```

Set the names **once** per terminal session and use the variables below: this is the main protection against typos.
```sh
export NET=mainnet
export OWNER=neargotchi.near            # your project account, exactly as the wallet shows it
export CONTRACT=drop1.$OWNER
export TEAM=$OWNER                      # or your separate team account
echo "$NET | owner $OWNER | contract $CONTRACT | team $TEAM"   # read it twice
```

Preflight (read-only, sends nothing; run it before step 4 and after every step from 5 on):
```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM
```
It checks that the accounts exist on that network and have enough NEAR, that the local wasm, `init.json` and the six
`catalog-*.json` exist with the expected sizes and content, and once deployed: code hash = local build, owner, team,
limit 5, pause / freeze / base_uri / catalog state, and how many keys the contract account still has. Exit code 1 if
anything FAILs. Dry run on testnet: `python3 scripts/mainnet_preflight.py --network testnet --owner neargotchi-admin-ng67.testnet --contract neargotchi-drop1-ng67.testnet --team neargotchi-team-ng67.testnet --owner-min 1 --skip-local`.

## Signing without a Ledger

Two keys sign in this runbook, both kept in the **macOS keychain** by near-cli-rs (`sign-with-keychain`), never in a file:

1. **CONTRACT's temporary key** (steps 4–11): created by `autogenerate-new-keypair save-to-keychain` in step 4, deleted
   in step 11. It signs deploy, `load_catalog`, `set_base_uri`, `freeze_metadata`, `unpause`/`pause` around the test
   mint, and `propose_owner`. The contract is its own owner until step 10.
2. **OWNER's key**, for the few owner transactions (creating CONTRACT, the test mint, `accept_owner`, later `pause` /
   `unpause`). Two ways, pick one:
   - **(a) recommended, own CLI key:** `near account import-account using-web-wallet network-config mainnet` — a
     MyNearWallet page asks you to approve a *new* full-access key for the CLI on this Mac (saved in the keychain). Your
     seed phrase is never typed in the terminal, and that key can be removed later on its own (see hygiene). If OWNER
     lives in Meteor only: import it into MyNearWallet in a separate browser profile, or use (b).
   - **(b) seed phrase at the CLI prompt:** run `near account import-account using-seed-phrase network-config mainnet`
     **without** the phrase on the command line, so the interactive prompt asks for it (nothing lands in shell history).
     The key derived from the seed is then in the keychain.
   - Check: `near account list-keys $OWNER network-config $NET now` lists the key; in Keychain Access the entry is
     under "near-cli".

Every transaction command below ends with `network-config $NET sign-with-keychain send`. Replace `send` with `display`
to print the signed transaction without sending it. Arguments are passed as `json-args "$(cat file.json)"`, which works
in every version (no file is uploaded anywhere, the shell inserts the JSON).

## 0. Decide before you start

| decision | recommendation | why now |
|---|---|---|
| media: PNG or WebP | **PNG** (1024 px, `images/drop1`, 154.5 MB) | `media` = `{id}.png` and `media_hash` = sha256 of the PNG go into the contract with `load_catalog` (step 6) and can't be changed afterwards, not even before the freeze. WebP = regenerate metadata + hashes before step 5. |
| gateway in `base_uri` | `https://ipfs.io/ipfs/<CID>` (no trailing slash) | NEP-177 `base_uri` is an https gateway; wallets build `base_uri + "/" + media`. Changeable until step 9. |
| TEAM | see "Accounts" | `init.json` contains it. |

## 1. Costs (measured: sandbox CI run 43052461862, testnet ng67)

| item | bytes | NEAR (1 B = 0.00001 NEAR) |
|---|---|---|
| wasm + account (code) | 376 168 | 3.76 |
| after `new` | 390 747 | 3.91 |
| catalog (300 entries, 313 B/token) | +93 972 | +0.94 → **4.85** before the first mint |
| each mint (token + checkpoint + per-account counter) | +357 … +526 | covered by the 0.01 NEAR kept per mint |
| after 300 mints | 591 895 | **5.92** |

CONTRACT gets **8 NEAR**. OWNER needs **≥ 11 NEAR** before step 4 (8 + 2 for the test mint + gas; the test mint's
1.99 NEAR goes to TEAM via `distribute`, since it is the first mint). Gas: deploy ≈ 0.01 NEAR, each `load_catalog`
≈ 14–16 Tgas, a mint 7.5–11.7 Tgas.

## 2. Build and check the code

```sh
cd contracts/drop1 && ./build.sh && shasum -a 256 res/neargotchi_drop1.wasm && cargo test --lib && cd ../..
```
34 unit tests must pass; the sandbox suite runs in GitHub Actions (`contract-drop1`): the last run on the commit you
deploy must be green. Write the sha256 down (step 5 compares it on chain; the preflight does it for you).

## 3. Images to IPFS (Pinata, by hand)

```sh
python3 scripts/ipfs_drop1.py prepare        # → ipfs/drop1/: 300 × {id}.png + {id}.json, every PNG checked against media_hash
```
Upload the **folder** `ipfs/drop1` to Pinata (Upload → Folder) so the CID is the folder and `<CID>/1.png` works. Then:
```sh
python3 scripts/ipfs_drop1.py verify-url https://ipfs.io/ipfs/<CID>
python3 scripts/ipfs_drop1.py verify-url https://gateway.pinata.cloud/ipfs/<CID> 30
```
Both must print `ok`. Keep the pin (unpinning later breaks the images).

## 4. Create the contract account (OWNER pays 8 NEAR)

```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM --skip-local
#   owner exists with ≥ 11 NEAR; contract "does not exist (fine before step 4)"
near account create-account fund-myself $CONTRACT '8 NEAR' autogenerate-new-keypair save-to-keychain \
  sign-as $OWNER network-config $NET sign-with-keychain send
near account view-account-summary $CONTRACT network-config $NET now     # 8 NEAR, no contract, 1 access key
```

## 5. Deploy + init (one transaction)

```sh
python3 scripts/mainnet_args.py --owner $CONTRACT --team $TEAM --base-uri https://ipfs.io/ipfs/<CID>
#  → contracts/drop1/res/mainnet/init.json (owner = the contract during setup, limit 5, provenance) + catalog-1..6.json
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM      # local files all OK

near contract deploy $CONTRACT use-file contracts/drop1/res/neargotchi_drop1.wasm \
  with-init-call new json-args "$(cat contracts/drop1/res/mainnet/init.json)" \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config $NET sign-with-keychain send
```
Verify:
```sh
near account view-account-summary $CONTRACT network-config $NET now   # "Contract (SHA-256 checksum hex)" = the hash from step 2
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM
#   code hash == local build; drop_status paused True, catalog 0/300, limit 5; owner() = the contract; team() = TEAM
```

## 6. Load the metadata (6 transactions)

```sh
for i in 1 2 3 4 5 6; do
  near contract call-function as-transaction $CONTRACT load_catalog json-args "$(cat contracts/drop1/res/mainnet/catalog-$i.json)" \
    prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send || break
  near contract call-function as-read-only $CONTRACT drop_status json-args '{}' network-config $NET now
done
```
`catalog_loaded` must go 50, 100, …, 300. If one batch fails, the loop stops: re-send **only** the missing batch
(batch k = ids 50·(k−1)+1 … 50·k; `catalog_loaded` tells you where it stopped). Re-sending a batch that is already in
fails with "token id already loaded" and changes nothing.

## 7. base_uri

Set in step 5 if you passed `--base-uri`. To set / change it (only until step 9):
```sh
near contract call-function as-transaction $CONTRACT set_base_uri json-args '{"base_uri":"https://ipfs.io/ipfs/<CID>"}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
near contract call-function as-read-only $CONTRACT nft_metadata json-args '{}' network-config $NET now
```

## 8. Test mint (paused except for a few seconds)

```sh
near contract call-function as-transaction $CONTRACT unpause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $CONTRACT network-config $NET sign-with-keychain send
near contract call-function as-transaction $CONTRACT nft_mint json-args '{}' prepaid-gas '100.0 Tgas' attached-deposit '2 NEAR' \
  sign-as $OWNER network-config $NET sign-with-keychain send
near contract call-function as-transaction $CONTRACT pause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $CONTRACT network-config $NET sign-with-keychain send
```
Check: the mint result shows a token; `drop_status` → minted 1, pending 0, paused true; `accrued` → team 1.99 NEAR;
`nft_token {"token_id":"<id>"}` → `media` `<id>.png`; `https://ipfs.io/ipfs/<CID>/<id>.png` opens; the token shows in
your wallet's NFT tab with its image.

## 9. Freeze the metadata (irreversible)

```sh
near contract call-function as-transaction $CONTRACT freeze_metadata json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $CONTRACT network-config $NET sign-with-keychain send
```
Preflight: `frozen True`, `base_uri` = your gateway URL.

## 10. Ownership to OWNER (two steps)

```sh
near contract call-function as-transaction $CONTRACT propose_owner json-args "{\"owner_id\":\"$OWNER\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
near contract call-function as-read-only $CONTRACT proposed_owner json-args '{}' network-config $NET now   # must print OWNER exactly
near contract call-function as-transaction $CONTRACT accept_owner json-args '{}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
near contract call-function as-read-only $CONTRACT owner json-args '{}' network-config $NET now           # OWNER
```
A typo in `propose_owner` is harmless: nobody can accept it; propose again with the right name.

## 11. Delete the contract account's key (makes the code final)

Whoever holds a full-access key of CONTRACT can deploy different code and take everything in it, holders' rewards
included. The contract has no upgrade method on purpose. Delete the key **before** going live:
```sh
near account list-keys $CONTRACT network-config $NET now
near account delete-keys $CONTRACT public-keys ed25519:<the key from list-keys> network-config $NET sign-with-keychain send
near account list-keys $CONTRACT network-config $NET now      # must be empty
```
After this nobody (you included) can change the code; a bug found later is handled with `pause` + a new contract (see
"Rollback"). Preflight: "contract account has 0 access key(s) — code is final". If you decide not to delete it, say so
publicly (README / site): holders then have to trust whoever holds that key.

## 12. Front (production = mainnet: one deployment)

The public site (https://neargochi.vercel.app) becomes the mainnet build; judges try it without real funds locally
(README → "Try it without real funds"). Vercel → Environment Variables (Production, and Preview to test first):
```
NEXT_PUBLIC_CHAIN=mainnet
NEXT_PUBLIC_DROP1_CONTRACT=drop1.OWNER.near
NEXT_PUBLIC_TREASURY=TEAM.near           # snack / energy-pack payments go here (real NEAR)
NEAR_AI_API_KEY=...                       # server-only, as on testnet
# optional: NEXT_PUBLIC_RPC_URL=https://a,https://b  (tried first; the built-in free list follows)
```
Without the two account variables a mainnet build refuses to open the wallet. Check on the preview URL: header shows
"mainnet", /mint shows `1 / 300` and the "unaudited contract. real funds." box, hatch stays disabled until the checkbox
is ticked; /pet with OWNER connected shows the test token and "holder rewards".

RPC (task 068): the site reads through free key-less endpoints (FastNear, dRPC, ZAN, Intear; `rpc.mainnet.near.org` is
deprecated). If you ever buy a keyed plan, never put the key in a `NEXT_PUBLIC_` variable: add a server route that
forwards JSON-RPC with the key from a server-only variable and put that route first in `NEXT_PUBLIC_RPC_URL`.

## 13. Go live

```sh
python3 scripts/mainnet_preflight.py --network $NET --owner $OWNER --contract $CONTRACT --team $TEAM   # all OK, 0 keys
near contract call-function as-transaction $CONTRACT unpause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $OWNER network-config $NET sign-with-keychain send
```
On https://nearblocks.io/address/drop1.OWNER.near: code hash, no access keys, the first public mint. Mint one from the
live site with a second account (≥ 2.1 NEAR) and check that your test token now has ≈ 0.995 NEAR in `pending_rewards`.

## 14. Running it

- **Team payout:** anyone may call `distribute` (it can only pay TEAM):
  `near contract call-function as-transaction $CONTRACT distribute json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send`
- **Holder rewards:** holders claim on /pet (stats tab → claim) or `claim_rewards {"token_ids":["12"]}`. Views:
  `pending_rewards {"token_id":"12"}`, `pending_rewards_for_owner {"account_id":"x.near"}`, `accrued`.
- **Stuck ticket** (`drop_status.pending` > 0 for minutes, a buyer attached too little gas): anyone finishes it with
  `reveal {"ticket_id":N}` (the token goes to the buyer; `ticket {"ticket_id":N}` shows who paid).
- **Limit:** `set_max_per_account {"max_per_account":5}` (owner). A speed bump, not Sybil protection.

## Owner key hygiene

- **Seed phrase on paper only** (two copies, two places). Never photographed, never in a cloud note or a password manager
  synced to the phone you use for everything, never typed into any site other than the wallet it belongs to.
- **Separate computer, or at least a separate browser profile** for the project account: no other extensions, no
  everyday browsing in it. Sign out of the wallet when done.
- **The owner key does as little as possible:** after step 13 it is only needed for `pause` / `unpause` / `set_team` /
  `withdraw_surplus`. `distribute` can be called by anyone (it always pays TEAM).
- **Move the team's earnings regularly:** call `distribute`, then send what TEAM received to your main account every few
  days, so a leaked project key exposes little.
- **The CLI key:** if you used (a) `using-web-wallet`, remove that key once the launch is done
  (`near account list-keys $OWNER …` first, then `near account delete-keys $OWNER public-keys ed25519:<the CLI key> …` —
  make sure it is the CLI key, not the wallet's). Import again when you need the CLI.
- **Never** put the owner seed or key in the repo, `.env`, a script, a CI secret or a chat message.
- **After the hackathon:** move ownership to a Ledger (step L).

## Optional later: L. Ownership to a Ledger

1. Set up a Ledger account (`LEDGER.near`) with a little NEAR for gas.
2. `propose_owner {"owner_id":"LEDGER.near"}` signed by OWNER; check `proposed_owner`.
3. `accept_owner` signed with `sign-as LEDGER.near network-config mainnet sign-with-ledger send`.
4. `owner` → LEDGER.near. From then on OWNER has no rights on the contract; optionally `set_team` to a Ledger account.

## Where it is easy to make a mistake (and how to catch it)

| step | mistake | how it shows / how to check |
|---|---|---|
| any | typo in an account name (e.g. `neargochi` vs `neargotchi`) | use `$OWNER` / `$CONTRACT` / `$TEAM` and `echo` them; preflight FAILs on accounts that don't exist or have the wrong suffix |
| any | wrong network (`testnet` in a mainnet command or the reverse) | `$NET` everywhere; a `.testnet` account on mainnet = preflight FAIL; `near config show-connections` |
| any | near-cli-rs talks to the deprecated RPC (429) | `near config edit-connection mainnet --key rpc_url --value https://free.rpc.fastnear.com` |
| any | seed phrase typed as a command argument | it stays in `~/.zsh_history`: use the interactive prompt; if it happened, remove the line from the history file |
| 4 | OWNER not funded / too little | preflight "need ≥ 11"; create-account fails with "not enough balance" and nothing is created |
| 4 | contract name not a sub-account of OWNER | preflight WARN; `fund-myself` of `drop1.OWNER.near` must be signed by `$OWNER` |
| 5 | init with the wrong team / owner / no limit | preflight compares `init.json` with your variables before the deploy, and `team()` / `owner()` / limit after it |
| 5 | deploying a different wasm than the tested one | code hash on chain vs local build (preflight) |
| 6 | 6 × `load_catalog`: one fails, or a batch is sent twice | `drop_status.catalog_loaded` after each (the loop prints it); re-send only the missing batch; the sale can't start before 300/300 ("catalog not loaded") |
| 7–9 | freeze with the wrong `base_uri` | `nft_metadata` + open an image URL before step 9; after the freeze it can't be fixed |
| 8 | forgetting to `pause` after the test mint | preflight shows `paused`; step 13 is the only `unpause` that should stay |
| 10 | `propose_owner` with a typo | `proposed_owner` view before `accept_owner`; a wrong proposal can't be accepted, propose again |
| 11 | deleting the key before the setup is finished | do steps 6–10 first; after 11 the contract can't sign for itself any more |
| 11 | deleting the wrong key (on OWNER instead of CONTRACT) | the command names `$CONTRACT`; `list-keys $CONTRACT` before and after |
| 12 | front points at the wrong contract / testnet | the preview deployment shows "mainnet" and the right counter before you switch production |

## Rollback / incident plan

| situation | action | what it does / doesn't |
|---|---|---|
| anything wrong in the sale (front bug, wrong image, exploit suspicion) | `pause` (OWNER) | stops `nft_mint` only. Reveals of paid tickets, `claim_rewards`, `distribute`, transfers keep working. |
| wrong `base_uri` before step 9 | `set_base_uri` | after `freeze_metadata` impossible |
| wrong team account | `set_team` (OWNER) | any time, also after the freeze; only redirects the team half |
| money sent to the contract by mistake, bounced refunds | `withdraw_surplus {"amount":"<yocto>"}` (OWNER) | only what is above `locked_balance()` = storage + unpaid team share + unclaimed holder rewards + 0.01 NEAR × unminted tokens |
| bug in the contract after step 11 | `pause`, announce, new contract on a **new** account for future sales | the old contract can't be changed; tokens and their rewards stay claimable; mints can't be refunded |
| owner key leaked | at once: `propose_owner` to a fresh account and `accept_owner` from it; `set_team` if TEAM = OWNER; move TEAM's funds | it is a race: the attacker can do the same `propose_owner` to themselves. Until then they can pause/unpause, change the team account (future team share), the limit and `withdraw_surplus` (surplus only); never take holders' rewards or the storage reserve, never change the code (step 11) |
| owner seed lost | nothing on chain helps | the owner can't be recovered. Holders still claim; the team share still reaches TEAM via `distribute` (anyone can call it) |
