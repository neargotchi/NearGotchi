// Chain switch (docs/DEPLOY.md, docs/MAINNET-RUNBOOK.md). NEXT_PUBLIC_CHAIN=demo (default) keeps the localStorage mock;
// =testnet / =mainnet talk to the drop 1 contract through a real wallet. Public config only, no secrets.

/** One build = one chain. Unknown values fall back to demo (never to mainnet by accident). */
export type Chain = "demo" | "testnet" | "mainnet";
export const CHAIN: Chain = process.env.NEXT_PUBLIC_CHAIN === "testnet" || process.env.NEXT_PUBLIC_CHAIN === "mainnet" ? process.env.NEXT_PUBLIC_CHAIN : "demo";
/** Real wallet + real contract (testnet or mainnet). Demo = localStorage mock. */
export const isOnChain = CHAIN !== "demo";
export const isTestnet = CHAIN === "testnet";
/** Real NEAR: the mint and the shop spend money. Shows the "unaudited, real funds" warning. */
export const isMainnet = CHAIN === "mainnet";
/** "testnet" | "mainnet" for copy (only meaningful when isOnChain). */
export const NET = isMainnet ? "mainnet" : "testnet";

// No default contract / treasury on mainnet: they must come from the environment, so a build can never point real
// money at a testnet-era default. The testnet defaults are the shared judging deployment.
// ng57 = the deployed testnet drop (old contract, still the default); the 50/50 version is a separate test account.
const TESTNET_CONTRACT = "neargotchi-drop1-ng57.testnet";
const TESTNET_TREASURY = "neargotchi-team-ng57.testnet";
export const DROP1_CONTRACT = process.env.NEXT_PUBLIC_DROP1_CONTRACT || (isMainnet ? "" : TESTNET_CONTRACT);
/**
 * Free public RPC endpoints, no API key, CORS open (docs.near.org/api/rpc/providers, checked with curl 2026-11-11:
 * view call + `tx` status work on all four). rpc.{testnet,mainnet}.near.org are NOT here: they answer
 * HTTP 429 "THIS ENDPOINT IS DEPRECATED" (the cause of the "— / 300" counter, task 068).
 * NEXT_PUBLIC_RPC_URL (comma-separated) goes first.
 */
const PUBLIC_RPCS = {
  testnet: ["https://test.rpc.fastnear.com", "https://near-testnet.drpc.org", "https://api.zan.top/near-testnet", "https://testnet-rpc.intea.rs"],
  mainnet: ["https://free.rpc.fastnear.com", "https://near.drpc.org", "https://api.zan.top/near-mainnet", "https://rpc.intea.rs"],
};
const envRpcs = (process.env.NEXT_PUBLIC_RPC_URL || "").split(",").map((url) => url.trim()).filter(Boolean);
export const RPC_URLS: string[] = [...new Set([...envRpcs, ...PUBLIC_RPCS[isMainnet ? "mainnet" : "testnet"]])];
/** The first endpoint (kept for callers that need a single URL). */
export const RPC_URL = RPC_URLS[0];
/** Where snack / energy-pack payments go: the team account (docs/MAINNET-RUNBOOK.md). */
export const TREASURY_ACCOUNT = process.env.NEXT_PUBLIC_TREASURY || (isMainnet ? "" : TESTNET_TREASURY);
export const EXPLORER_URL = isMainnet ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
/**
 * Suffix of every localStorage key that holds game state (pets, chat, shop, owned-token cache). Demo keeps the old
 * keys; on chain the state belongs to one chain + contract, so a pet from another contract (or the demo) never shows
 * up (task 068). Within a namespace a pet is identified by its owner account + token id.
 */
export const STORAGE_NS = isOnChain ? `:${CHAIN}:${DROP1_CONTRACT}` : "";

/**
 * A mainnet build without both accounts, or with a testnet account in either, is misconfigured: the UI refuses to
 * sign anything (task 080: real NEAR must never go to a `.testnet` name).
 */
export const CONFIG_ERROR: string | null = !isMainnet
  ? null
  : !DROP1_CONTRACT || !TREASURY_ACCOUNT
    ? "mainnet build needs NEXT_PUBLIC_DROP1_CONTRACT and NEXT_PUBLIC_TREASURY"
    : /\.testnet$/.test(DROP1_CONTRACT) || /\.testnet$/.test(TREASURY_ACCOUNT)
      ? "mainnet build points at a .testnet account (NEXT_PUBLIC_DROP1_CONTRACT / NEXT_PUBLIC_TREASURY)"
      : null;

/** 2 NEAR in yoctoNEAR (contract PRICE) and 100 Tgas (plan: mint measured at 6–12 Tgas, the rest is refunded). */
export const MINT_DEPOSIT = "2000000000000000000000000";
export const MINT_GAS = "100000000000000";

type RpcResponse<T> = { result?: T; error?: { code?: number; data?: unknown; message?: string; cause?: { name?: string } } };

/** An answer about the request itself (same on every node): retrying elsewhere won't change it. */
const DETERMINISTIC = new Set([
  "CONTRACT_EXECUTION_ERROR", "UNKNOWN_ACCOUNT", "NO_CONTRACT_CODE", "INVALID_ACCOUNT", "PARSE_ERROR",
  "UNKNOWN_ACCESS_KEY", "UNKNOWN_BLOCK", "UNKNOWN_CHUNK", "INVALID_TRANSACTION",
]);

/** A failed RPC answer. `final` = the request is the problem (don't try another endpoint). */
export class RpcError extends Error {
  constructor(message: string, readonly final: boolean) {
    super(message);
    this.name = "RpcError";
  }
}

/** Test hooks (scripts/check-drop1.mjs): replace fetch / sleep / per-attempt timeout. */
export const rpcRuntime = {
  fetch: (input: string, init: RequestInit) => globalThis.fetch(input, init),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  timeoutMs: 8000,
  /** Backoff between full rounds over all endpoints. */
  backoffMs: [400, 1200],
};

/** Index of the endpoint that answered last: the next request starts there. */
let preferred = 0;

async function rpcOnce<T>(url: string, method: string, params: unknown): Promise<T> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), rpcRuntime.timeoutMs) : null;
  try {
    const response = await rpcRuntime.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "ng", method, params }),
      signal: controller?.signal,
    });
    if (!response.ok) throw new RpcError(`http ${response.status}`, false);
    const body = (await response.json()) as RpcResponse<T>;
    if (body.error) {
      const name = body.error.cause?.name || "";
      throw new RpcError(name || body.error.message || "rpc error", DETERMINISTIC.has(name));
    }
    if (body.result === undefined) throw new RpcError("empty rpc answer", false);
    return body.result;
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw new RpcError(String((error as Error)?.message ?? error), false); // network error / timeout / bad JSON
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * JSON-RPC with failover: tries every endpoint (starting with the last one that worked), then backs off and
 * repeats (3 rounds). A deterministic error (contract panic, unknown account…) is thrown at once.
 */
export async function rpc<T>(method: string, params: unknown): Promise<T> {
  let last: RpcError = new RpcError("no rpc endpoint", false);
  for (let round = 0; round <= rpcRuntime.backoffMs.length; round++) {
    if (round > 0) await rpcRuntime.sleep(rpcRuntime.backoffMs[round - 1]);
    for (let step = 0; step < RPC_URLS.length; step++) {
      const index = (preferred + step) % RPC_URLS.length;
      try {
        const result = await rpcOnce<T>(RPC_URLS[index], method, params);
        preferred = index;
        return result;
      } catch (error) {
        last = error as RpcError;
        if (last.final) throw last;
      }
    }
  }
  throw last;
}

/** Read-only contract call (no wallet needed). */
export async function viewCall<T>(methodName: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await rpc<{ result: number[]; error?: string }>("query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: DROP1_CONTRACT,
    method_name: methodName,
    args_base64: btoa(JSON.stringify(args)),
  });
  // a contract-level failure (panic, MethodNotFound) inside a successful RPC answer: the same on every node
  if (result.error) throw new RpcError(result.error, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(result.result))) as T;
}

/** Final outcome of a transaction by hash (used when a redirect wallet sends the visitor back to the site). */
export async function txStatus(hash: string, signerId: string): Promise<TxOutcome> {
  return rpc<TxOutcome>("tx", { tx_hash: hash, sender_account_id: signerId, wait_until: "FINAL" });
}

export type TxOutcome = {
  status?: { SuccessValue?: string; Failure?: unknown } | string;
  transaction?: { hash?: string; signer_id?: string; receiver_id?: string; actions?: unknown[] };
};

/** "0.05" → yoctoNEAR string (exact, no floats). */
export function nearToYocto(near: string): string {
  const [whole, frac = ""] = near.split(".");
  return (BigInt(whole) * BigInt(10) ** BigInt(24) + BigInt(frac.padEnd(24, "0").slice(0, 24))).toString();
}

/** The JSON a successful transaction returned (SuccessValue is base64), or null. */
export function outcomeValue<T>(outcome: TxOutcome | void | undefined): T | null {
  const status = outcome && typeof outcome.status === "object" ? outcome.status : null;
  if (!status?.SuccessValue) return null;
  try {
    return JSON.parse(atob(status.SuccessValue)) as T;
  } catch {
    return null;
  }
}
