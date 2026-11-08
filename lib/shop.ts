// Snack shop (docs/DEVLOG.md §1 table, step 5). Mock: stock lives in localStorage per demo account
// and restocks on read (like hunger). Prices are demo $NEARGotchi from the wallet. Async on purpose: the
// UI only calls getShop / buySnack / subscribeShop, so a contract can replace the bodies later.

import { baseMood, getPet, levelOf, simulatePet, updatePet, type DemoPet } from "./mocks";
import { WalletError, connectedAccountId, spend } from "./wallet";

export const snackIds = ["cookie", "berries", "noodles", "candy"] as const;
export type SnackId = (typeof snackIds)[number];

export type Snack = {
  id: SnackId;
  /** demo $NEARGotchi */
  price: number;
  /** taken off hunger */
  hunger: number;
  /** added to energy */
  energy: number;
  /** null = always in stock */
  max: number | null;
  /** +1 stock every … ms while below max */
  restockMs: number | null;
  /** > 0: the pet stays happy this long */
  happyMs: number;
};

const MIN = 60000;

/** §1 table: bone cookie / berries / noodles / star candy. */
export const snacks: Snack[] = [
  { id: "cookie", price: 2, hunger: 10, energy: 0, max: null, restockMs: null, happyMs: 0 },
  { id: "berries", price: 5, hunger: 25, energy: 5, max: 3, restockMs: 1 * MIN, happyMs: 0 },
  { id: "noodles", price: 10, hunger: 50, energy: 10, max: 2, restockMs: 3 * MIN, happyMs: 0 },
  { id: "candy", price: 20, hunger: 20, energy: 40, max: 1, restockMs: 10 * MIN, happyMs: 60000 },
];

export const findSnack = (id: unknown) => snacks.find((snack) => snack.id === id) ?? null;

export const SHOP_STORAGE_KEY = "neargotchi-shop";

/** One limited snack's stock; nextAt = when the next unit arrives (ms), null while full. */
type Slot = { stock: number; nextAt: number | null };
type ShopStore = { v: 1; accounts: Record<string, Partial<Record<SnackId, Slot>>> };

export type ShopItem = {
  snack: Snack;
  /** null = unlimited */
  stock: number | null;
  /** ms timestamp of the next restock, null when full or unlimited */
  nextAt: number | null;
};

export type BuyResult = "fed" | "asleep" | "full" | "broke" | "out_of_stock";

export class ShopError extends Error {
  constructor(public readonly code: "no_pet" | "unknown_snack") {
    super(code);
    this.name = "ShopError";
  }
}

const inBrowser = () => typeof window !== "undefined";
let memory: ShopStore | null = null;
const listeners = new Set<() => void>();

function readStore(): ShopStore {
  if (!inBrowser()) return memory ?? { v: 1, accounts: {} };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SHOP_STORAGE_KEY);
  } catch {
    return memory ?? { v: 1, accounts: {} };
  }
  const store: ShopStore = { v: 1, accounts: {} };
  if (raw) {
    try {
      const data = JSON.parse(raw) as Partial<ShopStore> | null;
      if (data && data.v === 1 && data.accounts && typeof data.accounts === "object") {
        for (const [account, slots] of Object.entries(data.accounts)) {
          const clean: Partial<Record<SnackId, Slot>> = {};
          for (const snack of snacks) {
            const slot = (slots as Record<string, Slot> | null)?.[snack.id];
            if (
              snack.max !== null &&
              slot &&
              Number.isInteger(slot.stock) &&
              slot.stock >= 0 &&
              slot.stock <= snack.max &&
              (slot.nextAt === null || (typeof slot.nextAt === "number" && Number.isFinite(slot.nextAt)))
            ) {
              clean[snack.id] = { stock: slot.stock, nextAt: slot.nextAt };
            }
          }
          store.accounts[account] = clean;
        }
      }
    } catch {
      // corrupt: full stock for everyone
    }
    if (JSON.stringify(store) !== raw) writeStore(store, false);
  }
  memory = store;
  return store;
}

function writeStore(store: ShopStore, announce = true) {
  memory = store;
  if (inBrowser()) {
    try {
      window.localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // storage blocked: memory keeps it until reload
    }
  }
  if (announce) listeners.forEach((listener) => listener());
}

/** Pure: a slot after restocking up to `now` (missing slot = full). */
export function restock(snack: Snack, slot: Slot | undefined, now: number): Slot {
  if (snack.max === null || snack.restockMs === null) return { stock: 0, nextAt: null };
  if (!slot) return { stock: snack.max, nextAt: null };
  if (slot.stock >= snack.max || slot.nextAt === null) return { stock: Math.min(slot.stock, snack.max), nextAt: slot.stock >= snack.max ? null : now + snack.restockMs };
  if (now < slot.nextAt) return slot;
  const arrived = 1 + Math.floor((now - slot.nextAt) / snack.restockMs);
  const stock = Math.min(snack.max, slot.stock + arrived);
  return stock >= snack.max ? { stock, nextAt: null } : { stock, nextAt: slot.nextAt + arrived * snack.restockMs };
}

function itemsFor(store: ShopStore, owner: string, now: number): ShopItem[] {
  const slots = store.accounts[owner] ?? {};
  return snacks.map((snack) => {
    if (snack.max === null) return { snack, stock: null, nextAt: null };
    const slot = restock(snack, slots[snack.id], now);
    return { snack, stock: slot.stock, nextAt: slot.nextAt };
  });
}

/** The connected account's shop, restocked to now; [] without a wallet. */
export async function getShop(): Promise<ShopItem[]> {
  const owner = connectedAccountId();
  return owner ? itemsFor(readStore(), owner, Date.now()) : [];
}

/**
 * Buys one snack for one of the account's pets and feeds it right away. Checks in order: out of stock,
 * full (nothing to eat for: hunger 0 and no energy to add), broke. A sleeping pet eats too ("asleep":
 * the energy can wake it up). Counts stats.snacks; star candy keeps the pet happy for 60s.
 */
export async function buySnack(petId: string, snackId: SnackId): Promise<{ pet: DemoPet; result: BuyResult }> {
  const snack = findSnack(snackId);
  if (!snack) throw new ShopError("unknown_snack");
  const owner = connectedAccountId();
  const current = await getPet(petId);
  if (!owner || !current) throw new ShopError("no_pet");
  const now = Date.now();
  const pet = simulatePet(current, now);
  const store = readStore();
  const slots = { ...(store.accounts[owner] ?? {}) };
  const slot = snack.max === null ? null : restock(snack, slots[snack.id], now);

  const keep = async (result: BuyResult) => ({ pet: await updatePet(pet, pet.id), result });
  if (slot && slot.stock <= 0) return keep("out_of_stock");
  const nothingToDo = levelOf(pet.hunger) <= 0 && (snack.energy === 0 || levelOf(pet.energy) >= 100);
  if (nothingToDo) return keep("full");
  try {
    await spend(snack.price);
  } catch (error) {
    if (error instanceof WalletError && error.code === "broke") return keep("broke");
    throw error;
  }
  if (slot && snack.max !== null && snack.restockMs !== null) {
    const stock = slot.stock - 1;
    slots[snack.id] = { stock, nextAt: slot.nextAt ?? now + snack.restockMs };
    writeStore({ v: 1, accounts: { ...store.accounts, [owner]: slots } });
  }
  const wasAsleep = baseMood(pet) === "sleep";
  const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
  const fed = {
    ...pet,
    hunger: clamp(pet.hunger - snack.hunger),
    energy: clamp(pet.energy + snack.energy),
    happyUntil: snack.happyMs > 0 ? new Date(now + snack.happyMs).toISOString() : pet.happyUntil,
    stats: { ...pet.stats, snacks: pet.stats.snacks + 1 },
  };
  const saved = await updatePet({ ...fed, mood: baseMood(fed) }, pet.id);
  return { pet: saved, result: wasAsleep ? "asleep" : "fed" };
}

/** Stock changes in this tab and in other tabs. */
export function subscribeShop(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SHOP_STORAGE_KEY || event.key === null) callback();
  };
  if (inBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (inBrowser()) window.removeEventListener("storage", onStorage);
  };
}
