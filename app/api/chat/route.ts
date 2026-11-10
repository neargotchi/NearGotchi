import { handleChat } from "../../../lib/chat-ai";

// Pet chat on NEAR AI (task 060). The key lives only in the server env (NEAR_AI_API_KEY).
export const dynamic = "force-dynamic";

/** Is the real AI configured? (no key value, just the flag) */
export async function GET() {
  return Response.json({ enabled: Boolean(process.env.NEAR_AI_API_KEY) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // handled as bad_request
  }
  const result = await handleChat(body, ip);
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
}
