// Browser side of the NEAR AI chat (task 060): one call to /api/chat. Never throws.

export type AiAnswer = { status: "ok"; text: string } | { status: "no_key" } | { status: "error" };

export type AiRequest = {
  petType: string;
  petName: string;
  stats: { hunger: number; energy: number; mood: string };
  history: { from: "you" | "pet"; text: string }[];
  message: string;
};

const CLIENT_TIMEOUT_MS = 20000;

export async function askNearAi(request: AiRequest): Promise<AiAnswer> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    if (response.status === 503) return { status: "no_key" };
    if (!response.ok) return { status: "error" };
    const data = (await response.json()) as { reply?: unknown };
    return typeof data.reply === "string" && data.reply ? { status: "ok", text: data.reply } : { status: "error" };
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
