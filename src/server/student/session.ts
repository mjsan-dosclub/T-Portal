import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "@/server/auth/crypto";
import { ABSOLUTE_MS, IDLE_MS, PRE_MFA_MS, readCookie } from "@/server/auth/session";
import { clientIp, errorResponse, json, sameOrigin, type HttpError } from "@/server/http";

// Student sessions: separate cookie + table from admins, so a student session can never call admin APIs.
export const STUDENT_COOKIE = "dos_student_session";

export type StudentPrincipal = { userId: string; studentId: string; fullName: string; email: string; totpEnabled: boolean; mustChangePassword: boolean };

export async function createStudentSession(userId: string, mfaPassed: boolean, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const token = randomToken();
  const now = new Date();
  await db.studentSession.create({
    data: { id: sha256Hex(token), studentUserId: userId, mfaPassed, lastSeenAt: now, expiresAt: new Date(now.getTime() + (mfaPassed ? ABSOLUTE_MS : PRE_MFA_MS)), ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
  });
  return token;
}

export async function resolveStudentSession(token: string | undefined | null, now = new Date()) {
  if (!token || token.length > 200) return null;
  const id = sha256Hex(token);
  const s = await db.studentSession.findUnique({ where: { id }, include: { user: { include: { student: { select: { id: true, fullName: true, email: true, deletedAt: true } } } } } });
  if (!s) return null;
  if (s.expiresAt <= now || now.getTime() - s.lastSeenAt.getTime() > IDLE_MS || s.user.student.deletedAt) {
    await db.studentSession.deleteMany({ where: { id } });
    return null;
  }
  if (now.getTime() - s.lastSeenAt.getTime() > 60_000) await db.studentSession.update({ where: { id }, data: { lastSeenAt: now } });
  const principal: StudentPrincipal = { userId: s.user.id, studentId: s.user.student.id, fullName: s.user.student.fullName, email: s.user.student.email, totpEnabled: s.user.totpEnabled, mustChangePassword: s.user.mustChangePassword };
  return { mfaPassed: s.mfaPassed, principal };
}

export async function destroyStudentSession(token: string | undefined | null) {
  if (token) await db.studentSession.deleteMany({ where: { id: sha256Hex(token) } });
}

export function studentCookie(token: string, maxAgeMs = ABSOLUTE_MS) {
  return `${STUDENT_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}
export function clearStudentCookie() {
  return `${STUDENT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export type StudentCtx = { req: Request; student: StudentPrincipal; ip: string; userAgent: string | null };

/** Guard for student APIs: student session + MFA + same origin. While a one-time password is in use, only the
 *  "set new password" endpoint is allowed (PH2-7). */
export function withStudent(handler: (ctx: StudentCtx) => Promise<Response>, opts: { allowMustChange?: boolean } = {}) {
  return async (req: Request): Promise<Response> => {
    try {
      const s = await resolveStudentSession(readCookie(req.headers.get("cookie"), STUDENT_COOKIE));
      if (!s || !s.mfaPassed) return json({ error: "Not signed in" }, { status: 401 });
      if (s.principal.mustChangePassword && !opts.allowMustChange) return json({ error: "Set a new password first" }, { status: 403 });
      if (req.method !== "GET" && !sameOrigin(req)) return json({ error: "Request origin not allowed" }, { status: 403 });
      return await handler({ req, student: s.principal, ip: clientIp(req), userAgent: req.headers.get("user-agent") });
    } catch (err) {
      return errorResponse(err as HttpError);
    }
  };
}

/** For student pages. */
export async function requireStudentPage(opts: { allowMustChange?: boolean } = {}): Promise<StudentPrincipal> {
  const s = await resolveStudentSession((await cookies()).get(STUDENT_COOKIE)?.value);
  if (!s) redirect("/student/login");
  if (!s.mfaPassed) redirect(s.principal.totpEnabled ? "/student/totp" : "/student/enrol");
  if (s.principal.mustChangePassword && !opts.allowMustChange) redirect("/student/change-password");
  return s.principal;
}

export async function studentSignInState() {
  const s = await resolveStudentSession((await cookies()).get(STUDENT_COOKIE)?.value);
  if (!s) return "anonymous" as const;
  if (s.mfaPassed) return "signed_in" as const;
  return s.principal.totpEnabled ? ("needs_totp" as const) : ("needs_enrol" as const);
}
