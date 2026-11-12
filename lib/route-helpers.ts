// Small helpers shared by the energy / auth / chat route handlers (task 081). Server only.

import { SESSION_COOKIE } from "./near-auth";
import type { Reply } from "./energy-server";

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** The session cookie from the request (Cookie header), or undefined. */
export function sessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

/** JSON response, never cached; sets / clears the HttpOnly session cookie when the reply carries one. */
export function toResponse(reply: Reply, request: Request): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  if (reply.session) {
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    headers.append("set-cookie", `${SESSION_COOKIE}=${reply.session.value}; Path=/; Max-Age=${reply.session.maxAge}; HttpOnly; SameSite=Lax${secure}`);
  }
  return Response.json(reply.body, { status: reply.status, headers });
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
