# SUBMISSION — NEAR Hackathon (deadline 2026-11-14 23:59 UTC)

Nothing here has been sent or published. The owner does every step after their own confirmation.

## Placeholders to fill in (not invented)
Left on purpose, to be filled by the owner. Nothing else in this file or in the README is a placeholder.
- [ ] `{{DEMO_URL}}` (demo / testnet build for judges, no real money)
- [ ] `{{X_POST_URL}}` (after the post is published)
- [ ] `{{OTHER_CHAIN_DISCLOSURE}}`, `{{OTHER_PROJECTS_DISCLOSURE}}` (README, hackathon questions Q-002 / Q-015: text comes from the owner)
- [ ] `{{ART_TOOLS_DISCLOSURE}}` (README: how the pet art was made; the repo does not record the tool, so it is not guessed here)

Typed into the submission form by hand, not kept in this public repo: team lead name, contact email, team size.
Project name: NEARGOTCHI. Mainnet payout account: `neargotchiai.near` (the contract's `team` account, read on chain).

## Tracks
- games
- nfts

## Links
- Production (NEAR mainnet, real NEAR): https://neargotchi.com
- Demo / testnet build for judges (no real money): {{DEMO_URL}}
- Repo: https://github.com/neargotchi/NearGochi (visibility = owner's decision)
- Contract (NEAR mainnet): `drop1.neargochi-dev.near` · https://nearblocks.io/address/drop1.neargochi-dev.near (deploy record: `docs/MAINNET-RUNBOOK.md`)
- Contract (NEAR testnet, same code as mainnet, 50/50 + holder rewards): `neargotchi-drop1-ng67.testnet` · https://testnet.nearblocks.io/address/neargotchi-drop1-ng67.testnet
- Holder rewards on testnet: 2nd mint `7edZwRA1d5dSCQ6KFJNhFuLowScrzLgjPkaS8VfR16iF` → token #198's owner claims 0.995 NEAR `4T7Ck242PEM3rczLrY94fghnprTwNDegVgeiax7hNBDj`
- Older testnet contract (33/33/34, no holder rewards): `neargotchi-drop1-ng57.testnet` · https://testnet.nearblocks.io/address/neargotchi-drop1-ng57.testnet
- Test mint (admin account, token #83): `9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB` · https://testnet.nearblocks.io/txns/9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB
- Mint from the website (`nft_mint`, 2 NEAR, token #10): `D5NRFD7v9pwDmw2Kmg21QtAgf3CRrZ5R1hehEiYnBnf7` · https://testnet.nearblocks.io/txns/D5NRFD7v9pwDmw2Kmg21QtAgf3CRrZ5R1hehEiYnBnf7

## Description (paste into the form, English, 1628 characters; the form allows 20–2000)
NEARGOTCHI is an AI Tamagotchi on NEAR. You hatch a pixel pet, feed it, play mini-games with it and talk to it. Production is NEAR mainnet; judges can use the demo/testnet build or run it locally (no real money). The chain stays out of the way until you mint or buy.

GAMES: the loop is hunger, food, games, talk. A pet gets hungry over time (about 170 minutes from 0 to 100), snacks fix hunger, three mini-games (catch the snack, fetch, hide & seek) make it happy but a bit hungrier, and talking uses energy. Energy is the fuel of the chat, which runs on NEAR AI Cloud (Claude Haiku 5.5, GLM as fallback): every answered message costs 4 energy, and an energy pack in the shop refills it. Food and packs are paid in small NEAR transfers. Players only see the chain when they mint and when they buy.

NFTS: a hatch costs 2 NEAR and the drop 1 contract (Rust, near-sdk 5, NEP-171/177/178/181/297) draws one random pet (commit, then reveal in a later block) from a pool of 300 in four tiers (common, rare, epic, legendary). The NFT is the pet: it has a character, a state and a tier. Holders are part of the drop too: half of every hatch goes to the pets hatched before it, split equally, and owners claim their share from their wallet. It is a share of hatch sales, nothing more is promised. 5% NEP-199 royalty. Ownership of the token decides who can open the pet, its chat and its rewards.

On-chain: the NFT, ownership, the split, holder rewards and the shop payments. Off-chain: pet state, chat history, the mini-games and shop stock (in the browser). Status: not audited; real NEAR on mainnet, nothing is promised about value.

## X post draft (max 280 chars)
```
we built NEARGOTCHI for the @NEARProtocol hackathon: hatch a pixel pet on NEAR (2 NEAR, 1 of 300, half of later hatches goes to holders), feed it, play with it, and chat with it through NEAR AI. try it: https://neargochi.vercel.app #NEARHackathon
```
(Count it again after adding the project name or the repo link.)

## Demo video script (60–90 s)
Recorded on the demo / testnet build ({{DEMO_URL}}): no real money.
1. **0:00–0:08 Landing.** Show the hero, "live on near testnet". Voice: "NEARGOTCHI, an AI pet on NEAR."
2. **0:08–0:18 Connect.** Click connect wallet, pick a testnet wallet, the account id appears in the header.
3. **0:18–0:33 Hatch.** /mint: the live counter "x / 300 hatched" from the contract, click hatch (2 NEAR), approve in the wallet. The egg cracks, the pet appears with its tier and name. Name it.
4. **0:33–0:43 Pet page.** /pet: stats tab with the NFT card, hunger and energy bars.
5. **0:43–0:55 Feed.** Feed tab: buy a snack (testnet NEAR price shown), approve, the pet eats, hunger drops. Mention the energy pack.
6. **0:55–1:10 Chat on NEAR AI.** Chat tab: "powered by near ai", send a message (a Polish one if you want to show language matching), the pet answers, energy drops by 4.
7. **1:10–1:20 Contract.** Open nearblocks testnet: the contract account and the mint transaction. One line: "ownership and payments are on chain, game state is in the browser."
8. **1:20–1:25 Outro.** Demo URL and repo.

## Pre-submission checklist
- [ ] Decision: repo public (owner). The code has no keys (secret scan of the tree and the whole history: see `docs/DEVLOG.md`).
- [ ] README has "Quick start for judges", the on/off-chain table, the contract and the mint hash (deployed wasm sha256 `a3412e7aa1e1f6df63beb0dd32ce7e2241d6543fcd51cfd7cf1603512d8b003a`)
- [ ] LICENSE (MIT) is in the repo
- [ ] Vercel env: production `NEXT_PUBLIC_CHAIN=mainnet` + `NEXT_PUBLIC_DROP1_CONTRACT` + `NEXT_PUBLIC_TREASURY` + `SESSION_SECRET` + Upstash vars; demo build `NEXT_PUBLIC_CHAIN=testnet`; `NEAR_AI_API_KEY` server-side only, no NEXT_PUBLIC_ (docs/DEPLOY.md)
- [x] Live check on the deployed site: hatch from the website done (hash above); shop purchases and NEAR AI chat were checked live by the owner
- [ ] Live NEAR AI check: `NEAR_AI_API_KEY=... npm run check:chat -- --live`, and one chat in the browser
- [x] One purchase in the shop works on testnet (checked by the owner)
- [ ] Fill in all placeholders above
- [ ] X post published, `{{X_POST_URL}}` pasted into the form
- [ ] Submit on nearhackathon.com (owner only)
