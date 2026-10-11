import { confirmEnrolment, startEnrolment } from "@/server/auth/service";
import { sessionCookie } from "@/server/auth/session";
import { errorResponse, json } from "@/server/http";
import { authPreflight } from "../_shared";

/** POST {action:"start"} → QR + manual key. POST {action:"confirm", code} → recovery codes (shown once). */
export async function POST(req: Request) {
  try {
    const pre = await authPreflight(req);
    if (pre instanceof Response) return pre;
    if (pre.body.action === "start") {
      const r = await startEnrolment(pre.token, pre.meta);
      if (!r) return json({ error: "Your sign-in expired. Start again." }, { status: 401 });
      return json(r);
    }
    const r = await confirmEnrolment(pre.token, String(pre.body.code ?? ""), pre.meta);
    if (r.status === "no_session") return json({ error: "Your sign-in expired. Start again." }, { status: 401 });
    if (r.status === "invalid") return json({ error: "That code didn't match. Enter the current 6-digit code from Google Authenticator." }, { status: 400 });
    return json({ recoveryCodes: r.recoveryCodes, next: "/" }, { headers: { "Set-Cookie": sessionCookie(r.token) } });
  } catch (err) {
    return errorResponse(err);
  }
}
