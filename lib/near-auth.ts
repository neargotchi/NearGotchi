// Sign-in with a NEAR wallet (task 081): NEP-413 signed messages + a short HMAC session cookie.
// NEP-413 (https://github.com/near/NEPs/blob/master/neps/nep-0413.md): the wallet signs
//   sha256( u32_le(2^31 + 413) ‖ borsh{ message: string, nonce: [u8; 32], recipient: string, callbackUrl: Option<string> } )
// with an ed25519 key of the account. The server checks the signature, that the nonce is one it issued (single use),
// and (lib/energy-server.ts) that the key is a full-access key of that account on chain.
// Server only (node:crypto).

import { createHmac, createPublicKey, createHash, randomBytes, timingSafeEqual, verify } from "node:crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(text: string): Uint8Array | null {
  let n = BigInt(0);
  for (const ch of text) {
    const digit = B58.indexOf(ch);
    if (digit < 0) return null;
    n = n * BigInt(58) + BigInt(digit);
  }
  const bytes: number[] = [];
  while (n > BigInt(0)) {
    bytes.unshift(Number(n % BigInt(256)));
    n /= BigInt(256);
  }
  for (const ch of text) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** "ed25519:<base58 32 bytes>" → the raw key, or null. */
export function parsePublicKey(publicKey: string): Uint8Array | null {
  if (typeof publicKey !== "string" || !publicKey.startsWith("ed25519:")) return null;
  const raw = base58Decode(publicKey.slice("ed25519:".length));
  return raw && raw.length === 32 ? raw : null;
}

const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const borshString = (s: string) => {
  const bytes = Buffer.from(s, "utf8");
  return Buffer.concat([u32(bytes.length), bytes]);
};

/** NEP-413 tag: 2^31 + 413. */
export const NEP413_TAG = 2147484061;

/** The 32-byte hash the wallet signs. */
export function nep413Hash(message: string, nonce: Uint8Array, recipient: string, callbackUrl?: string | null): Buffer {
  const parts = [u32(NEP413_TAG), borshString(message), Buffer.from(nonce), borshString(recipient)];
  parts.push(callbackUrl ? Buffer.concat([Buffer.from([1]), borshString(callbackUrl)]) : Buffer.from([0]));
  return createHash("sha256").update(Buffer.concat(parts)).digest();
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

/** ed25519 signature check; never throws. */
export function verifyEd25519(publicKey: Uint8Array, data: Uint8Array, signature: Uint8Array): boolean {
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: b64url(publicKey) }, format: "jwk" });
    return signature.length === 64 && verify(null, data, key, signature);
  } catch {
    return false;
  }
}

/** Wallets return the signature as base64; accept base64url too. */
export function decodeSignature(signature: string): Uint8Array | null {
  if (typeof signature !== "string" || signature.length < 80 || signature.length > 100) return null;
  const bytes = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return bytes.length === 64 ? bytes : null;
}

/**
 * Is `signature` a valid NEP-413 signature by `publicKey` over (message, nonce, recipient)? MyNearWallet's module can
 * pass a callbackUrl, Meteor's does not: the payload is checked without it and, if the client says it used one, with it.
 */
export function verifySignedMessage(input: {
  publicKey: string;
  signature: string;
  message: string;
  nonce: Uint8Array;
  recipient: string;
  callbackUrl?: string | null;
}): boolean {
  const key = parsePublicKey(input.publicKey);
  const signature = decodeSignature(input.signature);
  if (!key || !signature || input.nonce.length !== 32) return false;
  if (verifyEd25519(key, nep413Hash(input.message, input.nonce, input.recipient, null), signature)) return true;
  return Boolean(input.callbackUrl) && verifyEd25519(key, nep413Hash(input.message, input.nonce, input.recipient, input.callbackUrl), signature);
}

export const newNonce = () => randomBytes(32);

// ---------- session cookie ----------

export const SESSION_COOKIE = "ng_session";
export const SESSION_TTL_SEC = 24 * 60 * 60;

type SessionBody = { v: 1; a: string; e: number };

const mac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

/** "<base64url json>.<hmac>" for `accountId`, valid for SESSION_TTL_SEC. */
export function signSession(accountId: string, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ v: 1, a: accountId, e: now + SESSION_TTL_SEC * 1000 } satisfies SessionBody)).toString("base64url");
  return `${body}.${mac(secret, body)}`;
}

/** The account of a valid, unexpired session cookie, or null. */
export function readSession(cookie: string | undefined | null, secret: string, now = Date.now()): string | null {
  if (!cookie || !secret) return null;
  const [body, tag] = cookie.split(".");
  if (!body || !tag) return null;
  const want = Buffer.from(mac(secret, body));
  const got = Buffer.from(tag);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionBody>;
    return data.v === 1 && typeof data.a === "string" && typeof data.e === "number" && data.e > now ? data.a : null;
  } catch {
    return null;
  }
}
