import { handleVerify } from "../../../../lib/energy-server";
import { clientIp, jsonBody, toResponse } from "../../../../lib/route-helpers";

// Sign-in step 2 (task 081, mainnet only): checks the NEP-413 signature + the full-access key on chain → session cookie.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return toResponse(await handleVerify(await jsonBody(request), clientIp(request)), request);
}
