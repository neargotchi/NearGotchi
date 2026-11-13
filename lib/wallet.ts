// Demo wallet (docs/DEVLOG.md §1). Mock only: no wallet library, no network, nothing is signed.
// Async on purpose: on NEAR, connect/disconnect/getAccount map to wallet-selector and spend/balance to
// the $NEARGotchi FT (§7); the UI only uses these functions.
// NEXT_PUBLIC_CHAIN=testnet/mainnet (lib/chain.ts): connect / disconnect / getAccount use a real NEAR wallet
// (wallet-selector); the balance stays demo $NEARGotchi (snacks are task 059). Demo mode is unchanged.

import { isOnChain } from "./chain";

/** One browser = one demo account (owner decision 1). */
export const DEMO_ACCOUNT_ID = "you.demo";
export const WALLET_STORAGE_KEY = "neargotchi-wallet";

/** Demo $NEARGotchi, display only. The balance belongs to the account, not to a pet (since v4). */
export const WALLET_RULES = { startBalance: 100 } as const;

export type DemoAccount = {
  v: 1;
  accountId: string;
  /** false after disconnect: the account, its balance and its pets stay in this browser. */
  connected: boolean;
  /** ISO date of the last connect */
  connectedAt: string;
  balance: number;
};

export type WalletErrorCode = "not_connected" | "broke" | "cancelled";

export class WalletError extends Error {
  constructor(public readonly code: WalletErrorCode) {
    super(code);
    this.name = "WalletError";
  }
}

const inBrowser = () => typeof window !== "undefined";

// Blocked storage: the account lives here (survives client navigation, gone on reload).
let memory: DemoAccount | null = null;
const listeners = new Set<(account: DemoAccount | null) => void>();

/** undefined = storage unavailable. */
function readRaw(): string | null | undefined {
  if (!inBrowser()) return undefined;
  try {
    return window.localStorage.getItem(WALLET_STORAGE_KEY);
  } catch {
    return undefined;
  }
}

function writeRaw(value: string | null) {
  if (!inBrowser()) return;
  try {
    if (value === null) window.localStorage.removeItem(WALLET_STORAGE_KEY);
    else window.localStorage.setItem(WALLET_STORAGE_KEY, value);
  } catch {
    // storage blocked: memory keeps it until reload
  }
}

function parse(raw: string): DemoAccount | null {
  try {
    const data = JSON.parse(raw) as Partial<DemoAccount> | null;
    const ok =
      !!data &&
      data.v === 1 &&
      (isOnChain ? typeof data.accountId === "string" && data.accountId.length > 0 : data.accountId === DEMO_ACCOUNT_ID) &&
      typeof data.connected === "boolean" &&
      typeof data.connectedAt === "string" &&
      Number.isFinite(Date.parse(data.connectedAt)) &&
      typeof data.balance === "number" &&
      Number.isFinite(data.balance) &&
      data.balance >= 0;
    return ok ? (data as DemoAccount) : null;
  } catch {
    return null;
  }
}

/** The stored record, connected or not (corrupt data is cleared). */
function readRecord(): DemoAccount | null {
  const raw = readRaw();
  if (raw === undefined) return memory;
  const record = raw === null ? null : parse(raw);
  if (!record && raw !== null) writeRaw(null);
  memory = record;
  return record;
}

function save(record: DemoAccount): DemoAccount {
  memory = record;
  writeRaw(JSON.stringify(record));
  const shown = record.connected ? record : null;
  listeners.forEach((listener) => listener(shown));
  return record;
}

/** Sync: the connected account id, or null. For the pet store's ownership checks. */
export function connectedAccountId(): string | null {
  const record = readRecord();
  return record?.connected ? record.accountId : null;
}

/**
 * Pets v3 → v4 migration: an old pet's balance moves to the account (the larger of the two wins).
 * Creates the record when there is none yet, still disconnected, so the visitor connects on purpose.
 */
export function absorbBalance(balance: number) {
  const record = readRecord();
  const amount = Number.isFinite(balance) && balance >= 0 ? balance : 0;
  if (record) {
    if (amount > record.balance) save({ ...record, balance: amount });
    return;
  }
  save({
    v: 1,
    accountId: DEMO_ACCOUNT_ID,
    connected: false,
    connectedAt: new Date().toISOString(),
    balance: Math.max(amount, WALLET_RULES.startBalance),
  });
}

/**
 * Testnet: aligns the stored record with the wallet-selector session (also after a redirect wallet returns).
 * Task 101: an account the visitor disconnected here stays disconnected even if the selector still holds its session
 * (Meteor's sign-out popup closed or failed): that session is stale, not a connect. `adopt` = a sign-in just happened.
 */
async function syncChain(adopt = false): Promise<DemoAccount | null> {
  const { getNear, activeAccountId } = await import("./near");
  const { selector } = await getNear();
  const accountId = activeAccountId(selector);
  const record = readRecord();
  if (!accountId) {
    if (record?.connected) save({ ...record, connected: false });
    return null;
  }
  const now = new Date().toISOString();
  if (record && record.accountId === accountId) {
    if (record.connected) return record;
    return adopt ? save({ ...record, connected: true, connectedAt: now }) : null;
  }
  return save({ v: 1, accountId, connected: true, connectedAt: now, balance: WALLET_RULES.startBalance });
}

/** The connected account, or null (never connected / disconnected). */
export async function getAccount(): Promise<DemoAccount | null> {
  if (isOnChain && inBrowser()) {
    try {
      return await syncChain();
    } catch {
      // wallet library unavailable: fall through to the stored record
    }
  }
  const record = readRecord();
  return record?.connected ? record : null;
}

/** Task 101: set right before the reload that drops a stale wallet session; the header then reopens the modal once. */
const REOPEN_KEY = "neargotchi-wallet-reopen";

/** True once after that reload (the flag is taken before anything else runs, so it can never loop). */
export function takeReopen(): boolean {
  if (!isOnChain || !inBrowser()) return false;
  try {
    const flag = window.sessionStorage.getItem(REOPEN_KEY);
    window.sessionStorage.removeItem(REOPEN_KEY);
    return flag === "1";
  } catch {
    return false;
  }
}

/** false when the flag can't be stored (then no reload: the modal opens in this page instead). */
function reloadForConnect(): boolean {
  try {
    window.sessionStorage.setItem(REOPEN_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Opens the wallet modal and resolves once an account signed in. Throws WalletError("cancelled") if closed.
 * Task 101: the modal is only ever shown with no wallet session left in the selector, so a sign-in can't make the
 * selector sign another wallet out (lib/near.ts guardSignOut is the second line). A stale session (the visitor
 * disconnected, the wallet kept it) is dropped locally and the page reloads once, which resets the selector; the
 * modal then opens by itself (takeReopen in app/wallet-menu.tsx). `afterReset`: that second run, never reloads again.
 */
async function connectChain(afterReset = false): Promise<DemoAccount> {
  const { getNear, activeAccountId, clearLocalSession } = await import("./near");
  const { selector, modal } = await getNear();
  if (activeAccountId(selector)) {
    const existing = await syncChain();
    if (existing) return existing;
    clearLocalSession();
    if (!afterReset && reloadForConnect()) return new Promise<DemoAccount>(() => {});
  } else {
    // no session in the selector: leftovers of an old one (e.g. Meteor's own record) go too, locally
    clearLocalSession();
  }
  return new Promise<DemoAccount>((resolve, reject) => {
    const offIn = selector.on("signedIn", () => {
      cleanup();
      syncChain(true).then((account) => (account ? resolve(account) : reject(new WalletError("cancelled"))), reject);
    });
    const offHide = modal.on("onHide", () => {
      // the sign-in event can follow the hide event; give it a moment
      setTimeout(() => {
        cleanup();
        reject(new WalletError("cancelled"));
      }, 400);
    });
    const cleanup = () => {
      offIn.remove();
      offHide.remove();
    };
    modal.show();
  });
}

/**
 * Demo: reuses this browser's demo account (balance and pets come back) or creates it with 100.
 * Testnet: real wallet sign-in (throws WalletError("cancelled") when the modal is closed).
 */
export async function connect({ afterReset = false }: { afterReset?: boolean } = {}): Promise<DemoAccount> {
  if (isOnChain) return connectChain(afterReset);
  const record = readRecord();
  const now = new Date().toISOString();
  return save(
    record
      ? { ...record, connected: true, connectedAt: now }
      : { v: 1, accountId: DEMO_ACCOUNT_ID, connected: true, connectedAt: now, balance: WALLET_RULES.startBalance },
  );
}

/** Hides the account; nothing is deleted. */
export async function disconnect(): Promise<void> {
  if (isOnChain) {
    try {
      const { getNear, signOutOnPurpose } = await import("./near");
      const { selector } = await getNear();
      // the one intended wallet sign-out (Meteor: its "Sign Out Request" popup)
      if (selector.isSignedIn()) await signOutOnPurpose(selector);
    } catch {
      // already signed out, or the wallet's popup was closed / failed
    }
    // Task 101: whatever the wallet answered, nothing of the session stays in this browser's storage, so the next
    // connect starts clean (a selector that still holds it in memory is reset by connect's reload).
    try {
      (await import("./near")).clearLocalSession();
    } catch {
      // wallet library unavailable: nothing was stored by it
    }
  }
  const record = readRecord();
  if (record?.connected) save({ ...record, connected: false });
}

/** Pays demo $NEARGotchi. Throws WalletError("not_connected" | "broke"). */
export async function spend(amount: number): Promise<DemoAccount> {
  const record = readRecord();
  if (!record?.connected) throw new WalletError("not_connected");
  if (record.balance < amount) throw new WalletError("broke");
  return save({ ...record, balance: record.balance - amount });
}

/** Demo only: back to the start balance. */
export async function refill(): Promise<DemoAccount> {
  const record = readRecord();
  if (!record?.connected) throw new WalletError("not_connected");
  return save({ ...record, balance: WALLET_RULES.startBalance });
}

/** Calls back with the connected account (or null) on changes in this tab and from other tabs. */
export function subscribeAccount(callback: (account: DemoAccount | null) => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== WALLET_STORAGE_KEY && event.key !== null) return;
    getAccount().then(callback);
  };
  if (inBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (inBrowser()) window.removeEventListener("storage", onStorage);
  };
}
