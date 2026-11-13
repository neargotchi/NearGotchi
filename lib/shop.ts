// Shop (docs/DEVLOG.md §1 table, step 5; task 059). Snacks fill ONLY hunger; the energy pack fills ONLY
// energy (energy is spent only by chatting). Stock lives in localStorage per account and restocks on read.
// Payment: demo = $NEARGotchi from the demo wallet; NEXT_PUBLIC_CHAIN=testnet / mainnet = a NEAR transfer (test NEAR /
// real NEAR) to the team treasury, and the effect is applied only after the transaction is confirmed (popup wallets:
// right away; redirect wallets: resumePurchase() on return, task 080: amount ≥ price, block not older than the purchase).
// Hunger is browser state, like the whole pet: the payment is checked, the game is not. Energy on MAINNET is NEAR AI
// credits on the server ledger (task 081): the pack is credited by /api/energy/claim, never here.
// Async on purpose: the UI only calls the functions below.

import { STORAGE_NS, TREASURY_ACCOUNT, isMainnet, isOnChain, nearToYocto, rpc, txStatus, type TxOutcome } from "./chain";
import { claimEnergy, sessionAccount } from "./energy-client";
import { baseMood, getPet, levelOf, mirrorEnergy, simulatePet, updatePet, type DemoPet } from "./mocks";
import { WalletError, connectedAccountId, spend } from "./wallet";

export const snackIds = ["cookie", "berries", "noodles", "candy"] as const;
export type SnackId = (typeof snackIds)[number];

export type Snack = {
  id: SnackId;
  /** demo $NEARGotchi */
  price: number;
  /** taken off hunger */
  hunger: number;
  /** null = always in stock */
  max: number | null;
  /** +1 stock every … ms while below max */
  restockMs: number | null;
  /** > 0: the pet stays happy this long */
  happyMs: number;
};

const MIN = 60000;

/** NEAR prices (one place, task 059): test NEAR on testnet, **real NEAR on mainnet** (paid to the team treasury). */
export const NEAR_PRICES = { cookie: "0.04", berries: "0.08", noodles: "0.15", candy: "0.25", energy: "0.4" } as const;

/** The energy pack: +50 energy, no limit. Demo price in $NEARGotchi. */
export const ENERGY_PACK = { id: "energy", price: 25, energy: 50 } as const;

export type ItemId = SnackId | typeof ENERGY_PACK.id;
export const isItemId = (id: unknown): id is ItemId => id === ENERGY_PACK.id || snackIds.some((snack) => snack === id);
export const demoPriceOf = (id: ItemId) => (id === ENERGY_PACK.id ? ENERGY_PACK.price : findSnack(id)!.price);

/** §1 table: bone cookie / berries / noodles / star candy. */
export const snacks: Snack[] = [
  { id: "cookie", price: 2, hunger: 10, max: null, restockMs: null, happyMs: 0 },
  { id: "berries", price: 5, hunger: 25, max: 3, restockMs: 1 * MIN, happyMs: 0 },
  { id: "noodles", price: 10, hunger: 50, max: 2, restockMs: 3 * MIN, happyMs: 0 },
  { id: "candy", price: 20, hunger: 20, max: 1, restockMs: 10 * MIN, happyMs: 150000 },
];

export const findSnack = (id: unknown) => snacks.find((snack) => snack.id === id) ?? null;

export const SHOP_STORAGE_KEY = `neargotchi-shop${STORAGE_NS}`;

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

/** signin / confirming: mainnet energy pack only (task 081): sign in first / paid, the server is still confirming. */
export type BuyResult = "fed" | "charged" | "full" | "broke" | "out_of_stock" | "cancelled" | "failed" | "signin" | "confirming";

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

const PENDING_KEY = `neargotchi-pending-buy${STORAGE_NS}`;
const USED_KEY = `neargotchi-used-tx${STORAGE_NS}`;

/** createdAt (ms) = when the wallet was opened; the paying transaction must not be older (task 080). */
type Pending = { item: ItemId; petId: string; owner: string; createdAt?: number; hash?: string };

/** A purchase whose chain check failed for network reasons is retried on later /pet loads for this long. */
const PENDING_RETRY_MS = 60 * MIN;

/** Clock skew allowed between this device and the chain when matching a transaction to a pending purchase. */
const PAY_SKEW_MS = 10 * MIN;

/** Sum of the Transfer deposits in a transaction's actions, yoctoNEAR (RPC `tx` shape: [{"Transfer":{"deposit":"…"}}]). */
export function transferredYocto(actions: unknown[] | undefined): bigint {
  let sum = BigInt(0);
  for (const action of actions ?? []) {
    const deposit = (action as { Transfer?: { deposit?: unknown } } | null)?.Transfer?.deposit;
    if (typeof deposit === "string" && /^\d+$/.test(deposit)) sum += BigInt(deposit);
  }
  return sum;
}

/**
 * Pure (task 080): does a finished transaction pay for `item`? Successful, signed by `owner`, sent to `treasury`
 * (never empty), transfers at least the item's price (overpaying is accepted), and — when both times are known — is
 * in a block not older than the purchase (minus clock skew), so an old payment can't be replayed in another browser.
 */
export function paysFor(tx: TxOutcome, owner: string, treasury: string, item: ItemId, blockMs?: number, pendingSince?: number): boolean {
  const status = typeof tx.status === "object" ? tx.status : null;
  if (!status || status.Failure !== undefined || !treasury) return false;
  if (tx.transaction?.signer_id !== owner || tx.transaction?.receiver_id !== treasury) return false;
  if (transferredYocto(tx.transaction?.actions) < BigInt(nearToYocto(NEAR_PRICES[item]))) return false;
  if (pendingSince !== undefined && !(typeof blockMs === "number" && Number.isFinite(blockMs) && blockMs >= pendingSince - PAY_SKEW_MS)) return false;
  return true;
}

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: a redirect purchase cannot be resumed
  }
};

/** Pure: the pet after eating a snack or drinking an energy pack (only the bar of that item moves). */
export function applyItem(pet: DemoPet, item: ItemId, now: number): DemoPet {
  if (item === ENERGY_PACK.id) {
    const next = { ...pet, energy: clamp(pet.energy + ENERGY_PACK.energy) };
    return { ...next, mood: baseMood(next) };
  }
  const snack = findSnack(item)!;
  const next = {
    ...pet,
    hunger: clamp(pet.hunger - snack.hunger),
    happyUntil: snack.happyMs > 0 ? new Date(now + snack.happyMs).toISOString() : pet.happyUntil,
    stats: { ...pet.stats, snacks: pet.stats.snacks + 1 },
  };
  return { ...next, mood: baseMood(next) };
}

/** Takes one unit of a limited snack from the account's stock (after payment). */
function takeStock(owner: string, snack: Snack, now: number) {
  if (snack.max === null || snack.restockMs === null) return;
  const store = readStore();
  const slots = { ...(store.accounts[owner] ?? {}) };
  const slot = restock(snack, slots[snack.id], now);
  slots[snack.id] = { stock: Math.max(0, slot.stock - 1), nextAt: slot.nextAt ?? now + snack.restockMs };
  writeStore({ v: 1, accounts: { ...store.accounts, [owner]: slots } });
}

/** Mainnet energy pack (task 081): the server ledger credits it, never this browser. */
const ledgerPack = (item: ItemId) => isMainnet && item === ENERGY_PACK.id;

/**
 * Mainnet energy pack after a confirmed payment: the server checks the transaction on chain and credits +50 once
 * (idempotent per hash); the stored pet only mirrors the balance it answers with.
 */
async function claimPack(pet: DemoPet, hash: string, onConfirming?: () => void): Promise<{ pet: DemoPet; result: BuyResult }> {
  if (!pet.token) return { pet, result: "failed" };
  const claim = await claimEnergy(hash, pet.token.tokenId, onConfirming);
  if (claim.status === "credited" || claim.status === "already_credited") {
    return { pet: (await mirrorEnergy(pet.id, claim.energy)) ?? pet, result: "charged" };
  }
  if (claim.status === "signed_out") return { pet, result: "signin" };
  return { pet, result: claim.status === "unconfirmed" ? "confirming" : "failed" };
}

/** On chain: sends the NEAR transfer. "paid" (+ hash) only when a confirmed successful outcome came back in this tab. */
async function payNear(owner: string, item: ItemId, petId: string): Promise<{ result: "paid" | "cancelled" | "failed"; hash?: string }> {
  const { getNear } = await import("./near");
  const { actionCreators } = await import("@near-wallet-selector/core");
  const { selector } = await getNear();
  writeJson(PENDING_KEY, { item, petId, owner, createdAt: Date.now() } satisfies Pending);
  try {
    const wallet = await selector.wallet();
    // Redirect wallets leave the page here; resumePurchase() finishes it on return.
    const outcome = (await wallet.signAndSendTransaction({
      receiverId: TREASURY_ACCOUNT,
      actions: [actionCreators.transfer(BigInt(nearToYocto(NEAR_PRICES[item])))],
    })) as TxOutcome | void;
    writeJson(PENDING_KEY, null);
    const status = outcome && typeof outcome.status === "object" ? outcome.status : null;
    if (!status || status.Failure) return { result: "failed" };
    const hash = outcome?.transaction?.hash;
    if (hash) writeJson(USED_KEY, [...readJson<string[]>(USED_KEY, []), hash].slice(-50));
    return { result: "paid", hash };
  } catch (error) {
    writeJson(PENDING_KEY, null);
    return { result: /reject|denied|cancel|closed|declin/i.test(String((error as Error)?.message ?? error)) ? "cancelled" : "failed" };
  }
}

/**
 * Buys one snack (and feeds it right away) or the energy pack for one of the account's pets. Checks in order:
 * out of stock, nothing to do (snack at hunger 0 / pack at 100 energy), payment (demo balance or testnet NEAR).
 * Snacks count stats.snacks; star candy keeps the pet happy for 150 s.
 */
export async function buyItem(petId: string, itemId: ItemId, onConfirming?: () => void): Promise<{ pet: DemoPet; result: BuyResult }> {
  if (!isItemId(itemId)) throw new ShopError("unknown_snack");
  const snack = itemId === ENERGY_PACK.id ? null : findSnack(itemId);
  const owner = connectedAccountId();
  const current = await getPet(petId);
  if (!owner || !current) throw new ShopError("no_pet");
  const now = Date.now();
  const pet = simulatePet(current, now);
  const slot = snack && snack.max !== null ? restock(snack, readStore().accounts[owner]?.[snack.id], now) : null;

  const keep = async (result: BuyResult) => ({ pet: await updatePet(pet, pet.id), result });
  if (slot && slot.stock <= 0) return keep("out_of_stock");
  const nothingToDo = snack ? levelOf(pet.hunger) <= 0 : levelOf(pet.energy) >= 100;
  if (nothingToDo) return keep("full");
  if (ledgerPack(itemId)) {
    // sign in BEFORE paying: the claim needs the session, and a payment nobody can claim helps no one
    if ((await sessionAccount()) !== owner) return keep("signin");
    const paid = await payNear(owner, itemId, pet.id);
    if (paid.result !== "paid") return keep(paid.result);
    if (!paid.hash) return keep("confirming");
    return claimPack(await updatePet(pet, pet.id), paid.hash, onConfirming);
  }
  if (isOnChain) {
    const paid = await payNear(owner, itemId, pet.id);
    if (paid.result !== "paid") return keep(paid.result);
  } else {
    try {
      await spend(demoPriceOf(itemId));
    } catch (error) {
      if (error instanceof WalletError && error.code === "broke") return keep("broke");
      throw error;
    }
  }
  if (snack) takeStock(owner, snack, now);
  const saved = await updatePet(applyItem(pet, itemId, now), pet.id);
  return { pet: saved, result: snack ? "fed" : "charged" };
}

/**
 * On chain, on /pet after a redirect wallet returns with ?transactionHashes=: verifies the transfer (`paysFor`: signer,
 * treasury receiver, amount ≥ price, block not older than the purchase; not used before in this browser), then applies
 * the purchase that was pending. null = nothing to do. If the chain can't be read, the purchase stays pending with
 * its hash and the next /pet load (within an hour) checks it again, so a paid item is not lost to a network error.
 */
export async function resumePurchase(): Promise<{ pet: DemoPet; result: BuyResult; item: ItemId } | null> {
  if (!isOnChain || typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const pending = readJson<Pending | null>(PENDING_KEY, null);
  const hash = params.get("transactionHashes")?.split(",").pop() || pending?.hash;
  const failed = params.get("errorCode") || params.get("errorMessage");
  if (!pending || (!hash && !failed)) return null;
  writeJson(PENDING_KEY, null);
  const owner = connectedAccountId();
  if (!owner || owner !== pending.owner || !isItemId(pending.item)) return null;
  const current = await getPet(pending.petId);
  if (!current) return null;
  const keep = async (result: BuyResult) => ({ pet: current, result, item: pending.item });
  if (failed || !hash) return keep("cancelled");
  if (ledgerPack(pending.item)) {
    // mainnet energy pack: the server verifies the payment itself (idempotent per hash)
    const claimed = await claimPack(current, hash);
    return { ...claimed, item: pending.item };
  }
  const used = readJson<string[]>(USED_KEY, []);
  if (used.includes(hash)) return null;
  try {
    const tx = await txStatus(hash, owner);
    let blockMs: number | undefined;
    if (pending.createdAt !== undefined) {
      const blockHash = (tx as { transaction_outcome?: { block_hash?: string } }).transaction_outcome?.block_hash;
      const block = blockHash ? await rpc<{ header?: { timestamp_nanosec?: string } }>("block", { block_id: blockHash }) : null;
      const ns = block?.header?.timestamp_nanosec;
      blockMs = ns && /^\d+$/.test(ns) ? Number(BigInt(ns) / BigInt(1000000)) : undefined;
    }
    if (!paysFor(tx, owner, TREASURY_ACCOUNT, pending.item, blockMs, pending.createdAt)) return keep("failed");
  } catch {
    // chain unreadable right now: keep it (with the hash, the URL is cleaned) and retry on the next /pet load
    if (Date.now() - (pending.createdAt ?? 0) < PENDING_RETRY_MS) writeJson(PENDING_KEY, { ...pending, hash });
    return keep("failed");
  }
  writeJson(USED_KEY, [...used, hash].slice(-50));
  const now = Date.now();
  const snack = pending.item === ENERGY_PACK.id ? null : findSnack(pending.item);
  if (snack) takeStock(owner, snack, now);
  const pet = simulatePet(current, now);
  const saved = await updatePet(applyItem(pet, pending.item, now), pet.id);
  return { pet: saved, result: snack ? "fed" : "charged", item: pending.item };
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
