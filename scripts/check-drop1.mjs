// Checks for lib/drop1.ts, DemoPet v3 (migration, mint from a drawn token, rename) and the rarity-only copy
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
await test("slim list: ids 1..300, unique, every token has its webp", async () => {
  assert.equal(drop.DROP1_TOTAL, 300);
  assert.deepEqual(tokens.map((t) => t.tokenId), Array.from({ length: 300 }, (_, i) => i + 1));
  for (const t of tokens) assert.equal((await drop.getToken(t.tokenId)).image, `/drop1/${t.tokenId}.webp`);
  readFileSync(new URL("../public/drop1/300.webp", import.meta.url));
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

console.log("DemoPet v3");
const save = (pet) => store.set(mocks.PET_STORAGE_KEY, JSON.stringify(pet));
const stored = () => JSON.parse(store.get(mocks.PET_STORAGE_KEY));

await test("v1 → v3: lastUpdated now, token of the same pet, minted, saved", async () => {
  save(basePet(1));
  const pet = await mocks.getPet();
  assert.equal(pet.v, 3);
  assert.ok(Date.now() - Date.parse(pet.lastUpdated) < 5000);
  assert.ok(idsOf("pet2").includes(pet.token.tokenId));
  assert.deepEqual(minted(), [pet.token.tokenId]);
  assert.deepEqual(stored(), pet);
});

await test("v2 → v3 keeps lastUpdated; migrates once", async () => {
  save(basePet(2, { lastUpdated: "2026-11-02T10:00:00.000Z" }));
  const a = await mocks.getPet();
  const b = await mocks.getPet();
  assert.equal(a.lastUpdated, "2026-11-02T10:00:00.000Z");
  assert.deepEqual(a.token, b.token);
  assert.equal(minted().length, 1);
  const known = tokens.find((t) => t.tokenId === a.token.tokenId);
  assert.deepEqual(a.token, { tokenId: known.tokenId, tier: known.tier, background: known.background, accessory: known.accessory });
});

await test("v2 whose pet has no free token → v3 with token null", async () => {
  store.set(KEY, JSON.stringify(idsOf("pet2")));
  save(basePet(2, { lastUpdated: "2026-11-02T10:00:00.000Z" }));
  const pet = await mocks.getPet();
  assert.equal(pet.v, 3);
  assert.equal(pet.token, null);
  assert.equal(minted().length, 100);
  assert.equal((await mocks.getPet()).token, null);
});

await test("v3 with a wrong / unknown / missing token is corrupt and cleared", async () => {
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
    assert.ok(!store.has(mocks.PET_STORAGE_KEY));
  }
});

await test("v3 pet whose id fell off the minted list puts it back", async () => {
  const t = tokens.find((x) => x.petId === "pet2");
  save(basePet(3, { lastUpdated: "2026-11-02T10:00:00.000Z", token: { tokenId: t.tokenId, tier: t.tier, background: t.background, accessory: t.accessory } }));
  assert.equal((await mocks.getPet()).token.tokenId, t.tokenId);
  assert.deepEqual(minted(), [t.tokenId]);
});

await test("mintPet saves the drawn token; rename; update keeps it; reset keeps it minted", async () => {
  const drawn = await drop.hatchRandom();
  const pet = await mocks.mintPet({ token: drawn });
  assert.equal(pet.v, 3);
  assert.equal(pet.petId, drawn.petId);
  assert.equal(pet.name, tokens.find((t) => t.tokenId === drawn.tokenId).name.split(" #")[0], "default = the pet's own name");
  assert.equal(pet.token.tokenId, drawn.tokenId);
  assert.deepEqual(minted(), [drawn.tokenId], "mintPet claims nothing extra");
  assert.equal((await mocks.renamePet("  Scout  ")).name, "scout");
  await assert.rejects(mocks.renamePet("x"), (e) => e.code === "too_short");
  assert.equal((await mocks.renamePet("")).name, pet.name, "empty → the pet's own name");
  const fed = await mocks.updatePet({ hunger: 50 });
  assert.deepEqual(fed.token, pet.token);
  assert.equal(stored().v, 3);
  await mocks.resetPet();
  assert.equal(await mocks.getPet(), null);
  assert.deepEqual(minted(), [drawn.tokenId]);
  await assert.rejects(mocks.mintPet({ token: { tokenId: 999 } }), (e) => e.code === "no_pet");
  await assert.rejects(mocks.renamePet("scout"), (e) => e.code === "no_pet");
});

console.log("copy");
const copy = await import("../lib/copy.ts");
await test("rarity only: no value / price / growth words in the drop-1 and /mint strings", async () => {
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
  assert.ok(strings.length > 30);
  const hits = strings.filter(([, text]) => banned.test(text));
  assert.deepEqual(hits, []);
});

console.log(`\n${passed} checks passed`);
