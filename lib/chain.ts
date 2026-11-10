// Chain switch (docs/PLAN-CONTRACT-NFT.md §9). NEXT_PUBLIC_CHAIN=demo (default) keeps the localStorage mock;
// =testnet talks to the drop 1 contract through a real wallet. Public config only, no secrets.

export const CHAIN: "demo" | "testnet" = process.env.NEXT_PUBLIC_CHAIN === "testnet" ? "testnet" : "demo";
export const isTestnet = CHAIN === "testnet";

export const DROP1_CONTRACT = process.env.NEXT_PUBLIC_DROP1_CONTRACT || "neargotchi-drop1-ng57.testnet";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.near.org";
export const EXPLORER_URL = "https://testnet.nearblocks.io";

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

export type TxOutcome = { status?: { SuccessValue?: string; Failure?: unknown } | string };

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
