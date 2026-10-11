import { STUDENT_LOGIN_ERROR, studentPasswordLogin } from "@/server/student/auth";
import { studentCookie } from "@/server/student/session";
import { PRE_MFA_MS } from "@/server/auth/session";
import { errorResponse, json } from "@/server/http";
import { studentPreflight } from "../_shared";

export async function POST(req: Request) {
  try {
    const pre = await studentPreflight(req);
    if (pre instanceof Response) return pre;
    const r = await studentPasswordLogin(String(pre.body.email ?? ""), String(pre.body.password ?? ""), pre.meta);
    if (r.status === "locked") return json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    if (r.status === "expired") return json({ error: "That one-time password has expired. Ask your DOS Club coordinator for a new one." }, { status: 401 });
    if (r.status !== "ok") return json({ error: STUDENT_LOGIN_ERROR }, { status: 401 });
    return json({ next: r.next }, { headers: { "Set-Cookie": studentCookie(r.token, PRE_MFA_MS) } });
  } catch (e) {
    return errorResponse(e);
  }
}
