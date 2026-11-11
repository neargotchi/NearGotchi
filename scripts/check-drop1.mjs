// Checks for lib/drop1.ts, lib/wallet.ts, DemoPet v4 (migrations v1–v3 → v4, collection, chat v2, mint from a
// drawn token, rename, feed from the wallet) and the rarity-only copy
// rule (docs/DEVLOG.md §5).
//   node --experimental-transform-types scripts/check-drop1.mjs
// No test runner, no deps: Node runs the TS directly; two hooks let it load the bundler-style imports
// (extensionless "./drop1", JSON without an import attribute). window.localStorage is an in-memory stub.
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
let blocked = false;
const localStorage = {
  getItem: (k) => { if (blocked) throw new Error("blocked"); return store.has(k) ? store.get(k) : null; },
  setItem: (k, v) => { if (blocked) throw new Error("blocked"); store.set(k, String(v)); },
  removeItem: (k) => { if (blocked) throw new Error("blocked"); store.delete(k); },
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };

const drop = await import("../lib/drop1.ts");
const mocks = await import("../lib/mocks.ts");
const tokens = JSON.parse(readFileSync(new URL("../lib/drop1-tokens.json", import.meta.url), "utf8"));
const KEY = drop.MINTED_STORAGE_KEY;
const minted = () => JSON.parse(store.get(KEY) ?? "[]");
const idsOf = (petId) => tokens.filter((t) => t.petId === petId).map((t) => t.tokenId);

let passed = 0;
async function test(name, run) {
  store.clear();
  blocked = false;
  await run();
  passed++;
  console.log(`  ok  ${name}`);
}

const basePet = (v, extra = {}) => ({
  v, id: "demo-pet2-1", petId: "pet2", species: "dragon", name: "nightshade", balance: 100, hunger: 20, energy: 100,
  mood: "happy", outfit: {}, mintedAt: "2026-11-01T10:00:00.000Z", demo: true, ...extra,
});

console.log("drop1");
await test("slim list: ids 1..300, unique, every token has its webp and its og card", async () => {
  assert.equal(drop.DROP1_TOTAL, 300);
  assert.deepEqual(tokens.map((t) => t.tokenId), Array.from({ length: 300 }, (_, i) => i + 1));
  for (const t of tokens) assert.equal((await drop.getToken(t.tokenId)).image, `/drop1/${t.tokenId}.webp`);
  readFileSync(new URL("../public/drop1/300.webp", import.meta.url));
  // /nft/[id] share cards (scripts/build_og.py): one 1200×630 JPEG per token.
  for (const t of tokens) {
    const jpg = readFileSync(new URL(`../public/og/drop1/${t.tokenId}.jpg`, import.meta.url));
    assert.equal(jpg.readUInt16BE(0), 0xffd8, `og ${t.tokenId} is a JPEG`);
  }
});

await test("300 hatches: no repeated id, then sold out", async () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const t = await drop.hatchRandom();
    assert.ok(!seen.has(t.tokenId), `repeat #${t.tokenId}`);
    seen.add(t.tokenId);
  }
  assert.equal(seen.size, 300);
  assert.deepEqual(await drop.getDropStatus(), { minted: 300, total: 300, soldOut: true });
  await assert.rejects(drop.hatchRandom(), (e) => e instanceof drop.DropError && e.code === "sold_out");
  await drop.resetDrop();
  assert.deepEqual(await drop.getDropStatus(), { minted: 0, total: 300, soldOut: false });
});

await test("corrupt minted list is cleared and counts as nothing minted", async () => {
  for (const bad of ["nope", "{}", "[1,1]", "[0]", "[301]", '["1"]', "[1.5]", "null", JSON.stringify(Array(301).fill(1))]) {
    store.set(KEY, bad);
    assert.equal((await drop.getDropStatus()).minted, 0, bad);
    assert.ok(!store.has(KEY), `${bad} not cleared`);
  }
  store.set(KEY, "[5,7]");
  const t = await drop.hatchRandom();
  assert.ok(![5, 7].includes(t.tokenId));
  assert.equal(minted().length, 3);
});

await test("blocked storage: draws from memory, still no repeats", async () => {
  blocked = true;
  const before = (await drop.getDropStatus()).minted; // memory keeps the last list it saw
  const a = await drop.hatchRandom();
  const b = await drop.hatchRandom();
  assert.notEqual(a.tokenId, b.tokenId);
  assert.equal((await drop.getDropStatus()).minted, before + 2);
  blocked = false;
  await drop.resetDrop();
});

await test("claim for one pet stays in that pet's 100, then null", async () => {
  const own = new Set(idsOf("pet2"));
  for (let i = 0; i < 100; i++) assert.ok(own.has(drop.claimRandomToken("pet2").tokenId));
  assert.equal(drop.claimRandomToken("pet2"), null);
  assert.equal(drop.claimRandomToken("pet1").petId, "pet1");
});

await test("landing helpers: 12 backgrounds in file order with their tier; a sample token per pet and tier", async () => {
  const bgs = drop.dropBackgrounds();
  assert.equal(bgs.length, 12);
  assert.deepEqual(bgs.map((b) => b.id.slice(0, 3)), ["c01", "c02", "c03", "c04", "c05", "c06", "r07", "r08", "r09", "e10", "e11", "l12"]);
  assert.deepEqual([...new Set(bgs.map((b) => b.tier))], ["common", "rare", "epic", "legendary"]);
  for (const petId of ["pet1", "pet2", "pet3"]) {
    for (const tier of drop.tiers) {
      const t = drop.tierSample(petId, tier);
      assert.ok(t && t.petId === petId && t.tier === tier, `${petId} ${tier}`);
    }
  }
});

console.log("wallet");
const wallet = await import("../lib/wallet.ts");
const WKEY = wallet.WALLET_STORAGE_KEY;
const account = () => JSON.parse(store.get(WKEY));

await test("connect → you.demo with 100; disconnect keeps the record; reconnect brings it back", async () => {
  assert.equal(await wallet.getAccount(), null);
  const a = await wallet.connect();
  assert.equal(a.accountId, "you.demo");
  assert.equal(a.balance, 100);
  assert.equal(account().connected, true);
  await wallet.spend(30);
  await wallet.disconnect();
  assert.equal(await wallet.getAccount(), null);
  assert.equal(account().connected, false);
  assert.equal(account().balance, 70);
  assert.equal((await wallet.connect()).balance, 70, "same account, same balance");
  await assert.rejects(wallet.spend(71), (e) => e instanceof wallet.WalletError && e.code === "broke");
  assert.equal((await wallet.refill()).balance, 100);
});

await test("wallet: corrupt record cleared; spend without a wallet fails", async () => {
  for (const bad of ["nope", "{}", JSON.stringify({ v: 1, accountId: "evil.near", connected: true, connectedAt: "2026-11-01T10:00:00.000Z", balance: 5 }), JSON.stringify({ v: 1, accountId: "you.demo", connected: true, connectedAt: "x", balance: -1 })]) {
    store.set(WKEY, bad);
    assert.equal(await wallet.getAccount(), null, bad);
    assert.ok(!store.has(WKEY));
  }
  await assert.rejects(wallet.spend(1), (e) => e.code === "not_connected");
});

console.log("DemoPet v4");
const LEGACY = mocks.LEGACY_PET_STORAGE_KEY;
const PKEY = mocks.PETS_STORAGE_KEY;
const save = (pet) => store.set(LEGACY, JSON.stringify(pet));
const pets = () => JSON.parse(store.get(PKEY));

await test("v1 → v4: lastUpdated now, token of the same pet, minted, owner you.demo, old key removed", async () => {
  save(basePet(1));
  await wallet.connect();
  const pet = await mocks.getPet();
  assert.equal(pet.v, 4);
  assert.equal(pet.owner, "you.demo");
  assert.ok(Date.now() - Date.parse(pet.lastUpdated) < 5000);
  assert.ok(idsOf("pet2").includes(pet.token.tokenId));
  assert.deepEqual(minted(), [pet.token.tokenId]);
  assert.deepEqual(pets().pets, [pet]);
  assert.ok(!store.has(LEGACY));
  assert.equal(!("balance" in pet) && !("outfit" in pet), true);
  assert.deepEqual(pet.stats, { games: 0, snacks: 0, messages: 0, best: { snack: 0, fetch: 0, hideseek: 0 } });
});

await test("rename: old default names become near dragon / near kat; picked names stay", async () => {
  await wallet.connect();
  save(basePet(2, { lastUpdated: "2026-11-02T10:00:00.000Z" })); // pet2 "nightshade"
  assert.equal((await mocks.getPet()).name, "near dragon");
  assert.equal(pets().pets[0].name, "near dragon", "saved under the new name");
  const t3 = tokens.find((x) => x.petId === "pet3");
  const t1 = tokens.find((x) => x.petId === "pet1");
  const asToken = (t) => ({ tokenId: t.tokenId, tier: t.tier, background: t.background, accessory: t.accessory });
  const stored = pets();
  const v4 = (id, petId, species, name, t) => ({ ...stored.pets[0], id, petId, species, name, token: asToken(t) });
  store.set(PKEY, JSON.stringify({ ...stored, pets: [...stored.pets, v4("k", "pet3", "meerkat", "merk", t3), v4("c", "pet1", "corgi", "merk", t1)] }));
  const names = (await mocks.getPets()).map((p) => [p.id, p.name]);
  assert.deepEqual(names.slice(1), [["k", "near kat"], ["c", "merk"]], "a corgi the user named merk keeps it");
  assert.equal(tokens.filter((t) => /merk|nightshade/.test(t.name)).length, 0);
  assert.equal(tokens.find((t) => t.petId === "pet2").name.split(" #")[0], "near dragon");
});

await test("v2 → v4 keeps lastUpdated; migrates once; works before the wallet is connected", async () => {
  save(basePet(2, { lastUpdated: "2026-11-02T10:00:00.000Z", balance: 140 }));
  assert.equal(await mocks.getPet(), null, "no wallet → no pet shown");
  assert.equal(pets().pets.length, 1, "but the collection is already migrated");
  assert.equal(account().connected, false, "migration creates the account, still disconnected");
  assert.equal(account().balance, 140, "the pet's balance moved to the account");
  await wallet.connect();
  const a = await mocks.getPet();
  const b = await mocks.getPet();
  assert.equal(a.lastUpdated, "2026-11-02T10:00:00.000Z");
  assert.deepEqual(a.token, b.token);
  assert.equal(minted().length, 1);
  const known = tokens.find((t) => t.tokenId === a.token.tokenId);
  assert.deepEqual(a.token, { tokenId: known.tokenId, tier: known.tier, background: known.background, accessory: known.accessory });
});

await test("v3 → v4: a lower balance never lowers the account's", async () => {
  await wallet.connect(); // 100
  const t = tokens.find((x) => x.petId === "pet2");
  save(basePet(3, { lastUpdated: "2026-11-02T10:00:00.000Z", balance: 20, token: { tokenId: t.tokenId, tier: t.tier, background: t.background, accessory: t.accessory } }));
  assert.equal((await mocks.getPet()).token.tokenId, t.tokenId);
  assert.equal(account().balance, 100);
  assert.deepEqual(minted(), [t.tokenId], "v3 pet whose id fell off the minted list puts it back");
});

await test("v2 whose pet has no free token → v4 with token null", async () => {
  store.set(KEY, JSON.stringify(idsOf("pet2")));
  save(basePet(2, { lastUpdated: "2026-11-02T10:00:00.000Z" }));
  await wallet.connect();
  const pet = await mocks.getPet();
  assert.equal(pet.v, 4);
  assert.equal(pet.token, null);
  assert.equal(minted().length, 100);
  assert.equal((await mocks.getPet()).token, null);
});

await test("v3 with a wrong / unknown / missing token is corrupt: dropped, old key removed", async () => {
  await wallet.connect();
  const pet1Token = tokens.find((t) => t.petId === "pet1");
  const pet2Token = tokens.find((t) => t.petId === "pet2");
  const asToken = (t) => ({ tokenId: t.tokenId, tier: t.tier, background: t.background, accessory: t.accessory });
  const bad = [
    asToken(pet1Token), // another pet's token
    { ...asToken(pet2Token), tier: pet2Token.tier === "legendary" ? "common" : "legendary" },
    { ...asToken(pet2Token), tokenId: 999 },
    "7",
    undefined,
  ];
  for (const token of bad) {
    save(basePet(3, { lastUpdated: "2026-11-02T10:00:00.000Z", token }));
    assert.equal(await mocks.getPet(), null, JSON.stringify(token));
    assert.ok(!store.has(LEGACY));
    assert.ok(!store.has(PKEY), "nothing to keep → no collection written");
  }
});

await test("v1 chat log becomes the migrated pet's log (chat v2)", async () => {
  save(basePet(2, { lastUpdated: "2026-11-02T10:00:00.000Z" }));
  const msg = { id: "m-1", from: "you", text: "gm", at: "2026-11-02T10:00:00.000Z" };
  store.set(mocks.CHAT_STORAGE_KEY, JSON.stringify({ v: 1, petInstanceId: "demo-pet2-1", messages: [msg] }));
  await wallet.connect();
  assert.deepEqual(await mocks.getChat(), [msg]);
  assert.deepEqual(JSON.parse(store.get(mocks.CHAT_STORAGE_KEY)), { v: 2, logs: { "demo-pet2-1": [msg] } });
});

await test("collection: needs a wallet; many pets; active = newest or chosen; release falls back; chat per pet", async () => {
  const first = await drop.hatchRandom();
  await assert.rejects(mocks.mintPet({ token: first }), (e) => e.code === "no_wallet");
  await wallet.connect();
  const a = await mocks.mintPet({ token: first });
  const b = await mocks.mintPet({ token: await drop.hatchRandom(), name: "scout" });
  assert.deepEqual((await mocks.getPets()).map((p) => p.id), [a.id, b.id]);
  assert.equal((await mocks.getPet()).id, b.id, "the new pet is active");
  await assert.rejects(mocks.mintPet({ token: first }), (e) => e.code === "no_pet", "one pet per token");
  await mocks.setActivePet(a.id);
  assert.equal((await mocks.getPet()).id, a.id);
  await mocks.chatWithPet("gm");
  await mocks.chatWithPet("hello", b.id);
  assert.equal((await mocks.getChat(a.id)).length, 2);
  assert.equal((await mocks.getChat(b.id)).length, 2);
  assert.equal((await mocks.getPet(a.id)).stats.messages, 1);
  await mocks.releasePet(a.id);
  assert.equal((await mocks.getPet()).id, b.id, "falls back to the remaining pet");
  assert.equal((await mocks.getChat(a.id)).length, 0);
  assert.deepEqual(Object.keys(JSON.parse(store.get(mocks.CHAT_STORAGE_KEY)).logs), [b.id]);
  assert.ok(minted().includes(first.tokenId), "a released pet's token stays minted");
  await wallet.disconnect();
  assert.equal(await mocks.getPet(), null);
  assert.deepEqual(await mocks.getPets(), []);
  await assert.rejects(mocks.renamePet("scout"), (e) => e.code === "no_pet");
  await wallet.connect();
  assert.equal((await mocks.getPet()).id, b.id, "pets come back with the account");
});

await test("v4: a bad pet or a duplicate is dropped alone; a bad shape resets the collection", async () => {
  await wallet.connect();
  const a = await mocks.mintPet({ token: await drop.hatchRandom() });
  const b = await mocks.mintPet({ token: await drop.hatchRandom() });
  const raw = pets();
  store.set(PKEY, JSON.stringify({ ...raw, pets: [raw.pets[0], { ...raw.pets[1], hunger: 300 }, { ...raw.pets[0], id: "copy" }, { ...raw.pets[0] }] }));
  assert.deepEqual((await mocks.getPets()).map((p) => p.id), [a.id]);
  assert.deepEqual(pets().active, {}, "active pointed at the dropped pet");
  assert.equal((await mocks.getPet()).id, a.id);
  void b;
  for (const bad of ["nope", "[]", JSON.stringify({ v: 3, pets: [], active: {} })]) {
    store.set(PKEY, bad);
    assert.deepEqual(await mocks.getPets(), [], bad);
  }
});

await test("mintPet saves the drawn token; rename; update keeps it; release keeps it minted", async () => {
  await wallet.connect();
  const drawn = await drop.hatchRandom();
  const pet = await mocks.mintPet({ token: drawn });
  assert.equal(pet.v, 4);
  assert.equal(pet.petId, drawn.petId);
  assert.equal(pet.name, tokens.find((t) => t.tokenId === drawn.tokenId).name.split(" #")[0], "default = the pet's own name");
  assert.equal(pet.token.tokenId, drawn.tokenId);
  assert.deepEqual(minted(), [drawn.tokenId], "mintPet claims nothing extra");
  assert.equal((await mocks.renamePet("  Scout  ")).name, "scout");
  await assert.rejects(mocks.renamePet("x"), (e) => e.code === "too_short");
  assert.equal((await mocks.renamePet("")).name, pet.name, "empty → the pet's own name");
  const fed = await mocks.updatePet({ hunger: 50 });
  assert.deepEqual(fed.token, pet.token);
  await mocks.releasePet();
  assert.equal(await mocks.getPet(), null);
  assert.deepEqual(minted(), [drawn.tokenId]);
  await assert.rejects(mocks.mintPet({ token: { tokenId: 999 } }), (e) => e.code === "no_pet");
  await assert.rejects(mocks.renamePet("scout"), (e) => e.code === "no_pet");
});

await test("hunger tempo (task 064): +0.9/min, 0 → 100 in ~111 min, hungry (70) after ~78 min; energy does not move (task 059)", async () => {
  const start = Date.parse("2026-11-02T10:00:00.000Z");
  const pet = { ...basePet(4), hunger: 20, energy: 100, lastUpdated: new Date(start).toISOString() };
  assert.equal(mocks.PET_RULES.hungerPerMin, 0.9);
  const later = mocks.simulatePet(pet, start + 10 * 60000);
  assert.equal(later.hunger, 29);
  const fresh = { ...pet, hunger: 0 };
  const at = (min) => mocks.simulatePet(fresh, start + min * 60000);
  assert.equal(at(77).mood, "normal");
  assert.equal(at(79).mood, "hungry", "hungry after ~78 min");
  assert.ok(at(100).hunger < 100 && at(100).hunger >= 89, "starving (≥ 90, no games) only after ~100 min");
  assert.equal(at(112).hunger, 100, "0 → 100 in ~111 min");
  assert.equal(later.energy, 100, "energy is constant over time");
  assert.equal(later.mood, "normal");
});

await test("chat (task 059): an answered message costs 4 energy and NO hunger; hungry answer also costs energy; < 4 energy = blocked", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  const a = await mocks.chatWithPet("gm", pet.id);
  assert.equal(a.kind, "reply");
  assert.ok(Math.abs(a.pet.energy - 76) < 0.1, String(a.pet.energy));
  assert.ok(Math.abs(a.pet.hunger - 20) < 0.1, "chat leaves hunger alone");
  assert.equal(a.pet.stats.messages, 1);
  assert.equal(mocks.PET_RULES.chatHunger, 0);
  assert.equal(mocks.PET_RULES.chatEnergy, 4);
  await mocks.updatePet({ hunger: 90, energy: 80 }, pet.id);
  const b = await mocks.chatWithPet("gm", pet.id);
  assert.equal(b.kind, "hungry");
  assert.ok(Math.abs(b.pet.hunger - 90) < 0.1 && Math.abs(b.pet.energy - 76) < 0.1);
  await mocks.updatePet({ hunger: 20, energy: 3 }, pet.id);
  const c = await mocks.chatWithPet("gm", pet.id);
  assert.equal(c.kind, "no_energy");
  assert.equal(c.reply.text, "no_energy");
  assert.ok(Math.abs(c.pet.hunger - 20) < 0.1 && Math.abs(c.pet.energy - 3) < 0.1, "blocked chat spends nothing");
  assert.equal(c.pet.stats.messages, 3);
  await mocks.updatePet({ energy: 4 }, pet.id);
  assert.equal((await mocks.chatWithPet("gm", pet.id)).kind, "reply", "exactly the cost is enough");
});

await test("chat on NEAR AI (task 060): energy is taken only after a good answer; error / no key", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  let asked;
  const ok = await mocks.chatWithPet("gm", pet.id, async (req) => ((asked = req), { status: "ok", text: "rawr from ai" }));
  assert.equal(ok.source, "ai");
  assert.equal(ok.reply.text, "rawr from ai");
  assert.ok(Math.abs(ok.pet.energy - 76) < 0.1);
  assert.equal(asked.message, "gm");
  assert.equal(asked.petType, pet.petId);
  assert.deepEqual(Object.keys(asked.stats).sort(), ["energy", "hunger", "mood"]);
  const bad = await mocks.chatWithPet("again", pet.id, async () => ({ status: "error" }));
  assert.equal(bad.kind, "ai_error");
  assert.ok(Math.abs(bad.pet.energy - 76) < 0.1, "API error: energy stays");
  const nokey = await mocks.chatWithPet("gm", pet.id, async () => ({ status: "no_key" }));
  assert.equal(nokey.source, "mock");
  assert.equal(nokey.kind, "reply");
  assert.ok(Math.abs(nokey.pet.energy - 72) < 0.1, "no key: the mock answers and costs energy");
  await mocks.updatePet({ energy: 2 }, pet.id);
  let called = false;
  const blocked = await mocks.chatWithPet("gm", pet.id, async () => ((called = true), { status: "ok", text: "x" }));
  assert.equal(blocked.kind, "no_energy");
  assert.equal(called, false, "no energy: the AI is not even asked");
});

await test("energy (task 059): constant over any time, no sleep from low energy; hunger still rises", async () => {
  const start = Date.parse("2026-11-02T10:00:00.000Z");
  const base = { ...basePet(4), owner: "you.demo", happyUntil: null, lastUpdated: new Date(start).toISOString() };
  for (const energy of [0, 10, 30, 100]) {
    for (const minutes of [1, 60, 24 * 60]) {
      const later = mocks.simulatePet({ ...base, hunger: 0, energy, mood: "normal" }, start + minutes * 60000);
      assert.equal(later.energy, energy, `energy ${energy} after ${minutes} min`);
      assert.notEqual(later.mood, "sleep");
    }
  }
  const hours = mocks.simulatePet({ ...base, hunger: 20, energy: 100, mood: "normal" }, start + 3 * 60 * 60000);
  assert.equal(hours.hunger, 100);
  assert.equal(hours.mood, "hungry");
  assert.equal(mocks.baseMood({ hunger: 0, energy: 0, mood: "sleep" }), "normal", "a stored sleep mood is ignored");
});

await test("chat: the 'who' line uses the pet's own name", async () => {
  assert.equal(mocks.pickReply({ petId: "pet2", name: "pixel" }, "who are you", 0), "pixel. small dragon. big shards. bigger plans.");
  assert.equal(mocks.pickReply({ petId: "pet1" }, "who are you", 0), "batman. corgi. legend. the real dog of this whole thing.");
});

console.log("shop");
const shop = await import("../lib/shop.ts");
const SKEY = shop.SHOP_STORAGE_KEY;
const shopPet = async (patch = {}) => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  return mocks.updatePet({ hunger: 60, energy: 60, ...patch }, pet.id);
};
const stockOf = async (id) => (await shop.getShop()).find((item) => item.snack.id === id);

await test("shop: §1 table, full stock at first, nothing without a wallet", async () => {
  assert.deepEqual(shop.snacks.map((s) => [s.id, s.price, s.hunger, s.max]), [
    ["cookie", 2, 10, null], ["berries", 5, 25, 3], ["noodles", 10, 50, 2], ["candy", 20, 20, 1],
  ]);
  for (const snack of shop.snacks) assert.equal("energy" in snack, false, "snacks have no energy effect");
  assert.deepEqual(await shop.getShop(), []);
  await wallet.connect();
  assert.deepEqual((await shop.getShop()).map((i) => [i.snack.id, i.stock, i.nextAt]), [
    ["cookie", null, null], ["berries", 3, null], ["noodles", 2, null], ["candy", 1, null],
  ]);
});

await test("shop: buy & feed pays, feeds, counts, takes stock; cookie never runs out", async () => {
  const pet = await shopPet();
  const { pet: fed, result } = await shop.buyItem(pet.id, "berries");
  assert.equal(result, "fed");
  assert.equal(fed.hunger, 35);
  assert.equal(fed.energy, 60, "a snack does not touch energy (task 059)");
  assert.equal(fed.stats.snacks, 1);
  assert.equal(account().balance, 95);
  const berries = await stockOf("berries");
  assert.equal(berries.stock, 2);
  assert.ok(berries.nextAt > Date.now() && berries.nextAt <= Date.now() + 60000);
  for (let i = 0; i < 3; i++) assert.equal((await shop.buyItem(pet.id, "cookie")).result, "fed");
  assert.equal((await stockOf("cookie")).stock, null);
  assert.equal(account().balance, 89);
});

await test("shop: out_of_stock costs nothing; restock adds 1 per interval up to max", async () => {
  const pet = await shopPet();
  assert.equal((await shop.buyItem(pet.id, "candy")).result, "fed");
  const before = account().balance;
  assert.equal((await shop.buyItem(pet.id, "candy")).result, "out_of_stock");
  assert.equal(account().balance, before);
  const candy = shop.findSnack("candy");
  const t0 = 1_000_000;
  assert.deepEqual(shop.restock(candy, { stock: 0, nextAt: t0 }, t0 - 1), { stock: 0, nextAt: t0 });
  assert.deepEqual(shop.restock(candy, { stock: 0, nextAt: t0 }, t0), { stock: 1, nextAt: null });
  const berries = shop.findSnack("berries");
  assert.deepEqual(shop.restock(berries, { stock: 0, nextAt: t0 }, t0 + 60000 + 5), { stock: 2, nextAt: t0 + 120000 });
  assert.deepEqual(shop.restock(berries, { stock: 0, nextAt: t0 }, t0 + 10 * 60000), { stock: 3, nextAt: null });
  const s = JSON.parse(store.get(SKEY));
  s.accounts["you.demo"].candy = { stock: 0, nextAt: Date.now() - 1 };
  store.set(SKEY, JSON.stringify(s));
  assert.equal((await stockOf("candy")).stock, 1, "restocked on read");
});

await test("shop: broke and full cost nothing; star candy makes happy; corrupt store = full stock", async () => {
  const pet = await shopPet();
  await wallet.spend(99);
  assert.equal((await shop.buyItem(pet.id, "berries")).result, "broke");
  assert.equal((await stockOf("berries")).stock, 3, "no stock taken");
  await wallet.refill();
  await mocks.updatePet({ hunger: 0, energy: 50 }, pet.id);
  assert.equal((await shop.buyItem(pet.id, "noodles")).result, "full", "no hunger left: energy is no reason to eat");
  assert.equal(account().balance, 100);
  await mocks.updatePet({ hunger: 40, energy: 50 }, pet.id);
  const candy = await shop.buyItem(pet.id, "candy");
  assert.equal(candy.result, "fed");
  assert.equal(candy.pet.energy, 50);
  assert.ok(Date.parse(candy.pet.happyUntil) > Date.now() + 50000);
  store.set(SKEY, "nope");
  assert.equal((await stockOf("candy")).stock, 1);
});

await test("shop (task 059): energy pack = +50 energy only (capped, no stock); snacks = hunger only; full energy refuses", async () => {
  const pet = await shopPet({ energy: 10, hunger: 80 });
  const cookie = await shop.buyItem(pet.id, "cookie");
  assert.equal(cookie.result, "fed");
  assert.equal(cookie.pet.energy, 10, "snack: energy untouched");
  assert.equal(cookie.pet.hunger, 70);
  const before = account().balance;
  const pack = await shop.buyItem(pet.id, "energy");
  assert.equal(pack.result, "charged");
  assert.equal(pack.pet.energy, 60);
  assert.equal(pack.pet.hunger, 70, "pack: hunger untouched");
  assert.equal(account().balance, before - shop.ENERGY_PACK.price);
  assert.equal(shop.ENERGY_PACK.energy, 50);
  const top = await shop.buyItem(pet.id, "energy");
  assert.equal(top.pet.energy, 100, "capped at 100");
  const cash = account().balance;
  assert.equal((await shop.buyItem(pet.id, "energy")).result, "full", "full energy refuses");
  assert.equal(account().balance, cash, "and costs nothing");
  assert.equal(shop.NEAR_PRICES.energy, "0.5");
  await assert.rejects(shop.buyItem("nobody", "cookie"), (e) => e.code === "no_pet");
});

console.log("games");
const games = await import("../lib/games.ts");
await test("games (task 049): canPlay hungry ≥ 90 > ok (energy never blocks); finishGame +10 hunger, happy 60 s, games++, best", async () => {
  assert.deepEqual(games.GAME_RULES, { hungerCost: 10, blockedAt: 90, happyMs: 60000 });
  assert.deepEqual([...games.gameIds], ["snack", "fetch", "hideseek"], "simon is gone, fetch and hide & seek are in");
  assert.equal(games.canPlay({ hunger: 20, energy: 80 }), "ok");
  assert.equal(games.canPlay({ hunger: 75, energy: 80 }), "ok", "a merely hungry pet still plays");
  assert.equal(games.canPlay({ hunger: 89.4, energy: 80 }), "ok");
  assert.equal(games.canPlay({ hunger: 90, energy: 80 }), "hungry");
  assert.equal(games.canPlay({ hunger: 20, energy: 0 }), "ok", "no energy still plays");
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  const a = await games.finishGame(pet.id, "snack", 5);
  assert.ok(Math.abs(a.pet.hunger - 30) < 0.1, String(a.pet.hunger));
  assert.ok(Date.parse(a.pet.happyUntil) > Date.now() + 55000);
  assert.equal(a.pet.stats.games, 1);
  assert.equal(a.pet.stats.best.snack, 5);
  assert.equal(a.newBest, true);
  const b = await games.finishGame(pet.id, "snack", 3);
  assert.equal(b.newBest, false);
  assert.equal(b.pet.stats.best.snack, 5, "best keeps the higher score");
  assert.equal(b.pet.stats.games, 2);
  const c = await games.finishGame(pet.id, "snack", 0);
  assert.equal(c.pet.stats.games, 3, "a round with 0 caught still counts and costs");
  assert.equal(account().balance, 100, "games cost food, never demo balance");
  await mocks.updatePet({ hunger: 95 }, pet.id);
  assert.equal((await games.finishGame(pet.id, "snack", 2)).pet.hunger, 100, "hunger caps at 100");
  await assert.rejects(games.finishGame(pet.id, "snack", -1), (e) => e.code === "bad_score");
  await assert.rejects(games.finishGame(pet.id, "simon", 1), (e) => e.code === "unknown_game");
  await assert.rejects(games.finishGame("nobody", "snack", 1), (e) => e.code === "no_pet");
});

await test("games (task 049): a fed pet plays at least 6 rounds in a row (20 s each)", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  // just fed with noodles from the hungry mood: 70 − 50 = 20 hunger, energy 80
  const start = Date.parse("2026-11-08T12:00:00.000Z");
  let current = { ...pet, hunger: 20, energy: 80, mood: "normal", lastUpdated: new Date(start).toISOString() };
  let played = 0;
  for (let round = 0; round < 12; round++) {
    const at = start + (round + 1) * 20000;
    const shown = mocks.simulatePet(current, at);
    if (games.canPlay(shown) !== "ok") break;
    const hunger = Math.min(100, shown.hunger + games.GAME_RULES.hungerCost);
    current = { ...shown, hunger, lastUpdated: new Date(at).toISOString() };
    played++;
  }
  assert.ok(played >= 6, `played ${played}`);
  // and the same through the real finishGame, back to back
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  for (let round = 0; round < 6; round++) {
    const now = await mocks.getPet(pet.id);
    assert.equal(games.canPlay(mocks.simulatePet(now, Date.now())), "ok", `round ${round + 1}`);
    await games.finishGame(pet.id, "snack", 4);
  }
});

await test("stats (task 049): a stored pet with the old best.simon stays valid, simon dropped", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  const raw = pets();
  raw.pets.find((p) => p.id === pet.id).stats = { games: 4, snacks: 1, messages: 2, best: { simon: 7, snack: 3 } };
  store.set(PKEY, JSON.stringify(raw));
  const back = await mocks.getPet(pet.id);
  assert.deepEqual(back.stats, { games: 4, snacks: 1, messages: 2, best: { snack: 3, fetch: 0, hideseek: 0 } }, "no best.fetch / best.hideseek yet → 0");
});

await test("fetch (task 050): power ping-pong, landing, flag 3 / close 1 / miss 0, ×2 from the 3rd hit in a row", async () => {
  const f = await import("../lib/fetch-game.ts");
  const F = f.FETCH;
  assert.equal(F.throws, 8);
  assert.equal(F.roundMs, 45000);
  assert.equal(f.powerAt(0), 0);
  assert.equal(f.powerAt(F.powerPeriodMs / 2), 1, "top of the swing");
  assert.equal(f.powerAt(F.powerPeriodMs), 0, "back down");
  assert.ok(Math.abs(f.powerAt(F.powerPeriodMs / 4) - 0.5) < 1e-9);
  assert.ok(Math.abs(f.powerAt((F.powerPeriodMs * 3) / 4) - 0.5) < 1e-9);
  assert.equal(f.landingX(0), F.minLand);
  assert.equal(f.landingX(1), F.maxLand);
  assert.equal(f.landingX(7), F.maxLand, "clamped");
  // every flag position is reachable with some power
  for (const r of [0, 0.25, 0.5, 0.999]) {
    const z = f.nextZone(r);
    assert.ok(z >= F.zoneMin && z <= F.zoneMax && z >= F.minLand && z <= F.maxLand, String(z));
  }
  assert.ok(Math.abs(f.nextZone(0.5, f.nextZone(0.5)) - f.nextZone(0.5)) >= 12, "a new flag moves");
  assert.deepEqual(f.scoreThrow(100, 104, 0), { kind: "hit", points: 3, streak: 1, double: false });
  assert.deepEqual(f.scoreThrow(100, 112, 1), { kind: "near", points: 1, streak: 0, double: false });
  assert.deepEqual(f.scoreThrow(60, 100, 2), { kind: "miss", points: 0, streak: 0, double: false });
  assert.deepEqual(f.scoreThrow(100, 100, 2), { kind: "hit", points: 6, streak: 3, double: true });
  assert.deepEqual(f.scoreThrow(100, 101, 5), { kind: "hit", points: 6, streak: 6, double: true });
  // a perfect round: 3 + 3 + 6×6 = 42
  let streak = 0, total = 0;
  for (let i = 0; i < F.throws; i++) {
    const r = f.scoreThrow(80, 80, streak);
    streak = r.streak;
    total += r.points;
  }
  assert.equal(total, 42);
  assert.equal(f.isTired(0, 30000), false);
  assert.equal(f.isTired(6, 30000), true, "7th throw");
  assert.equal(f.isTired(2, 9000), true, "last 10 s");
  assert.ok(f.runSpeed(6, 30000) < f.runSpeed(0, 30000));
  const top = f.arcPoint(12, 150, 0.5), end = f.arcPoint(12, 150, 1), startP = f.arcPoint(12, 150, 0);
  assert.equal(startP.y, f.HAND_Y);
  assert.equal(end.y, f.BALL_GROUND_Y);
  assert.equal(end.x, 150);
  assert.ok(top.y < startP.y && top.y >= 0, "arcs up and stays on the LCD");
});

await test("fetch (task 050): finishGame('fetch') +10 hunger, best.fetch; same block as catch", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  const a = await games.finishGame(pet.id, "fetch", 17);
  assert.ok(Math.abs(a.pet.hunger - 30) < 0.1, String(a.pet.hunger));
  assert.deepEqual(a.pet.stats.best, { snack: 0, fetch: 17, hideseek: 0 });
  assert.equal(a.newBest, true);
  assert.equal(games.canPlay({ hunger: 90, energy: 80 }), "hungry");
});

await test("hide & seek (task 051): spots 3→5 every 2 rounds, easy start, faster later, the pet follows its spot", async () => {
  const h = await import("../lib/hideseek-game.ts");
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(h.spotsFor), [3, 3, 4, 4, 5, 5, 5]);
  assert.deepEqual([1, 2, 3, 11, 20].map(h.swapsFor), [2, 3, 4, 12, 12]);
  const ms = [1, 2, 3, 4, 5, 6, 7, 8, 20].map(h.swapMsFor);
  assert.deepEqual(ms.slice(0, 2), [760, 680], "rounds 1–2 slow");
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i] <= ms[i - 1], "never slower");
  assert.equal(ms[ms.length - 1], h.HIDESEEK.minSwapMs);
  // seeded random → deterministic round
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let round = 1; round <= 8; round++) {
    const r = h.makeRound(round, rand);
    const n = h.spotsFor(round);
    assert.equal(r.kinds.length, n);
    assert.equal(r.swaps.length, h.swapsFor(round));
    for (let k = 0; k < r.swaps.length; k++) {
      const [a, b] = r.swaps[k];
      assert.ok(a >= 0 && b < n && a < b, `swap ${a},${b}`);
      if (k) assert.notDeepEqual(r.swaps[k], r.swaps[k - 1], "no pair twice in a row");
    }
    const slots = h.finalSlots(r);
    assert.deepEqual([...slots].sort(), [...Array(n).keys()], "a permutation");
    // exactly one slot finds the pet, and it's where the pet's spot ended up
    const found = [...Array(n).keys()].filter((slot) => h.isFound(r, slot));
    assert.deepEqual(found, [slots[r.petSpot]]);
    // the timeline: show → walk → sink → shuffle → pick; at the pick the view matches finalSlots
    const m = h.marks(r);
    assert.equal(h.viewAt(r, 0, false).stage, "show");
    assert.equal(h.viewAt(r, m.walk + 1, false).stage, "walk");
    assert.equal(h.viewAt(r, m.sink + 1, false).stage, "sink");
    assert.equal(h.viewAt(r, m.shuffle + 1, false).stage, "shuffle");
    for (const slow of [false, true]) {
      const end = h.viewAt(r, m.pick, slow);
      assert.equal(end.stage, "pick");
      assert.deepEqual(end.spots.map((s) => s.slot), slots, `slow=${slow}`);
      assert.equal(end.pet.visible, false, "hidden while you pick");
      // mid-swap: normal motion glides (a fractional slot appears), reduced motion never does
      const mid = h.viewAt(r, m.shuffle + r.swapMs * 0.3, slow);
      const fractional = mid.spots.some((s) => s.slot % 1 !== 0);
      assert.equal(fractional, !slow);
      if (slow) assert.ok(h.viewAt(r, m.shuffle + 10, true).spots.some((s) => s.flash), "flash on a swap");
    }
  }
  assert.ok(h.marks(h.makeRound(1, rand)).pick < 5000, "round 1 is short and readable");
});

await test("hide & seek (task 051): finishGame('hideseek') +10 hunger, best.hideseek", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  const a = await games.finishGame(pet.id, "hideseek", 4);
  assert.ok(Math.abs(a.pet.hunger - 30) < 0.1, String(a.pet.hunger));
  assert.deepEqual(a.pet.stats.best, { snack: 0, fetch: 0, hideseek: 4 });
});

await test("balance (task 052): hunger 0 → 6+ games; a night alone → hungry, 1 snack at balance 100 unblocks games", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  // six games back to back through the real finishGame, from a full pet
  await mocks.updatePet({ hunger: 0, energy: 100 }, pet.id);
  let played = 0;
  for (const game of ["snack", "fetch", "hideseek", "snack", "fetch", "hideseek", "snack", "fetch"]) {
    const now = mocks.simulatePet(await mocks.getPet(pet.id), Date.now());
    if (games.canPlay(now) !== "ok") break;
    await games.finishGame(pet.id, game, 1);
    played++;
  }
  assert.ok(played >= 6, `played ${played}`);
  // 12 h alone from a fed, rested pet: awake but starving → games blocked
  const night = Date.now() - 12 * 3600000;
  await mocks.updatePet({ hunger: 0, energy: 100, mood: "normal", lastUpdated: new Date(night).toISOString() }, pet.id);
  const raw = pets();
  raw.pets.find((p) => p.id === pet.id).lastUpdated = new Date(night).toISOString();
  store.set(PKEY, JSON.stringify(raw));
  const morning = mocks.simulatePet(await mocks.getPet(pet.id), Date.now());
  assert.equal(morning.hunger, 100);
  assert.notEqual(mocks.baseMood(morning), "sleep", "awake after the night");
  assert.equal(games.canPlay(morning), "hungry");
  // one snack is enough: berries (5) → 75, noodles (10) → 50; a cookie alone (−10) is not
  assert.equal(account().balance, 100);
  const cookie = await shop.buyItem(pet.id, "cookie");
  assert.equal(games.canPlay(cookie.pet), "hungry", "a cookie leaves it at 90");
  const berries = await shop.buyItem(pet.id, "berries");
  assert.equal(berries.result, "fed");
  assert.equal(games.canPlay(berries.pet), "ok", "cookie + berries unblock games");
  assert.equal(account().balance, 93, "2 + 5 demo spent");
  await wallet.refill();
  assert.equal(account().balance, 100, "refill tops it up again");
});

console.log("share + progress");
await test("share on x: intent url, rarity-only text, link to /nft/{id}", async () => {
  const share = await import("../lib/share.ts");
  const t = drop.findToken(tokens.find((x) => x.petId === "pet2" && x.tier === "rare").tokenId);
  const url = new URL(share.shareOnXUrl(t));
  assert.equal(url.origin + url.pathname, "https://x.com/intent/tweet");
  assert.equal(url.searchParams.get("url"), `https://neargochi.vercel.app/nft/${t.tokenId}`);
  assert.equal(url.searchParams.get("text"), `i hatched ${t.name}, a rare dragon. one of 25 rare near dragons in neargotchi drop 1 (demo).`);
  assert.ok(!/@/.test(url.searchParams.get("text")), "no @handle yet");
});

await test("getPet resolves /pet?id={tokenId} for the owner only", async () => {
  await wallet.connect();
  const a = await mocks.mintPet({ token: await drop.hatchRandom() });
  const b = await mocks.mintPet({ token: await drop.hatchRandom() });
  assert.equal((await mocks.getPet(String(a.token.tokenId))).id, a.id);
  assert.equal((await mocks.getPet(b.id)).id, b.id);
  assert.equal(await mocks.getPet("999"), null);
  await wallet.disconnect();
  assert.equal(await mocks.getPet(String(a.token.tokenId)), null);
});

await test("drop progress cells: 0 → none, first hatch → 1, 299 → 29, sold out → 30", async () => {
  const cells = (minted) => drop.filledCells({ minted, total: 300 });
  assert.deepEqual([0, 1, 9, 10, 150, 299, 300].map(cells), [0, 1, 1, 1, 15, 29, 30]);
});

console.log("copy");
const copy = await import("../lib/copy.ts");
await test("rarity only: no value / price / growth words in the drop-1, /mint, /pet, wallet and landing strings", async () => {
  // build_metadata.py BANNED + a few more; checked on the values, never the keys.
  const banned = /value|price|profit|moon|grow|invest|x\d|worth|floor|resale|resell|\bflip|\bpump|\breturns?\b|\bgains?\b|cheap|expensive|\brich\b/i;
  const strings = [];
  const walk = (node, path) => {
    if (typeof node === "string") strings.push([path, node]);
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  walk(copy.mintPage, "mintPage");
  walk(copy.petPage.token, "petPage.token");
  walk(copy.tierLabels, "tierLabels");
  walk(copy.itemLabels, "itemLabels");
  walk(copy.petGallery, "petGallery");
  walk(copy.header.wallet, "header.wallet");
  walk(copy.walletGate, "walletGate");
  walk(copy.dropProgress, "dropProgress");
  walk(copy.petPage.hatchAnother, "petPage.hatchAnother");
  for (const key of ["switcher", "tabs", "stats", "release", "games"]) walk(copy.petPage[key], `petPage.${key}`);
  walk(copy.petTraits, "petTraits");
  walk(copy.petPage.shop, "petPage.shop");
  walk(copy.petPage.games, "petPage.games");
  walk(copy.snackLabels, "snackLabels");
  walk(copy.nftPage, "nftPage");
  for (const key of ["hero", "howItWorks", "yourGotchi", "dropSection", "faq", "tokenomics"]) walk(copy[key], key);
  assert.ok(strings.length > 30);
  const hits = strings.filter(([, text]) => banned.test(text));
  assert.deepEqual(hits, []);
});

console.log("chain config");
// lib/chain.ts reads NEXT_PUBLIC_* at import time: each mode is checked in a fresh node process.
const { execFileSync } = await import("node:child_process");
const chainIn = (env) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ["--experimental-transform-types", "--no-warnings", "--input-type=module", "-e",
        "const c = await import('./lib/chain.ts'); console.log(JSON.stringify({ chain: c.CHAIN, onChain: c.isOnChain, mainnet: c.isMainnet, net: c.NET, contract: c.DROP1_CONTRACT, rpc: c.RPC_URL, treasury: c.TREASURY_ACCOUNT, explorer: c.EXPLORER_URL, error: c.CONFIG_ERROR }))"],
      { env: { PATH: process.env.PATH, ...env }, cwd: new URL("..", import.meta.url) },
    ).toString(),
  );
await test("demo by default; unknown values never fall through to mainnet", async () => {
  assert.equal(chainIn({}).chain, "demo");
  assert.equal(chainIn({ NEXT_PUBLIC_CHAIN: "Mainnet" }).chain, "demo");
  assert.equal(chainIn({ NEXT_PUBLIC_CHAIN: "demo" }).onChain, false);
});
await test("testnet unchanged: ng57 contract, testnet rpc + explorer, no config error", async () => {
  const t = chainIn({ NEXT_PUBLIC_CHAIN: "testnet" });
  assert.deepEqual([t.onChain, t.mainnet, t.net, t.contract, t.rpc, t.explorer, t.error], [true, false, "testnet", "neargotchi-drop1-ng57.testnet", "https://test.rpc.fastnear.com", "https://testnet.nearblocks.io", null]);
});
await test("mainnet: contract + treasury only from env, mainnet rpc; missing env = config error", async () => {
  const m = chainIn({ NEXT_PUBLIC_CHAIN: "mainnet", NEXT_PUBLIC_DROP1_CONTRACT: "drop.near", NEXT_PUBLIC_TREASURY: "team.near" });
  assert.deepEqual([m.onChain, m.mainnet, m.net, m.contract, m.treasury, m.rpc, m.explorer, m.error], [true, true, "mainnet", "drop.near", "team.near", "https://free.rpc.fastnear.com", "https://nearblocks.io", null]);
  const bare = chainIn({ NEXT_PUBLIC_CHAIN: "mainnet" });
  assert.equal(bare.contract, "");
  assert.equal(bare.treasury, "");
  assert.match(bare.error, /NEXT_PUBLIC_DROP1_CONTRACT/);
});

console.log("rpc failover");
const chain = await import("../lib/chain.ts");
const okBody = (result) => ({ ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: "ng", result }) });
const viewResult = (value) => ({ result: Array.from(new TextEncoder().encode(JSON.stringify(value))) });
const withFetch = async (impl, run) => {
  const saved = { ...chain.rpcRuntime };
  const calls = [];
  chain.rpcRuntime.fetch = async (url, init) => { calls.push(url); return impl(url, JSON.parse(init.body), calls.length); };
  chain.rpcRuntime.sleep = async () => {};
  try { return await run(calls); } finally { Object.assign(chain.rpcRuntime, saved); }
};
await test("no deprecated near.org endpoint in the lists; 4 free endpoints per network", async () => {
  assert.ok(chain.RPC_URLS.length >= 4);
  assert.ok(chain.RPC_URLS.every((url) => url.startsWith("https://") && !/rpc\.(testnet|mainnet)\.near\.org/.test(url)));
});
await test("first endpoint fails (429 / network error) → the next one answers; the good one is used first next time", async () => {
  await withFetch(
    (url) => {
      if (url === chain.RPC_URLS[0]) return { ok: false, status: 429, json: async () => ({}) };
      if (url === chain.RPC_URLS[1]) throw new TypeError("fetch failed");
      return okBody(viewResult({ minted: 7, total: 300, sold_out: false, paused: false }));
    },
    async (calls) => {
      assert.deepEqual(await chain.viewCall("drop_status"), { minted: 7, total: 300, sold_out: false, paused: false });
      assert.deepEqual(calls, chain.RPC_URLS.slice(0, 3));
      calls.length = 0;
      await chain.viewCall("drop_status");
      assert.deepEqual(calls, [chain.RPC_URLS[2]], "starts with the endpoint that worked");
    },
  );
});
await test("rpc-level error (TIMEOUT_ERROR) fails over; a contract error does not", async () => {
  await withFetch(
    (url, body, n) => n === 1
      ? { ok: true, status: 200, json: async () => ({ error: { code: -32000, cause: { name: "TIMEOUT_ERROR" } } }) }
      : okBody(viewResult("995")),
    async (calls) => {
      assert.equal(await chain.viewCall("pending_rewards", { token_id: "1" }), "995");
      assert.equal(calls.length, 2);
    },
  );
  await withFetch(
    () => ({ ok: true, status: 200, json: async () => ({ error: { code: -32000, cause: { name: "CONTRACT_EXECUTION_ERROR" } } }) }),
    async (calls) => {
      await assert.rejects(chain.viewCall("pending_rewards", { token_id: "1" }), (e) => e.final === true);
      assert.equal(calls.length, 1, "deterministic: no other endpoint, no retry");
    },
  );
  // old contract without the method: the RPC answers 200 with result.error (MethodNotFound) → final, panel hidden
  await withFetch(
    () => okBody({ block_hash: "x", error: "wasm execution failed with error: MethodResolveError(MethodNotFound)", logs: [] }),
    async (calls) => {
      await assert.rejects(chain.viewCall("pending_rewards", { token_id: "10" }), (e) => e.final === true && /MethodNotFound/.test(e.message));
      assert.equal(calls.length, 1);
    },
  );
});
await test("all endpoints down: 3 rounds with backoff, then an error", async () => {
  const sleeps = [];
  await withFetch(
    () => { throw new TypeError("offline"); },
    async (calls) => {
      chain.rpcRuntime.sleep = async (ms) => { sleeps.push(ms); };
      await assert.rejects(chain.viewCall("drop_status"), /offline/);
      assert.equal(calls.length, chain.RPC_URLS.length * 3);
      assert.deepEqual(sleeps, [400, 1200]);
    },
  );
});
await test("formatNear: readable amounts, never 0000", async () => {
  assert.equal(drop.formatNear("0"), "0 NEAR");
  assert.equal(drop.formatNear("995000000000000000000000"), "0.995 NEAR");
  assert.equal(drop.formatNear("1990000000000000000000000"), "1.99 NEAR");
  assert.equal(drop.formatNear("2000000000000000000000000"), "2 NEAR");
  assert.equal(drop.formatNear("12345678900000000000000000"), "12.3456 NEAR");
  assert.equal(drop.formatNear("10"), "< 0.0001 NEAR");
});

console.log("on chain (testnet build, separate process)");
await test("pets / chat / shop per chain + contract + account + token; counter cache (scripts/check-onchain.mjs)", async () => {
  const out = execFileSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "scripts/check-onchain.mjs"], {
    env: { PATH: process.env.PATH, NEXT_PUBLIC_CHAIN: "testnet", NEXT_PUBLIC_DROP1_CONTRACT: "neargotchi-drop1-ng67.testnet" },
    cwd: new URL("..", import.meta.url),
  }).toString();
  for (const line of out.trim().split("\n")) console.log(`      ${line}`);
  assert.match(out, /onchain ok/);
});

console.log(`\n${passed} checks passed`);
