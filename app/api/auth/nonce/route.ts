import { handleNonce } from "../../../../lib/energy-server";
import { clientIp, toResponse } from "../../../../lib/route-helpers";

// Sign-in step 1 (task 081, mainnet only): a single-use nonce + the message the wallet signs (NEP-413).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return toResponse(await handleNonce(clientIp(request)), request);
}
