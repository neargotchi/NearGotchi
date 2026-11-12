// Server-side store for the energy ledger, payment hashes, sign-in nonces and rate limits (task 081).
// Upstash Redis over its REST API (plain fetch, no SDK) when the env has it; an in-memory store for local runs and
// tests. Every operation the ledger relies on is ONE atomic step (a Lua script in Redis, synchronous code in memory),
// so two parallel requests can never both spend the same energy or credit the same payment.
// Server only: never import this from a client component (it reads server env and holds the token).

export interface EnergyStore {
  readonly kind: "redis" | "memory";
  /** SET key value NX EX ttl: true when this call created the key. */
  takeOnce(key: string, value: string, ttlSec: number): Promise<boolean>;
  /** GET + DEL in one step (sign-in nonces): the value, or null when missing / already used. */
  consume(key: string): Promise<string | null>;
  /** Balance of `key`, created with `start` on first sight (SETNX). */
  balance(key: string, start: number): Promise<number>;
  /** Spends `amount` if the balance (created with `start` if missing) is at least that: the new balance, or null. */
  spend(key: string, amount: number, start: number): Promise<number | null>;
  /** Adds `amount` (refund of a failed chat): the new balance. */
  refund(key: string, amount: number): Promise<number>;
  /**
   * Marks `onceKey` (NX, ttl) and, only if it was new, adds `amount` to `balanceKey` (created with `start`).
   * The new balance, or null when `onceKey` already existed (payment already credited).
   */
  creditOnce(onceKey: string, onceValue: string, onceTtlSec: number, balanceKey: string, amount: number, start: number): Promise<number | null>;
  /** INCR with an expiry set on the first hit of the window: the count in this window. */
  hit(key: string, windowSec: number): Promise<number>;
}

// ---------- in memory ----------

type Entry = { value: string; expires: number | null };

export class MemoryStore implements EnergyStore {
  readonly kind = "memory" as const;
  private data = new Map<string, Entry>();
  constructor(private readonly now: () => number = Date.now) {}

  private read(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expires !== null && entry.expires <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }
  private write(key: string, value: string, ttlSec: number | null = null, keepTtl = false) {
    const old = this.data.get(key);
    const expires = ttlSec !== null ? this.now() + ttlSec * 1000 : keepTtl && old ? old.expires : null;
    this.data.set(key, { value, expires });
  }
  private num(key: string, start: number): number {
    const value = this.read(key);
    if (value === null) {
      this.write(key, String(start));
      return start;
    }
    return Number(value);
  }

  async takeOnce(key: string, value: string, ttlSec: number) {
    if (this.read(key) !== null) return false;
    this.write(key, value, ttlSec);
    return true;
  }
  async consume(key: string) {
    const value = this.read(key);
    this.data.delete(key);
    return value;
  }
  async balance(key: string, start: number) {
    return this.num(key, start);
  }
  async spend(key: string, amount: number, start: number) {
    const current = this.num(key, start);
    if (current < amount) return null;
    this.write(key, String(current - amount));
    return current - amount;
  }
  async refund(key: string, amount: number) {
    const next = Number(this.read(key) ?? "0") + amount;
    this.write(key, String(next));
    return next;
  }
  async creditOnce(onceKey: string, onceValue: string, onceTtlSec: number, balanceKey: string, amount: number, start: number) {
    if (this.read(onceKey) !== null) return null;
    this.write(onceKey, onceValue, onceTtlSec);
    const next = this.num(balanceKey, start) + amount;
    this.write(balanceKey, String(next));
    return next;
  }
  async hit(key: string, windowSec: number) {
    const value = this.read(key);
    const next = (value === null ? 0 : Number(value)) + 1;
    if (value === null) this.write(key, String(next), windowSec);
    else this.write(key, String(next), null, true);
    return next;
  }
}

// ---------- Upstash Redis (REST) ----------

const LUA = {
  balance: "redis.call('SET', KEYS[1], ARGV[1], 'NX'); return tonumber(redis.call('GET', KEYS[1]))",
  spend:
    "redis.call('SET', KEYS[1], ARGV[2], 'NX'); local v = tonumber(redis.call('GET', KEYS[1])); " +
    "if v >= tonumber(ARGV[1]) then return redis.call('DECRBY', KEYS[1], ARGV[1]) end; return -1",
  creditOnce:
    "if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then " +
    "redis.call('SET', KEYS[2], ARGV[4], 'NX'); return redis.call('INCRBY', KEYS[2], ARGV[3]) end; return -1",
  hit: "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return c",
};

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

export class RedisRestStore implements EnergyStore {
  readonly kind = "redis" as const;
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly doFetch: typeof fetch = fetch,
  ) {}

  private async command<T>(args: (string | number)[]): Promise<T> {
    let response: Response;
    try {
      response = await this.doFetch(this.url, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify(args.map(String)),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new StoreError("redis unreachable");
    }
    let data: { result?: T; error?: string };
    try {
      data = (await response.json()) as { result?: T; error?: string };
    } catch {
      throw new StoreError(`redis http ${response.status}`);
    }
    if (!response.ok || data.error) throw new StoreError(data.error ? "redis error" : `redis http ${response.status}`);
    return data.result as T;
  }
  private evalScript<T>(script: string, keys: string[], args: (string | number)[]) {
    return this.command<T>(["EVAL", script, keys.length, ...keys, ...args]);
  }

  async takeOnce(key: string, value: string, ttlSec: number) {
    return (await this.command<string | null>(["SET", key, value, "NX", "EX", ttlSec])) === "OK";
  }
  async consume(key: string) {
    return this.command<string | null>(["GETDEL", key]);
  }
  async balance(key: string, start: number) {
    return Number(await this.evalScript<number>(LUA.balance, [key], [start]));
  }
  async spend(key: string, amount: number, start: number) {
    const next = Number(await this.evalScript<number>(LUA.spend, [key], [amount, start]));
    return next < 0 ? null : next;
  }
  async refund(key: string, amount: number) {
    return Number(await this.command<number>(["INCRBY", key, amount]));
  }
  async creditOnce(onceKey: string, onceValue: string, onceTtlSec: number, balanceKey: string, amount: number, start: number) {
    const next = Number(await this.evalScript<number>(LUA.creditOnce, [onceKey, balanceKey], [onceValue, onceTtlSec, amount, start]));
    return next < 0 ? null : next;
  }
  async hit(key: string, windowSec: number) {
    return Number(await this.evalScript<number>(LUA.hit, [key], [windowSec]));
  }
}

// ---------- which store ----------

/** Upstash via the Vercel Marketplace integration (either naming), or null. Values never leave this module. */
export function redisEnv(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let shared: EnergyStore | null | undefined;

/**
 * Redis when configured. Without it: an in-memory store for local runs (`next dev` / `next start` on this machine,
 * tests), but **null on Vercel** — the mainnet ledger fails closed there instead of keeping balances in one instance.
 */
export function getEnergyStore(env: Record<string, string | undefined> = process.env): EnergyStore | null {
  if (shared !== undefined) return shared;
  const redis = redisEnv(env);
  shared = redis ? new RedisRestStore(redis.url, redis.token) : env.VERCEL ? null : new MemoryStore();
  return shared;
}

/** Tests only. */
export function resetEnergyStore(store?: EnergyStore | null) {
  shared = store;
}
