// NEP-413 signMessage results come back in slightly different shapes depending on the wallet (task 082). This turns
// them into the one form /api/auth/verify expects — publicKey "ed25519:<base58>", signature standard base64 — or
// names the field that is missing. Pure and browser-safe, so it is unit tested (scripts/check-energy.mjs). The one
// Buffer use is nonceBuffer(): the wallet-selector core demands a real Buffer there (task 083).
// It never relaxes anything: the server still checks the signature, the single-use nonce and the full-access key.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  let n = BigInt(0);
  for (const b of bytes) n = n * BigInt(256) + BigInt(b);
  let out = "";
  while (n > BigInt(0)) {
    out = B58[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** Uint8Array, number[], Node Buffer, Buffer-as-JSON ({type:"Buffer",data}), {data} or an index object → bytes. */
function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value) && value.every((v) => Number.isInteger(v) && v >= 0 && v < 256)) return Uint8Array.from(value);
  if (typeof value === "object" && value !== null) {
    const data = (value as { data?: unknown }).data;
    if (data !== undefined && data !== value) return asBytes(data);
    const keys = Object.keys(value);
    if (keys.length > 0 && keys.every((k, i) => k === String(i))) return asBytes(Object.values(value));
  }
  return null;
}

const B58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,50}$/;

/** "ed25519:<base58>" from a prefixed string, a bare base58 string, a PublicKey-like object (toString / data) or raw bytes. */
export function normalizePublicKey(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (text.startsWith("ed25519:")) return B58_RE.test(text.slice(8)) ? text : null;
    return B58_RE.test(text) ? `ed25519:${text}` : null;
  }
  if (typeof value === "object" && value !== null) {
    const own = (value as { toString?: () => string }).toString;
    if (typeof own === "function" && own !== Object.prototype.toString) {
      const text = own.call(value);
      if (typeof text === "string" && text !== "[object Object]") {
        const viaString = normalizePublicKey(text);
        if (viaString) return viaString;
      }
    }
    const bytes = asBytes(value);
    return bytes && bytes.length === 32 ? `ed25519:${base58Encode(bytes)}` : null;
  }
  return null;
}

/** Standard base64 of a 64-byte signature from base64, base64url (with or without padding) or bytes. */
export function normalizeSignature(value: unknown): string | null {
  if (typeof value === "string") {
    let text = value.trim().replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
    text = text.replace(/=+$/, "");
    if (text.length !== 86) return null; // 64 bytes
    return `${text}==`;
  }
  const bytes = asBytes(value);
  return bytes && bytes.length === 64 ? toBase64(bytes) : null;
}

export type SignedShape =
  | { ok: true; accountId: string; publicKey: string; signature: string }
  | { ok: false; missing: ("accountId" | "publicKey" | "signature")[] };

/** The wallet's result + the selector's active account (used only when the wallet doesn't name one). */
export function normalizeSignedMessage(result: unknown, activeAccount: string | null): SignedShape {
  const r = (typeof result === "object" && result !== null ? result : {}) as Record<string, unknown>;
  const accountId = typeof r.accountId === "string" && r.accountId.trim() ? r.accountId.trim() : activeAccount;
  const publicKey = normalizePublicKey(r.publicKey);
  const signature = normalizeSignature(r.signature);
  const missing: ("accountId" | "publicKey" | "signature")[] = [];
  if (!accountId) missing.push("accountId");
  if (!publicKey) missing.push("publicKey");
  if (!signature) missing.push("signature");
  return accountId && publicKey && signature ? { ok: true, accountId, publicKey, signature } : { ok: false, missing };
}

/**
 * The NEP-413 nonce exactly as @near-wallet-selector/core accepts it (task 083): its `validateSignMessageParams`
 * throws "Invalid nonce. It must be a Buffer with a length of 32 bytes." unless `Buffer.isBuffer(nonce)` and
 * `nonce.length === 32` — a plain Uint8Array fails. The core uses the free global `Buffer`, which the bundler
 * (Turbopack / webpack) replaces with Next's `buffer` polyfill; this function uses the same free `Buffer`, so it gets
 * the same polyfill (whose isBuffer checks the `_isBuffer` mark). null = no Buffer here, or not 32 bytes.
 */
export function nonceBuffer(base64: string): Buffer | null {
  if (typeof Buffer === "undefined" || typeof base64 !== "string") return null;
  const bytes = Buffer.from(base64, "base64");
  return bytes.length === 32 ? bytes : null;
}

/** A wallet error message safe to show: no long base58/base64 runs (keys, signatures, nonces), max 80 chars. */
export function safeDetail(text: unknown): string {
  const raw = typeof text === "string" ? text : text instanceof Error ? text.message : String(text ?? "");
  return raw
    .replace(/[A-Za-z0-9+/_=-]{20,}/g, "…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
