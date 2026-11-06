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
  /** Mouth in the happy sprite, as fractions of its width/height (/pet feed animation target). */
  mouth: [number, number];
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
    mouth: [0.3, 0.51],
  },
  {
    id: "pet2",
    species: "dragon",
    name: "nightshade",
    description: "small dragon. big shards.",
    spriteFolder: "pet2",
    spriteWidth: 489,
    spriteHeight: 431,
    mouth: [0.36, 0.45],
  },
  {
    id: "pet3",
    species: "meerkat",
    name: "merk",
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

// ---------- Demo pet store (PLAN-MINT.md §2) ----------
// Async on purpose: a future backend swaps these bodies and keeps the same calls.
// Browser-only; every storage access is guarded. Nothing here is a real mint.

export type DemoPet = {
  /** 2 since /pet (adds lastUpdated); v1 pets from /mint are migrated on read. */
  v: 2;
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
  /** ISO date: hunger/energy are simulated from here to "now" (docs/DEVLOG.md §2). */
  lastUpdated: string;
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

/** Parses a stored pet; a v1 pet (from /mint before /pet existed) is migrated with lastUpdated = now. */
function parsePetRecord(raw: string | null | undefined): { pet: DemoPet; migrated: boolean } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as (Omit<Partial<DemoPet>, "v"> & { v?: number }) | null;
    if (
      !data ||
      (data.v !== 1 && data.v !== 2) ||
      (data.v === 2 && (typeof data.lastUpdated !== "string" || !Number.isFinite(Date.parse(data.lastUpdated)))) ||
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
    if (data.v === 1) return { pet: { ...(data as unknown as DemoPet), v: 2, lastUpdated: new Date().toISOString() }, migrated: true };
    return { pet: data as DemoPet, migrated: false };
  } catch {
    return null;
  }
}

const parsePet = (raw: string | null | undefined) => parsePetRecord(raw)?.pet ?? null;

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
  const record = parsePetRecord(raw);
  if (!record && raw !== null) writeStored(null);
  if (record?.migrated) writeStored(JSON.stringify(record.pet));
  memoryPet = record?.pet ?? null;
  return memoryPet;
}

/** Validates, creates and saves the demo pet. Throws MintError on a bad name or unknown pet. */
export async function mintPet(input: { petId: string; name: string }): Promise<DemoPet> {
  const profile = findPet(input.petId);
  if (!profile) throw new MintError("no_pet");
  const checked = validatePetName(input.name, input.petId);
  if (!checked.ok) throw new MintError(checked.error);
  const now = new Date().toISOString();
  const pet: DemoPet = {
    v: 2,
    id: `demo-${profile.id}-${Date.now()}`,
    petId: profile.id,
    species: profile.species,
    name: checked.name,
    balance: 100,
    hunger: 20,
    energy: 100,
    mood: "happy",
    outfit: {},
    mintedAt: now,
    lastUpdated: now,
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
  return savePet({ ...current, ...patch, v: 2, id: current.id, demo: true } as DemoPet);
}

function savePet(pet: DemoPet): DemoPet {
  memoryPet = pet;
  writeStored(JSON.stringify(pet));
  notify(pet);
  return pet;
}

/** Removes the demo pet and its chat log. */
export async function resetPet(): Promise<void> {
  memoryPet = null;
  writeStored(null);
  clearChat();
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

// ---------- /pet simulation (docs/DEVLOG.md §2, numbers approved in its review) ----------

export const PET_RULES = {
  /** 20 → 70 (hungry) in 2.5 min; never above 100. */
  hungerPerMin: 20,
  /** Slow drain … */
  energyPerMin: 5,
  /** … twice as fast while hunger ≥ 70 ("it gets sad and slowly loses energy"). */
  energyPerMinHungry: 10,
  hungryAt: 70,
  /** energy ≤ 15 → asleep, doesn't talk. */
  sleepAt: 15,
  feedPrice: 5,
  feedHunger: 30,
  feedEnergy: 10,
  chatEnergy: 4,
  happyMs: 3000,
  startBalance: 100,
  chatMax: 30,
  messageMax: 140,
} as const;

const clampLevel = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;

/** Displayed and compared as whole numbers so the bars, numbers and moods always agree. */
export const levelOf = (value: number) => Math.round(value);

/** Mood without the UI-only happy timer. */
export function baseMood(pet: Pick<DemoPet, "hunger" | "energy">): Mood {
  if (levelOf(pet.energy) <= PET_RULES.sleepAt) return "sleep";
  if (levelOf(pet.hunger) >= PET_RULES.hungryAt) return "hungry";
  return "normal";
}

/** Sprite mood: sleep > happy (UI timer) > hungry > normal (docs/DEVLOG.md §4). */
export function moodOf(pet: Pick<DemoPet, "hunger" | "energy">, now: number, happyUntil: number): Mood {
  const base = baseMood(pet);
  if (base === "sleep") return "sleep";
  if (now < happyUntil) return "happy";
  return base;
}

/**
 * Pure: hunger and energy from lastUpdated to now (also covers a closed tab). Energy drains at
 * 5/min until hunger reaches 70, then at 10/min. A clock that moved backwards changes nothing.
 */
export function simulatePet(pet: DemoPet, now: number): DemoPet {
  const last = Date.parse(pet.lastUpdated);
  const stamp = new Date(now).toISOString();
  if (!Number.isFinite(last) || now <= last) return { ...pet, lastUpdated: stamp };
  const minutes = (now - last) / 60000;
  const R = PET_RULES;
  const hunger = Math.min(100, pet.hunger + R.hungerPerMin * minutes);
  const untilHungry = pet.hunger >= R.hungryAt ? 0 : (R.hungryAt - pet.hunger) / R.hungerPerMin;
  const energy =
    pet.energy - R.energyPerMin * Math.min(minutes, untilHungry) - R.energyPerMinHungry * Math.max(0, minutes - untilHungry);
  const next = { ...pet, hunger: clampLevel(hunger), energy: clampLevel(energy), lastUpdated: stamp };
  return { ...next, mood: baseMood(next) };
}

/** Simulates to now and saves (on actions, every 15s while visible, on hide). */
export async function tickPet(): Promise<DemoPet | null> {
  const current = await getPet();
  return current ? savePet(simulatePet(current, Date.now())) : null;
}

export type FeedResult = "fed" | "full" | "broke";

/** Costs 5 demo balance: −30 hunger, +10 energy. Not hungry at all → "full"; can't pay → "broke". */
export async function feedPet(): Promise<{ pet: DemoPet; result: FeedResult }> {
  const current = await getPet();
  if (!current) throw new Error("no pet");
  const pet = simulatePet(current, Date.now());
  const R = PET_RULES;
  if (levelOf(pet.hunger) <= 0) return { pet: savePet(pet), result: "full" };
  if (pet.balance < R.feedPrice) return { pet: savePet(pet), result: "broke" };
  const fed = {
    ...pet,
    balance: pet.balance - R.feedPrice,
    hunger: clampLevel(pet.hunger - R.feedHunger),
    energy: clampLevel(pet.energy + R.feedEnergy),
  };
  return { pet: savePet({ ...fed, mood: baseMood(fed) }), result: "fed" };
}

/** Demo only: back to 100 when a snack can't be paid; otherwise a no-op. */
export async function refillBalance(): Promise<DemoPet> {
  const current = await getPet();
  if (!current) throw new Error("no pet");
  const pet = simulatePet(current, Date.now());
  return savePet(pet.balance < PET_RULES.feedPrice ? { ...pet, balance: PET_RULES.startBalance } : pet);
}

// ---------- Chat (deterministic local replies; "demo · near ai soon") ----------

export type ChatMessage = {
  id: string;
  /** "note" = system note; its text is a code ("asleep") rendered by the UI. */
  from: "you" | "pet" | "note";
  text: string;
  /** ISO date */
  at: string;
};

export type ChatKind = "reply" | "hungry" | "asleep";

export const CHAT_STORAGE_KEY = "neargotchi-chat";

type ChatLog = { v: 1; petInstanceId: string; messages: ChatMessage[] };

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
    who: "batman. corgi. legend. the real dog of this whole thing.",
    love: "you may pet the loaf.",
    fallback: ["interesting. now feed me.", "i nodded. that's all you get."],
    hungry: "too hungry to talk. bowl first.",
  },
  pet2: {
    greet: "rawr. that was a greeting. you're welcome.",
    food: "i eat shards. also snacks. mostly snacks.",
    near: "near has shards. i have shards. we're basically family.",
    who: "nightshade. small dragon. big shards. bigger plans.",
    love: "my scales are blushing. you can't tell, they're green.",
    fallback: ["i breathed a tiny fire. it went out. anyway.", "noted. filed under dragon business."],
    hungry: "no fire without food.",
  },
  pet3: {
    greet: "gm. i saw you coming three blocks ago.",
    food: "food detected. eyes open. mouth also open.",
    near: "new block. new block. new block. i love it here.",
    who: "merk. on watch since genesis.",
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

/** Pure and deterministic: same pet + text + index → same line. */
export function pickReply(pet: Pick<DemoPet, "petId">, text: string, index: number): string {
  const lines = petLines[pet.petId] ?? petLines.pet1;
  const lower = text.toLowerCase();
  const rule = replyRules.find(([, pattern]) => pattern.test(lower));
  return rule ? lines[rule[0]] : lines.fallback[index % 2];
}

let memoryChat: ChatLog | null = null;

function readChatLog(petInstanceId: string): ChatMessage[] {
  let log: ChatLog | null = memoryChat;
  if (inBrowser()) {
    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      log = null;
      if (raw) {
        try {
          const data = JSON.parse(raw) as ChatLog;
          const valid =
            data?.v === 1 &&
            typeof data.petInstanceId === "string" &&
            Array.isArray(data.messages) &&
            data.messages.every(
              (m) =>
                m &&
                typeof m.id === "string" &&
                (m.from === "you" || m.from === "pet" || m.from === "note") &&
                typeof m.text === "string" &&
                typeof m.at === "string",
            );
          if (valid) log = data;
          else window.localStorage.removeItem(CHAT_STORAGE_KEY);
        } catch {
          window.localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      }
    } catch {
      log = memoryChat; // storage blocked
    }
  }
  if (!log || log.petInstanceId !== petInstanceId) return [];
  return log.messages.slice(-PET_RULES.chatMax);
}

function writeChatLog(petInstanceId: string, messages: ChatMessage[]) {
  memoryChat = { v: 1, petInstanceId, messages: messages.slice(-PET_RULES.chatMax) };
  if (!inBrowser()) return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(memoryChat));
  } catch {
    // storage blocked: memoryChat keeps it until reload
  }
}

function clearChat() {
  memoryChat = null;
  if (!inBrowser()) return;
  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // storage blocked
  }
}

/** The current pet's log (last 30); a log from another pet or a corrupt one is dropped. */
export async function getChat(): Promise<ChatMessage[]> {
  const pet = await getPet();
  return pet ? readChatLog(pet.id) : [];
}

let messageSeq = 0;
const chatMessage = (from: ChatMessage["from"], text: string, now: number): ChatMessage => ({
  id: `m-${now}-${(messageSeq += 1)}`,
  from,
  text,
  at: new Date(now).toISOString(),
});

/**
 * Stores your message and the reply. Asleep → "asleep" note, hungry → its hungry line (both free);
 * otherwise a personality line for 4 energy. Throws on an empty message.
 */
export async function chatWithPet(
  text: string,
): Promise<{ pet: DemoPet; messages: ChatMessage[]; reply: ChatMessage; kind: ChatKind }> {
  const current = await getPet();
  if (!current) throw new Error("no pet");
  const clean = text.trim().slice(0, PET_RULES.messageMax);
  if (!clean) throw new Error("empty message");
  const now = Date.now();
  let pet = simulatePet(current, now);
  const log = readChatLog(pet.id);
  const sent = log.filter((m) => m.from === "you").length;
  const mine = chatMessage("you", clean, now);
  const mood = baseMood(pet);
  let reply: ChatMessage;
  let kind: ChatKind;
  if (mood === "sleep") {
    reply = chatMessage("note", "asleep", now);
    kind = "asleep";
  } else if (mood === "hungry") {
    reply = chatMessage("pet", (petLines[pet.petId] ?? petLines.pet1).hungry, now);
    kind = "hungry";
  } else {
    reply = chatMessage("pet", pickReply(pet, clean, sent), now);
    kind = "reply";
    const spent = { ...pet, energy: clampLevel(pet.energy - PET_RULES.chatEnergy) };
    pet = { ...spent, mood: baseMood(spent) };
  }
  const messages = [...log, mine, reply].slice(-PET_RULES.chatMax);
  writeChatLog(pet.id, messages);
  return { pet: savePet(pet), messages, reply, kind };
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
