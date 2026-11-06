// Single mocks module (PLAN.md §4): the only place for demo pets, items, balances,
// chat replies and simulation rules. All values here are demonstration data.

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
};

/** Approved pets (copy v1). */
export const pets: PetProfile[] = [
  {
    id: "pet1",
    species: "corgi",
    name: "batman",
    description: "the corgi of near's co-founder. chunky. legendary. always hungry.",
    spriteFolder: "pet1",
    spriteWidth: 489,
    spriteHeight: 431,
  },
  {
    id: "pet2",
    species: "dragon",
    name: "nightshade",
    description: "small dragon. big shards.",
    spriteFolder: "pet2",
    spriteWidth: 489,
    spriteHeight: 431,
  },
  {
    id: "pet3",
    species: "meerkat",
    name: "merk",
    description: "always on watch. never misses a block.",
    spriteFolder: "pet3",
    spriteWidth: 489,
    spriteHeight: 431,
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

// ---------- Demo pet store (PLAN-MINT.md §2) ----------
// Async on purpose: a future backend swaps these bodies and keeps the same calls.
// Browser-only; every storage access is guarded. Nothing here is a real mint.

export type DemoPet = {
  v: 1;
  /** "demo-" + petId + "-" + Date.now() */
  id: string;
  petId: PetProfile["id"];
  species: string;
  name: string;
  /** Demo $NEARGotchi, display only ("100 demo $NEARGotchi"). */
  balance: number;
  /** 0–100 */
  hunger: number;
  /** 0–100 */
  energy: number;
  mood: Mood;
  outfit: Partial<Record<Slot, Item["id"] | null>>;
  /** ISO date */
  mintedAt: string;
  demo: true;
};

export const PET_STORAGE_KEY = "neargotchi-pet";

export const PET_NAME_MIN = 2;
export const PET_NAME_MAX = 12;

export type NameError = "too_short" | "too_long" | "bad_chars" | "no_pet";

export class MintError extends Error {
  constructor(public readonly code: NameError) {
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

// Blocked storage: the pet lives here (survives client navigation, gone on reload).
let memoryPet: DemoPet | null = null;
const listeners = new Set<(pet: DemoPet | null) => void>();
const notify = (pet: DemoPet | null) => listeners.forEach((listener) => listener(pet));

const inBrowser = () => typeof window !== "undefined";

/** undefined = storage unavailable. */
function readStored(): string | null | undefined {
  if (!inBrowser()) return undefined;
  try {
    return window.localStorage.getItem(PET_STORAGE_KEY);
  } catch {
    return undefined;
  }
}

function writeStored(value: string | null): boolean {
  if (!inBrowser()) return false;
  try {
    if (value === null) window.localStorage.removeItem(PET_STORAGE_KEY);
    else window.localStorage.setItem(PET_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

const isLevel = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

function parsePet(raw: string | null | undefined): DemoPet | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<DemoPet> | null;
    if (
      !data ||
      data.v !== 1 ||
      data.demo !== true ||
      typeof data.id !== "string" ||
      typeof data.name !== "string" ||
      !findPet(data.petId) ||
      !validatePetName(data.name, data.petId).ok ||
      normalizePetName(data.name) !== data.name ||
      typeof data.balance !== "number" ||
      !Number.isFinite(data.balance) ||
      !isLevel(data.hunger) ||
      !isLevel(data.energy) ||
      !moods.includes(data.mood as Mood) ||
      typeof data.outfit !== "object" ||
      data.outfit === null ||
      typeof data.mintedAt !== "string"
    ) {
      return null;
    }
    return data as DemoPet;
  } catch {
    return null;
  }
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

/** The saved demo pet, or null (none / corrupt / old version / unknown pet — corrupt data is cleared). */
export async function getPet(): Promise<DemoPet | null> {
  const raw = readStored();
  if (raw === undefined) return memoryPet;
  const pet = parsePet(raw);
  if (!pet && raw !== null) writeStored(null);
  memoryPet = pet;
  return pet;
}

/** Validates, creates and saves the demo pet. Throws MintError on a bad name or unknown pet. */
export async function mintPet(input: { petId: string; name: string }): Promise<DemoPet> {
  const profile = findPet(input.petId);
  if (!profile) throw new MintError("no_pet");
  const checked = validatePetName(input.name, input.petId);
  if (!checked.ok) throw new MintError(checked.error);
  const pet: DemoPet = {
    v: 1,
    id: `demo-${profile.id}-${Date.now()}`,
    petId: profile.id,
    species: profile.species,
    name: checked.name,
    balance: 100,
    hunger: 20,
    energy: 100,
    mood: "happy",
    outfit: {},
    mintedAt: new Date().toISOString(),
    demo: true,
  };
  memoryPet = pet;
  writeStored(JSON.stringify(pet));
  notify(pet);
  return pet;
}

/** For /pet: merges a patch into the saved pet. */
export async function updatePet(patch: Partial<Omit<DemoPet, "v" | "id" | "demo">>): Promise<DemoPet> {
  const current = await getPet();
  if (!current) throw new Error("no pet");
  const next = { ...current, ...patch, v: 1, id: current.id, demo: true } as DemoPet;
  memoryPet = next;
  writeStored(JSON.stringify(next));
  notify(next);
  return next;
}

export async function resetPet(): Promise<void> {
  memoryPet = null;
  writeStored(null);
  notify(null);
}

/** Calls back on mint/update/reset in this tab and on storage changes from other tabs. */
export function subscribePet(callback: (pet: DemoPet | null) => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PET_STORAGE_KEY && event.key !== null) return;
    const pet = parsePet(event.newValue);
    memoryPet = pet;
    callback(pet);
  };
  if (inBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (inBrowser()) window.removeEventListener("storage", onStorage);
  };
}
