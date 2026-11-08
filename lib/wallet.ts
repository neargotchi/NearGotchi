// Demo wallet (docs/DEVLOG.md §1). Mock only: no wallet library, no network, nothing is signed.
// Async on purpose: on NEAR, connect/disconnect/getAccount map to wallet-selector and spend/balance to
// the $NEARGotchi FT (§7); the UI only uses these functions.

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

export type WalletErrorCode = "not_connected" | "broke";

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
      data.accountId === DEMO_ACCOUNT_ID &&
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

/** The connected demo account, or null (never connected / disconnected). */
export async function getAccount(): Promise<DemoAccount | null> {
  const record = readRecord();
  return record?.connected ? record : null;
}

/** "Connects": reuses this browser's demo account (balance and pets come back) or creates it with 100. */
export async function connect(): Promise<DemoAccount> {
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
