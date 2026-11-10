# NEARGOTCHI

An AI pet on NEAR. Hatch one of 300 pixel gotchis (common / rare / epic / legendary) for 2 NEAR, name it, feed it, play with it.
Built for the NEAR hackathon (deadline 2026-11-14). **Testnet only.**

- Live site: https://neargochi.vercel.app (demo mode by default)
- Drop 1 NFT contract (testnet): [`neargotchi-drop1-ng57.testnet`](https://testnet.nearblocks.io/address/neargotchi-drop1-ng57.testnet)
- Test mint (admin account, token #83): [`9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB`](https://testnet.nearblocks.io/txns/9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB)

## Try it (about 3 minutes)

You need a NEAR **testnet** account with at least ~2.1 testnet NEAR (get some from a testnet faucet; it is free and has no value).

1. `npm install`
2. `cp .env.example .env.local` and set `NEXT_PUBLIC_CHAIN=testnet`
3. `npm run dev`, open http://localhost:3000/mint
   → you see the real counter from the contract, "x / 300 hatched · y left".
4. Click **connect wallet**, pick MyNearWallet or Meteor, sign in with your testnet account
   → the button shows your real account id.
5. Click **hatch** (2 NEAR + gas), approve in the wallet
   → the egg cracks and shows the pet the contract drew for you (tier, species, name). The counter goes up by one.
6. Open **/pet** → every token your account owns on the contract is listed as a pet.
   Without `NEXT_PUBLIC_CHAIN` (or `=demo`) the site runs fully offline on a localStorage mock, no wallet needed.

## How it works

- **Contract** (`contracts/drop1`, Rust, near-sdk 5): NEP-171/177/178/181/297 + 5% royalty. `nft_mint` takes 2 NEAR and issues a ticket; a
  self-callback in a later block draws a random token from the pool of 300 (public `reveal(ticket)` is the fallback). Proceeds
  split 33/33/34 between three treasuries via `distribute()`. 18 unit tests + a near-workspaces sandbox suite (300 mints, sold out,
  fallback, split) run in GitHub Actions. Details: `docs/CONTRACT-SETUP.md`, `docs/PLAN-CONTRACT-NFT.md`.
- **Front** (Next.js, React, Tailwind): `lib/chain.ts` (config + RPC), `lib/near.ts` (wallet-selector), `lib/wallet.ts`, `lib/drop1.ts`.
  Redirect wallets come back to `/mint?transactionHashes=…` and the mint finishes from the transaction result.
- **Images:** the contract's `base_uri` is `https://neargochi.vercel.app/drop1-full/`; for now it serves 512px WebP renders
  (the `media_hash` in the metadata is for the original PNGs, which move to IPFS later, so it does not match the served bytes yet).

## What is a mock

- Pet state (hunger, energy, stats), the snack shop, mini-games and the $NEARGotchi balance: demo, stored in your browser.
- Chat: scripted answers. NEAR AI integration is not built yet.
- Nothing about the game state is on-chain; only ownership of the NFT is.

## Honest notes

- The project started on 2026-11-05, before the hackathon window; the art and site pre-date the contract and wallet work.
  We use no private libraries, only public npm and crates.io dependencies.
- Testnet only. No audit. Do not use with real funds.

## Stack

Next.js 16, React 19, Tailwind 4, `@near-wallet-selector` 10, Rust + near-sdk 5, near-workspaces.

## License

MIT, see `LICENSE`.
