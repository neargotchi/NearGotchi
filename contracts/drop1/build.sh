#!/usr/bin/env bash
# Deployable wasm without cargo-near, same flags it sets: `--cfg near` (near-sdk uses the NEAR host functions:
# panic messages, sha256; without it a panic is a bare `unreachable` trap), MVP wasm features, symbols stripped.
# Output: res/neargotchi_drop1.wasm (read by tests/sandbox.rs and examples/testnet.rs).
set -euo pipefail
cd "$(dirname "$0")"
RUSTFLAGS="--cfg near -C link-arg=-s -C target-cpu=mvp" cargo build --target wasm32-unknown-unknown --release
mkdir -p res
cp target/wasm32-unknown-unknown/release/neargotchi_drop1.wasm res/
ls -l res/neargotchi_drop1.wasm
