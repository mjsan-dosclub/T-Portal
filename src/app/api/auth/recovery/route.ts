import { LOCKED_ERROR, recoveryLogin } from "@/server/auth/service";
import { sessionCookie } from "@/server/auth/session";
import { errorResponse, json } from "@/server/http";
import { authPreflight } from "../_shared";

export async function POST(req: Request) {
  try {
    const pre = await authPreflight(req);
    if (pre instanceof Response) return pre;
    const r = await recoveryLogin(pre.token, String(pre.body.code ?? ""), pre.meta);
    if (r.status === "no_session") return json({ error: "Your sign-in expired. Start again." }, { status: 401 });
    if (r.status === "locked") return json({ error: LOCKED_ERROR }, { status: 429 });
    if (r.status === "invalid") return json({ error: "That recovery code is not valid or was already used." }, { status: 401 });
    return json({ next: "/" }, { headers: { "Set-Cookie": sessionCookie(r.token) } });
  } catch (err) {
    return errorResponse(err);
  }
}
