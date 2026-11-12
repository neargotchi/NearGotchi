// Server side of energy = NEAR AI credits (task 081, docs/ENERGY.md). Mainnet only: the ledger here is the single
// source of truth for a token's energy. Demo / testnet builds never reach these handlers (the routes answer
// "not_mainnet" and /api/chat keeps its old behaviour), so the judges' demo needs no database.
//
// Nothing from the client is trusted for money: the account comes from a signed session, the token's owner from
// the contract, the amount / receiver / signer / age of a payment from the chain (RPC), the price and treasury from
// server config. Every balance change is one atomic store operation (lib/energy-store.ts).
// Fail closed: no store, no session secret, a store or RPC error → 503 and no energy is spent or credited.

import { CHAIN, DROP1_CONTRACT, TREASURY_ACCOUNT, rpc as chainRpc, type Chain } from "./chain";
import { LIMITS, askModels, parseRequest } from "./chat-ai";
import { CHAT_COST, ENERGY_START, PACK_ENERGY, PACK_PRICE_YOCTO, SIGN_IN_MESSAGE, SIGN_IN_RECIPIENT } from "./energy-rules";
import { StoreError, getEnergyStore, type EnergyStore } from "./energy-store";
import { SESSION_TTL_SEC, newNonce, readSession, signSession, verifySignedMessage } from "./near-auth";

export const RULES = {
  /** chat messages per minute, per account and per IP */
  chatPerMinute: 10,
  /** model calls per UTC day for the whole site (DAILY_CHAT_CAP overrides) */
  dailyCapDefault: 300,
  /** sign-in nonces / verifications per IP per minute */
  authPerMinute: 20,
  nonceTtlSec: 300,
  /** a payment older than this can't be claimed */
  paymentMaxAgeMs: 24 * 60 * 60 * 1000,
  /** "used payment" marks live a bit longer than a payment can be claimed */
  paidTtlSec: 3 * 24 * 60 * 60,
  /** a block "from the future" beyond this clock skew is rejected */
  futureSkewMs: 10 * 60 * 1000,
} as const;

export type Rpc = <T>(method: string, params: unknown) => Promise<T>;

export type ServerDeps = {
  chain: Chain;
  store: EnergyStore | null;
  /** HMAC key for the session cookie (SESSION_SECRET); null = not configured */
  secret: string | null;
  contract: string;
  treasury: string;
  rpc: Rpc;
  now: () => number;
  ai: { key?: string; model?: string; fetch?: typeof fetch };
  dailyCap: number;
};

/** Local runs without SESSION_SECRET get a per-process random secret; on Vercel a missing secret fails closed. */
let devSecret: string | null = null;
function sessionSecret(env: Record<string, string | undefined>): string | null {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) return env.SESSION_SECRET;
  if (env.VERCEL) return null;
  devSecret ??= newNonce().toString("hex");
  return devSecret;
}

export function defaultDeps(env: Record<string, string | undefined> = process.env): ServerDeps {
  const cap = Number(env.DAILY_CHAT_CAP);
  return {
    chain: CHAIN,
    store: getEnergyStore(env),
    secret: sessionSecret(env),
    contract: DROP1_CONTRACT,
    treasury: TREASURY_ACCOUNT,
    rpc: chainRpc,
    now: Date.now,
    ai: { key: env.NEAR_AI_API_KEY, model: env.NEAR_AI_MODEL },
    dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : RULES.dailyCapDefault,
  };
}

export type ErrorCode =
  | "not_mainnet"
  | "not_configured"
  | "store_unavailable"
  | "rpc_unavailable"
  | "bad_request"
  | "too_long"
  | "rate_limited"
  | "unauthorized"
  | "bad_nonce"
  | "bad_signature"
  | "not_full_access"
  | "not_owner"
  | "pending"
  | "not_a_payment"
  | "too_old"
  | "no_energy"
  | "no_key"
  | "resting"
  | "upstream"
  | "timeout";

export type Reply = {
  status: number;
  body: Record<string, unknown> & { error?: ErrorCode };
  /** session cookie to set (value + max age); "" = clear it */
  session?: { value: string; maxAge: number };
};

const fail = (status: number, error: ErrorCode, extra: Record<string, unknown> = {}): Reply => ({ status, body: { error, ...extra } });

const ACCOUNT_RE = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const HASH_RE = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export const energyKey = (contract: string, tokenId: number) => `ng:energy:${contract}:${tokenId}`;
const dayKey = (now: number) => `ng:chat:day:${new Date(now).toISOString().slice(0, 10)}`;

/** "1".."300" or a number → the token id, else null. */
export function parseTokenId(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,3}$/.test(text)) return null;
  const id = Number(text);
  return id >= 1 && id <= 300 ? id : null;
}

/** Shared gate: mainnet + store + secret. */
function gate(deps: ServerDeps): Reply | null {
  if (deps.chain !== "mainnet") return fail(404, "not_mainnet");
  if (!deps.store) return fail(503, "store_unavailable");
  if (!deps.secret) return fail(503, "not_configured");
  return null;
}

/** Wraps a handler: store / RPC exceptions become 503 (fail closed), never a 500 with details. */
async function guarded(run: () => Promise<Reply>): Promise<Reply> {
  try {
    return await run();
  } catch (error) {
    return error instanceof StoreError ? fail(503, "store_unavailable") : fail(503, "rpc_unavailable");
  }
}

async function tooMany(deps: ServerDeps, key: string, perMinute: number): Promise<boolean> {
  return (await deps.store!.hit(key, 60)) > perMinute;
}

/** Owner of a drop-1 token from the contract (`nft_token`), null when it doesn't exist. */
async function ownerOf(deps: ServerDeps, tokenId: number): Promise<string | null> {
  const result = await deps.rpc<{ result?: number[] }>("query", {
    request_type: "call_function",
    finality: "final",
    account_id: deps.contract,
    method_name: "nft_token",
    args_base64: Buffer.from(JSON.stringify({ token_id: String(tokenId) })).toString("base64"),
  });
  const token = JSON.parse(Buffer.from(result.result ?? []).toString("utf8") || "null") as { owner_id?: string } | null;
  return token?.owner_id ?? null;
}

/** Session account + token ownership, or the error reply. */
async function ownedToken(deps: ServerDeps, cookie: string | undefined, rawToken: unknown): Promise<{ account: string; tokenId: number } | Reply> {
  const account = readSession(cookie, deps.secret!, deps.now());
  if (!account) return fail(401, "unauthorized");
  const tokenId = parseTokenId(rawToken);
  if (tokenId === null) return fail(400, "bad_request");
  if ((await ownerOf(deps, tokenId)) !== account) return fail(403, "not_owner");
  return { account, tokenId };
}

const isReply = (value: unknown): value is Reply => typeof value === "object" && value !== null && "status" in value && "body" in value;

// ---------- sign-in ----------

/** GET /api/auth/nonce: a single-use nonce (5 min) and the exact message / recipient to sign. */
export function handleNonce(ip: string, deps: ServerDeps = defaultDeps()): Promise<Reply> {
  return guarded(async () => {
    const closed = gate(deps);
    if (closed) return closed;
    if (await tooMany(deps, `ng:rl:auth:${ip}`, RULES.authPerMinute)) return fail(429, "rate_limited");
    const nonce = newNonce().toString("base64");
    await deps.store!.takeOnce(`ng:nonce:${nonce}`, "1", RULES.nonceTtlSec);
    return { status: 200, body: { nonce, message: SIGN_IN_MESSAGE, recipient: SIGN_IN_RECIPIENT } };
  });
}

/** POST /api/auth/verify { accountId, publicKey, signature, nonce, callbackUrl? } → session cookie (24 h). */
export function handleVerify(body: unknown, ip: string, deps: ServerDeps = defaultDeps()): Promise<Reply> {
  return guarded(async () => {
    const closed = gate(deps);
    if (closed) return closed;
    if (await tooMany(deps, `ng:rl:auth:${ip}`, RULES.authPerMinute)) return fail(429, "rate_limited");
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const { accountId, publicKey, signature, nonce } = b;
    const callbackUrl = typeof b.callbackUrl === "string" ? b.callbackUrl.slice(0, 500) : null;
    if (typeof accountId !== "string" || !ACCOUNT_RE.test(accountId) || typeof publicKey !== "string" || typeof signature !== "string" || typeof nonce !== "string") {
      return fail(400, "bad_request");
    }
    // single use: consumed before anything else, so a replayed signature finds no nonce
    if ((await deps.store!.consume(`ng:nonce:${nonce}`)) !== "1") return fail(401, "bad_nonce");
    const nonceBytes = Buffer.from(nonce, "base64");
    if (!verifySignedMessage({ publicKey, signature, message: SIGN_IN_MESSAGE, nonce: nonceBytes, recipient: SIGN_IN_RECIPIENT, callbackUrl })) {
      return fail(401, "bad_signature");
    }
    // the key must be a full-access key of that account right now (not a function-call key, not someone else's)
    let permission: unknown;
    try {
      permission = (await deps.rpc<{ permission?: unknown }>("query", { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey })).permission;
    } catch (error) {
      if (/UNKNOWN_ACCESS_KEY|UNKNOWN_ACCOUNT|does not exist/i.test(String((error as Error)?.message ?? error))) return fail(401, "not_full_access");
      throw error;
    }
    if (permission !== "FullAccess") return fail(401, "not_full_access");
    return { status: 200, body: { account: accountId }, session: { value: signSession(accountId, deps.secret!, deps.now()), maxAge: SESSION_TTL_SEC } };
  });
}

/** GET /api/auth/session: the signed-in account, or 401. */
export async function handleSession(cookie: string | undefined, deps: ServerDeps = defaultDeps()): Promise<Reply> {
  if (deps.chain !== "mainnet") return fail(404, "not_mainnet");
  if (!deps.secret) return fail(503, "not_configured");
  const account = readSession(cookie, deps.secret, deps.now());
  return account ? { status: 200, body: { account } } : fail(401, "unauthorized");
}

// ---------- energy ----------

/** GET /api/energy?token=ID: the token's balance (created with ENERGY_START on first sight). */
export function handleEnergy(cookie: string | undefined, rawToken: unknown, deps: ServerDeps = defaultDeps()): Promise<Reply> {
  return guarded(async () => {
    const closed = gate(deps);
    if (closed) return closed;
    const owned = await ownedToken(deps, cookie, rawToken);
    if (isReply(owned)) return owned;
    const energy = await deps.store!.balance(energyKey(deps.contract, owned.tokenId), ENERGY_START);
    return { status: 200, body: { energy, token: owned.tokenId } };
  });
}

type ChainTx = {
  status?: { SuccessValue?: string; Failure?: unknown } | string;
  transaction?: { signer_id?: string; receiver_id?: string; actions?: unknown[] };
  transaction_outcome?: { block_hash?: string };
};

/** Sum of the Transfer deposits of a transaction (yoctoNEAR). */
export function transferredYocto(actions: unknown[] | undefined): bigint {
  let sum = BigInt(0);
  for (const action of actions ?? []) {
    const deposit = (action as { Transfer?: { deposit?: unknown } } | null)?.Transfer?.deposit;
    if (typeof deposit === "string" && /^\d+$/.test(deposit)) sum += BigInt(deposit);
  }
  return sum;
}

/**
 * POST /api/energy/claim { tx_hash, token_id }: credits PACK_ENERGY once per payment. The server reads the finished
 * transaction itself: signer = session account, receiver = treasury, Transfer sum ≥ pack price, success, block ≤ 24 h
 * old. The payment hash is marked and the energy added in one atomic step, so a repeat (or a parallel duplicate) gets
 * "already_credited" and no second credit. 409 "pending" = not final on chain yet: the client retries.
 */
export function handleClaim(cookie: string | undefined, body: unknown, deps: ServerDeps = defaultDeps()): Promise<Reply> {
  return guarded(async () => {
    const closed = gate(deps);
    if (closed) return closed;
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const hash = typeof b.tx_hash === "string" ? b.tx_hash.trim() : "";
    if (!HASH_RE.test(hash)) return fail(400, "bad_request");
    const owned = await ownedToken(deps, cookie, b.token_id);
    if (isReply(owned)) return owned;
    if (!deps.treasury) return fail(503, "not_configured");

    let tx: ChainTx;
    try {
      tx = await deps.rpc<ChainTx>("tx", { tx_hash: hash, sender_account_id: owned.account, wait_until: "FINAL" });
    } catch (error) {
      // unknown / not final yet (or a hash of someone else's tx: sender must be the session account)
      if (/UNKNOWN_TRANSACTION|TIMEOUT|not found|INVALID_TRANSACTION/i.test(String((error as Error)?.message ?? error))) return fail(409, "pending");
      throw error;
    }
    const status = typeof tx.status === "object" ? tx.status : null;
    const paid =
      status !== null &&
      status.Failure === undefined &&
      tx.transaction?.signer_id === owned.account &&
      tx.transaction?.receiver_id === deps.treasury &&
      transferredYocto(tx.transaction?.actions) >= BigInt(PACK_PRICE_YOCTO);
    if (!paid) return fail(402, "not_a_payment");
    const blockHash = tx.transaction_outcome?.block_hash;
    if (!blockHash) return fail(409, "pending");
    const block = await deps.rpc<{ header?: { timestamp_nanosec?: string } }>("block", { block_id: blockHash });
    const ns = block.header?.timestamp_nanosec;
    const at = ns && /^\d+$/.test(ns) ? Number(BigInt(ns) / BigInt(1000000)) : NaN;
    const now = deps.now();
    if (!Number.isFinite(at) || at < now - RULES.paymentMaxAgeMs || at > now + RULES.futureSkewMs) return fail(402, "too_old");

    const key = energyKey(deps.contract, owned.tokenId);
    const credited = await deps.store!.creditOnce(`ng:paid:${hash}`, `${owned.account}:${owned.tokenId}`, RULES.paidTtlSec, key, PACK_ENERGY, ENERGY_START);
    if (credited === null) {
      return { status: 200, body: { status: "already_credited", energy: await deps.store!.balance(key, ENERGY_START), token: owned.tokenId } };
    }
    return { status: 200, body: { status: "credited", energy: credited, added: PACK_ENERGY, token: owned.tokenId } };
  });
}

// ---------- chat ----------

/**
 * POST /api/chat on mainnet: session + token ownership, rate limits (account and IP), then CHAT_COST energy is taken
 * atomically BEFORE the model is called; the global daily cap is checked; a failed / timed-out answer gives the energy
 * back. The reply carries the new balance. Message and history are trimmed by parseRequest (LIMITS). Nothing logged.
 */
export function handleMainnetChat(cookie: string | undefined, body: unknown, ip: string, deps: ServerDeps = defaultDeps()): Promise<Reply> {
  return guarded(async () => {
    const closed = gate(deps);
    if (closed) return closed;
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const owned = await ownedToken(deps, cookie, b.tokenId);
    if (isReply(owned)) return owned;
    const parsed = parseRequest(body);
    if (!parsed.ok) return fail(400, parsed.error);
    if (await tooMany(deps, `ng:rl:chat:ip:${ip}`, RULES.chatPerMinute)) return fail(429, "rate_limited");
    if (await tooMany(deps, `ng:rl:chat:acct:${owned.account}`, RULES.chatPerMinute)) return fail(429, "rate_limited");
    if (!deps.ai.key) return fail(503, "no_key");

    const store = deps.store!;
    const key = energyKey(deps.contract, owned.tokenId);
    const left = await store.spend(key, CHAT_COST, ENERGY_START);
    if (left === null) return fail(402, "no_energy", { energy: await store.balance(key, ENERGY_START) });
    if ((await store.hit(dayKey(deps.now()), 2 * 24 * 60 * 60)) > deps.dailyCap) {
      return fail(503, "resting", { energy: await store.refund(key, CHAT_COST) });
    }
    const request = { ...parsed.value, stats: { ...parsed.value.stats, energy: Math.min(100, left) } };
    const attempt = await askModels(request, deps.ai.key, deps.ai.model, deps.ai.fetch);
    if (attempt.ok) return { status: 200, body: { reply: attempt.reply, energy: left } };
    const energy = await store.refund(key, CHAT_COST);
    return attempt.timeout ? fail(504, "timeout", { energy }) : fail(502, "upstream", { energy });
  });
}

/** For the docs / tests: the limits the mainnet chat uses. */
export const CHAT_LIMITS = { messageMax: LIMITS.messageMax, historyMax: LIMITS.historyMax, perMinute: RULES.chatPerMinute };
