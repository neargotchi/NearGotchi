// On-chain build checks (task 068), run by scripts/check-drop1.mjs in a child process with
// NEXT_PUBLIC_CHAIN=testnet NEXT_PUBLIC_DROP1_CONTRACT=neargotchi-drop1-ng67.testnet (lib/chain.ts reads env at import).
// RPC is a mocked fetch (lib/chain.ts rpcRuntime); localStorage is an in-memory stub; no wallet library is loaded.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.\w+$/.test(specifier) && context.parentURL?.endsWith(".ts")) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    }
    return next(url, context);
  },
});

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
let clock = Date.parse("2026-11-11T12:00:00Z");
Date.now = () => clock;
const later = () => (clock += 20000); // past the 15 s owned-token cache

const chain = await import("../lib/chain.ts");
const mocks = await import("../lib/mocks.ts");
const drop = await import("../lib/drop1.ts");
const shop = await import("../lib/shop.ts");
const tokens = JSON.parse(readFileSync(new URL("../lib/drop1-tokens.json", import.meta.url), "utf8"));
assert.equal(chain.CHAIN, "testnet");
assert.equal(chain.DROP1_CONTRACT, "neargotchi-drop1-ng67.testnet");

// ---- mocked contract: owners → token ids; `down` = every endpoint fails ----
const holdings = new Map();
let down = false;
let minted = 2;
chain.rpcRuntime.sleep = async () => {};
chain.rpcRuntime.fetch = async (url, init) => {
  if (down) throw new TypeError("fetch failed");
  const body = JSON.parse(init.body);
  const { method_name, args_base64 } = body.params;
  const args = JSON.parse(atob(args_base64));
  let value;
  if (method_name === "nft_tokens_for_owner") value = (holdings.get(args.account_id) ?? []).map((id) => ({ token_id: String(id), owner_id: args.account_id }));
  else if (method_name === "drop_status") value = { minted, total: 300, sold_out: false, paused: false };
  else throw new Error(`unexpected ${method_name}`);
  return { ok: true, status: 200, json: async () => ({ result: { result: Array.from(new TextEncoder().encode(JSON.stringify(value))) } }) };
};

const connect = (accountId) =>
  localStorage.setItem("neargotchi-wallet", JSON.stringify({ v: 1, accountId, connected: true, connectedAt: new Date(clock).toISOString(), balance: 100 }));
const petFor = (owner, tokenId, name) => {
  const t = tokens.find((row) => row.tokenId === tokenId);
  const pet = { v: 4, id: `demo-${t.petId}-${tokenId}-1`, owner, petId: t.petId, species: { pet1: "corgi", pet2: "dragon", pet3: "meerkat" }[t.petId], name,
    hunger: 20, energy: 100, mood: "happy", mintedAt: "2026-11-09T10:00:00.000Z", lastUpdated: "2026-11-09T10:00:00.000Z", happyUntil: null,
    stats: { games: 0, snacks: 0, messages: 0, best: { snack: 0, fetch: 0, hideseek: 0 } },
    token: { tokenId, tier: t.tier, background: t.background, accessory: t.accessory }, demo: true };
  return pet;
};

// 1. keys are namespaced by chain + contract
assert.equal(mocks.PETS_STORAGE_KEY, "neargotchi-pets:testnet:neargotchi-drop1-ng67.testnet");
assert.equal(mocks.CHAT_STORAGE_KEY, "neargotchi-chat:testnet:neargotchi-drop1-ng67.testnet");
assert.equal(shop.SHOP_STORAGE_KEY, "neargotchi-shop:testnet:neargotchi-drop1-ng67.testnet");
console.log("keys namespaced by chain + contract");

// 2. the user's case: buyer1.testnet had pet #10 from ng57 in the old (un-namespaced) key, holds nothing on ng67
const oldStore = JSON.stringify({ v: 4, pets: [petFor("buyer1.testnet", 10, "old")], active: { "buyer1.testnet": "demo-pet1-10-1" } });
localStorage.setItem("neargotchi-pets", oldStore);
localStorage.setItem("neargotchi-pet", JSON.stringify({ v: 3, id: "x" })); // a legacy demo pet: never migrated on chain
connect("buyer1.testnet");
assert.deepEqual(await mocks.getPets(), []);
assert.equal(await mocks.getPet(), null);
assert.equal(await mocks.getPet("10"), null);
assert.equal(localStorage.getItem("neargotchi-pets"), oldStore, "the old state is kept under its own key, untouched");
assert.ok(localStorage.getItem("neargotchi-pet"), "legacy demo pet not touched on chain");
console.log("old ng57 pet invisible on ng67 (kept under its own key)");

// 3. even a pet stored in THIS namespace is hidden when the contract says the account doesn't hold the token
localStorage.setItem(mocks.PETS_STORAGE_KEY, JSON.stringify({ v: 4, pets: [petFor("buyer1.testnet", 10, "stale")], active: {} }));
later();
assert.deepEqual(await mocks.getPets(), []);
console.log("stored pet of a token the account doesn't hold: hidden");

// 4. the contract lists token 5 → exactly that pet appears (auto-created), token 10 stays hidden
holdings.set("buyer1.testnet", [5]);
later();
const mine = await mocks.getPets();
assert.deepEqual(mine.map((p) => p.token.tokenId), [5]);
assert.equal((await mocks.getPet()).token.tokenId, 5);
console.log("held token 5 → its pet shows, nothing else");

// 5. another account in the same browser sees none of it; a token that moves to it gets its own pet
connect("bob.testnet");
later();
assert.deepEqual(await mocks.getPets(), []);
holdings.set("buyer1.testnet", []);
holdings.set("bob.testnet", [5]);
later();
assert.deepEqual((await mocks.getPets()).map((p) => [p.owner, p.token.tokenId]), [["bob.testnet", 5]]);
connect("buyer1.testnet");
later();
assert.deepEqual(await mocks.getPets(), [], "transferred away → hidden for the old owner");
console.log("account switch + transfer: each account sees only what it holds now");

// 6. RPC down: the last known list is used (never someone else's pet, never an old contract's)
holdings.set("buyer1.testnet", [5]);
later();
assert.equal((await mocks.getPets()).length, 1);
down = true;
later();
assert.deepEqual((await mocks.getPets()).map((p) => p.token.tokenId), [5], "last known holdings");
connect("carol.testnet");
assert.deepEqual(await mocks.getPets(), [], "never loaded + RPC down → nothing");
down = false;
console.log("rpc down: last known holdings, nothing for a never-loaded account");

// 7. counter: last good value cached per chain + contract; "—" (null) only if nothing was ever read
assert.equal(drop.STATUS_CACHE_KEY, "neargotchi-drop-status:testnet:neargotchi-drop1-ng67.testnet");
store.delete(drop.STATUS_CACHE_KEY);
down = true;
assert.equal(await drop.getDropStatus(), null, "never read → null (UI: —)");
down = false;
minted = 2;
assert.equal((await drop.getDropStatus()).minted, 2);
down = true;
const cached = await drop.getDropStatus();
assert.equal(cached.minted, 2);
assert.equal(cached.total, 300);
down = false;
console.log("counter: cached 2/300 when the rpc fails, null only before the first read");

console.log("onchain ok");
