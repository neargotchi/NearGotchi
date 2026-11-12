# NEARGOTCHI

An AI pet on NEAR. Hatch one of 300 pixel gotchis (common / rare / epic / legendary) for 2 NEAR, name it, feed it, play with it.
Built for the NEAR hackathon (deadline 2026-11-14).

**Real funds warning:** drop 1 goes live on NEAR **mainnet** (real NEAR). The contract is **not audited**. Only spend what
you can afford to lose. To look around without real money, see [Try it without real funds](#try-it-without-real-funds).

- Live site: https://neargochi.vercel.app (production = the mainnet build; a free build for looking around: [Try it without real funds](#try-it-without-real-funds))
- Drop 1 NFT contract (mainnet): [`drop1.neargochi-dev.near`](https://nearblocks.io/address/drop1.neargochi-dev.near) (owner `neargochi-dev.near`, team `neargotchiai.near`; test mint, token #195: [`9JEEHWBk…`](https://nearblocks.io/txns/9JEEHWBkgMtmcSYk15jUkyCAG8bTovZuzF2Rz2TduBcZ); deploy record in `docs/MAINNET-RUNBOOK.md`)
- $NEARGotchi token (mainnet): [`neargotchi.nearlytrade.near`](https://nearblocks.io/address/neargotchi.nearlytrade.near)
- Drop 1 NFT contract (testnet, current contract with holder rewards): [`neargotchi-drop1-ng67.testnet`](https://testnet.nearblocks.io/address/neargotchi-drop1-ng67.testnet)
- Older testnet contract (33/33/34 split, no holder rewards; the testnet build of the site still reads it by default): [`neargotchi-drop1-ng57.testnet`](https://testnet.nearblocks.io/address/neargotchi-drop1-ng57.testnet)
- Holder rewards on testnet ng67: mint by a second account [`7edZwRA1…`](https://testnet.nearblocks.io/txns/7edZwRA1d5dSCQ6KFJNhFuLowScrzLgjPkaS8VfR16iF) → token #198's owner claims 0.995 NEAR [`4T7Ck242…`](https://testnet.nearblocks.io/txns/4T7Ck242PEM3rczLrY94fghnprTwNDegVgeiax7hNBDj)
- Test mint (admin account, token #83): [`9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB`](https://testnet.nearblocks.io/txns/9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB)
- Mint from the website (token #10, `buyer1.testnet`): [`D5NRFD7v9pwDmw2Kmg21QtAgf3CRrZ5R1hehEiYnBnf7`](https://testnet.nearblocks.io/txns/D5NRFD7v9pwDmw2Kmg21QtAgf3CRrZ5R1hehEiYnBnf7)

## Hatch proceeds: 50% team / 50% holder rewards

Every hatch pays 2 NEAR. 0.01 NEAR stays in the contract for the token's storage; the other 1.99 NEAR is split:

- **50% team** (0.995 NEAR): accrues in the contract and is paid to the team account by `distribute()` (anyone may call it).
- **50% holder rewards** (0.995 NEAR): split **equally between the tokens hatched before this payment**. The new token
  doesn't share in its own payment or in earlier ones (each token keeps a checkpoint of the reward counter from the moment it
  was minted). Owners claim with `claim_rewards(token_ids)` (on the site: /pet → stats → claim); `pending_rewards(token_id)` shows
  what a token has waiting. Rewards belong to the token: if you transfer or sell it unclaimed, the new owner claims them.
- **First hatch:** no earlier token exists, so its holder half goes to the team. **Rounding:** the share is divided in yoctoNEAR;
  the remainder (fewer than 300 yoctoNEAR per hatch) goes to the team.
- These two are the only payouts of hatch proceeds in the contract. Nothing is promised about any value: holder rewards exist
  only if later hatches happen.

Example: hatch #2 pays 0.995 NEAR to token #1; hatch #3 pays 0.4975 NEAR to each of tokens #1 and #2.

## Try it without real funds

**Demo mode** (no wallet, no chain, everything in the browser): `npm install`, `npm run dev`, open http://localhost:3000.

**Testnet mode** (real wallet, free testnet NEAR, the same contract code as mainnet):
1. `npm install` and `cp .env.example .env.local`
2. in `.env.local`: `NEXT_PUBLIC_CHAIN=testnet`, `NEXT_PUBLIC_DROP1_CONTRACT=neargotchi-drop1-ng67.testnet`,
   `NEXT_PUBLIC_TREASURY=neargotchi-team-ng67.testnet` (and `NEAR_AI_API_KEY` for real chat answers)
3. `npm run dev`, then follow the steps below on http://localhost:3000. Testnet NEAR is free from a faucet and has no value.

## Quick start (testnet mode)

You need a NEAR **testnet** wallet (MyNearWallet or Meteor) with about 2.5 testnet NEAR (free from a testnet faucet, no value).

1. Open https://neargochi.vercel.app/mint → you see the live counter from the contract, "x / 300 hatched".
2. Click **connect wallet** and sign in → the header shows your real account id.
3. Click **hatch** (2 NEAR + gas) and approve in the wallet → the egg cracks and shows the pet the contract drew for you, with its tier. The counter goes up by one.
4. Open **/pet** → feed tab → **buy & feed** a snack (small testnet NEAR payment, approve in the wallet) → the pet eats and its hunger drops.
5. Open the **chat** tab and talk to it → answers come from NEAR AI ("powered by near ai"), each answered message costs 4 energy. The **energy pack** in the feed tab refills it.

| | On-chain (NEAR mainnet / testnet) | Off-chain (your browser) |
|---|---|---|
| Pet NFT, ownership, random draw | yes (drop 1 contract) | |
| Hatch payment (2 NEAR), 50% team / 50% holder rewards, 5% royalty | yes | |
| Holder rewards (pending, claim) | yes (`pending_rewards`, `claim_rewards`) | |
| Snack and energy-pack payments | yes (plain NEAR transfer to the team account) | the effect (hunger, energy, stock) |
| Hunger, energy, stats, chat history | | yes |
| Mini-games (catch the snack, fetch, hide & seek) | | yes |
| Chat answers | | NEAR AI Cloud API (Claude Haiku 5.5, GLM fallback) via a server route |

## Run it locally

1. `npm install`
2. `cp .env.example .env.local`, then set `NEXT_PUBLIC_CHAIN=testnet` (and `NEAR_AI_API_KEY` for real chat answers, see "NEAR AI";
   for the holder-rewards contract also the two ng67 accounts from "Try it without real funds")
3. `npm run dev` and open http://localhost:3000/mint, then follow steps 1–5 above on localhost.

Without `NEXT_PUBLIC_CHAIN` (or with `=demo`) the site runs fully offline on a localStorage mock: no wallet, no chain.
Checks: `npm run check:drop1` (game logic), `npm run check:chat` (chat route, mocked), `cd contracts/drop1 && cargo test --lib` (contract).

## How it works

- **Contract** (`contracts/drop1`, Rust, near-sdk 5): NEP-171/177/178/181/297 + 5% royalty. `nft_mint` takes 2 NEAR and issues a ticket; a
  self-callback in a later block draws a random token from the pool of 300 (public `reveal(ticket)` is the fallback). Proceeds:
  50% team (`distribute()`), 50% holder rewards (reward per token, `claim_rewards`), see above. Mainnet limit: 5 mints per account.
  34 unit tests + a near-workspaces sandbox suite (300 mints, sold out, fallback, rewards, claims, transfer, limit) run in GitHub
  Actions. No upgrade method. On 2026-11-12 the mainnet contract account still holds its deploy key; the runbook deletes it
  before the sale opens (step 11), after which nobody can change the code. Details: `docs/MAINNET-RUNBOOK.md`,
  `docs/CONTRACT-SETUP.md`, money-path review in `docs/REPORT.md` (DONE: 067).
- **Mainnet mode:** `NEXT_PUBLIC_CHAIN=mainnet` + `NEXT_PUBLIC_DROP1_CONTRACT` + `NEXT_PUBLIC_TREASURY` (no defaults). The mint page
  shows an "unaudited contract, real funds" warning and the hatch button stays disabled until the visitor ticks the checkbox.
- **RPC:** all chain reads (counter, owned tokens, rewards, tx status after a wallet redirect) go through a fallback list of
  free public endpoints without API keys (FastNear, dRPC, ZAN, Intear; `rpc.*.near.org` is deprecated and answers 429): each
  request tries the endpoints in turn (starting with the last one that worked), then backs off and repeats; the counter keeps
  the last value it read. `NEXT_PUBLIC_RPC_URL` (comma-separated) is tried first. No proxy and no key are needed.
- **Energy on mainnet = NEAR AI credits, kept on the server** (Upstash Redis ledger per token, NEP-413 wallet sign-in, chat cost
  and energy-pack payments verified server-side; demo / testnet unchanged): `docs/ENERGY.md`.
- **Game state on chain builds** is stored per chain + contract + account + token: /pet shows only pets whose token the
  connected account holds on the current contract (`nft_tokens_for_owner`); state from another contract or account stays in the
  browser under its own key but is never shown.
- **Front** (Next.js, React, Tailwind): `lib/chain.ts` (config + RPC), `lib/near.ts` (wallet-selector), `lib/wallet.ts`, `lib/drop1.ts`.
  Redirect wallets come back to `/mint?transactionHashes=…` and the mint finishes from the transaction result.
- **Images:** on mainnet `base_uri` is the project's dedicated Pinata IPFS gateway
  (`https://lavender-known-gorilla-623.mypinata.cloud/ipfs/<CID>/`) for a folder with the 300 original PNGs, and every `media_hash`
  matches (`scripts/ipfs_drop1.py` checks it). Public gateways are not used: ipfs.io / dweb.link stopped serving hotlinks on
  2026-09-21 and the public Pinata gateway rate-limits; `base_uri` stays changeable until a second pin provider is added
  (`docs/DEVLOG.md`). The testnet contracts use `https://neargochi.vercel.app/drop1-full/`, which serves 512px WebP
  renders (there the `media_hash` does not match the served bytes).

## NEAR AI

Chat via the [NEAR AI Cloud](https://docs.near.ai/cloud/guides/openai-compatibility) API (OpenAI-compatible; Claude Haiku 5.5, GLM as fallback), called from a server route, `app/api/chat/route.ts`. Haiku is an external provider behind NEAR AI Cloud.
The key never reaches the browser.

1. Create a NEAR AI Cloud API key.
2. Locally: put `NEAR_AI_API_KEY=<your key>` in `.env.local` (gitignored). On Vercel: Project Settings → Environment Variables → `NEAR_AI_API_KEY`, then redeploy.
   Optional: `NEAR_AI_MODEL` (default `anthropic/claude-haiku-5-5`; if it fails, one retry on `z-ai/glm-5.3-flash`).
3. Open `/pet` → chat tab. The note under the title says "powered by near ai". Each answered message costs 4 energy; a failed AI call costs nothing.

Without the key the chat falls back to scripted answers and says "demo mode (mock answers)". Limits: 300 chars per message, 8 messages of history,
150 output tokens, 9 s timeout per model attempt, 12 requests per minute per IP. Tests: `npm run check:chat` (mocked fetch).

## What is a mock

- Pet state (hunger, energy, stats), shop stock and the mini-games live in your browser. The demo balance in $NEARGotchi exists only in demo mode.
- Chat: real answers through the NEAR AI Cloud API when `NEAR_AI_API_KEY` is set (see above), scripted answers otherwise.
- Nothing about the game state is on-chain; only ownership of the NFT is.

## Honest notes

- The git history starts on 2026-11-05: the site, art and demo game pre-date the contract and wallet work (tasks 057-058).
  [USER: list of own libraries or "none"]
- No audit. The money paths were reviewed by us (findings and what was not checked: `docs/REPORT.md`, DONE: 067), which is not an audit.
  Mainnet means real NEAR; only spend what you can afford to lose.

## Deploy

The site is deployed with the Vercel CLI from a local checkout (no Git integration): `npx vercel@latest login`, `npx vercel@latest link`
(existing project), then `scripts/deploy-vercel.sh` after each commit (deploys a clean `git archive` export of HEAD without
`.git`, then deletes it). `.vercelignore` keeps local env files and large local-only folders out of the upload; environment variables live in the Vercel project, and `NEXT_PUBLIC_*` changes need a
redeploy. Details and troubleshooting: `docs/DEPLOY.md`.

## Stack

Next.js 16, React 19, Tailwind 4, `@near-wallet-selector` 10, Rust + near-sdk 5, near-workspaces.

## License

MIT, see `LICENSE`.
