# Contract setup — drop 1 NFT on NEAR testnet (task 057)

Code: `contracts/drop1` (Rust, near-sdk 5.30.1 + near-contract-standards 5.30.1). Mainnet deploy record and runbook: docs/MAINNET-RUNBOOK.md. Deployed mainnet wasm (2026-11-13, tx `EdZ7iKo2DPPy6psJLh6n3sD3H5iS7zisWmuEAXBtzbvA`): sha256 `a3412e7aa1e1f6df63beb0dd32ce7e2241d6543fcd51cfd7cf1603512d8b003a`, base58 `BzH6tuQv4EDojTH2Fw2utZQKzP7HCGnma1FVL3vanhwf`.

## Testnet ng67 (current code: 50 % team / 50 % holder rewards, task 067)
| role | account |
|---|---|
| contract | `neargotchi-drop1-ng67.testnet` |
| owner / admin | `neargotchi-admin-ng67.testnet` |
| team (50 % + first-mint share + rounding, royalty 5 %) | `neargotchi-team-ng67.testnet` |

- Deploy: https://testnet.nearblocks.io/txns/AZw5JdxN1hr5mGTniariWFkBMgadMdtH4yejkHaYKHyU · init: https://testnet.nearblocks.io/txns/5sp2uFWpzkH12V5ZAKD9nDtdawuvXQSMThssou82PV7
- Test mint (admin → token #198): https://testnet.nearblocks.io/txns/CKbdbHCKJcadZSMApvG9nPDbdJ517JXh9QmboSHbv2on
- Rewards check (`cargo run --example testnet_rewards`): team mints #94 (https://testnet.nearblocks.io/txns/7edZwRA1d5dSCQ6KFJNhFuLowScrzLgjPkaS8VfR16iF),
  token #198 then has 0.995 NEAR pending, the team account's claim of #198 fails, the admin claims 0.995 NEAR
  (https://testnet.nearblocks.io/txns/4T7Ck242PEM3rczLrY94fghnprTwNDegVgeiax7hNBDj), a second claim pays 0.
- No per-account limit on testnet (`LIMIT=5 cargo run --example testnet` would set it). Mainnet: `docs/MAINNET-RUNBOOK.md`.

## Testnet ng57 (old code: 33 / 33 / 34, no holder rewards; kept, the testnet build's default)
| role | account |
|---|---|
| contract | `neargotchi-drop1-ng57.testnet` |
| owner / admin | `neargotchi-admin-ng57.testnet` |
| treasury: team (33 %, royalty 5 %) | `neargotchi-team-ng57.testnet` |
| treasury: stakers (33 %) | `neargotchi-stakers-ng57.testnet` |
| treasury: buyback & burn (34 % + rounding) | `neargotchi-buyback-ng57.testnet` |

- Explorer: https://testnet.nearblocks.io/address/neargotchi-drop1-ng57.testnet
- Deploy: https://testnet.nearblocks.io/txns/HjujLfhniQp2mia1GLQwKTAyuwPPBtQJA3UXbmagb6T · init: https://testnet.nearblocks.io/txns/E8MFZ7ESn6aUB7FhaAYF3TerbdpjwaUJQRUpxps18DBh
- Test mint (admin, 2 NEAR → token #83 "batman #083"): https://testnet.nearblocks.io/txns/9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB
- State after setup: catalog 300/300, unpaused, `max_per_account: null` (no limit, owner decision), metadata not frozen,
  `base_uri = https://neargochi.vercel.app/drop1-full/` (temporary; IPFS CID in a later task), provenance = sha256 of data/collection-drop1.json.
- **Keys:** created by the testnet faucet helper; private keys only in `~/.near-credentials/testnet/<account>.json` on this Mac (near-cli format, chmod 600). Never in the repo (`.gitignore`: `*.testnet.json`, `.near-credentials/`).

## Toolchain on this Mac (Intel, x86_64 macOS)
- rustup 1.29.2, rustc / cargo 1.99.1, target `wasm32-unknown-unknown`.
- `cargo-near` and `near-cli-rs` are **not installed** (installing them was blocked in this session). Instead:
  - build: `contracts/drop1/build.sh` = `cargo build --release --target wasm32-unknown-unknown` with the flags cargo-near sets
    (`--cfg near` — required: without it near-sdk panics lose their message —, `-C target-cpu=mvp`, strip) → `res/neargotchi_drop1.wasm` (≈ 363 KB);
  - deploy / admin: `cargo run --example testnet` (near-workspaces on testnet, idempotent: accounts → deploy → `new` → catalog → unpause → 1 mint → `drop_status`;
    `SUFFIX=xyz` for other names, `REDEPLOY=1` to push new code).
- near-workspaces sandbox has no Intel-macOS binary → `tests/sandbox.rs` is ignored locally and runs in GitHub Actions
  (`.github/workflows/contract-drop1.yml`, ubuntu): build → `cargo test --lib` → `cargo test --test sandbox`.

## Commands
```
cd contracts/drop1
./build.sh                                   # wasm → res/
cargo test --lib                             # 34 unit tests
cargo test --test sandbox -- --nocapture     # linux / Apple Silicon / CI only
cargo run --example testnet                  # testnet setup (keys from ~/.near-credentials)
```
With near-cli-rs installed later, the same calls are e.g.
`near contract call-function as-read-only neargotchi-drop1-ng57.testnet drop_status json-args '{}' network-config testnet now`.
