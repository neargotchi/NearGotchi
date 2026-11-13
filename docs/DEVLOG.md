# DEVLOG

How NEARGOTCHI was built during the hackathon window (2026-11-05 to 2026-11-13). The full commit list is the history of this
repository; this file is the short story. All code was written with Claude Code (see README, "AI assistance").

## Timeline

- **11-05 to 11-08, landing page and demo game.** Hero, "meet the pets", "how it works", the three pets (corgi, dragon, meerkat),
  the pet screen with four tabs (stats, feed, games, chat), three mini-games (catch the snack, fetch, hide & seek), a shop with
  snack stock and an energy pack, all on a localStorage mock so the site runs without a wallet.
- **11-08 to 11-10, drop 1 collection.** 300 tokens (4 tiers, 12 backgrounds, 13 items) composed deterministically from the source
  sheets by `scripts/compose_drop1.py`; NEP-177 metadata and a provenance hash of `data/collection-drop1.json`.
- **11-09 to 11-11, contract and wallet.** Rust contract `contracts/drop1` (near-sdk 5; NEP-171/177/178/181/297, 5% royalty):
  `nft_mint` stores a ticket, a callback in a later block draws the token from the remaining pool, a public `reveal` is the
  fallback. Wallet selector (MyNearWallet, Meteor), mint flow and holder rewards in the front end. Hatch proceeds: 50% team
  (pull payment), 50% holder rewards (reward per token with checkpoints). Deployed and exercised on testnet first.
- **11-11 to 11-12, mainnet and energy.** Mainnet deploy of the contract, IPFS images behind a dedicated gateway, NEP-413
  sign-in, a server ledger for chat energy (Upstash Redis, atomic spend / credit), payment verification by transaction hash.
- **11-13, review and fixes.** An independent review found that the draw could be steered by choosing the attached gas; fixed with
  a gas gate (`nft_mint` needs 35 Tgas, a reveal 18 Tgas, checked before the draw), deployed on testnet and then on mainnet.
  Copy and README were corrected so they claim only what the contract and the site do today.

## How it was checked

- Contract: 40 unit tests (`cargo test --lib`) and a near-workspaces sandbox suite that mints all 300 tokens, checks the 301st is
  refused with a refund, the gas gate, rewards, claims, transfers and the per-account limit (runs in GitHub Actions).
- Front end and server: `npm run check:drop1`, `check:chat`, `check:energy`, `check:greens`, `tsc`, `eslint`, and production builds
  for the demo and the mainnet configuration.
- Money paths were reviewed by us and then by an independent reviewer; this is not an audit and the contract is **not audited**.

## Known limits

- No audit. Real NEAR on mainnet.
- The contract account still holds a full-access key, so its code can be replaced by whoever holds that key.
- On-chain randomness on NEAR comes from block producers' seed; no on-chain randomness is perfect.
- Pet state, shop stock and chat history live in the browser; only ownership, payments and rewards are on chain.
- `npm audit` reports transitive findings inside the wallet-selector dependencies; fixing them needs a breaking downgrade.
