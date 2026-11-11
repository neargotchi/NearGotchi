// Chain switch (docs/PLAN-CONTRACT-NFT.md §9). NEXT_PUBLIC_CHAIN=demo (default) keeps the localStorage mock;
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
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || (isMainnet ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org");
/** Where snack / energy-pack payments go: the team account (docs/MAINNET-RUNBOOK.md). */
export const TREASURY_ACCOUNT = process.env.NEXT_PUBLIC_TREASURY || (isMainnet ? "" : TESTNET_TREASURY);
export const EXPLORER_URL = isMainnet ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
/** A mainnet build without both accounts is misconfigured: the UI refuses to sign anything. */
export const CONFIG_ERROR: string | null =
  isMainnet && (!DROP1_CONTRACT || !TREASURY_ACCOUNT) ? "mainnet build needs NEXT_PUBLIC_DROP1_CONTRACT and NEXT_PUBLIC_TREASURY" : null;

/** 2 NEAR in yoctoNEAR (contract PRICE) and 100 Tgas (plan: mint measured at 6–12 Tgas, the rest is refunded). */
export const MINT_DEPOSIT = "2000000000000000000000000";
export const MINT_GAS = "100000000000000";

type RpcResponse<T> = { result?: T; error?: { data?: unknown; message?: string; cause?: { name?: string } } };

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "ng", method, params }),
  });
  const body = (await response.json()) as RpcResponse<T>;
  if (body.error || body.result === undefined) throw new Error(body.error?.cause?.name || body.error?.message || "rpc error");
  return body.result;
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
  if (result.error) throw new Error(result.error);
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
