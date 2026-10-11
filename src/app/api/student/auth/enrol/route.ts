import { studentConfirmEnrol, studentStartEnrol } from "@/server/student/auth";
import { studentCookie } from "@/server/student/session";
import { errorResponse, json } from "@/server/http";
import { studentPreflight } from "../_shared";

export async function POST(req: Request) {
  try {
    const pre = await studentPreflight(req);
    if (pre instanceof Response) return pre;
    if (pre.body.action === "start") {
      const r = await studentStartEnrol(pre.session, pre.meta);
      return r ? json(r) : json({ error: "Your sign-in expired. Start again." }, { status: 401 });
    }
    const r = await studentConfirmEnrol(pre.session, String(pre.body.code ?? ""), pre.meta);
    if (r.status === "no_session") return json({ error: "Your sign-in expired. Start again." }, { status: 401 });
    if (r.status === "invalid") return json({ error: "That code didn't match. Enter the current 6-digit code from Google Authenticator." }, { status: 400 });
    return json({ recoveryCodes: r.recoveryCodes, next: r.next }, { headers: { "Set-Cookie": studentCookie(r.token) } });
  } catch (e) {
    return errorResponse(e);
  }
}
