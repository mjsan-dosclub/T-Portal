import "server-only";
import { readCookie } from "@/server/auth/session";
import { hit } from "@/server/auth/rate-limit";
import { clientIp, json, sameOrigin } from "@/server/http";
import { STUDENT_COOKIE } from "@/server/student/session";
import type { Meta } from "@/server/student/auth";

/** Public student auth endpoints: same-origin + coarse per-IP limit (SEC-09). */
export async function studentPreflight(req: Request): Promise<{ meta: Meta; session?: string; body: Record<string, unknown> } | Response> {
  if (!sameOrigin(req)) return json({ error: "Request origin not allowed" }, { status: 403 });
  const ip = clientIp(req);
  if (!(await hit(`sauth:ip:${ip}`, 60, 60_000))) return json({ error: "Too many requests" }, { status: 429 });
  let body: Record<string, unknown> = {};
  try {
    const t = await req.text();
    body = t ? (JSON.parse(t) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const cookie = req.headers.get("cookie");
  return { meta: { ip, userAgent: req.headers.get("user-agent") }, session: readCookie(cookie, STUDENT_COOKIE), body };
}

