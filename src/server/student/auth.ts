import "server-only";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { audit } from "@/server/audit";
import { decrypt, encrypt, generateRecoveryCodes, hashRecoveryCode, safeEqualHex, sha256Hex } from "@/server/auth/crypto";
import { burnPasswordTime, hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { clearFailures, hit, isLocked, recordFailure } from "@/server/auth/rate-limit";
import { checkTotp, newTotpSecret, totpQr } from "@/server/auth/totp";
import { HttpError } from "@/server/http";
import { createStudentSession, destroyStudentSession, resolveStudentSession } from "./session";

// Phase 2 student access (DECISIONS PH2-5..7). No email service: first access is matched on email + the
// mobile number on record (PH2-6); forgotten passwords are reset by an admin with a one-time password (PH2-7).

export type Meta = { ip: string; userAgent: string | null; now?: Date };
const actor = (userId: string) => `student:${userId}`;

export const ACTIVATE_NO_MATCH =
  "We couldn't activate an account with those details. Check the email and mobile number you registered with DOS Club. Already activated? Sign in instead. Still stuck? Ask your DOS Club coordinator.";

/** First access: email + mobile on record must both match a student without an account; then create the password. */
export async function activateFirstTime(emailRaw: string, phoneRaw: string, password: string, meta: Meta) {
  if (!(await hit(`sactivate:ip:${meta.ip}`, 10, 15 * 60_000, meta.now))) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
  const email = normalizeEmail(emailRaw);
  if (!(await hit(`sactivate:email:${sha256Hex(email)}`, 5, 60 * 60_000, meta.now))) throw new HttpError(429, "Too many attempts for this email. Try again in an hour.");
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, problem, { fields: { password: problem } });
  const phone = normalizePhone(phoneRaw);
  const student = email ? await db.student.findFirst({ where: { email, deletedAt: null }, include: { portalUser: true } }) : null;
  const hash = await hashPassword(password); // always spend the time, matched or not
  if (!student || !phone.ok || student.phone !== phone.e164 || student.portalUser) {
    if (student) await audit(db, { actorId: null, action: student.portalUser ? "student_portal.activate_already_active" : "student_portal.activate_mismatch", entity: "student", entityId: student.id, ip: meta.ip, userAgent: meta.userAgent });
    throw new HttpError(400, ACTIVATE_NO_MATCH);
  }
  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const u = await tx.studentUser.create({ data: { studentId: student.id, passwordHash: hash } });
      await audit(tx, { actorId: actor(u.id), action: "student_portal.activated", entity: "student", entityId: student.id, ip: meta.ip, userAgent: meta.userAgent });
      return u;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(400, ACTIVATE_NO_MATCH); // concurrent activation
    throw e;
  }
  return { session: await createStudentSession(user.id, false, meta), next: "/student/enrol" };
}

/** Forced change after an admin one-time password (PH2-7). Only allowed while mustChangePassword is set. */
export async function setNewPasswordAfterReset(userId: string, studentId: string, next: string, meta: Meta) {
  const user = await db.studentUser.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mustChangePassword) throw new HttpError(400, "Use Account → Change password instead.");
  const problem = passwordProblem(next);
  if (problem) throw new HttpError(400, problem, { fields: { next: problem } });
  if (await verifyPassword(user.passwordHash, next)) throw new HttpError(400, "Choose a password different from the one-time password", { fields: { next: "Same as the one-time password" } });
  await db.studentUser.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next), mustChangePassword: false, tempPasswordExpiresAt: null } });
  await audit(db, { actorId: actor(userId), action: "student_portal.password_set_after_reset", entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
}

const loginKey = (email: string, ip: string) => `slogin:${sha256Hex(email)}:${ip}`;
export const STUDENT_LOGIN_ERROR = "Email or password is incorrect";

export async function studentPasswordLogin(emailRaw: string, password: string, meta: Meta) {
  const email = normalizeEmail(emailRaw);
  const key = loginKey(email, meta.ip);
  if (await isLocked(key, meta.now)) return { status: "locked" as const };
  const student = email ? await db.student.findFirst({ where: { email, deletedAt: null }, include: { portalUser: true } }) : null;
  const user = student?.portalUser ?? null;
  const ok = user ? await verifyPassword(user.passwordHash, String(password ?? "")) : (await burnPasswordTime(String(password ?? "")), false);
  if (ok && user?.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt <= (meta.now ?? new Date())) {
    return { status: "expired" as const };
  }
  if (!ok || !user || !student) {
    const locked = await recordFailure(key, meta.now);
    if (user && locked) await audit(db, { actorId: actor(user.id), action: "student_portal.locked", entity: "student", entityId: student!.id, ip: meta.ip, userAgent: meta.userAgent });
    return { status: locked ? ("locked" as const) : ("invalid" as const) };
  }
  const token = await createStudentSession(user.id, false, meta);
  return { status: "ok" as const, token, next: user.totpEnabled ? "/student/totp" : "/student/enrol" };
}

async function preMfa(token: string | undefined, meta: Meta) {
  const s = await resolveStudentSession(token, meta.now);
  return s && !s.mfaPassed ? s : null;
}

async function complete(oldToken: string, userId: string, studentId: string, meta: Meta, action: string) {
  await destroyStudentSession(oldToken);
  const token = await createStudentSession(userId, true, meta);
  const u = await db.studentUser.update({ where: { id: userId }, data: { lastLoginAt: meta.now ?? new Date() } });
  await audit(db, { actorId: actor(userId), action, entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
  return { token, next: u.mustChangePassword ? "/student/change-password" : "/student" };
}

export async function studentTotpLogin(token: string | undefined, code: string, meta: Meta) {
  const s = await preMfa(token, meta);
  if (!s || !token) return { status: "no_session" as const };
  const user = await db.studentUser.findUniqueOrThrow({ where: { id: s.principal.userId } });
  if (!user.totpEnabled || !user.totpSecretEnc) return { status: "no_session" as const };
  const key = loginKey(s.principal.email, meta.ip);
  if (await isLocked(key, meta.now)) return { status: "locked" as const };
  const r = await checkTotp(decrypt(user.totpSecretEnc), code, user.totpLastStep, meta.now ? Math.floor(meta.now.getTime() / 1000) : undefined);
  if (!r.ok) return { status: (await recordFailure(key, meta.now)) ? ("locked" as const) : ("invalid" as const) };
  const claimed = await db.studentUser.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: r.step } }] }, data: { totpLastStep: r.step } });
  if (claimed.count !== 1) return { status: "invalid" as const };
  await clearFailures(key);
  return { status: "ok" as const, ...(await complete(token, user.id, s.principal.studentId, meta, "student_portal.login")) };
}

export async function studentRecoveryLogin(token: string | undefined, code: string, meta: Meta) {
  const s = await preMfa(token, meta);
  if (!s || !token) return { status: "no_session" as const };
  const key = loginKey(s.principal.email, meta.ip);
  if (await isLocked(key, meta.now)) return { status: "locked" as const };
  const codes = await db.studentRecoveryCode.findMany({ where: { studentUserId: s.principal.userId, usedAt: null } });
  const h = hashRecoveryCode(String(code ?? ""));
  const match = codes.find((c) => safeEqualHex(c.codeHash, h));
  if (!match) return { status: (await recordFailure(key, meta.now)) ? ("locked" as const) : ("invalid" as const) };
  const used = await db.studentRecoveryCode.updateMany({ where: { id: match.id, usedAt: null }, data: { usedAt: meta.now ?? new Date() } });
  if (used.count !== 1) return { status: "invalid" as const };
  await clearFailures(key);
  return { status: "ok" as const, ...(await complete(token, s.principal.userId, s.principal.studentId, meta, "student_portal.login_recovery_code")) };
}

export async function studentStartEnrol(token: string | undefined, meta: Meta) {
  const s = await preMfa(token, meta);
  if (!s) return null;
  const user = await db.studentUser.findUniqueOrThrow({ where: { id: s.principal.userId } });
  if (user.totpEnabled) return null;
  let secret = user.totpSecretEnc ? decrypt(user.totpSecretEnc) : null;
  if (!secret) {
    secret = newTotpSecret();
    await db.studentUser.update({ where: { id: user.id }, data: { totpSecretEnc: encrypt(secret), totpLastStep: null } });
  }
  const { dataUrl } = await totpQr(secret, s.principal.email);
  return { qrDataUrl: dataUrl, manualKey: secret.replace(/(.{4})/g, "$1 ").trim() };
}

export async function studentConfirmEnrol(token: string | undefined, code: string, meta: Meta) {
  const s = await preMfa(token, meta);
  if (!s || !token) return { status: "no_session" as const };
  const user = await db.studentUser.findUniqueOrThrow({ where: { id: s.principal.userId } });
  if (user.totpEnabled || !user.totpSecretEnc) return { status: "no_session" as const };
  const r = await checkTotp(decrypt(user.totpSecretEnc), code, null, meta.now ? Math.floor(meta.now.getTime() / 1000) : undefined);
  if (!r.ok) return { status: "invalid" as const };
  const codes = generateRecoveryCodes(10);
  await db.$transaction(async (tx) => {
    await tx.studentRecoveryCode.deleteMany({ where: { studentUserId: user.id } });
    await tx.studentRecoveryCode.createMany({ data: codes.map((c) => ({ studentUserId: user.id, codeHash: hashRecoveryCode(c) })) });
    await tx.studentUser.update({ where: { id: user.id }, data: { totpEnabled: true, totpLastStep: r.step } });
    await audit(tx, { actorId: actor(user.id), action: "student_portal.2fa_enrolled", entity: "student", entityId: s.principal.studentId, ip: meta.ip, userAgent: meta.userAgent });
  });
  return { status: "ok" as const, ...(await complete(token, user.id, s.principal.studentId, meta, "student_portal.login")), recoveryCodes: codes };
}

export async function studentChangePassword(userId: string, studentId: string, current: string, next: string, meta: Meta) {
  const user = await db.studentUser.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, current))) throw new HttpError(400, "Current password is incorrect", { fields: { current: "Incorrect" } });
  const problem = passwordProblem(next);
  if (problem) throw new HttpError(400, problem, { fields: { next: problem } });
  if (current === next) throw new HttpError(400, "Choose a different password", { fields: { next: "Same as current" } });
  await db.studentUser.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await audit(db, { actorId: actor(userId), action: "student_portal.password_changed", entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
}

export async function studentRegenerateCodes(userId: string, studentId: string, code: string, meta: Meta) {
  const user = await db.studentUser.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecretEnc) return null;
  const r = await checkTotp(decrypt(user.totpSecretEnc), code, user.totpLastStep);
  if (!r.ok) return null;
  const codes = generateRecoveryCodes(10);
  await db.$transaction(async (tx) => {
    await tx.studentUser.update({ where: { id: userId }, data: { totpLastStep: r.step } });
    await tx.studentRecoveryCode.deleteMany({ where: { studentUserId: userId } });
    await tx.studentRecoveryCode.createMany({ data: codes.map((c) => ({ studentUserId: userId, codeHash: hashRecoveryCode(c) })) });
    await audit(tx, { actorId: actor(userId), action: "student_portal.recovery_codes_regenerated", entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
  });
  return codes;
}
