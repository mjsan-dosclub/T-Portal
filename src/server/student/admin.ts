import "server-only";
import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { audit } from "@/server/audit";
import { sha256Hex } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";
import type { SessionAdmin } from "@/server/auth/session";
import { HttpError } from "@/server/http";

type Meta = { ip?: string; userAgent?: string | null };
export const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000; // PH2-7

export async function portalStatus(studentId: string) {
  const u = await db.studentUser.findUnique({ where: { studentId }, select: { activatedAt: true, totpEnabled: true, lastLoginAt: true, mustChangePassword: true, tempPasswordExpiresAt: true } });
  if (!u) return { activated: false as const };
  return {
    activated: true as const, activatedAt: u.activatedAt.toISOString(), totpEnabled: u.totpEnabled, lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    pendingOneTimePassword: u.mustChangePassword, oneTimeExpiresAt: u.tempPasswordExpiresAt?.toISOString() ?? null,
  };
}

/** Super Admin: remove a student's portal account (lost phone and recovery codes). They then do first-time access again. */
export async function resetPortalAccess(studentId: string, reason: string | undefined, actor: SessionAdmin, meta: Meta) {
  const u = await db.studentUser.findUnique({ where: { studentId } });
  if (!u) throw new HttpError(404, "This student hasn't activated the portal");
  await db.$transaction(async (tx) => {
    await tx.studentUser.delete({ where: { id: u.id } }); // cascades sessions + recovery codes
    await audit(tx, { actorId: actor.id, action: "student_portal.access_reset", entity: "student", entityId: studentId, reason: reason?.slice(0, 300) ?? null, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** PH2-7: Admin/Super Admin issues a one-time password (shown once, 72 h). The student must set a new one after signing in. */
export async function resetStudentPassword(studentId: string, actor: SessionAdmin, meta: Meta) {
  const found = await db.studentUser.findUnique({ where: { studentId }, include: { student: { select: { email: true } } } });
  if (!found) throw new HttpError(404, "This student hasn't activated the portal yet. They can do first-time access themselves.");
  const u = { id: found.id, email: found.student.email };
  const oneTimePassword = randomBytes(9).toString("base64url"); // 12 chars
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
  await db.$transaction(async (tx) => {
    await tx.studentUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(oneTimePassword), mustChangePassword: true, tempPasswordExpiresAt: expiresAt } });
    await tx.studentSession.deleteMany({ where: { studentUserId: u.id } });
    await tx.rateLimit.deleteMany({ where: { key: { startsWith: `slogin:${sha256Hex(u.email)}:` } } }); // unlock this student only
    await audit(tx, { actorId: actor.id, action: "student_portal.password_reset_by_admin", entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
  });
  return { oneTimePassword, expiresAt: expiresAt.toISOString() };
}
