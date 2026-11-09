# Contract setup — drop 1 NFT on NEAR testnet (task 057)

Code: `contracts/drop1` (Rust, near-sdk 5.30.1 + near-contract-standards 5.30.1). Plan: docs/PLAN-CONTRACT-NFT.md.

## Testnet (live)
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
cargo test --lib                             # 18 unit tests
cargo test --test sandbox -- --nocapture     # linux / Apple Silicon / CI only
cargo run --example testnet                  # testnet setup (keys from ~/.near-credentials)
```
With near-cli-rs installed later, the same calls are e.g.
`near contract call-function as-read-only neargotchi-drop1-ng57.testnet drop_status json-args '{}' network-config testnet now`.
