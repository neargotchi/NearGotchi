// Single mocks module (PLAN.md §4): the only place for demo pets, items, balances,
// chat replies and simulation rules. All values here are demonstration data.

import { isTestnet } from "./chain";
import type { AiAnswer, AiRequest } from "./chat-client";
import { claimRandomToken, ensureMinted, findToken, getOwnedTokens, type Drop1Token } from "./drop1";
import { DEMO_ACCOUNT_ID, absorbBalance, connectedAccountId, subscribeAccount } from "./wallet";

export const moods = ["normal", "hungry", "happy", "sleep"] as const;
export type Mood = (typeof moods)[number];

export type PetProfile = {
  id: string;
  species: string;
  name: string;
  description: string;
  /** Folder under /public/pets with one PNG per mood. */
  spriteFolder: string;
  spriteWidth: number;
  spriteHeight: number;
  /** Mouth in the happy sprite, as fractions of its width/height (/pet feed animation target). */
  mouth: [number, number];
};

/** Approved pets (copy v1; pet2/pet3 renamed to "near dragon" / "near kat" by the owner, 2026-11-08). */
export const pets: PetProfile[] = [
  {
    id: "pet1",
    species: "corgi",
    name: "batman",
    description: "the corgi of near's co-founder. chunky. legendary. always hungry.",
    spriteFolder: "pet1",
    spriteWidth: 489,
    spriteHeight: 431,
    mouth: [0.3, 0.51],
  },
  {
    id: "pet2",
    species: "dragon",
    name: "near dragon",
    description: "small dragon. big shards.",
    spriteFolder: "pet2",
    spriteWidth: 489,
    spriteHeight: 431,
    mouth: [0.36, 0.45],
  },
  {
    id: "pet3",
    species: "meerkat",
    name: "near kat",
    description: "always on watch. never misses a block.",
    spriteFolder: "pet3",
    spriteWidth: 489,
    spriteHeight: 431,
    mouth: [0.37, 0.3],
  },
];

/** PET 4–6: rendered only when PETS_4_6_ENABLED is true. Empty until names and copy are approved. */
export const upcomingPets: PetProfile[] = [];

export const petSpriteSrc = (pet: PetProfile, mood: Mood) =>
  `/pets/${pet.spriteFolder}/${mood}.png`;

export const slots = ["head", "eyes", "neck", "body", "back"] as const;
export type Slot = (typeof slots)[number];

export type Item = {
  id: string;
  slot: Slot;
  src: string;
  width: number;
  height: number;
};

/** The 14 wardrobe items, one transparent PNG per item under /public/items/<slot>/. */
export const items: Item[] = [
  { id: "beanie", slot: "head", src: "/items/head/beanie.png", width: 255, height: 287 },
  { id: "cap", slot: "head", src: "/items/head/cap.png", width: 274, height: 210 },
  { id: "crown", slot: "head", src: "/items/head/crown.png", width: 224, height: 167 },
  { id: "halo", slot: "head", src: "/items/head/halo.png", width: 264, height: 191 },
  { id: "headphones", slot: "head", src: "/items/head/headphones.png", width: 301, height: 277 },
  { id: "keffiyeh", slot: "head", src: "/items/head/keffiyeh.png", width: 290, height: 281 },
  { id: "tophat", slot: "head", src: "/items/head/tophat.png", width: 279, height: 240 },
  { id: "mask", slot: "eyes", src: "/items/eyes/mask.png", width: 231, height: 115 },
  { id: "nerd", slot: "eyes", src: "/items/eyes/nerd.png", width: 223, height: 108 },
  { id: "pixel", slot: "eyes", src: "/items/eyes/pixel.png", width: 233, height: 70 },
  { id: "sunglasses", slot: "eyes", src: "/items/eyes/sunglasses.png", width: 220, height: 94 },
  { id: "chain", slot: "neck", src: "/items/neck/chain.png", width: 205, height: 208 },
  { id: "tshirt", slot: "body", src: "/items/body/tshirt.png", width: 228, height: 191 },
  { id: "cape", slot: "back", src: "/items/back/cape.png", width: 280, height: 256 },
];

// ---------- Demo pet store (docs/DEVLOG.md §1: pets v4, a collection per account) ----------
// Async on purpose: a future backend swaps these bodies and keeps the same calls.
// Browser-only; every storage access is guarded. Nothing here is a real mint.

/** The drop-1 token a pet hatched as (docs/DEVLOG.md §3). Always matches lib/drop1-tokens.json. */
export type PetToken = Pick<Drop1Token, "tokenId" | "tier" | "background" | "accessory">;

/** Counters for the stats tab; best scores per game. */
export type PetStats = { games: number; snacks: number; messages: number; best: { snack: number; fetch: number; hideseek: number } };

export type DemoPet = {
  /** 4 since demo v2: one of many pets of an account; the balance moved to the wallet. v1–v3 are migrated on read. */
  v: 4;
  /** "demo-" + petId + "-" + tokenId + "-" + Date.now(); the pet's key in the collection (stable across migrations). */
  id: string;
  /** Account that hatched it (lib/wallet.ts). Only the connected account's pets are visible. */
  owner: string;
  petId: PetProfile["id"];
  species: string;
  name: string;
  /** 0–100 */
  hunger: number;
  /** 0–100 */
  energy: number;
  mood: Mood;
  /** ISO date */
  mintedAt: string;
  /** ISO date: hunger/energy are simulated from here to "now" (docs/DEVLOG.md §2). */
  lastUpdated: string;
  /** ISO date until which the pet stays happy (games, snacks); null = no timer. */
  happyUntil: string | null;
  stats: PetStats;
  /** null only when no free token of this pet was left during a migration; no token card then. */
  token: PetToken | null;
  demo: true;
};

type PetStore = {
  v: 4;
  pets: DemoPet[];
  /** accountId → id of the pet shown on /pet */
  active: Record<string, string>;
};

/** The v1–v3 single pet, read only to migrate it (it had its own balance and an unused outfit). */
type LegacyPet = Omit<DemoPet, "v" | "owner" | "happyUntil" | "stats"> & { v: 3; balance: number };

const toPetToken = (token: Drop1Token | null): PetToken | null =>
  token && { tokenId: token.tokenId, tier: token.tier, background: token.background, accessory: token.accessory };

/** A stored token must be the manifest's token of the same pet, field for field. */
function checkToken(value: unknown, petId: string): { ok: true; token: PetToken | null } | { ok: false } {
  if (value === null) return { ok: true, token: null };
  if (!value || typeof value !== "object") return { ok: false };
  const stored = value as Partial<PetToken>;
  const known = findToken(stored.tokenId);
  const same =
    known &&
    known.petId === petId &&
    stored.tier === known.tier &&
    stored.background === known.background &&
    stored.accessory === known.accessory;
  return same ? { ok: true, token: toPetToken(known) } : { ok: false };
}

export const PETS_STORAGE_KEY = "neargotchi-pets";
/** v1–v3: one pet, no owner. Migrated into the collection on read, then removed. */
export const LEGACY_PET_STORAGE_KEY = "neargotchi-pet";

export const PET_NAME_MIN = 2;
export const PET_NAME_MAX = 12;

export type NameError = "too_short" | "too_long" | "bad_chars" | "no_pet";

export class MintError extends Error {
  constructor(public readonly code: NameError | "no_wallet") {
    super(code);
    this.name = "MintError";
  }
}

export const findPet = (petId: string | null | undefined) => pets.find((pet) => pet.id === petId);

/** Trim, collapse inner spaces, lowercase. */
export const normalizePetName = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase();

/** 2–12 chars of a–z 0–9 space - _ (after normalizing); empty → the pet's own name. */
export function validatePetName(
  raw: string,
  petId: string | null | undefined,
): { ok: true; name: string } | { ok: false; error: NameError } {
  const pet = findPet(petId);
  if (!pet) return { ok: false, error: "no_pet" };
  const name = normalizePetName(raw);
  if (!name) return { ok: true, name: pet.name };
  if (!/^[a-z0-9 _-]+$/.test(name)) return { ok: false, error: "bad_chars" };
  if (name.length < PET_NAME_MIN) return { ok: false, error: "too_short" };
  if (name.length > PET_NAME_MAX) return { ok: false, error: "too_long" };
  return { ok: true, name };
}

const inBrowser = () => typeof window !== "undefined";

/** undefined = storage unavailable. */
function readKey(key: string): string | null | undefined {
  if (!inBrowser()) return undefined;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function writeKey(key: string, value: string | null): boolean {
  if (!inBrowser()) return false;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const isLevel = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const isCount = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Fields every version shares. */
function commonValid(data: Record<string, unknown>): boolean {
  const name = data.name;
  const petId = data.petId as string;
  return (
    data.demo === true &&
    typeof data.id === "string" &&
    data.id.length > 0 &&
    typeof name === "string" &&
    !!findPet(petId) &&
    validatePetName(name, petId).ok &&
    normalizePetName(name) === name &&
    isLevel(data.hunger) &&
    isLevel(data.energy) &&
    moods.includes(data.mood as Mood) &&
    typeof data.mintedAt === "string"
  );
}

/**
 * Parses the old single pet. v1 (from /mint before /pet existed) gets lastUpdated = now; v1 and v2 (before
 * drop 1) get a random free drop-1 token of the same pet, marked minted, or token null when that pet has
 * none left. A v3 token must match the manifest, otherwise the record counts as corrupt.
 */
function parseLegacy(raw: string): LegacyPet | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!isObject(data) || (data.v !== 1 && data.v !== 2 && data.v !== 3) || !commonValid(data)) return null;
    if (data.v !== 1 && !isDate(data.lastUpdated)) return null;
    if (typeof data.balance !== "number" || !Number.isFinite(data.balance)) return null;
    const petId = data.petId as string;
    let token: PetToken | null;
    if (data.v === 3) {
      const checked = checkToken(data.token, petId);
      if (!checked.ok) return null;
      token = checked.token;
    } else {
      token = toPetToken(claimRandomToken(petId));
    }
    const lastUpdated = data.v === 1 ? new Date().toISOString() : (data.lastUpdated as string);
    return { ...(data as unknown as LegacyPet), v: 3, lastUpdated, token };
  } catch {
    return null;
  }
}

/**
 * Owner rename (2026-11-08): a pet still called by its old default name gets the new one; names the
 * user picked stay. Applied to every stored pet (v1–v4) on read; the old names live only here.
 */
const RENAMED_DEFAULTS: Record<string, [string, string]> = {
  pet2: ["nightshade", "near dragon"],
  pet3: ["merk", "near kat"],
};

const currentName = (petId: string, name: string) => {
  const renamed = RENAMED_DEFAULTS[petId];
  return renamed && name === renamed[0] ? renamed[1] : name;
};

const emptyStats = (): PetStats => ({ games: 0, snacks: 0, messages: 0, best: { snack: 0, fetch: 0, hideseek: 0 } });

/** v3 → v4: owned by the demo account, one more try for a token if it had none (the balance goes to the wallet in loadStore). */
function fromLegacy(old: LegacyPet): DemoPet {
  const token = old.token ?? toPetToken(claimRandomToken(old.petId));
  return {
    v: 4,
    id: old.id,
    owner: DEMO_ACCOUNT_ID,
    petId: old.petId,
    species: old.species,
    name: currentName(old.petId, old.name),
    hunger: old.hunger,
    energy: old.energy,
    mood: old.mood,
    mintedAt: old.mintedAt,
    lastUpdated: old.lastUpdated,
    happyUntil: null,
    stats: emptyStats(),
    token,
    demo: true,
  };
}

function parseStats(value: unknown): PetStats | null {
  if (!isObject(value) || !isObject(value.best)) return null;
  const { games, snacks, messages } = value;
  // Pets saved before task 049 also carry best.simon (game removed): ignored, the pet stays valid.
  // best.fetch (task 050) and best.hideseek (task 051) are newer: missing = 0.
  const { snack } = value.best;
  const fetch = value.best.fetch ?? 0;
  const hideseek = value.best.hideseek ?? 0;
  if (![games, snacks, messages, snack, fetch, hideseek].every(isCount)) return null;
  return { games, snacks, messages, best: { snack, fetch, hideseek } } as PetStats;
}

/** One v4 pet, rebuilt field by field (unknown fields dropped), or null when anything is off. */
function parseStoredPet(value: unknown): DemoPet | null {
  if (!isObject(value) || value.v !== 4 || !commonValid(value)) return null;
  if (typeof value.owner !== "string" || !value.owner || !isDate(value.lastUpdated)) return null;
  if (value.happyUntil !== null && !isDate(value.happyUntil)) return null;
  const stats = parseStats(value.stats);
  const checked = checkToken(value.token, value.petId as string);
  if (!stats || !checked.ok) return null;
  const pet = value as unknown as DemoPet;
  return {
    v: 4,
    id: pet.id,
    owner: pet.owner,
    petId: pet.petId,
    species: pet.species,
    name: currentName(pet.petId, pet.name),
    hunger: pet.hunger,
    energy: pet.energy,
    mood: pet.mood,
    mintedAt: pet.mintedAt,
    lastUpdated: pet.lastUpdated,
    happyUntil: pet.happyUntil,
    stats,
    token: checked.token,
    demo: true,
  };
}

const emptyStore = (): PetStore => ({ v: 4, pets: [], active: {} });

/** Adds a pet unless its id or token is already in the collection. */
function addPet(store: PetStore, pet: DemoPet): boolean {
  const clash = store.pets.some(
    (other) => other.id === pet.id || (pet.token && other.token?.tokenId === pet.token.tokenId),
  );
  if (!clash) store.pets.push(pet);
  return !clash;
}

/** Bad pets, duplicates and dangling `active` entries are dropped one by one; a bad shape resets the store. */
function parseStore(raw: string | null): PetStore {
  const store = emptyStore();
  if (!raw) return store;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!isObject(data) || data.v !== 4 || !Array.isArray(data.pets) || !isObject(data.active)) return store;
    for (const value of data.pets) {
      const pet = parseStoredPet(value);
      if (pet) addPet(store, pet);
    }
    for (const [owner, id] of Object.entries(data.active)) {
      if (store.pets.some((pet) => pet.id === id && pet.owner === owner)) store.active[owner] = id as string;
    }
  } catch {
    // corrupt JSON: empty store
  }
  return store;
}

// Blocked storage: the collection lives here (survives client navigation, gone on reload).
let memoryStore: PetStore | null = null;
let loading = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Reads the collection. Rewrites it when anything was dropped or migrated; an old single pet
 * (neargotchi-pet, v1–v3, also one written later by an outdated tab) joins the collection and its
 * key is removed only after the collection was saved. Every token is re-marked as minted (self-heal).
 */
function loadStore(): PetStore {
  const raw = readKey(PETS_STORAGE_KEY);
  if (raw === undefined) {
    memoryStore ??= emptyStore();
    return memoryStore;
  }
  // Re-entry (a listener reading pets while a migration runs) gets the last known state, never a second migration.
  if (loading) return memoryStore ?? parseStore(raw);
  loading = true;
  try {
    const store = parseStore(raw);
    const legacyRaw = readKey(LEGACY_PET_STORAGE_KEY);
    const legacy = legacyRaw ? parseLegacy(legacyRaw) : null;
    if (legacy) addPet(store, fromLegacy(legacy));
    for (const pet of store.pets) if (pet.token) ensureMinted(pet.token.tokenId);
    const serialized = JSON.stringify(store);
    const saved = serialized === raw || (raw === null && store.pets.length === 0) || writeKey(PETS_STORAGE_KEY, serialized);
    if (legacyRaw && saved) writeKey(LEGACY_PET_STORAGE_KEY, null);
    memoryStore = store;
    // Last, so the wallet's listeners (which read pets again) see the finished migration.
    if (legacy && saved) absorbBalance(legacy.balance);
    return store;
  } finally {
    loading = false;
  }
}

function commit(store: PetStore) {
  memoryStore = store;
  writeKey(PETS_STORAGE_KEY, JSON.stringify(store));
  notify();
}

const ownedBy = (store: PetStore, owner: string) => store.pets.filter((pet) => pet.owner === owner);

/** The account's chosen pet, else its newest one. */
function activeOf(store: PetStore, owner: string): DemoPet | null {
  const mine = ownedBy(store, owner);
  return mine.find((pet) => pet.id === store.active[owner]) ?? mine[mine.length - 1] ?? null;
}

/** False when localStorage is blocked (private mode, blocked site data). */
export function isPersistent(): boolean {
  if (!inBrowser()) return true;
  try {
    const probe = "neargotchi-probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

let ownedSync: { owner: string; at: number; run: Promise<void> } | null = null;

/** Testnet: every token the account owns on the contract gets a (local game-state) pet. Cached 15 s per account. */
async function syncOwned(owner: string) {
  if (!isTestnet) return;
  if (!ownedSync || ownedSync.owner !== owner || Date.now() - ownedSync.at > 15000) {
    ownedSync = {
      owner,
      at: Date.now(),
      run: (async () => {
        try {
          const tokens = await getOwnedTokens(owner);
          for (const token of tokens) {
            const store = loadStore();
            if (ownedBy(store, owner).some((pet) => pet.token?.tokenId === token.tokenId)) continue;
            await mintPet({ token }).catch(() => {});
          }
        } catch {
          // RPC down: show what is stored
        }
      })(),
    };
  }
  await ownedSync.run;
}

/** The connected account's pets, oldest first; [] when no wallet is connected. */
export async function getPets(): Promise<DemoPet[]> {
  const owner = connectedAccountId();
  if (owner) await syncOwned(owner);
  const store = loadStore();
  return owner ? ownedBy(store, owner) : [];
}

/**
 * One pet of the connected account: by pet id or by its token id ("17", as in /pet?id=17), or the active
 * one when no id is given. null without a wallet, without pets, or for an id the account doesn't own.
 */
export async function getPet(id?: string): Promise<DemoPet | null> {
  const owner = connectedAccountId();
  if (owner) await syncOwned(owner);
  const store = loadStore();
  if (!owner) return null;
  if (id === undefined) return activeOf(store, owner);
  return ownedBy(store, owner).find((pet) => pet.id === id || (pet.token && String(pet.token.tokenId) === id)) ?? null;
}

/** Picks the pet /pet shows for the connected account. */
export async function setActivePet(id: string): Promise<void> {
  const owner = connectedAccountId();
  const store = loadStore();
  if (!owner || !ownedBy(store, owner).some((pet) => pet.id === id)) throw new MintError("no_pet");
  if (store.active[owner] === id) return;
  commit({ ...store, active: { ...store.active, [owner]: id } });
}

/**
 * Saves a pet for a drop-1 token that hatchRandom() just drew (docs/DEVLOG.md §2) and makes it
 * the active one. Saved right after the draw with the pet's own name, so leaving during the reveal keeps
 * it; the reveal's name field then calls renamePet. Throws MintError: "no_wallet" without a connected
 * account, a name error, or "no_pet" for a token that isn't in the drop or already has a pet.
 */
export async function mintPet(input: { token: Pick<Drop1Token, "tokenId">; name?: string }): Promise<DemoPet> {
  const owner = connectedAccountId();
  if (!owner) throw new MintError("no_wallet");
  const token = findToken(input.token.tokenId);
  const profile = findPet(token?.petId);
  if (!token || !profile) throw new MintError("no_pet");
  const checked = validatePetName(input.name ?? "", profile.id);
  if (!checked.ok) throw new MintError(checked.error);
  ensureMinted(token.tokenId);
  const now = new Date().toISOString();
  const pet: DemoPet = {
    v: 4,
    id: `demo-${profile.id}-${token.tokenId}-${Date.now()}`,
    owner,
    petId: profile.id,
    species: profile.species,
    name: checked.name,
    hunger: 20,
    energy: 100,
    mood: "happy",
    mintedAt: now,
    lastUpdated: now,
    happyUntil: null,
    stats: emptyStats(),
    token: toPetToken(token),
    demo: true,
  };
  const store = loadStore();
  if (!addPet(store, pet)) throw new MintError("no_pet");
  commit({ ...store, active: { ...store.active, [owner]: pet.id } });
  return pet;
}

/** Validates (empty → the pet's own name) and saves. Throws MintError. */
export async function renamePet(raw: string, id?: string): Promise<DemoPet> {
  const current = await getPet(id);
  if (!current) throw new MintError("no_pet");
  const checked = validatePetName(raw, current.petId);
  if (!checked.ok) throw new MintError(checked.error);
  return checked.name === current.name ? current : updatePet({ name: checked.name }, current.id);
}

/** Merges a patch into one of the connected account's pets (the active one by default). */
export async function updatePet(
  patch: Partial<Omit<DemoPet, "v" | "id" | "owner" | "demo" | "token">>,
  id?: string,
): Promise<DemoPet> {
  const current = await getPet(id);
  if (!current) throw new Error("no pet");
  return savePet({ ...current, ...patch, v: 4, id: current.id, owner: current.owner, token: current.token, demo: true });
}

/** Replaces the stored pet with the same id; a pet released meanwhile (e.g. in another tab) is not brought back. */
function savePet(pet: DemoPet): DemoPet {
  const store = loadStore();
  const index = store.pets.findIndex((other) => other.id === pet.id);
  if (index === -1) return pet;
  const nextPets = store.pets.slice();
  nextPets[index] = pet;
  commit({ ...store, pets: nextPets });
  return pet;
}

/**
 * Removes one pet (the active one by default) and its chat log; the account's newest remaining pet
 * becomes active. Its drop-1 token stays minted (the counter only goes up).
 */
export async function releasePet(id?: string): Promise<void> {
  const current = await getPet(id);
  if (!current) return;
  const store = loadStore();
  const active = { ...store.active };
  if (active[current.owner] === current.id) delete active[current.owner];
  clearChat(current.id);
  commit({ ...store, pets: store.pets.filter((pet) => pet.id !== current.id), active });
}

/** Calls back on any change to the collection or the wallet, in this tab and from other tabs. */
export function subscribePets(callback: () => void): () => void {
  listeners.add(callback);
  const offAccount = subscribeAccount(() => callback());
  const onStorage = (event: StorageEvent) => {
    if (event.key === PETS_STORAGE_KEY || event.key === LEGACY_PET_STORAGE_KEY || event.key === null) callback();
  };
  if (inBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    offAccount();
    if (inBrowser()) window.removeEventListener("storage", onStorage);
  };
}

/** The active pet (or null) after any change; re-read through getPet so migrations run once. */
export function subscribePet(callback: (pet: DemoPet | null) => void): () => void {
  return subscribePets(() => {
    getPet().then(callback);
  });
}

// ---------- /pet simulation (docs/DEVLOG.md §2; hunger tempo from PLANNER REVIEW 037) ----------

export const PET_RULES = {
  /** 20 → 70 (hungry) in ~17 min; never above 100 (task 049: 5 → 3, games were almost always blocked). */
  hungerPerMin: 3,
  hungryAt: 70,
  /**
   * Economy (task 059, owner decisions 2026-11-09): energy never changes with time or games. It is spent ONLY
   * by chatting with the pet (energy = NEAR AI fuel) and refilled ONLY by the energy pack (lib/shop.ts).
   * Snacks, games and chat touch nothing else: food = hunger, chat = energy.
   */
  chatEnergy: 4,
  /** Chat no longer uses food. */
  chatHunger: 0,
  happyMs: 3000,
  chatMax: 30,
  messageMax: 140,
} as const;

const clampLevel = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;

/** Displayed and compared as whole numbers so the bars, numbers and moods always agree. */
export const levelOf = (value: number) => Math.round(value);

/** Mood without the UI-only happy timer. */
export function baseMood(pet: Pick<DemoPet, "hunger" | "energy"> & { mood?: Mood }): Mood {
  if (levelOf(pet.hunger) >= PET_RULES.hungryAt) return "hungry";
  return "normal";
}

/** Sprite mood: sleep > happy (UI timer) > hungry > normal (docs/DEVLOG.md §4). */
export function moodOf(pet: Pick<DemoPet, "hunger" | "energy"> & { mood?: Mood }, now: number, happyUntil: number): Mood {
  const base = baseMood(pet);
  if (base === "sleep") return "sleep";
  if (now < happyUntil) return "happy";
  return base;
}

/**
 * Pure: hunger from lastUpdated to now (also covers a closed tab): +3/min, max 100. Energy is untouched (task 059).
 * A clock that moved backwards changes nothing.
 */
export function simulatePet(pet: DemoPet, now: number): DemoPet {
  const last = Date.parse(pet.lastUpdated);
  const stamp = new Date(now).toISOString();
  if (!Number.isFinite(last) || now <= last) return { ...pet, lastUpdated: stamp };
  const minutes = (now - last) / 60000;
  const next = { ...pet, hunger: clampLevel(pet.hunger + PET_RULES.hungerPerMin * minutes), lastUpdated: stamp };
  return { ...next, mood: baseMood(next) };
}

/** Simulates one pet (the active one by default) to now and saves (on actions, every 15s while visible, on hide). */
export async function tickPet(id?: string): Promise<DemoPet | null> {
  const current = await getPet(id);
  return current ? savePet(simulatePet(current, Date.now())) : null;
}

// ---------- Chat (deterministic local replies; "demo · near ai soon") ----------

export type ChatMessage = {
  id: string;
  /** "note" = system note; its text is a code ("no_energy", older logs "asleep") rendered by the UI. */
  from: "you" | "pet" | "note";
  text: string;
  /** ISO date */
  at: string;
};

export type ChatKind = "reply" | "hungry" | "no_energy" | "ai_error";

export const CHAT_STORAGE_KEY = "neargotchi-chat";

/** v2: one log per pet (pet id → last 30 messages). A v1 log (one pet) becomes that pet's entry. */
type ChatStore = { v: 2; logs: Record<string, ChatMessage[]> };

type PetLines = {
  greet: string;
  food: string;
  near: string;
  who: string;
  love: string;
  fallback: [string, string];
  hungry: string;
};

/** Per-pet personality lines (docs/DEVLOG.md §5). */
export const petLines: Record<string, PetLines> = {
  pet1: {
    greet: "gm. i was asleep on the couch. still am, mentally.",
    food: "snack? i heard snack. i always hear snack.",
    near: "near is fast. i am not. we balance out.",
    who: "{name}. corgi. legend. the real dog of this whole thing.",
    love: "you may pet the loaf.",
    fallback: ["interesting. now feed me.", "i nodded. that's all you get."],
    hungry: "too hungry to talk. bowl first.",
  },
  pet2: {
    greet: "rawr. that was a greeting. you're welcome.",
    food: "i eat shards. also snacks. mostly snacks.",
    near: "near has shards. i have shards. we're basically family.",
    who: "{name}. small dragon. big shards. bigger plans.",
    love: "my scales are blushing. you can't tell, they're green.",
    fallback: ["i breathed a tiny fire. it went out. anyway.", "noted. filed under dragon business."],
    hungry: "no fire without food.",
  },
  pet3: {
    greet: "gm. i saw you coming three blocks ago.",
    food: "food detected. eyes open. mouth also open.",
    near: "new block. new block. new block. i love it here.",
    who: "{name}. on watch since genesis.",
    love: "i'll guard that compliment forever.",
    fallback: ["hm. scanning… nothing suspicious. carry on.", "noted. i never miss a block, or a message."],
    hungry: "can't watch on an empty stomach.",
  },
};

/** First matching keyword group wins; otherwise the two fallbacks alternate. */
const replyRules: [keyof Omit<PetLines, "fallback" | "hungry">, RegExp][] = [
  ["greet", /\b(gm|hi|hello|hey)\b/],
  ["food", /\b(food|eat|snacks?|hungry|feed)\b/],
  ["near", /\b(near|tokens?|burn|block|chain)\b/],
  ["who", /\b(who|name|you)\b/],
  ["love", /\b(love|good|cute|best)\b/],
];

/** Pure and deterministic: same pet + text + index → same line. "{name}" is the pet's own name (QC demo v2). */
export function pickReply(pet: Pick<DemoPet, "petId"> & { name?: string }, text: string, index: number): string {
  const lines = petLines[pet.petId] ?? petLines.pet1;
  const lower = text.toLowerCase();
  const rule = replyRules.find(([, pattern]) => pattern.test(lower));
  const line = rule ? lines[rule[0]] : lines.fallback[index % 2];
  return line.replace("{name}", pet.name ?? findPet(pet.petId)?.name ?? "");
}


const isMessage = (m: unknown): m is ChatMessage =>
  isObject(m) &&
  typeof m.id === "string" &&
  (m.from === "you" || m.from === "pet" || m.from === "note") &&
  typeof m.text === "string" &&
  typeof m.at === "string";

// Blocked storage: the logs live here until reload.
let memoryChat: ChatStore | null = null;

/** Reads all logs; a v1 log is converted, bad logs are dropped, and the result is saved when it changed. */
function readChats(): ChatStore {
  const raw = readKey(CHAT_STORAGE_KEY);
  if (raw === undefined) {
    memoryChat ??= { v: 2, logs: {} };
    return memoryChat;
  }
  const store: ChatStore = { v: 2, logs: {} };
  if (raw) {
    try {
      const data = JSON.parse(raw) as unknown;
      if (isObject(data) && data.v === 2 && isObject(data.logs)) {
        for (const [id, messages] of Object.entries(data.logs)) {
          if (Array.isArray(messages) && messages.every(isMessage)) store.logs[id] = messages.slice(-PET_RULES.chatMax);
        }
      } else if (
        isObject(data) &&
        data.v === 1 &&
        typeof data.petInstanceId === "string" &&
        Array.isArray(data.messages) &&
        data.messages.every(isMessage)
      ) {
        store.logs[data.petInstanceId] = data.messages.slice(-PET_RULES.chatMax);
      }
    } catch {
      // corrupt JSON: no logs
    }
    const serialized = JSON.stringify(store);
    if (serialized !== raw) writeKey(CHAT_STORAGE_KEY, Object.keys(store.logs).length ? serialized : null);
  }
  memoryChat = store;
  return store;
}

function writeChatLog(petId: string, messages: ChatMessage[]) {
  const store = readChats();
  memoryChat = { v: 2, logs: { ...store.logs, [petId]: messages.slice(-PET_RULES.chatMax) } };
  writeKey(CHAT_STORAGE_KEY, JSON.stringify(memoryChat));
}

function clearChat(petId: string) {
  const store = readChats();
  if (!(petId in store.logs)) return;
  const logs = { ...store.logs };
  delete logs[petId];
  memoryChat = { v: 2, logs };
  writeKey(CHAT_STORAGE_KEY, Object.keys(logs).length ? JSON.stringify(memoryChat) : null);
}

/** One pet's log (last 30), the active pet's by default. */
export async function getChat(id?: string): Promise<ChatMessage[]> {
  const pet = await getPet(id);
  return pet ? (readChats().logs[pet.id] ?? []) : [];
}

let messageSeq = 0;
const chatMessage = (from: ChatMessage["from"], text: string, now: number): ChatMessage => ({
  id: `m-${now}-${(messageSeq += 1)}`,
  from,
  text,
  at: new Date(now).toISOString(),
});

/**
 * Stores your message and the reply. Every answered message costs PET_RULES.chatEnergy energy (no food);
 * with less energy than that, a "no_energy" note comes back and nothing is spent. Hungry → its hungry line.
 * Every sent message counts in stats.messages.
 * Throws on an empty message.
 */
export async function chatWithPet(
  text: string,
  id?: string,
  /** NEAR AI (task 060): asked for the reply once the pet has the energy; "no_key" → the mock answers, "error" → friendly note, nothing spent. */
  ask?: (request: AiRequest) => Promise<AiAnswer>,
): Promise<{ pet: DemoPet; messages: ChatMessage[]; reply: ChatMessage; kind: ChatKind; source: "ai" | "mock" }> {
  const current = await getPet(id);
  if (!current) throw new Error("no pet");
  const clean = text.trim().slice(0, PET_RULES.messageMax);
  if (!clean) throw new Error("empty message");
  const now = Date.now();
  let pet = simulatePet(current, now);
  const log = readChats().logs[pet.id] ?? [];
  const sent = log.filter((m) => m.from === "you").length;
  const mine = chatMessage("you", clean, now);
  const mood = baseMood(pet);
  let reply: ChatMessage;
  let kind: ChatKind;
  let source: "ai" | "mock" = "mock";
  if (levelOf(pet.energy) < PET_RULES.chatEnergy) {
    // Not enough energy: nothing is spent, the UI links to the energy pack.
    reply = chatMessage("note", "no_energy", now);
    kind = "no_energy";
  } else {
    kind = mood === "hungry" ? "hungry" : "reply";
    const answer: AiAnswer = ask
      ? await ask({
          petType: pet.petId,
          petName: pet.name,
          stats: { hunger: levelOf(pet.hunger), energy: levelOf(pet.energy), mood },
          history: log.filter((m): m is ChatMessage & { from: "you" | "pet" } => m.from !== "note").slice(-8).map((m) => ({ from: m.from, text: m.text })),
          message: clean,
        })
      : { status: "no_key" };
    if (answer.status === "ok") {
      reply = chatMessage("pet", answer.text, now);
      source = "ai";
    } else if (answer.status === "error") {
      // The AI failed: a friendly note, and the energy stays.
      reply = chatMessage("note", "ai_error", now);
      kind = "ai_error";
    } else if (kind === "hungry") {
      reply = chatMessage("pet", (petLines[pet.petId] ?? petLines.pet1).hungry, now);
    } else {
      reply = chatMessage("pet", pickReply(pet, clean, sent), now);
    }
  }
  if (kind !== "no_energy" && kind !== "ai_error") {
    // every answered message (also the hungry line) costs energy; food is not touched
    const spent = { ...pet, energy: clampLevel(pet.energy - PET_RULES.chatEnergy), hunger: clampLevel(pet.hunger + PET_RULES.chatHunger) };
    pet = { ...spent, mood: baseMood(spent) };
  }
  pet = { ...pet, stats: { ...pet.stats, messages: pet.stats.messages + 1 } };
  const messages = [...log, mine, reply].slice(-PET_RULES.chatMax);
  writeChatLog(pet.id, messages);
  return { pet: savePet(pet), messages, reply, kind, source };
}

/** Other tabs' chat changes (storage event). */
export function subscribeChat(callback: () => void): () => void {
  if (!inBrowser()) return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHAT_STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
