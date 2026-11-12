import { CHAIN } from "../../../lib/chain";
import { handleChat } from "../../../lib/chat-ai";
import { handleMainnetChat } from "../../../lib/energy-server";
import { clientIp, jsonBody, sessionCookie, toResponse } from "../../../lib/route-helpers";

// Pet chat on NEAR AI (task 060). The key lives only in the server env (NEAR_AI_API_KEY).
// Mainnet (task 081): energy is NEAR AI credits on the server ledger — session + token ownership, the energy is taken
// before the model call and given back if it fails (lib/energy-server.ts). Demo / testnet: unchanged.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Is the real AI configured? (no key value, just the flag) + does this build use the server energy ledger? */
export async function GET() {
  return Response.json({ enabled: Boolean(process.env.NEAR_AI_API_KEY), ledger: CHAIN === "mainnet" }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await jsonBody(request);
  if (CHAIN === "mainnet") return toResponse(await handleMainnetChat(sessionCookie(request), body, clientIp(request)), request);
  const result = await handleChat(body, clientIp(request));
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
}
