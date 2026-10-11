import { studentTotpLogin } from "@/server/student/auth";
import { studentCookie } from "@/server/student/session";
import { errorResponse, json } from "@/server/http";
import { studentPreflight } from "../_shared";

export async function POST(req: Request) {
  try {
    const pre = await studentPreflight(req);
    if (pre instanceof Response) return pre;
    const r = await studentTotpLogin(pre.session, String(pre.body.code ?? ""), pre.meta);
    if (r.status === "no_session") return json({ error: "Your sign-in expired. Start again." }, { status: 401 });
    if (r.status === "locked") return json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    if (r.status !== "ok") return json({ error: "That code didn't work. Check the time on your phone and try the newest code." }, { status: 401 });
    return json({ next: r.next }, { headers: { "Set-Cookie": studentCookie(r.token) } });
  } catch (e) {
    return errorResponse(e);
  }
}
