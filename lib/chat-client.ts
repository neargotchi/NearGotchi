// Browser side of the NEAR AI chat (task 060): one call to /api/chat. Never throws.
// Mainnet (task 081): the request names the token, the server takes the energy from its ledger and every answer
// carries the token's new balance (`energy`); the client never spends energy itself.

export type AiAnswer =
  | { status: "ok"; text: string; energy?: number }
  | { status: "no_key" }
  | { status: "error"; energy?: number }
  /** mainnet: the ledger has less than one message of energy */
  | { status: "no_energy"; energy?: number }
  /** mainnet: no / expired session — sign in again */
  | { status: "signed_out" }
  /** mainnet: the site's daily NEAR AI budget is used up */
  | { status: "resting"; energy?: number };

export type AiRequest = {
  petType: string;
  petName: string;
  stats: { hunger: number; energy: number; mood: string };
  history: { from: "you" | "pet"; text: string }[];
  message: string;
  /** mainnet: the pet's drop-1 token (the server checks the session account owns it) */
  tokenId?: number;
};

/** the server may try the default model and then the fallback (9 s each) */
const CLIENT_TIMEOUT_MS = 22000;

export async function askNearAi(request: AiRequest): Promise<AiAnswer> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    let data: { reply?: unknown; energy?: unknown; error?: unknown } = {};
    try {
      data = (await response.json()) as typeof data;
    } catch {
      // no JSON: handled by status below
    }
    const energy = typeof data.energy === "number" ? data.energy : undefined;
    if (response.status === 401) return { status: "signed_out" };
    if (response.status === 402 || data.error === "no_energy") return { status: "no_energy", energy };
    if (data.error === "resting") return { status: "resting", energy };
    if (response.status === 503 && (data.error === "no_key" || data.error === undefined)) return { status: "no_key" };
    if (!response.ok) return { status: "error", energy };
    return typeof data.reply === "string" && data.reply ? { status: "ok", text: data.reply, energy } : { status: "error", energy };
  } catch {
    return { status: "error" };
  }
}

/** true when the server has a NEAR AI key; false on any failure (the chat then runs on the mock). */
export async function nearAiEnabled(): Promise<boolean> {
  try {
    const response = await fetch("/api/chat", { cache: "no-store" });
    return response.ok && ((await response.json()) as { enabled?: unknown }).enabled === true;
  } catch {
    return false;
  }
}
