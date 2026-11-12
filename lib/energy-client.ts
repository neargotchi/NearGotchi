// Browser side of energy = NEAR AI credits (task 081). Mainnet builds only (`usesLedger`): the server ledger is the
// source of truth, the client signs in once (NEP-413, no transaction), reads balances and claims energy packs.
// Demo / testnet builds never call any of this.

import { isMainnet } from "./chain";

/** One build = one chain: only mainnet uses the server ledger. */
export const usesLedger = isMainnet;

const json = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

/** The signed-in account (HttpOnly cookie, checked by the server), null = signed out, "unavailable" = server down. */
export async function sessionAccount(): Promise<string | null | "unavailable"> {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (response.status === 401) return null;
    if (!response.ok) return "unavailable";
    const data = await json<{ account?: unknown }>(response);
    return typeof data?.account === "string" ? data.account : null;
  } catch {
    return "unavailable";
  }
}

export type SignInResult = { ok: true; account: string } | { ok: false; reason: "cancelled" | "unsupported" | "failed" | "unavailable" };

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/**
 * Sign in: a nonce from the server → the wallet signs it (NEP-413 signMessage: no transaction, no cost) → the
 * server checks the signature and the account's full-access key → HttpOnly session cookie (24 h).
 * Needs a user click (the wallet opens a popup).
 */
export async function signIn(): Promise<SignInResult> {
  try {
    const nonceResponse = await fetch("/api/auth/nonce", { cache: "no-store" });
    if (!nonceResponse.ok) return { ok: false, reason: nonceResponse.status === 503 ? "unavailable" : "failed" };
    const issued = await json<{ nonce: string; message: string; recipient: string }>(nonceResponse);
    if (!issued?.nonce) return { ok: false, reason: "failed" };
    const { getNear } = await import("./near");
    const { selector } = await getNear();
    const wallet = await selector.wallet();
    if (typeof wallet.signMessage !== "function") return { ok: false, reason: "unsupported" };
    const callbackUrl = window.location.href;
    let signed: { accountId?: string; publicKey?: string; signature?: string } | void;
    try {
      signed = await wallet.signMessage({
        message: issued.message,
        recipient: issued.recipient,
        nonce: fromBase64(issued.nonce) as unknown as Buffer,
        callbackUrl,
      });
    } catch (error) {
      return { ok: false, reason: /reject|denied|cancel|closed|declin|not supported/i.test(String((error as Error)?.message ?? error)) ? "cancelled" : "failed" };
    }
    if (!signed?.accountId || !signed.publicKey || !signed.signature) return { ok: false, reason: "failed" };
    const verify = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature, nonce: issued.nonce, callbackUrl }),
    });
    const data = await json<{ account?: unknown }>(verify);
    return verify.ok && typeof data?.account === "string" ? { ok: true, account: data.account } : { ok: false, reason: verify.status === 503 ? "unavailable" : "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    // the cookie expires on its own
  }
}

/** A token's energy from the ledger: the number, "signed_out" (no / expired session) or null (not readable now). */
export async function fetchEnergy(tokenId: number): Promise<number | "signed_out" | null> {
  try {
    const response = await fetch(`/api/energy?token=${tokenId}`, { cache: "no-store" });
    if (response.status === 401) return "signed_out";
    if (!response.ok) return null;
    const data = await json<{ energy?: unknown }>(response);
    return typeof data?.energy === "number" ? data.energy : null;
  } catch {
    return null;
  }
}

export type ClaimResult =
  | { status: "credited" | "already_credited"; energy: number }
  | { status: "signed_out" | "not_a_payment" | "too_old" | "not_owner" | "unconfirmed" };

const PENDING_CLAIMS_KEY = "neargotchi-energy-claims:mainnet";
type PendingClaim = { hash: string; tokenId: number; at: number };

const readClaims = (): PendingClaim[] => {
  try {
    const list = JSON.parse(window.localStorage.getItem(PENDING_CLAIMS_KEY) ?? "[]") as PendingClaim[];
    return Array.isArray(list) ? list.filter((c) => typeof c?.hash === "string" && typeof c.tokenId === "number") : [];
  } catch {
    return [];
  }
};
const writeClaims = (list: PendingClaim[]) => {
  try {
    window.localStorage.setItem(PENDING_CLAIMS_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    // storage blocked: the claim is retried only in this page
  }
};

/** Test hook: wait between claim attempts. */
export const claimRuntime = { sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), tries: 12, delayMs: 3000 };

/**
 * Claims the energy of a paid pack. The server is idempotent per payment, so this retries freely while the
 * transaction isn't final yet ("confirming payment…"); a claim that can't be confirmed now is kept and retried on
 * the next /pet load (retryPendingClaims). The client never sends an amount: the server reads it from the chain.
 */
export async function claimEnergy(hash: string, tokenId: number, onWaiting?: () => void): Promise<ClaimResult> {
  writeClaims([...readClaims().filter((c) => c.hash !== hash), { hash, tokenId, at: Date.now() }]);
  for (let attempt = 0; attempt < claimRuntime.tries; attempt++) {
    if (attempt > 0) {
      onWaiting?.();
      await claimRuntime.sleep(claimRuntime.delayMs);
    }
    let response: Response;
    try {
      response = await fetch("/api/energy/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tx_hash: hash, token_id: tokenId }),
      });
    } catch {
      continue;
    }
    const data = await json<{ status?: string; energy?: number; error?: string }>(response);
    if (response.ok && (data?.status === "credited" || data?.status === "already_credited") && typeof data.energy === "number") {
      writeClaims(readClaims().filter((c) => c.hash !== hash));
      return { status: data.status, energy: data.energy };
    }
    if (response.status === 401) return { status: "signed_out" };
    if (data?.error === "not_a_payment" || data?.error === "too_old" || data?.error === "not_owner") {
      writeClaims(readClaims().filter((c) => c.hash !== hash));
      return { status: data.error };
    }
    // 409 pending, 503 rpc / store, network: try again
  }
  return { status: "unconfirmed" };
}

/** Claims kept from an earlier page (paid, not confirmed yet), at most a day old. Returns the last credited one. */
export async function retryPendingClaims(): Promise<{ tokenId: number; energy: number } | null> {
  const claims = readClaims().filter((c) => Date.now() - c.at < 24 * 60 * 60 * 1000);
  writeClaims(claims);
  let last: { tokenId: number; energy: number } | null = null;
  for (const claim of claims) {
    const result = await claimEnergy(claim.hash, claim.tokenId);
    if (result.status === "credited" || result.status === "already_credited") last = { tokenId: claim.tokenId, energy: result.energy };
  }
  return last;
}
