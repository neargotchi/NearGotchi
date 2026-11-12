import { handleClaim } from "../../../../lib/energy-server";
import { jsonBody, sessionCookie, toResponse } from "../../../../lib/route-helpers";

// Energy pack (task 081, mainnet only): POST { tx_hash, token_id } → +50 once per verified payment.
export const dynamic = "force-dynamic";
// the server waits for the transaction to be final on chain (RPC with failover)
export const maxDuration = 30;

export async function POST(request: Request) {
  return toResponse(await handleClaim(sessionCookie(request), await jsonBody(request)), request);
}
