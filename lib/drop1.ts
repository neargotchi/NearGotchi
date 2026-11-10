// Drop 1 mock (docs/DEVLOG.md §1): the 300 rendered tokens and a per-browser "minted" list.
// The UI only uses the async functions below, so a NEAR contract can replace their bodies later
// (getDropStatus → nft_total_supply, hatchRandom → nft_mint + nft_token, getToken → nft_token).
// Nothing here is a real mint. Copy rule: rarity only, never value.

import { DROP1_CONTRACT, MINT_DEPOSIT, MINT_GAS, isTestnet, outcomeValue, txStatus, viewCall, type TxOutcome } from "./chain";
import list from "./drop1-tokens.json";

export const tiers = ["common", "rare", "epic", "legendary"] as const;
export type Tier = (typeof tiers)[number];

/** One row of lib/drop1-tokens.json (written by scripts/build_metadata.py from data/collection-drop1.json). */
type TokenRow = { tokenId: number; petId: string; tier: Tier; background: string; accessory: string; name: string };

export type Drop1Token = TokenRow & {
  /** 512² webp under /public/drop1. */
  image: string;
};

const rows = list as TokenRow[];
const byId = new Map<number, Drop1Token>(rows.map((row) => [row.tokenId, { ...row, image: `/drop1/${row.tokenId}.webp` }]));

export const DROP1_TOTAL = rows.length;
export const MINTED_STORAGE_KEY = "neargotchi-drop1-minted";

export type DropErrorCode = "sold_out" | "paused" | "no_funds" | "rejected" | "failed";

export class DropError extends Error {
  readonly code: DropErrorCode;
  constructor(code: DropErrorCode) {
    super(code);
    this.name = "DropError";
    this.code = code;
  }
}

/** Sync lookup (also used by lib/mocks.ts to check a saved pet's token). */
export const findToken = (tokenId: unknown): Drop1Token | null =>
  (typeof tokenId === "number" && byId.get(tokenId)) || null;

/** How many tokens of this pet share the tier: "one of {n} rare near dragons". */
export const tierCount = (petId: string, tier: Tier) => rows.filter((row) => row.petId === petId && row.tier === tier).length;

/** components/DropProgress.tsx: 30 pixel cells, 10 tokens each. */
export const PROGRESS_CELLS = 30;

/** A cell lights up per 10 hatched; the first hatch already shows one, the last cell only when sold out. */
export const filledCells = ({ minted, total }: { minted: number; total: number }) =>
  minted <= 0
    ? 0
    : minted >= total
      ? PROGRESS_CELLS
      : Math.min(PROGRESS_CELLS - 1, Math.max(1, Math.floor((minted / total) * PROGRESS_CELLS)));

/** The lowest token id of a pet in a tier (landing previews: "one per tier"). */
export const tierSample = (petId: string, tier: Tier): Drop1Token | null => {
  const row = rows.find((r) => r.petId === petId && r.tier === tier);
  return row ? findToken(row.tokenId) : null;
};

/** The 12 backgrounds of the drop, by file order (c01 … l12), with their tier. */
export const dropBackgrounds = (): { id: string; tier: Tier }[] => {
  const seen = new Map<string, Tier>();
  for (const row of rows) seen.set(row.background, row.tier);
  return [...seen.entries()].sort(([a], [b]) => a.slice(1).localeCompare(b.slice(1))).map(([id, tier]) => ({ id, tier }));
};

/** "r08-sunset" → "sunset". */
export const backgroundLabel = (background: string) => background.replace(/^[a-z]\d+-/, "").replace(/-/g, " ");

// ---------- minted list: localStorage, guarded like lib/mocks.ts ----------

// Blocked storage: the list lives here (gone on reload).
let memoryMinted: number[] = [];
const listeners = new Set<(minted: number[]) => void>();

const inBrowser = () => typeof window !== "undefined";

/** Unique known ids, or null when the stored value is corrupt. */
function parseMinted(raw: string | null): number[] | null {
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > DROP1_TOTAL) return null;
    if (!data.every((id) => findToken(id))) return null;
    if (new Set(data).size !== data.length) return null;
    return data as number[];
  } catch {
    return null;
  }
}

/** The minted ids in this browser. Corrupt data is cleared (counts as nothing minted). */
function readMinted(): number[] {
  if (!inBrowser()) return memoryMinted;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MINTED_STORAGE_KEY);
  } catch {
    return memoryMinted; // storage blocked
  }
  const minted = parseMinted(raw);
  if (minted === null) writeMinted([]);
  memoryMinted = minted ?? [];
  return memoryMinted;
}

function writeMinted(minted: number[]) {
  memoryMinted = minted;
  if (!inBrowser()) return;
  try {
    if (minted.length) window.localStorage.setItem(MINTED_STORAGE_KEY, JSON.stringify(minted));
    else window.localStorage.removeItem(MINTED_STORAGE_KEY);
  } catch {
    // storage blocked: memoryMinted keeps it until reload
  }
}

const status = (minted: number[]) => ({ minted: minted.length, total: DROP1_TOTAL, soldOut: minted.length >= DROP1_TOTAL });

/** Uniform 0..n-1 (crypto with rejection sampling; Math.random only where crypto is missing). */
function randomIndex(n: number) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return Math.floor(Math.random() * n);
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do cryptoApi.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

/**
 * Sync claim of a random free token (optionally of one pet). Re-reads the list right before the draw,
 * so another tab's mint is seen. Null when none are left. Used by hatchRandom and by lib/mocks.ts
 * (v1/v2 pet migration: a token of the same pet).
 */
export function claimRandomToken(petId?: string): Drop1Token | null {
  const minted = readMinted();
  const taken = new Set(minted);
  const free = rows.filter((row) => !taken.has(row.tokenId) && (!petId || row.petId === petId));
  if (!free.length) return null;
  const token = byId.get(free[randomIndex(free.length)].tokenId)!;
  const next = [...minted, token.tokenId];
  writeMinted(next);
  listeners.forEach((listener) => listener(next));
  return token;
}

/** Puts a saved pet's token back on the list if the list was cleared under it (self-heal, no notify loop). */
export function ensureMinted(tokenId: number) {
  const minted = readMinted();
  if (findToken(tokenId) && !minted.includes(tokenId)) writeMinted([...minted, tokenId]);
}

// ---------- testnet (contracts/drop1): drop_status, nft_mint, nft_tokens_for_owner ----------

type ChainStatus = { minted: number; total: number; sold_out: boolean; paused: boolean };
type ChainToken = { token_id: string };

/** Local view of the contract's drop_status. */
const chainStatus = async (): Promise<DropStatus> => {
  const s = await viewCall<ChainStatus>("drop_status");
  return { minted: s.minted, total: s.total, soldOut: s.sold_out, paused: s.paused };
};

/** Maps a wallet / RPC / contract failure to a DropError. */
function toDropError(error: unknown): DropError {
  if (error instanceof DropError) return error;
  const text = String((error as { message?: string } | null)?.message ?? error).toLowerCase();
  if (text.includes("sold out")) return new DropError("sold_out");
  if (text.includes("paused")) return new DropError("paused");
  if (/not enough|notenoughbalance|insufficient|lack ?balance|exceeds the balance/.test(text)) return new DropError("no_funds");
  if (/reject|denied|cancel|closed|declin/.test(text)) return new DropError("rejected");
  return new DropError("failed");
}

const failureText = (outcome: TxOutcome | void | undefined) => {
  const status = outcome && typeof outcome.status === "object" ? outcome.status : null;
  return status?.Failure ? JSON.stringify(status.Failure) : null;
};

/** The token a successful nft_mint outcome returned (nft_mint's promise result = on_reveal's Token). */
function tokenFromOutcome(outcome: TxOutcome | void | undefined): Drop1Token | null {
  const failure = failureText(outcome);
  if (failure) throw toDropError(new Error(failure));
  const token = outcomeValue<ChainToken>(outcome);
  return token ? findToken(Number(token.token_id)) : null;
}

const SNAPSHOT_KEY = "neargotchi-drop1-owned-before";
const ownedIds = async (accountId: string) =>
  (await viewCall<ChainToken[]>("nft_tokens_for_owner", { account_id: accountId, from_index: "0", limit: 300 })).map((t) => Number(t.token_id));

/** Ids the connected account owns on the contract (My NFTs: /pet and /mint). */
export async function getOwnedTokens(accountId: string): Promise<Drop1Token[]> {
  const ids = await ownedIds(accountId);
  return ids.map((id) => findToken(id)).filter((t): t is Drop1Token => !!t);
}

/** Fallback when the outcome has no token: the one id the account owns now that it didn't before the mint. */
async function tokenFromOwnership(accountId: string): Promise<Drop1Token | null> {
  let before: number[] = [];
  try {
    before = JSON.parse(window.sessionStorage.getItem(SNAPSHOT_KEY) ?? "[]") as number[];
  } catch {
    // storage blocked: any owned token counts as new
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const fresh = (await ownedIds(accountId)).filter((id) => !before.includes(id));
    if (fresh.length) return findToken(fresh[fresh.length - 1]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

async function chainHatch(): Promise<Drop1Token> {
  const { getNear, activeAccountId } = await import("./near");
  const { selector } = await getNear();
  const accountId = activeAccountId(selector);
  if (!accountId) throw new DropError("failed");
  const status = await chainStatus();
  if (status.soldOut) throw new DropError("sold_out");
  if (status.paused) throw new DropError("paused");
  try {
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(await ownedIds(accountId)));
  } catch {
    // snapshot only helps the fallback
  }
  try {
    const { actionCreators } = await import("@near-wallet-selector/core");
    const wallet = await selector.wallet();
    // Redirect wallets (MyNearWallet) leave the page here and return to /mint?transactionHashes=… (see resumeMint).
    const outcome = await wallet.signAndSendTransaction({
      receiverId: DROP1_CONTRACT,
      actions: [actionCreators.functionCall("nft_mint", {}, BigInt(MINT_GAS), BigInt(MINT_DEPOSIT))],
    });
    const token = tokenFromOutcome(outcome as TxOutcome | void) ?? (await tokenFromOwnership(accountId));
    if (!token) throw new DropError("failed");
    return token;
  } catch (error) {
    throw toDropError(error);
  }
}

/** /mint after a redirect wallet: reads the finished nft_mint (?transactionHashes=) and returns its token. */
export async function resumeMint(hash: string, accountId: string): Promise<Drop1Token> {
  try {
    const token = tokenFromOutcome(await txStatus(hash, accountId)) ?? (await tokenFromOwnership(accountId));
    if (!token) throw new DropError("failed");
    return token;
  } catch (error) {
    throw toDropError(error);
  }
}

/** Wallet error params on the return URL (MyNearWallet: ?errorCode=…&errorMessage=…). */
export const dropErrorFromUrl = (message: string) => toDropError(new Error(message));

// ---------- async API (what the UI calls) ----------

export type DropStatus = { minted: number; total: number; soldOut: boolean; paused?: boolean };

export async function getDropStatus(): Promise<DropStatus> {
  if (isTestnet) {
    try {
      return await chainStatus();
    } catch {
      return { minted: 0, total: DROP1_TOTAL, soldOut: false };
    }
  }
  return status(readMinted());
}

/** Draws one free token from the whole pool and marks it minted. Throws DropError. Testnet: a real 2 NEAR mint. */
export async function hatchRandom(): Promise<Drop1Token> {
  if (isTestnet) return chainHatch();
  const token = claimRandomToken();
  if (!token) throw new DropError("sold_out");
  return token;
}

export async function getToken(tokenId: number): Promise<Drop1Token | null> {
  return findToken(tokenId);
}

/** Demo only (sold-out screen): forgets every minted id in this browser. A saved pet keeps its token. */
export async function resetDrop(): Promise<void> {
  if (isTestnet) return;
  writeMinted([]);
  listeners.forEach((listener) => listener([]));
}

/** Calls back with the new status on claims in this tab and on storage changes from other tabs (testnet: polls every 10 s). */
export function subscribeDrop(callback: (next: DropStatus) => void): () => void {
  if (isTestnet) {
    const timer = setInterval(() => {
      chainStatus().then(callback, () => {});
    }, 10000);
    return () => clearInterval(timer);
  }
  const local = (minted: number[]) => callback(status(minted));
  listeners.add(local);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== MINTED_STORAGE_KEY && event.key !== null) return;
    callback(status(readMinted()));
  };
  if (inBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(local);
    if (inBrowser()) window.removeEventListener("storage", onStorage);
  };
}
