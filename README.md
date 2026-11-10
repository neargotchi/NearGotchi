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

## NEAR AI

The pet chat runs on [NEAR AI Cloud](https://docs.near.ai/cloud/guides/openai-compatibility) (OpenAI-compatible API) through a server route, `app/api/chat/route.ts`.
The key never reaches the browser.

1. Create a NEAR AI Cloud API key.
2. Locally: put `NEAR_AI_API_KEY=<your key>` in `.env.local` (gitignored). On Vercel: Project Settings → Environment Variables → `NEAR_AI_API_KEY`, then redeploy.
   Optional: `NEAR_AI_MODEL` (default `z-ai/glm-5.3-flash`).
3. Open `/pet` → chat tab. The note under the title says "powered by near ai". Each answered message costs 4 energy; a failed AI call costs nothing.

Without the key the chat falls back to scripted answers and says "demo mode (mock answers)". Limits: 300 chars per message, 8 messages of history,
150 output tokens, 15 s timeout, 12 requests per minute per IP. Tests: `npm run check:chat` (mocked fetch).

## What is a mock

- Pet state (hunger, energy, stats), the snack shop, mini-games and the $NEARGotchi balance: demo, stored in your browser.
- Chat: real NEAR AI when `NEAR_AI_API_KEY` is set (see above), scripted answers otherwise.
- Nothing about the game state is on-chain; only ownership of the NFT is.

## Honest notes

- The git history starts on 2026-11-05: the site, art and demo game pre-date the contract and wallet work (tasks 057-058).
  We use no private libraries, only public npm and crates.io dependencies.
- Testnet only. No audit. Do not use with real funds.

## Stack

Next.js 16, React 19, Tailwind 4, `@near-wallet-selector` 10, Rust + near-sdk 5, near-workspaces.

## License

MIT, see `LICENSE`.
