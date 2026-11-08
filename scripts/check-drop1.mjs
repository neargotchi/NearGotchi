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
  assert.deepEqual(pet.stats, { games: 0, snacks: 0, messages: 0, best: { simon: 0, snack: 0 } });
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

await test("hunger tempo: 20 → 70 (hungry) in 10 min, energy unchanged", async () => {
  const start = Date.parse("2026-11-02T10:00:00.000Z");
  const pet = { ...basePet(4), hunger: 20, energy: 100, lastUpdated: new Date(start).toISOString() };
  const later = mocks.simulatePet(pet, start + 10 * 60000);
  assert.equal(later.hunger, 70);
  assert.equal(later.energy, 50);
  assert.equal(later.mood, "hungry");
});

await test("chat: an answered message costs 4 energy and 3 hunger; hungry / asleep answers are free", async () => {
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  const a = await mocks.chatWithPet("gm", pet.id);
  assert.equal(a.kind, "reply");
  assert.ok(Math.abs(a.pet.energy - 76) < 0.1, String(a.pet.energy));
  assert.ok(Math.abs(a.pet.hunger - 23) < 0.1, String(a.pet.hunger));
  assert.equal(a.pet.stats.messages, 1);
  assert.equal(mocks.PET_RULES.chatHunger, 3);
  await mocks.updatePet({ hunger: 90, energy: 80 }, pet.id);
  const b = await mocks.chatWithPet("gm", pet.id);
  assert.equal(b.kind, "hungry");
  assert.ok(Math.abs(b.pet.hunger - 90) < 0.1 && Math.abs(b.pet.energy - 80) < 0.1);
  await mocks.updatePet({ hunger: 20, energy: 10 }, pet.id);
  const c = await mocks.chatWithPet("gm", pet.id);
  assert.equal(c.kind, "asleep");
  assert.ok(Math.abs(c.pet.hunger - 20) < 0.1 && Math.abs(c.pet.energy - 10) < 0.1);
  assert.equal(c.pet.stats.messages, 3);
});

await test("sleep: recharges +3/min, wakes at 40; hunger keeps rising; 1 h alone → awake and hungry", async () => {
  const start = Date.parse("2026-11-02T10:00:00.000Z");
  const at = (min) => start + min * 60000;
  const base = { ...basePet(4), owner: "you.demo", happyUntil: null, lastUpdated: new Date(start).toISOString() };
  const asleep = { ...base, hunger: 30, energy: 10, mood: "sleep" };
  const five = mocks.simulatePet(asleep, at(5));
  assert.equal(five.energy, 25);
  assert.equal(five.hunger, 55);
  assert.equal(five.mood, "sleep", "still recharging below 40");
  const ten = mocks.simulatePet(asleep, at(10));
  assert.equal(ten.energy, 40);
  assert.notEqual(ten.mood, "sleep", "wakes up at 40");
  const fresh = { ...base, hunger: 20, energy: 100, mood: "normal" };
  const hour = mocks.simulatePet(fresh, at(60));
  assert.equal(hour.hunger, 100);
  assert.equal(hour.energy, 40, "a hungry pet sulks down to 40, not into sleep");
  assert.equal(hour.mood, "hungry");
  const tired = { ...base, hunger: 0, energy: 30, mood: "normal" };
  const nap = mocks.simulatePet(tired, at(3));
  assert.equal(nap.energy, 15);
  assert.equal(nap.mood, "sleep", "not hungry + tired → falls asleep");
  const later = mocks.simulatePet(tired, at(60));
  assert.notEqual(later.mood, "sleep", "…and wakes up by itself");
  assert.ok(later.energy >= 15 && later.hunger === 100);
  assert.equal(mocks.baseMood({ hunger: 0, energy: 30, mood: "sleep" }), "sleep", "between 15 and 40: still asleep if it was");
  assert.equal(mocks.baseMood({ hunger: 0, energy: 30, mood: "normal" }), "normal");
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
  assert.deepEqual(shop.snacks.map((s) => [s.id, s.price, s.hunger, s.energy, s.max]), [
    ["cookie", 2, 10, 0, null], ["berries", 5, 25, 5, 3], ["noodles", 10, 50, 10, 2], ["candy", 20, 20, 40, 1],
  ]);
  assert.deepEqual(await shop.getShop(), []);
  await wallet.connect();
  assert.deepEqual((await shop.getShop()).map((i) => [i.snack.id, i.stock, i.nextAt]), [
    ["cookie", null, null], ["berries", 3, null], ["noodles", 2, null], ["candy", 1, null],
  ]);
});

await test("shop: buy & feed pays, feeds, counts, takes stock; cookie never runs out", async () => {
  const pet = await shopPet();
  const { pet: fed, result } = await shop.buySnack(pet.id, "berries");
  assert.equal(result, "fed");
  assert.equal(fed.hunger, 35);
  assert.equal(fed.energy, 65);
  assert.equal(fed.stats.snacks, 1);
  assert.equal(account().balance, 95);
  const berries = await stockOf("berries");
  assert.equal(berries.stock, 2);
  assert.ok(berries.nextAt > Date.now() && berries.nextAt <= Date.now() + 60000);
  for (let i = 0; i < 3; i++) assert.equal((await shop.buySnack(pet.id, "cookie")).result, "fed");
  assert.equal((await stockOf("cookie")).stock, null);
  assert.equal(account().balance, 89);
});

await test("shop: out_of_stock costs nothing; restock adds 1 per interval up to max", async () => {
  const pet = await shopPet();
  assert.equal((await shop.buySnack(pet.id, "candy")).result, "fed");
  const before = account().balance;
  assert.equal((await shop.buySnack(pet.id, "candy")).result, "out_of_stock");
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
  assert.equal((await shop.buySnack(pet.id, "berries")).result, "broke");
  assert.equal((await stockOf("berries")).stock, 3, "no stock taken");
  await wallet.refill();
  await mocks.updatePet({ hunger: 0, energy: 100 }, pet.id);
  assert.equal((await shop.buySnack(pet.id, "noodles")).result, "full");
  assert.equal(account().balance, 100);
  await mocks.updatePet({ hunger: 0, energy: 50 }, pet.id);
  const candy = await shop.buySnack(pet.id, "candy");
  assert.equal(candy.result, "fed", "energy still helps when not hungry");
  assert.ok(Date.parse(candy.pet.happyUntil) > Date.now() + 50000);
  store.set(SKEY, "nope");
  assert.equal((await stockOf("candy")).stock, 1);
});

await test("shop: a sleeping pet eats and can wake up (asleep)", async () => {
  const pet = await shopPet({ energy: 10, hunger: 80 });
  assert.equal(mocks.baseMood(pet), "sleep");
  const cookie = await shop.buySnack(pet.id, "cookie");
  assert.equal(cookie.result, "asleep");
  assert.equal(mocks.baseMood(cookie.pet), "sleep", "a cookie has no energy");
  const candy = await shop.buySnack(pet.id, "candy");
  assert.equal(candy.result, "asleep");
  assert.notEqual(mocks.baseMood(candy.pet), "sleep", "+40 energy wakes it");
  await assert.rejects(shop.buySnack("nobody", "cookie"), (e) => e.code === "no_pet");
});

console.log("games");
const games = await import("../lib/games.ts");
await test("games: canPlay asleep > hungry > ok; finishGame +15 hunger, happy 60 s, games++, best", async () => {
  assert.deepEqual(games.GAME_RULES, { hungerCost: 15, blockedAt: 70, happyMs: 60000 });
  assert.equal(games.canPlay({ hunger: 20, energy: 80 }), "ok");
  assert.equal(games.canPlay({ hunger: 69.4, energy: 80 }), "ok");
  assert.equal(games.canPlay({ hunger: 70, energy: 80 }), "hungry");
  assert.equal(games.canPlay({ hunger: 90, energy: 10 }), "asleep");
  await wallet.connect();
  const pet = await mocks.mintPet({ token: await drop.hatchRandom() });
  await mocks.updatePet({ hunger: 20, energy: 80 }, pet.id);
  const a = await games.finishGame(pet.id, "simon", 5);
  assert.ok(Math.abs(a.pet.hunger - 35) < 0.1, String(a.pet.hunger));
  assert.ok(Date.parse(a.pet.happyUntil) > Date.now() + 55000);
  assert.equal(a.pet.stats.games, 1);
  assert.equal(a.pet.stats.best.simon, 5);
  assert.equal(a.newBest, true);
  const b = await games.finishGame(pet.id, "simon", 3);
  assert.equal(b.newBest, false);
  assert.equal(b.pet.stats.best.simon, 5, "best keeps the higher score");
  assert.equal(b.pet.stats.games, 2);
  const c = await games.finishGame(pet.id, "simon", 0);
  assert.equal(c.pet.stats.games, 3, "a game lost in round 1 still counts and costs");
  assert.equal(account().balance, 100, "games cost food, never demo balance");
  await mocks.updatePet({ hunger: 95 }, pet.id);
  assert.equal((await games.finishGame(pet.id, "snack", 2)).pet.hunger, 100, "hunger caps at 100");
  await assert.rejects(games.finishGame(pet.id, "simon", -1), (e) => e.code === "bad_score");
  await assert.rejects(games.finishGame(pet.id, "chess", 1), (e) => e.code === "unknown_game");
  await assert.rejects(games.finishGame("nobody", "simon", 1), (e) => e.code === "no_pet");
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

console.log(`\n${passed} checks passed`);
