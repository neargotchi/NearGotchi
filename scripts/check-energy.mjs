// Checks for energy = NEAR AI credits on the server (task 081, docs/ENERGY.md): sign-in (NEP-413 + session), the
// energy ledger, energy-pack claims and the mainnet chat. Everything runs offline: an in-memory store, a fake RPC and
// a fake NEAR AI; a real ed25519 key pair signs the sign-in messages.
//   node --experimental-transform-types --no-warnings scripts/check-energy.mjs
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.\w+$/.test(specifier) && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".json")) return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    return next(url, context);
  },
});

const S = await import("../lib/energy-server.ts");
const { MemoryStore, RedisRestStore, StoreError, getEnergyStore, resetEnergyStore, redisEnv } = await import("../lib/energy-store.ts");
const auth = await import("../lib/near-auth.ts");
const rules = await import("../lib/energy-rules.ts");
const chainLib = await import("../lib/chain.ts");
const chatAi = await import("../lib/chat-ai.ts");

let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`  ok  ${name}`);
}

// ---------- fixtures ----------
const ME = "buyer.near";
const OTHER = "other.near";
const TREASURY = "neargotchiai.near";
const CONTRACT = "drop1.neargochi-dev.near";
const SECRET = "s".repeat(48);
const NOW = Date.parse("2026-11-13T12:00:00Z");
const PACK = rules.PACK_PRICE_YOCTO;

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
const fakeHash = (seed) => b58(Buffer.alloc(32, seed));

const owners = { 5: ME, 7: OTHER };
const keys = new Map(); // `${account}|${publicKey}` → permission
const txs = new Map(); // hash → tx (sender must match)
const blocks = new Map(); // block hash → ms
let rpcCalls = 0;
const rpc = async (method, params) => {
  rpcCalls++;
  if (method === "query" && params.request_type === "call_function" && params.method_name === "nft_token") {
    const id = JSON.parse(Buffer.from(params.args_base64, "base64").toString()).token_id;
    const token = owners[id] ? { token_id: id, owner_id: owners[id] } : null;
    return { result: [...Buffer.from(JSON.stringify(token))] };
  }
  if (method === "query" && params.request_type === "view_access_key") {
    const permission = keys.get(`${params.account_id}|${params.public_key}`);
    if (!permission) throw new Error("UNKNOWN_ACCESS_KEY");
    return { nonce: 1, permission };
  }
  if (method === "tx") {
    const tx = txs.get(params.tx_hash);
    if (!tx || tx.transaction.signer_id !== params.sender_account_id) throw new Error("UNKNOWN_TRANSACTION");
    return tx;
  }
  if (method === "block") {
    const ms = blocks.get(params.block_id);
    if (ms === undefined) throw new Error("UNKNOWN_BLOCK");
    return { header: { timestamp_nanosec: String(BigInt(ms) * 1000000n) } };
  }
  throw new Error(`unexpected rpc ${method}`);
};

/** A finished payment: defaults = a correct energy-pack payment by ME, 1 minute ago. */
function pay(seed, over = {}) {
  const hash = fakeHash(seed);
  const blockHash = `block-${seed}`;
  blocks.set(blockHash, over.at ?? NOW - 60_000);
  txs.set(hash, {
    status: over.status ?? { SuccessValue: "" },
    transaction: { signer_id: over.signer ?? ME, receiver_id: over.receiver ?? TREASURY, actions: over.actions ?? [{ Transfer: { deposit: over.deposit ?? PACK } }] },
    transaction_outcome: { block_hash: blockHash },
  });
  return hash;
}

const ok = (content) => async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const deps = (over = {}) => ({
  chain: "mainnet",
  store: new MemoryStore(() => NOW),
  secret: SECRET,
  contract: CONTRACT,
  treasury: TREASURY,
  rpc,
  now: () => NOW,
  ai: { key: "ai-key", model: undefined, fetch: ok("gm. i saw you coming three blocks ago.") },
  dailyCap: 300,
  ...over,
});
const session = (account = ME) => auth.signSession(account, SECRET, NOW);
const chatBody = (over = {}) => ({ petType: "pet3", petName: "kat", stats: { hunger: 20, energy: 99, mood: "normal" }, history: [], message: "gm", tokenId: 5, ...over });
const energyOf = async (d, token = 5) => (await S.handleEnergy(session(), token, d)).body.energy;

// ---------- sign-in ----------
console.log("sign-in (NEP-413 + session)");
const pair = generateKeyPairSync("ed25519");
const rawPub = Buffer.from(pair.publicKey.export({ format: "jwk" }).x, "base64url");
const PUB = `ed25519:${b58(rawPub)}`;
keys.set(`${ME}|${PUB}`, "FullAccess");
const signNep413 = (nonceB64, callbackUrl = null, key = pair.privateKey) =>
  sign(null, auth.nep413Hash(rules.SIGN_IN_MESSAGE, Buffer.from(nonceB64, "base64"), rules.SIGN_IN_RECIPIENT, callbackUrl), key).toString("base64");

await test("nonce → wallet signature → verify: session cookie (HttpOnly value), 24 h, the account in it", async () => {
  const d = deps();
  const issued = await S.handleNonce("1.1.1.1", d);
  assert.equal(issued.status, 200);
  assert.equal(issued.body.message, rules.SIGN_IN_MESSAGE);
  assert.equal(Buffer.from(issued.body.nonce, "base64").length, 32);
  const res = await S.handleVerify({ accountId: ME, publicKey: PUB, signature: signNep413(issued.body.nonce), nonce: issued.body.nonce }, "1.1.1.1", d);
  assert.equal(res.status, 200);
  assert.equal(res.body.account, ME);
  assert.equal(res.session.maxAge, 24 * 3600);
  assert.equal(auth.readSession(res.session.value, SECRET, NOW), ME);
  assert.equal(auth.readSession(res.session.value, SECRET, NOW + 25 * 3600 * 1000), null, "expires after 24 h");
});
await test("a nonce works once; the signature must match; the key must be a FULL-access key of that account", async () => {
  const d = deps();
  const n1 = (await S.handleNonce("ip", d)).body.nonce;
  const good = { accountId: ME, publicKey: PUB, signature: signNep413(n1), nonce: n1 };
  assert.equal((await S.handleVerify(good, "ip", d)).status, 200);
  assert.equal((await S.handleVerify(good, "ip", d)).body.error, "bad_nonce", "replay");
  const n2 = (await S.handleNonce("ip", d)).body.nonce;
  const stranger = generateKeyPairSync("ed25519");
  assert.equal((await S.handleVerify({ ...good, nonce: n2, signature: signNep413(n2, null, stranger.privateKey) }, "ip", d)).body.error, "bad_signature");
  const n3 = (await S.handleNonce("ip", d)).body.nonce;
  assert.equal((await S.handleVerify({ ...good, accountId: OTHER, nonce: n3, signature: signNep413(n3) }, "ip", d)).body.error, "not_full_access", "my key, someone else's account");
  keys.set(`${OTHER}|${PUB}`, { FunctionCall: { allowance: null, receiver_id: CONTRACT, method_names: [] } });
  const n4 = (await S.handleNonce("ip", d)).body.nonce;
  assert.equal((await S.handleVerify({ ...good, accountId: OTHER, nonce: n4, signature: signNep413(n4) }, "ip", d)).body.error, "not_full_access", "function-call key");
  keys.delete(`${OTHER}|${PUB}`);
  assert.equal((await S.handleVerify({ ...good, nonce: "AAAA" }, "ip", d)).body.error, "bad_nonce", "a nonce we never issued");
});
await test("MyNearWallet-style payload with callbackUrl is accepted when the client says which url it used", async () => {
  const d = deps();
  const n = (await S.handleNonce("ip", d)).body.nonce;
  const url = "https://neargochi.vercel.app/pet?tab=chat";
  const res = await S.handleVerify({ accountId: ME, publicKey: PUB, signature: signNep413(n, url), nonce: n, callbackUrl: url }, "ip", d);
  assert.equal(res.status, 200);
});
await test("session cookie: tampered / other secret / garbage → no account", async () => {
  const value = session();
  assert.equal(auth.readSession(value, SECRET, NOW), ME);
  assert.equal(auth.readSession(value.replace(/^./, (c) => (c === "e" ? "f" : "e")), SECRET, NOW), null);
  assert.equal(auth.readSession(value, "x".repeat(48), NOW), null);
  assert.equal(auth.readSession("nope", SECRET, NOW), null);
  assert.equal(auth.readSession(undefined, SECRET, NOW), null);
});
await test("auth endpoints are rate limited per IP", async () => {
  const d = deps();
  for (let i = 0; i < S.RULES.authPerMinute; i++) assert.equal((await S.handleNonce("9.9.9.9", d)).status, 200);
  assert.equal((await S.handleNonce("9.9.9.9", d)).body.error, "rate_limited");
});

// ---------- energy ----------
console.log("energy ledger");
await test("no session → 401; someone else's token → 403; bad token id → 400; own token starts at ENERGY_START once", async () => {
  const d = deps();
  assert.equal((await S.handleEnergy(undefined, 5, d)).status, 401);
  assert.equal((await S.handleEnergy(session(), 7, d)).status, 403);
  assert.equal((await S.handleEnergy(session(), "0", d)).status, 400);
  assert.equal((await S.handleEnergy(session(), "abc", d)).status, 400);
  assert.equal((await S.handleEnergy(session(), "301", d)).status, 400);
  assert.equal(await energyOf(d), rules.ENERGY_START);
  assert.equal(await energyOf(d), rules.ENERGY_START, "SETNX: not reset on the next read");
});
await test("the balance belongs to the TOKEN: after a transfer the new owner sees (and spends) it, the old one gets 403", async () => {
  const d = deps();
  await S.handleMainnetChat(session(), chatBody(), "ip-a", d);
  owners[5] = OTHER;
  assert.equal((await S.handleEnergy(session(), 5, d)).status, 403);
  assert.equal((await S.handleEnergy(session(OTHER), 5, d)).body.energy, 96);
  owners[5] = ME;
});

// ---------- claims ----------
console.log("energy pack claims");
await test("valid payment → +50 once; the same hash again → already_credited, no second credit", async () => {
  const d = deps();
  const hash = pay(1);
  const first = await S.handleClaim(session(), { tx_hash: hash, token_id: 5 }, d);
  assert.equal(first.status, 200);
  assert.deepEqual([first.body.status, first.body.energy], ["credited", 150]);
  const again = await S.handleClaim(session(), { tx_hash: hash, token_id: 5 }, d);
  assert.deepEqual([again.status, again.body.status, again.body.energy], [200, "already_credited", 150]);
  assert.equal(await energyOf(d), 150);
});
await test("parallel duplicate claims of one payment: exactly one credit", async () => {
  const d = deps();
  const hash = pay(2);
  const results = await Promise.all(Array.from({ length: 5 }, () => S.handleClaim(session(), { tx_hash: hash, token_id: 5 }, d)));
  assert.equal(results.filter((r) => r.body.status === "credited").length, 1);
  assert.equal(results.filter((r) => r.body.status === "already_credited").length, 4);
  assert.equal(await energyOf(d), 150);
});
await test("one payment can't be claimed for two tokens (or by two accounts)", async () => {
  const d = deps();
  owners[6] = ME;
  const hash = pay(3);
  assert.equal((await S.handleClaim(session(), { tx_hash: hash, token_id: 5 }, d)).body.status, "credited");
  assert.equal((await S.handleClaim(session(), { tx_hash: hash, token_id: 6 }, d)).body.status, "already_credited");
  assert.equal(await energyOf(d, 6), rules.ENERGY_START);
  delete owners[6];
});
await test("rejected payments: too little, wrong receiver, someone else's tx, failed tx, older than 24 h, from the future", async () => {
  const d = deps();
  const claim = (hash) => S.handleClaim(session(), { tx_hash: hash, token_id: 5 }, d);
  assert.equal((await claim(pay(10, { deposit: "499999999999999999999999" }))).body.error, "not_a_payment");
  assert.equal((await claim(pay(11, { receiver: "neargotchi-team-ng57.testnet" }))).body.error, "not_a_payment");
  assert.equal((await claim(pay(12, { signer: OTHER }))).body.error, "pending", "the server looks the tx up as sent by the session account: not found");
  assert.equal((await claim(pay(13, { status: { Failure: { ActionError: {} } } }))).body.error, "not_a_payment");
  assert.equal((await claim(pay(14, { status: "Started" }))).body.error, "not_a_payment");
  assert.equal((await claim(pay(15, { at: NOW - 25 * 3600 * 1000 }))).body.error, "too_old");
  assert.equal((await claim(pay(16, { at: NOW + 3600 * 1000 }))).body.error, "too_old");
  assert.equal((await claim(pay(17, { actions: [{ FunctionCall: { method_name: "x", deposit: PACK } }] }))).body.error, "not_a_payment", "only Transfer counts");
  assert.equal(await energyOf(d), rules.ENERGY_START, "nothing credited");
});
await test("accepted: overpay, a payment split over two Transfer actions; unknown / not final tx → 409 pending (client retries)", async () => {
  const d = deps();
  const claim = (hash) => S.handleClaim(session(), { tx_hash: hash, token_id: 5 }, d);
  assert.equal((await claim(pay(20, { deposit: "600000000000000000000000" }))).body.energy, 150);
  assert.equal((await claim(pay(21, { actions: [{ Transfer: { deposit: "250000000000000000000000" } }, { Transfer: { deposit: "250000000000000000000000" } }] }))).body.energy, 200);
  const res = await claim(fakeHash(99));
  assert.deepEqual([res.status, res.body.error], [409, "pending"]);
});
await test("claims need a session and the token's ownership; the hash must look like a hash", async () => {
  const d = deps();
  const hash = pay(30);
  assert.equal((await S.handleClaim(undefined, { tx_hash: hash, token_id: 5 }, d)).status, 401);
  assert.equal((await S.handleClaim(session(), { tx_hash: hash, token_id: 7 }, d)).status, 403);
  assert.equal((await S.handleClaim(session(), { tx_hash: "not a hash!", token_id: 5 }, d)).status, 400);
  assert.equal((await S.handleClaim(session(), { tx_hash: hash, token_id: 5, amount: "999", receiver: "me.near" }, d)).body.energy, 150, "extra client fields are ignored");
});

// ---------- chat ----------
console.log("mainnet chat");
await test("a message costs CHAT_COST, taken before the model call; the reply carries the new balance", async () => {
  const d = deps();
  let seenEnergy = null;
  const spy = async () => {
    seenEnergy = await energyOf(d);
    return ok("gm")();
  };
  const res = await S.handleMainnetChat(session(), chatBody(), "ip", { ...d, ai: { key: "ai-key", fetch: spy } });
  assert.deepEqual([res.status, res.body.reply, res.body.energy], [200, "gm", 96]);
  assert.equal(seenEnergy, 96, "already taken while the model runs");
});
await test("two parallel messages at 4 energy: exactly one goes through, the other gets 402 no_energy", async () => {
  const d = deps();
  for (let i = 0; i < 24; i++) await d.store.spend(S.energyKey(CONTRACT, 5), rules.CHAT_COST, rules.ENERGY_START);
  assert.equal(await energyOf(d), 4);
  const [a, b] = await Promise.all([S.handleMainnetChat(session(), chatBody(), "ip1", d), S.handleMainnetChat(session(), chatBody(), "ip2", d)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 402]);
  assert.equal(await energyOf(d), 0);
  const res = await S.handleMainnetChat(session(), chatBody(), "ip3", d);
  assert.deepEqual([res.status, res.body.error, res.body.energy], [402, "no_energy", 0]);
});
await test("model error / timeout / empty answer: the energy comes back", async () => {
  for (const [fetchImpl, status] of [
    [async () => new Response("{}", { status: 500 }), 502],
    [async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; }, 504],
    [ok(""), 502],
  ]) {
    const d = deps();
    const res = await S.handleMainnetChat(session(), chatBody(), "ip", { ...d, ai: { key: "ai-key", fetch: fetchImpl } });
    assert.equal(res.status, status);
    assert.equal(res.body.energy, rules.ENERGY_START);
    assert.equal(await energyOf(d), rules.ENERGY_START);
  }
});
await test("no session → 401, someone else's token → 403, no NEAR AI key → 503 without spending", async () => {
  const d = deps();
  assert.equal((await S.handleMainnetChat(undefined, chatBody(), "ip", d)).status, 401);
  assert.equal((await S.handleMainnetChat(session(), chatBody({ tokenId: 7 }), "ip", d)).status, 403);
  const noKey = await S.handleMainnetChat(session(), chatBody(), "ip", { ...d, ai: { key: undefined } });
  assert.deepEqual([noKey.status, noKey.body.error], [503, "no_key"]);
  assert.equal(await energyOf(d), rules.ENERGY_START);
});
await test("limits: message length / history trimmed, 10 messages per minute per account and per IP", async () => {
  const d = deps();
  assert.equal((await S.handleMainnetChat(session(), chatBody({ message: "x".repeat(301) }), "ip", d)).body.error, "too_long");
  let sent = null;
  const spy = async (url, init) => { sent = JSON.parse(init.body); return ok("ok")(); };
  const long = Array.from({ length: 30 }, (_, i) => ({ from: i % 2 ? "pet" : "you", text: "y".repeat(500) }));
  await S.handleMainnetChat(session(), chatBody({ history: long }), "ip-h", { ...d, ai: { key: "k", fetch: spy } });
  assert.ok(sent.messages.length <= 1 + 8 + 1, "system + 8 history + message");
  assert.ok(sent.messages.every((m) => m.content.length <= 2000));
  const e = deps();
  for (let i = 0; i < S.RULES.chatPerMinute; i++) assert.equal((await S.handleMainnetChat(session(), chatBody(), `ip-${i}`, e)).status, 200);
  assert.equal((await S.handleMainnetChat(session(), chatBody(), "ip-new", e)).body.error, "rate_limited", "per account");
  const f = deps();
  owners[8] = OTHER;
  for (let i = 0; i < S.RULES.chatPerMinute; i++) await S.handleMainnetChat(session(i % 2 ? ME : OTHER), chatBody({ tokenId: i % 2 ? 5 : 8 }), "same-ip", f);
  assert.equal((await S.handleMainnetChat(session(), chatBody(), "same-ip", f)).body.error, "rate_limited", "per IP");
  delete owners[8];
});
await test("global daily cap: past DAILY_CHAT_CAP no model call, 'resting', energy given back", async () => {
  let calls = 0;
  const d = deps({ dailyCap: 2 });
  const counting = async () => { calls++; return ok("hi")(); };
  const run = (ip) => S.handleMainnetChat(session(), chatBody(), ip, { ...d, ai: { key: "k", fetch: counting } });
  assert.equal((await run("a")).status, 200);
  assert.equal((await run("b")).status, 200);
  const third = await run("c");
  assert.deepEqual([third.status, third.body.error, third.body.energy], [503, "resting", 92]);
  assert.equal(calls, 2);
  assert.equal(S.defaultDeps({ DAILY_CHAT_CAP: "50" }).dailyCap, 50);
  assert.equal(S.defaultDeps({}).dailyCap, 300);
});

// ---------- fail closed / other chains ----------
console.log("fail closed + demo / testnet");
await test("no store / no secret / store down → 503 and nothing spent or credited", async () => {
  assert.equal((await S.handleEnergy(session(), 5, deps({ store: null }))).body.error, "store_unavailable");
  assert.equal((await S.handleMainnetChat(session(), chatBody(), "ip", deps({ secret: null }))).body.error, "not_configured");
  const broken = new MemoryStore(() => NOW);
  broken.spend = async () => { throw new StoreError("redis unreachable"); };
  broken.hit = async () => 1;
  const res = await S.handleMainnetChat(session(), chatBody(), "ip", deps({ store: broken }));
  assert.deepEqual([res.status, res.body.error], [503, "store_unavailable"]);
  const rpcDown = await S.handleEnergy(session(), 5, deps({ rpc: async () => { throw new Error("every endpoint failed"); } }));
  assert.deepEqual([rpcDown.status, rpcDown.body.error], [503, "rpc_unavailable"]);
});
await test("store choice: Upstash (either env naming) → redis; nothing on Vercel → null (fail closed); local → memory", async () => {
  assert.deepEqual(redisEnv({ UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "t" }), { url: "https://u", token: "t" });
  assert.deepEqual(redisEnv({ KV_REST_API_URL: "https://k", KV_REST_API_TOKEN: "t2" }), { url: "https://k", token: "t2" });
  resetEnergyStore(undefined);
  assert.equal(getEnergyStore({ VERCEL: "1" }), null);
  resetEnergyStore(undefined);
  assert.equal(getEnergyStore({}).kind, "memory");
  resetEnergyStore(undefined);
  assert.equal(getEnergyStore({ KV_REST_API_URL: "https://k", KV_REST_API_TOKEN: "t" }).kind, "redis");
  resetEnergyStore(undefined);
  assert.equal(S.defaultDeps({ VERCEL: "1" }).secret, null, "no SESSION_SECRET on Vercel = not configured");
  assert.equal(S.defaultDeps({ VERCEL: "1", SESSION_SECRET: "short" }).secret, null, "a short secret is refused");
  assert.equal(S.defaultDeps({ SESSION_SECRET: SECRET }).secret, SECRET);
});
await test("Upstash REST: commands as a JSON array with a Bearer token; spend / creditOnce are single EVAL scripts", async () => {
  const sent = [];
  const fake = async (url, init) => {
    sent.push({ url, auth: init.headers.authorization, body: JSON.parse(init.body) });
    const cmd = JSON.parse(init.body)[0];
    return new Response(JSON.stringify({ result: cmd === "SET" ? "OK" : cmd === "EVAL" ? -1 : 7 }), { status: 200 });
  };
  const r = new RedisRestStore("https://redis.example", "tok", fake);
  assert.equal(await r.takeOnce("k", "v", 60), true);
  assert.equal(await r.spend("e", 4, 100), null, "-1 from the script = not enough");
  assert.equal(await r.creditOnce("p", "x", 10, "e", 50, 100), null, "-1 = already credited");
  assert.equal(await r.refund("e", 4), 7);
  assert.deepEqual(sent[0].body, ["SET", "k", "v", "NX", "EX", "60"]);
  assert.equal(sent[0].auth, "Bearer tok");
  assert.equal(sent[1].body[0], "EVAL");
  assert.deepEqual(sent[1].body.slice(2), ["1", "e", "4", "100"]);
  assert.deepEqual(sent[2].body.slice(2), ["2", "p", "e", "x", "10", "50", "100"]);
  const failing = new RedisRestStore("https://redis.example", "tok", async () => new Response(JSON.stringify({ error: "WRONGPASS" }), { status: 401 }));
  await assert.rejects(failing.balance("e", 100), (e) => e instanceof StoreError && !/tok/.test(e.message), "token never in the error");
});
await test("demo / testnet builds: every ledger endpoint answers not_mainnet; the old /api/chat logic is untouched", async () => {
  for (const chain of ["demo", "testnet"]) {
    const d = deps({ chain });
    assert.equal((await S.handleNonce("ip", d)).body.error, "not_mainnet");
    assert.equal((await S.handleVerify({}, "ip", d)).body.error, "not_mainnet");
    assert.equal((await S.handleSession(session(), d)).body.error, "not_mainnet");
    assert.equal((await S.handleEnergy(session(), 5, d)).body.error, "not_mainnet");
    assert.equal((await S.handleClaim(session(), { tx_hash: pay(40), token_id: 5 }, d)).body.error, "not_mainnet");
    assert.equal((await S.handleMainnetChat(session(), chatBody(), "ip", d)).body.error, "not_mainnet");
  }
  chatAi.resetRateLimit();
  const demo = await chatAi.handleChat({ petType: "pet1", petName: "b", stats: {}, history: [], message: "gm" }, "ip", { key: "k" }, ok("woof"));
  assert.deepEqual([demo.status, demo.body.reply], [200, "woof"]);
  assert.equal(chainLib.CHAIN, "demo", "this process: no NEXT_PUBLIC_CHAIN = demo build");
});
await test("shared numbers match the client (pack price / size, chat cost, start)", async () => {
  const shop = await import("../lib/shop.ts");
  const mocks = await import("../lib/mocks.ts");
  assert.equal(rules.PACK_PRICE_YOCTO, chainLib.nearToYocto(shop.NEAR_PRICES.energy));
  assert.equal(rules.PACK_PRICE_NEAR, shop.NEAR_PRICES.energy);
  assert.equal(rules.PACK_ENERGY, shop.ENERGY_PACK.energy);
  assert.equal(rules.CHAT_COST, mocks.PET_RULES.chatEnergy);
  assert.equal(rules.ENERGY_START, 100);
});

console.log(`${passed} checks passed (rpc calls: ${rpcCalls})`);
