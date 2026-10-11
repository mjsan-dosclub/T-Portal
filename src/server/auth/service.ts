import "server-only";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize";
import { audit } from "@/server/audit";
import { decrypt, encrypt, generateRecoveryCodes, hashRecoveryCode, safeEqualHex, sha256Hex } from "./crypto";
import { burnPasswordTime, verifyPassword } from "./password";
import { clearFailures, isLocked, recordFailure } from "./rate-limit";
import { createSession, destroySession, resolveSession } from "./session";
import { checkTotp, newTotpSecret, totpQr } from "./totp";

export type ReqMeta = { ip: string; userAgent: string | null; now?: Date };

export const GENERIC_LOGIN_ERROR = "Email or password is incorrect";
export const LOCKED_ERROR = "Too many attempts. Try again in 15 minutes.";

function loginKey(email: string, ip: string) {
  // Hash the email so the rate-limit table holds no PII.
  return `login:${sha256Hex(email)}:${ip}`;
}

export type PasswordLoginResult =
  | { status: "invalid" }
  | { status: "locked" }
  | { status: "ok"; token: string; next: "totp" | "enrol" };

export async function passwordLogin(emailRaw: string, password: string, meta: ReqMeta): Promise<PasswordLoginResult> {
  const email = normalizeEmail(emailRaw);
  const key = loginKey(email, meta.ip);
  if (await isLocked(key, meta.now)) return { status: "locked" };

  const admin = email ? await db.adminUser.findUnique({ where: { email } }) : null;
  const ok = admin && admin.isActive ? await verifyPassword(admin.passwordHash, String(password ?? "")) : (await burnPasswordTime(String(password ?? "")), false);

  if (!ok || !admin) {
    const locked = await recordFailure(key, meta.now);
    if (admin) {
      await db.adminUser.update({ where: { id: admin.id }, data: { failedAttempts: { increment: 1 } } });
      await audit(db, { actorId: admin.id, action: locked ? "auth.locked" : "auth.password_failed", entity: "admin_user", entityId: admin.id, ip: meta.ip, userAgent: meta.userAgent });
    }
    return locked ? { status: "locked" } : { status: "invalid" };
  }

  const token = await createSession(admin.id, { mfaPassed: false, ip: meta.ip, userAgent: meta.userAgent, now: meta.now });
  return { status: "ok", token, next: admin.totpEnabled ? "totp" : "enrol" };
}

async function preMfa(token: string | undefined, meta: ReqMeta) {
  const s = await resolveSession(token, meta.now);
  if (!s || s.mfaPassed) return null;
  return s;
}

async function completeMfa(oldToken: string, adminId: string, meta: ReqMeta, action: string) {
  // Rotate the session id when privilege increases (session fixation defence).
  await destroySession(oldToken);
  const token = await createSession(adminId, { mfaPassed: true, ip: meta.ip, userAgent: meta.userAgent, now: meta.now });
  await db.adminUser.update({ where: { id: adminId }, data: { lastLoginAt: meta.now ?? new Date(), failedAttempts: 0 } });
  await audit(db, { actorId: adminId, action, entity: "admin_user", entityId: adminId, ip: meta.ip, userAgent: meta.userAgent });
  return token;
}

export type MfaResult = { status: "invalid" } | { status: "locked" } | { status: "no_session" } | { status: "ok"; token: string };

export async function totpLogin(token: string | undefined, code: string, meta: ReqMeta): Promise<MfaResult> {
  const s = await preMfa(token, meta);
  if (!s || !token) return { status: "no_session" };
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: s.admin.id } });
  if (!admin.totpEnabled || !admin.totpSecretEnc) return { status: "no_session" };
  const key = loginKey(admin.email, meta.ip);
  if (await isLocked(key, meta.now)) return { status: "locked" };

  const epoch = meta.now ? Math.floor(meta.now.getTime() / 1000) : undefined;
  const r = await checkTotp(decrypt(admin.totpSecretEnc), code, admin.totpLastStep, epoch);
  if (!r.ok) {
    const locked = await recordFailure(key, meta.now);
    await audit(db, { actorId: admin.id, action: locked ? "auth.locked" : "auth.totp_failed", entity: "admin_user", entityId: admin.id, ip: meta.ip, userAgent: meta.userAgent });
    return locked ? { status: "locked" } : { status: "invalid" };
  }
  // Conditional update: two concurrent requests with the same code can't both succeed (AUTH-06).
  const claimed = await db.adminUser.updateMany({
    where: { id: admin.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: r.step } }] },
    data: { totpLastStep: r.step },
  });
  if (claimed.count !== 1) return { status: "invalid" };
  await clearFailures(key);
  return { status: "ok", token: await completeMfa(token, admin.id, meta, "auth.login") };
}

export async function recoveryLogin(token: string | undefined, code: string, meta: ReqMeta): Promise<MfaResult> {
  const s = await preMfa(token, meta);
  if (!s || !token) return { status: "no_session" };
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: s.admin.id }, include: { recoveryCodes: { where: { usedAt: null } } } });
  const key = loginKey(admin.email, meta.ip);
  if (await isLocked(key, meta.now)) return { status: "locked" };
  const h = hashRecoveryCode(String(code ?? ""));
  const match = admin.recoveryCodes.find((rc) => safeEqualHex(rc.codeHash, h));
  if (!match) {
    const locked = await recordFailure(key, meta.now);
    await audit(db, { actorId: admin.id, action: locked ? "auth.locked" : "auth.recovery_failed", entity: "admin_user", entityId: admin.id, ip: meta.ip, userAgent: meta.userAgent });
    return locked ? { status: "locked" } : { status: "invalid" };
  }
  const used = await db.recoveryCode.updateMany({ where: { id: match.id, usedAt: null }, data: { usedAt: meta.now ?? new Date() } });
  if (used.count !== 1) return { status: "invalid" };
  await clearFailures(key);
  return { status: "ok", token: await completeMfa(token, admin.id, meta, "auth.login_recovery_code") };
}

/** Step 1 of enrolment: create (or re-show) a pending secret. Only for admins without 2FA. */
export async function startEnrolment(token: string | undefined, meta: ReqMeta) {
  const s = await preMfa(token, meta);
  if (!s) return null;
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: s.admin.id } });
  if (admin.totpEnabled) return null;
  let secret = admin.totpSecretEnc ? decrypt(admin.totpSecretEnc) : null;
  if (!secret) {
    secret = newTotpSecret();
    await db.adminUser.update({ where: { id: admin.id }, data: { totpSecretEnc: encrypt(secret), totpLastStep: null } });
  }
  const { dataUrl } = await totpQr(secret, admin.email);
  return { qrDataUrl: dataUrl, manualKey: secret.replace(/(.{4})/g, "$1 ").trim() };
}

export type EnrolResult = { status: "invalid" } | { status: "no_session" } | { status: "ok"; token: string; recoveryCodes: string[] };

/** Step 2: verify a code against the pending secret, enable 2FA, issue 10 recovery codes (shown once). */
export async function confirmEnrolment(token: string | undefined, code: string, meta: ReqMeta): Promise<EnrolResult> {
  const s = await preMfa(token, meta);
  if (!s || !token) return { status: "no_session" };
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: s.admin.id } });
  if (admin.totpEnabled || !admin.totpSecretEnc) return { status: "no_session" };
  const epoch = meta.now ? Math.floor(meta.now.getTime() / 1000) : undefined;
  const r = await checkTotp(decrypt(admin.totpSecretEnc), code, null, epoch);
  if (!r.ok) return { status: "invalid" }; // AUTH-02: nothing saved

  const codes = generateRecoveryCodes(10);
  await db.$transaction(async (tx) => {
    await tx.recoveryCode.deleteMany({ where: { adminId: admin.id } });
    await tx.recoveryCode.createMany({ data: codes.map((c) => ({ adminId: admin.id, codeHash: hashRecoveryCode(c) })) });
    await tx.adminUser.update({ where: { id: admin.id }, data: { totpEnabled: true, totpLastStep: r.step } });
    await audit(tx, { actorId: admin.id, action: "auth.2fa_enrolled", entity: "admin_user", entityId: admin.id, ip: meta.ip, userAgent: meta.userAgent });
  });
  const newToken = await completeMfa(token, admin.id, meta, "auth.login");
  return { status: "ok", token: newToken, recoveryCodes: codes };
}

/** Regenerate recovery codes for a fully signed-in admin (requires a current TOTP code). */
export async function regenerateRecoveryCodes(adminId: string, code: string, meta: ReqMeta): Promise<string[] | null> {
  const admin = await db.adminUser.findUniqueOrThrow({ where: { id: adminId } });
  if (!admin.totpSecretEnc) return null;
  const r = await checkTotp(decrypt(admin.totpSecretEnc), code, admin.totpLastStep);
  if (!r.ok) return null;
  const codes = generateRecoveryCodes(10);
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { totpLastStep: r.step } });
    await tx.recoveryCode.deleteMany({ where: { adminId } });
    await tx.recoveryCode.createMany({ data: codes.map((c) => ({ adminId, codeHash: hashRecoveryCode(c) })) });
    await audit(tx, { actorId: adminId, action: "auth.recovery_codes_regenerated", entity: "admin_user", entityId: adminId, ip: meta.ip, userAgent: meta.userAgent });
  });
  return codes;
}
