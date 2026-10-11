import { clearSessionCookie, destroySession, readCookie } from "@/server/auth/session";
import { errorResponse, json, sameOrigin } from "@/server/http";

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({ error: "Request origin not allowed" }, { status: 403 });
    await destroySession(readCookie(req.headers.get("cookie")));
    return json({ next: "/login" }, { headers: { "Set-Cookie": clearSessionCookie() } });
  } catch (err) {
    return errorResponse(err);
  }
}
