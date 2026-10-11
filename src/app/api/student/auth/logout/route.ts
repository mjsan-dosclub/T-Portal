import { readCookie } from "@/server/auth/session";
import { clearStudentCookie, destroyStudentSession, STUDENT_COOKIE } from "@/server/student/session";
import { errorResponse, json, sameOrigin } from "@/server/http";

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({ error: "Request origin not allowed" }, { status: 403 });
    await destroyStudentSession(readCookie(req.headers.get("cookie"), STUDENT_COOKIE));
    return json({ next: "/student/login" }, { headers: { "Set-Cookie": clearStudentCookie() } });
  } catch (e) {
    return errorResponse(e);
  }
}
