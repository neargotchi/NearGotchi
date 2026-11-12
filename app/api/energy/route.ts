import { handleEnergy } from "../../../lib/energy-server";
import { sessionCookie, toResponse } from "../../../lib/route-helpers";

// A token's energy from the server ledger (task 081, mainnet only): GET /api/energy?token=ID.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  return toResponse(await handleEnergy(sessionCookie(request), token), request);
}
