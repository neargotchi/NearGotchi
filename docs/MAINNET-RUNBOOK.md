# Drop 1 on NEAR mainnet: runbook (no Ledger)

For the owner. **Real NEAR, unaudited contract.** Nothing in the repo has sent anything to mainnet: every step below is
yours. Never paste a seed phrase or private key anywhere: not in a chat, the repo, an issue, a `.env` file or a shell
command line (shell history keeps it). The only places a seed phrase goes: paper, and the hidden prompt of a wallet or
of near-cli-rs on your own computer.

Contract: `contracts/drop1`. Split: **50 % team / 50 % holder rewards** (per mint: 2 NEAR − 0.01 NEAR storage reserve =
1.99 NEAR → 0.995 team, 0.995 to the tokens minted before this payment, equally; first mint and rounding dust → team).
Limit **5 mints per account** (set in `new`). Review: `docs/REPORT.md` → DONE: 067. No Ledger (owner decision, task 069):
a fresh project account with its seed phrase on paper; ownership can move to a Ledger later (optional step L).

## Mainnet record (2026-11-12, done by the owner)

Accounts: OWNER `neargochi-dev.near`, CONTRACT **`drop1.neargochi-dev.near`**, TEAM `neargotchiai.near`. Code hash on chain
`D7z3DKfjddZ6XRRpQUX7BXSMzLn24wHtwFePtCFpArTM` = local `contracts/drop1/res/neargotchi_drop1.wasm` (sha256 `b41638a1…eb634`,
`cargo test --lib` 34/34). Letters = `docs/MAINNET-COMMANDS.md`; tx ids on https://nearblocks.io/txns/<id>.

| step | what | signer | tx | result |
|---|---|---|---|---|
| A (§4) | create CONTRACT, 8 NEAR | OWNER | `HdzS6EginreRQv7ec6aqCvvAd5L2Nwj3RZvkeLwgeBMV` | OK |
| B (§5) | deploy + `new` (limit 5, `base_uri` ipfs.io without `/`) | CONTRACT | `3sFbDP1A4FpriSzNaEQ4BC4P4StuJRiEkGVUtgWUe1xd` | OK |
| C (§6) | `load_catalog` 1…6 | CONTRACT | `FhNzwoGDCVfnyo2g44FYiNMtH4nKP9wcBZt1JFaX1D6T`, `HSZkgrYkC5JtofGUjfkHd7254RHJWhZ4wNXtcYYZUNgC`, `DGsacbkzasXzZ4zY8kEu7LHupmmt6vKavg384ARwvRrA`, `CdNnwFz5CWFwuKR1ZbUk1KuZB77aC947NNBCqX4Z4xfw`, `DS7xhiEGS1setyjrBcpmXEFC4a9hCo6rKgjaceCR5Hjz`, `9wenrur6dK5V5cJBqN2pRyWCpDPSoEj16UCyJs7F5Lq2` | 300/300 |
| E (§8) | `unpause` → `nft_mint` 2 NEAR → `pause` | CONTRACT / OWNER / CONTRACT | `FbRkq7ExNGRiTtdxe3s1NRnnvscaHHQUtcUqpr2E11dy`, `9JEEHWBkgMtmcSYk15jUkyCAG8bTovZuzF2Rz2TduBcZ` (token **#195**, `nft_mint` event OK), `BSgSPxe8AEyrnqtorRBBaX7jVCqvZb33gPee7Uskr12f` | minted 1, paused |
| D (§7) | `set_base_uri` ipfs.io with `/` | CONTRACT | `88dcrLAGJgihceHKaEJu2fsMzniqawj27m6E3A4zQsqD` | OK, but ipfs.io is retired → no image |
| D (§7) | `set_base_uri` public `gateway.pinata.cloud` | CONTRACT | `3KA2A9q4tv2M8socgycnMphZvAq2duYeGqFhNfsfm8yv` | OK, but rate-limited → grey image in Meteor |
| G (§10) | `propose_owner` with `{"new_owner":…}` | CONTRACT | `DFb3CV96M8bBPoxYrY5qwodKQZ8vexDpUfMBkfdGerH4` | **FAIL** `missing field owner_id` (nothing changed) |
| G (§10) | `propose_owner {"owner_id":"neargochi-dev.near"}` | CONTRACT | `Cbhsf2iaZGCYVcBTBv7wUjfZkPkMiiUvJ1jKTPmSw3sa` | OK |
| H (§10) | `accept_owner` | OWNER | `96NjRTxoiM7ZaL6LFwWawQ3sVPzStkjDvpZ5USanX9N7` | `owner()` = `neargochi-dev.near` |
| §14 | `distribute` | OWNER | `F4wbNzySYw5NQ2GyU36zYSZxBUzWxpmrMHTu46WyGq16` | 1.99 NEAR → `neargotchiai.near` |
| D (§7) | `set_base_uri` dedicated `https://lavender-known-gorilla-623.mypinata.cloud/ipfs/<CID>/` | **OWNER** | `36Hu1Zb3cBiNJ8NLKA1Puj6fkNdbmgBdJTrEc4nC21V4` | OK — image #195 shows in Meteor |
| F (§9) | `freeze_metadata` | — | — | **not done on purpose** (see §9) |
| J (§11) | delete the CONTRACT key | — | — | **not done**: 1 full-access key left (preflight WARN) |

Lessons (also in "Where it is easy to make a mistake"): the `propose_owner` argument is **`owner_id`**; after
`accept_owner` every owner function (`set_base_uri`, `pause`/`unpause`, `freeze_metadata`, `set_team`…) needs
**`sign-as $OWNER`** — the CONTRACT key only still signs account-level actions (deploy, delete key). State after the
record: paused, catalog 300/300, minted 1, limit 5, `metadata_frozen: false`, `accrued.team` 0.

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
| gateway in `base_uri` | `https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/` (dedicated Pinata gateway, paid Picnic plan, trailing slash) — see §3 | NEP-177 `base_uri` is an https gateway; wallets build `base_uri + "/" + media`. Changeable until step 9. |
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

## 3. Images on IPFS — done (task 071)

The folder `ipfs/drop1` (300 × `{id}.png` + 300 × `{id}.json`) is pinned on Pinata (Public IPFS):

**CID `bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm`**

`base_uri` (on chain since 2026-11-12, default of `scripts/mainnet_args.py`) =
`https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/` — the
project's **dedicated** Pinata gateway, **with** a trailing slash. Wallets build the image URL as `base_uri + "/" + media`
(Nearblocks and MyNearWallet trim the slash first; clients that don't produce `…//10.png`, which the gateway serves too;
details and source links: `docs/DEVLOG.md`), e.g. token #10:
`https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/10.png` (its JSON: `…/10.json`). Verification (all 300 PNG sha256 == `media_hash`, all 300 JSON == `metadata/drop1`): `docs/REPORT.md` → DONE: 071.
How it was verified: the folder's CID computed locally from the files (`cid`, UnixFS with kubo's CIDv1 defaults) equals
the CID Pinata reports, so the pinned bytes are exactly the local folder; locally every PNG matches its `media_hash` and
every JSON equals `metadata/drop1`. A one-byte change in any file gives a different CID (tested). Re-check before step 9
(the freeze makes `base_uri` permanent):
```sh
python3 scripts/ipfs_drop1.py verify-dir                                              # 300 PNG == media_hash
python3 scripts/ipfs_drop1.py cid ipfs/drop1 bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm                                    # local bytes == pinned CID (no network)
python3 scripts/ipfs_drop1.py verify-url https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm 12   # sample through the gateway in base_uri
# full download of all 600 files (slow): IPFS_WORKERS=1 IPFS_DELAY=2 python3 scripts/ipfs_drop1.py verify-url https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm all
```
Keep the pin (and the Pinata plan: see below).

**Gateway notes (2026-11-12, task 079 → `docs/DEVLOG.md`):**
- **ipfs.io and dweb.link are retired** for hotlinked content since **2026-09-21** (IPFS Foundation / Shipyard, Aug 2026):
  every request gets `429` "switching to a service worker gateway only". The `429, retry-after: 900` seen on 2026-11-11
  was this, not a per-IP limit. A `base_uri` on them = no image in any wallet.
- **Public `gateway.pinata.cloud`** rate-limits hard: `429` + a Cloudflare bot challenge after ~5 requests from one IP;
  Pinata's docs: public gateways "are not meant for production apps". Meteor showed a grey placeholder with it.
- **Dedicated gateway** (`lavender-known-gorilla-623.mypinata.cloud`): no request rate limits per Pinata's docs; serves only
  CIDs pinned on our account. It needs a **paid plan**: the Free plan allows 500 files and drop 1 is 600 (300 PNG + 300
  JSON), so the account is on **Picnic** ($20/month: 500 GB bandwidth, 1 M requests). If the plan lapses, every image
  breaks — keep it paid while the collection matters.
- **`base_uri` is deliberately NOT frozen** (no step 9 yet): the owner can still re-point it with `set_base_uri` if the
  gateway or plan changes. Integrity does not depend on the gateway: each token's `media_hash` (sha256 of the PNG) and the
  content-addressed CID are on chain / in the URL, so any gateway serving the CID serves verifiably the same bytes.
- **Target before the freeze (after the hackathon):** a second pinning provider by CID (see "Redundancy") and/or a custom
  domain on the gateway (e.g. `img.<own domain>`), so a frozen `base_uri` survives a provider change via DNS. Then freeze.

**Which gateway in `base_uri`** (it can't change after step 9):

| option | verdict |
|---|---|
| `https://<name>.mypinata.cloud/ipfs/<CID>/` (dedicated, paid) | **in use.** Works in Meteor; bound to the Pinata account and plan, so not yet for a frozen `base_uri` — add a custom domain and a second pin first. |
| `https://<own domain>/ipfs/<CID>/` (custom domain on a dedicated gateway) | **target for the freeze**: provider can change behind DNS. |
| `https://ipfs.io/ipfs/<CID>` · `https://dweb.link/ipfs/<CID>` | **no** — retired for hotlinks 2026-09-21. |
| `https://gateway.pinata.cloud/ipfs/<CID>` | **no** — public, 429 + bot challenge after a few requests. |
| `ipfs://<CID>` | **no.** NEP-177 asks for a gateway; MyNearWallet passes `ipfs://…/10.png` through unchanged, which a browser `<img>` can't load (source verified). |

How clients build the URL (source-verified for Nearblocks, MyNearWallet, Intear, Mintbase template; Meteor closed source):
`docs/DEVLOG.md` §2. Meteor shows #195 with the dedicated gateway (checked by the owner, 2026-11-12).

## Redundancy (after the hackathon)

One pin = one point of failure. The CID is content-addressed: any provider that pins **the same CID** serves the same
files; the on-chain `base_uri` (dedicated Pinata gateway) serves only what is pinned on our Pinata account, so a second
provider protects the files, and a gateway on our own domain lets `base_uri` follow them. Pin **by CID** (don't re-upload the
folder: a different uploader's chunking can produce a different CID):
- Another pinning service with "pin by CID" (e.g. Filebase, 4EVERLAND, Storacha): in its dashboard choose "pin by CID" /
  "import CID" and paste `bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm`. Or with a local IPFS node (kubo) and the IPFS Pinning Service API:
  `ipfs pin remote service add <name> <endpoint> <token>` then `ipfs pin remote add --service=<name> --name=neargotchi-drop1 bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm`
  (the token goes into kubo's config, never into the repo).
- Your own node: `ipfs pin add bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm` (kubo fetches it from the network and keeps it while the node runs).
- Then: `python3 scripts/ipfs_drop1.py verify-url https://<that provider's gateway>/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm all`.
- Keep the originals offline too: `images/drop1` (PNG, outside git) and `ipfs/drop1` (rebuild with `prepare`).
Exact menu names / endpoints of each provider: not verified here — follow the provider's "pin by CID" docs.

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
python3 scripts/mainnet_args.py --owner $CONTRACT --team $TEAM        # base_uri = dedicated gateway /ipfs/<drop 1 CID>/ by default
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

Set in step 5 if you passed `--base-uri`. To set / change it (only until step 9). **Signer = the current owner:**
`$CONTRACT` before step 10, **`$OWNER` after `accept_owner`** (mainnet: already `$OWNER`; the contract key gets "owner only"):
```sh
near contract call-function as-transaction $CONTRACT set_base_uri json-args '{"base_uri":"https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/"}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
near contract call-function as-read-only $CONTRACT nft_metadata json-args '{}' network-config $NET now
curl -sI https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/195.png | head -3   # 200, image/png
```
Mainnet history: `new` set ipfs.io (no slash), then ipfs.io with `/`, then public `gateway.pinata.cloud`, then the
dedicated gateway (record at the top). Before a new value: `curl` the image through it (200, `image/png`, CORS `*`) and
open the token in Meteor.

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
`nft_token {"token_id":"<id>"}` → `media` `<id>.png`; `https://lavender-known-gorilla-623.mypinata.cloud/ipfs/bafybeih3wekkmxod2plah2wq54tcjt2gvxryttg6rnz57pao22nmwnnkgm/<id>.png` opens; the token shows in
your wallet's NFT tab with its image. (Mainnet: token #195, done.) Nearblocks lists the token only after its NFT indexer
catches up (on 2026-11-12 its API was still empty for the collection although the `nft_mint` event was emitted).

## 9. Freeze the metadata (irreversible)

**Mainnet: postponed on purpose** until after the hackathon, when a second pinning provider (by CID) and/or a custom
domain for the gateway are in place (§3 "Gateway notes"). Until then `base_uri` stays changeable; `media_hash` + CID keep
the images verifiable. Signer after step 10 = `$OWNER`:
```sh
near contract call-function as-transaction $CONTRACT freeze_metadata json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $OWNER network-config $NET sign-with-keychain send
```
Preflight: `frozen True`, `base_uri` = your gateway URL (OK, not retired / not the public Pinata gateway).

## 10. Ownership to OWNER (two steps)

```sh
near contract call-function as-transaction $CONTRACT propose_owner json-args "{\"owner_id\":\"$OWNER\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $CONTRACT network-config $NET sign-with-keychain send
near contract call-function as-read-only $CONTRACT proposed_owner json-args '{}' network-config $NET now   # must print OWNER exactly
near contract call-function as-transaction $CONTRACT accept_owner json-args '{}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as $OWNER network-config $NET sign-with-keychain send
near contract call-function as-read-only $CONTRACT owner json-args '{}' network-config $NET now           # OWNER
```
A typo in `propose_owner` is harmless: nobody can accept it; propose again with the right name. The argument is
**`owner_id`** (mainnet: a first call with `new_owner` failed with "missing field `owner_id`" and changed nothing). From
here on all owner functions are signed with `sign-as $OWNER`.

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
"mainnet", /mint shows `1 / 300` and the hatch button with "2 near · real" (no warning box or checkbox since task 089;
the FAQ says the contract is unaudited); /pet with OWNER connected shows the test token and "holder rewards".

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
| 7 | `base_uri` on a retired or public gateway (ipfs.io / dweb.link / gateway.pinata.cloud) | grey image in wallets; preflight FAILs on these hosts; use the dedicated gateway (§3) |
| 10 | `propose_owner` with the wrong field name (`new_owner`) | fails with "missing field `owner_id`"; nothing changes — the field is `owner_id` |
| after 10 | owner function signed by `$CONTRACT` | "owner only": after `accept_owner` sign with `$OWNER` |
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
