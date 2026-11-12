# Energy = NEAR AI credits (mainnet, task 081)

On the **mainnet** build a pet's energy is what its chat costs us in NEAR AI credits, so it lives on the **server**, not
in the browser. Demo and testnet builds (`NEXT_PUBLIC_CHAIN=demo|testnet`) are unchanged: energy stays in
localStorage, no database, no sign-in (the free demo for judges needs nothing).

## Who is the source of truth

| what | where | who can change it |
|---|---|---|
| energy of a token | Redis key `ng:energy:<contract>:<token_id>` (Upstash) | only the server: −4 per chat message, +50 per verified energy-pack payment; starts at 100 the first time the token is seen |
| who you are | HttpOnly cookie `ng_session` (HMAC-SHA256 with `SESSION_SECRET`, 24 h) | issued only after a NEP-413 signature by a full-access key of the account |
| who owns the token | the drop 1 contract (`nft_token`) | read on every energy / claim / chat request |
| whether a payment happened | the chain (`tx` + `block` via the same free RPCs as the site) | read by the server; the client never sends an amount or a receiver |
| hunger, food, games, chat log | the browser (as before) | the player |

The browser only **mirrors** the server balance into the stored pet so the bars show it; an edited value is overwritten on
the next read and buys nothing: the server decides every message.

Energy belongs to the **token**, not the account: sell or transfer the NFT and the energy goes with it.

## Flows

**Sign in** (once per 24 h, first visit to /pet with a wallet, one click):
1. `GET /api/auth/nonce` → 32 random bytes, stored for 5 min, single use; plus the exact message and recipient.
2. The wallet signs it with NEP-413 `signMessage` (MyNearWallet: popup; Meteor: its own window). **No transaction, no cost.**
3. `POST /api/auth/verify {accountId, publicKey, signature, nonce, callbackUrl}` → the server consumes the nonce,
   checks the ed25519 signature over the NEP-413 payload (with and without `callbackUrl`, since MyNearWallet's module
   passes one and Meteor's doesn't) and that `publicKey` is a **full-access** key of `accountId` on chain
   (`view_access_key`) → `Set-Cookie: ng_session=…; HttpOnly; SameSite=Lax; Secure; Max-Age=86400`.

If sign-in fails, the banner shows a small secret-free code of the failing step under the message (task 082): `nonce: <status>`, `sign: <wallet error>` / `sign: no_signature_fields (<field>)` / `sign: unsupported`, or `verify: <status> <code>` with `bad_nonce`, `bad_public_key`, `bad_signature_format`, `bad_signature`, `not_full_access`, `rate_limited`, `bad_request`; wallet results are normalised first (`lib/sign-shapes.ts`: key as `ed25519:`/bare base58/object/bytes, signature as base64/base64url/bytes).

**Read energy:** `GET /api/energy?token=ID` → session + `nft_token(ID).owner_id == session account` → balance.

**Chat:** `POST /api/chat {…, tokenId}` → session + ownership → rate limits (10/min per account, 10/min per IP) →
**−4 atomically** (Lua `GET`/`DECRBY` in one script; below 4 → 402 `no_energy`) → global daily cap
(`DAILY_CHAT_CAP`, default 300 model calls per UTC day; over it → 503 `resting`, "ai is resting, try tomorrow", energy
given back, model not called) → NEAR AI → on error / timeout / empty answer the 4 come back (`INCRBY`). Message ≤ 300
chars, history ≤ 8 messages (trimmed). Nothing is logged (no keys, no message text).

**Energy pack (0.5 NEAR → +50):**
1. The client checks the session **before** paying (no session → "sign in first", nothing paid).
2. The wallet sends 0.5 NEAR to the treasury `neargotchiai.near` (same transfer as before).
3. `POST /api/energy/claim {tx_hash, token_id}` → session + ownership → the server fetches the transaction (final)
   **as sent by the session account**, and requires: no `Failure`; signer = session account; receiver = treasury;
   sum of `Transfer` deposits ≥ 0.5 NEAR (BigInt); block ≤ 24 h old (and not from the future). Then **one atomic
   script** marks the hash (`SET NX`, 3 days) and adds +50; a repeat or a parallel duplicate gets
   `already_credited` and no second credit. Not final yet → 409 `pending`: the client says "confirming payment…" and
   retries (12 × 3 s), and keeps an unconfirmed claim for a day to retry on the next /pet load.

Food (snacks) is still paid and applied in the browser as before (task 080 checks).

## Failure behaviour (fail closed)

| situation | result |
|---|---|
| no Redis env on Vercel | ledger endpoints and the mainnet chat → 503 `store_unavailable`; /pet shows "the energy service is down right now"; nothing is spent or credited. (Locally — `next dev` / `next start` on your machine — an in-memory store is used instead.) |
| Redis error mid-request | 503, no partial credit (pay mark + credit are one script); a refund that fails after a model error is the one way to lose 4 energy |
| no / short (< 32 chars) `SESSION_SECRET` on Vercel | 503 `not_configured` (locally a random per-process secret) |
| RPC down | 503 `rpc_unavailable`; claims are retried by the client |
| no `NEAR_AI_API_KEY` | 503 `no_key` before any energy is taken; the client answers from the script for free |

## Known limits / residual risks

- **Session = bearer cookie** for 24 h: whoever has the browser has the session (HttpOnly blocks page scripts from
  reading it; `SameSite=Lax` blocks cross-site POSTs). Sign-out: `DELETE /api/auth/session`. No server-side revocation
  list: changing `SESSION_SECRET` logs everyone out.
- **Ownership is checked per request** at `final` finality: right after a transfer, the old owner may still be the owner
  on the RPC for a block or two.
- **Order of a claim:** a payment can be claimed for any token the payer owns (the transfer doesn't name a token); the
  hash is then spent for all tokens.
- **Energy can exceed 100** on the server (a pack at 80 → 130: you paid for 50); the bars show at most 100 and the
  shop calls a pet with ≥ 100 "full", so you can't buy more until it drops.
- **Rate limits / daily cap** are counted in Redis (shared by all instances). The cap counts model calls, not tokens:
  a run of very long answers costs more than the average.
- **Demo / testnet project:** no ledger and no cap — if it has `NEAR_AI_API_KEY`, its chat spends real credits under the
  old in-memory per-IP limit only. Recommended: no key on the demo project (scripted answers), or a separate key with a
  small budget.
- **Wallet support:** both MyNearWallet and Meteor (wallet-selector 10.1.4 modules) implement `signMessage`; checked in
  code, not yet with a real signature from each wallet on mainnet — sign in once with each after deploying.
- **Redis scripts** were checked offline (in-memory store with the same semantics, REST command encoding); not yet
  run against a live Upstash database.

## Code

`lib/energy-server.ts` (handlers, all rules), `lib/energy-store.ts` (Upstash REST / memory), `lib/near-auth.ts`
(NEP-413 + session), `lib/energy-rules.ts` (numbers shared with the client), `lib/energy-client.ts` (browser),
routes `app/api/auth/{nonce,verify,session}`, `app/api/energy`, `app/api/energy/claim`, `app/api/chat` (mainnet branch).
Tests: `npm run check:energy`.
