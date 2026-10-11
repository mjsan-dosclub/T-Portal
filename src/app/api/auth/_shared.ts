import "server-only";
import { clientIp, json, sameOrigin } from "@/server/http";
import { hit } from "@/server/auth/rate-limit";
import { readCookie } from "@/server/auth/session";
import type { ReqMeta } from "@/server/auth/service";

/** Common pre-checks for public auth endpoints: origin + coarse per-IP rate limit (SEC-09). */
export async function authPreflight(req: Request): Promise<{ meta: ReqMeta; token: string | undefined; body: Record<string, unknown> } | Response> {
  if (!sameOrigin(req)) return json({ error: "Request origin not allowed" }, { status: 403 });
  const ip = clientIp(req);
  if (!(await hit(`auth:ip:${ip}`, 60, 60_000))) return json({ error: "Too many requests" }, { status: 429 });
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return { meta: { ip, userAgent: req.headers.get("user-agent") }, token: readCookie(req.headers.get("cookie")), body };
}
