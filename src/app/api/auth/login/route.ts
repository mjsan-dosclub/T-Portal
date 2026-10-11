import { GENERIC_LOGIN_ERROR, LOCKED_ERROR, passwordLogin } from "@/server/auth/service";
import { PRE_MFA_MS, sessionCookie } from "@/server/auth/session";
import { errorResponse, json } from "@/server/http";
import { authPreflight } from "../_shared";

export async function POST(req: Request) {
  try {
    const pre = await authPreflight(req);
    if (pre instanceof Response) return pre;
    const r = await passwordLogin(String(pre.body.email ?? ""), String(pre.body.password ?? ""), pre.meta);
    if (r.status === "locked") return json({ error: LOCKED_ERROR }, { status: 429 });
    if (r.status === "invalid") return json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
    return json({ next: r.next === "enrol" ? "/enrol-2fa" : "/login/totp" }, { headers: { "Set-Cookie": sessionCookie(r.token, PRE_MFA_MS) } });
  } catch (err) {
    return errorResponse(err);
  }
}
