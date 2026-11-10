# SUBMISSION — NEAR Hackathon (deadline 2026-11-14 23:59 UTC)

Nothing here has been sent or published. The owner does every step after their own confirmation.

## Placeholders to fill in (not invented)
- [ ] [PROJECT NAME]
- [ ] [TEAM LEAD NAME]
- [ ] [CONTACT EMAIL]
- [ ] [TEAM SIZE]
- [ ] [MAINNET PAYOUT ACCOUNT]
- [ ] [X POST URL] (after the post is published)
- [ ] README: `[USER: list of own libraries or "none"]`

## Tracks
- games
- nfts

## Links
- Demo: https://neargochi.vercel.app
- Repo: https://github.com/neargotchi/NearGochi (visibility = owner's decision)
- Contract (NEAR testnet): `neargotchi-drop1-ng57.testnet` · https://testnet.nearblocks.io/address/neargotchi-drop1-ng57.testnet
- Test mint (admin account, token #83): `9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB` · https://testnet.nearblocks.io/txns/9YizpnEU8jo5NY1tnhiozrTeTnTMQtvTteAmNm2ugtMB
- Mint from the website (`nft_mint`, 2 NEAR, token #10, account `buyer1.testnet`): `D5NRFD7v9pwDmw2Kmg21QtAgf3CRrZ5R1hehEiYnBnf7` · https://testnet.nearblocks.io/txns/D5NRFD7v9pwDmw2Kmg21QtAgf3CRrZ5R1hehEiYnBnf7

## Description (paste into the form, English, 1408 characters; the form allows 20–2000)
NEARGOTCHI is an AI Tamagotchi on NEAR. You hatch a pixel pet, feed it, play mini-games with it and talk to it. It runs on NEAR testnet; the chain stays out of the way until you mint or buy.

GAMES: the loop is hunger, food, games, talk. A pet gets hungry over time (about 110 minutes from 0 to 100), snacks fix hunger, three mini-games (catch the snack, fetch, hide & seek) make it happy but a bit hungrier, and talking uses energy. Energy is the fuel of the chat, which runs on NEAR AI Cloud (Claude Haiku 5.5, GLM as fallback): every answered message costs 4 energy, and an energy pack in the shop refills it. Food and packs are paid in small testnet NEAR transfers. Players only see the chain when they mint and when they buy.

NFTS: a hatch costs 2 NEAR and the drop 1 contract (Rust, near-sdk 5, NEP-171/177/178/181/297) draws one random pet from a pool of 300 (commit, then reveal in a later block). The NFT is the pet: it has a character, a state and a tier (common, rare, epic, legendary). Hatch proceeds are split 33% team, 33% stakers, 34% buyback in the contract, with a 5% NEP-199 royalty. Ownership of the token decides who can open the pet and its chat.

On-chain: the NFT, ownership, the split and the shop payments. Off-chain: pet state, chat history, the mini-games and shop stock (in the browser). Status: testnet only, not audited. Staking and the $NEARGotchi token are planned, not live.

## X post draft (max 280 chars)
```
we built NEARGOTCHI for the @NEARProtocol hackathon: hatch a pixel pet on NEAR testnet (2 NEAR, 1 of 300), feed it, play with it, and chat with it through NEAR AI. try it: https://neargochi.vercel.app #NEARHackathon
```
(Count it again after adding the project name or the repo link.)

## Demo video script (60–90 s)
1. **0:00–0:08 Landing.** Show the hero, "live on near testnet". Voice: "NEARGOTCHI, an AI pet on NEAR."
2. **0:08–0:18 Connect.** Click connect wallet, pick a testnet wallet, the account id appears in the header.
3. **0:18–0:33 Hatch.** /mint: the live counter "x / 300 hatched" from the contract, click hatch (2 NEAR), approve in the wallet. The egg cracks, the pet appears with its tier and name. Name it.
4. **0:33–0:43 Pet page.** /pet: stats tab with the NFT card, hunger and energy bars.
5. **0:43–0:55 Feed.** Feed tab: buy a snack (testnet NEAR price shown), approve, the pet eats, hunger drops. Mention the energy pack.
6. **0:55–1:10 Chat on NEAR AI.** Chat tab: "powered by near ai", send a message (a Polish one if you want to show language matching), the pet answers, energy drops by 4.
7. **1:10–1:20 Contract.** Open nearblocks testnet: the contract account and the mint transaction. One line: "ownership and payments are on chain, game state is in the browser."
8. **1:20–1:25 Outro.** Demo URL and repo.

## Pre-submission checklist
- [ ] Decision: repo public (owner). The code has no keys (see the grep in the REPORT).
- [ ] README has "Quick start for judges", the on/off-chain table, the contract and the mint hash
- [ ] LICENSE (MIT) is in the repo
- [ ] Vercel env: `NEXT_PUBLIC_CHAIN=testnet`, `NEAR_AI_API_KEY` (server-side, no NEXT_PUBLIC_), redeploy
- [x] Live check on the deployed site: hatch from the website done (hash above); shop purchases and NEAR AI chat were checked live by the owner
- [ ] Live NEAR AI check: `NEAR_AI_API_KEY=... npm run check:chat -- --live`, and one chat in the browser
- [x] One purchase in the shop works on testnet (checked by the owner)
- [ ] Fill in all placeholders above
- [ ] X post published, [X POST URL] pasted into the form
- [ ] Submit on nearhackathon.com (owner only)
