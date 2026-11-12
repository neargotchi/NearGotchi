import { handleSession } from "../../../../lib/energy-server";
import { sessionCookie, toResponse } from "../../../../lib/route-helpers";

// Who is signed in (task 081, mainnet only). DELETE = sign out (clears the cookie).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return toResponse(await handleSession(sessionCookie(request)), request);
}

export async function DELETE(request: Request) {
  return toResponse({ status: 200, body: { account: null }, session: { value: "", maxAge: 0 } }, request);
}
