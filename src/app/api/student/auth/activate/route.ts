import { activateFirstTime } from "@/server/student/auth";
import { studentCookie } from "@/server/student/session";
import { PRE_MFA_MS } from "@/server/auth/session";
import { errorResponse, json } from "@/server/http";
import { studentPreflight } from "../_shared";

/** PH2-5/6: first access. Email + mobile on record must match; then the password is created. */
export async function POST(req: Request) {
  try {
    const pre = await studentPreflight(req);
    if (pre instanceof Response) return pre;
    const r = await activateFirstTime(String(pre.body.email ?? ""), String(pre.body.phone ?? ""), String(pre.body.password ?? ""), pre.meta);
    return json({ next: r.next }, { headers: { "Set-Cookie": studentCookie(r.session, PRE_MFA_MS) } });
  } catch (e) {
    return errorResponse(e);
  }
}
