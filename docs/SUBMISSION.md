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
- Mint from the website: not recorded yet (see checklist).

## Description (paste into the form, English, ~1,300 characters)
NEARGOTCHI is an AI Tamagotchi on NEAR. You hatch a pixel pet, name it, feed it, play mini-games with it and talk to it.

How it works: a hatch costs 2 NEAR. The drop 1 contract (Rust, near-sdk 5, NEP-171/177/178/181/297) draws one random pet from a pool of 300, each with its own tier (common, rare, epic, legendary), background and item. The draw happens in a later block (commit, then reveal), with a public reveal fallback. Hatch proceeds are split 33% team, 33% stakers, 34% buyback treasury, and the NFTs carry a 5% NEP-199 royalty. The pet chat runs on NEAR AI Cloud: energy is the fuel, every answered message costs 4 energy, and an energy pack in the shop refills it. In testnet mode the shop takes small testnet NEAR payments; snacks only fill hunger.

On-chain: the NFT contract, the mint, ownership, the payout split and the shop payments (plain NEAR transfers). Off-chain: pet state (hunger, energy, stats, chat history), the mini-games (catch the snack, fetch, hide & seek) and shop stock. These live in the browser.

Status: NEAR testnet only, not audited. Staking and the $NEARGotchi token are planned, not live. Quick start for judges is in the README: open the demo, connect a testnet wallet, hatch, feed, chat.

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
- [ ] Live check on the deployed site: connect, hatch, then replace "Mint from the website" above with its hash
- [ ] Live NEAR AI check: `NEAR_AI_API_KEY=... npm run check:chat -- --live`, and one chat in the browser
- [ ] One purchase in the shop (snack or energy pack) works on testnet
- [ ] Fill in all placeholders above
- [ ] X post published, [X POST URL] pasted into the form
- [ ] Submit on nearhackathon.com (owner only)
