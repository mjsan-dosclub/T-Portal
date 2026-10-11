import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { cleanText, normalizeEmail } from "@/lib/normalize";
import { audit } from "./audit";
import { sha256Hex } from "./auth/crypto";
import { hashPassword, passwordProblem, verifyPassword } from "./auth/password";
import type { SessionAdmin } from "./auth/session";
import { HttpError } from "./http";

type Meta = { ip?: string; userAgent?: string | null };

export const inviteSchema = z.object({
  email: z.preprocess((v) => normalizeEmail(v), z.email({ error: "Enter a valid email" })),
  name: z.preprocess((v) => cleanText(v), z.string().min(2, "Name is required").max(100)),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]),
  canExport: z.boolean().optional(),
});

export const updateAdminSchema = z.object({
  name: z.preprocess((v) => cleanText(v), z.string().min(2).max(100)).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
  canExport: z.boolean().optional(),
});

function tempPassword() {
  return randomBytes(12).toString("base64url"); // 16 chars
}

export async function listAdmins() {
  const rows = await db.adminUser.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return rows.map((a) => ({
    id: a.id, email: a.email, name: a.name, role: a.role, isActive: a.isActive, totpEnabled: a.totpEnabled, canExport: a.canExport,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null, lockedUntil: a.lockedUntil?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
  }));
}

/** FR-AUTH-7: no public sign-up. Super Admin creates the account; a one-time password is shown once. */
export async function inviteAdmin(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = inviteSchema.parse(raw);
  if (await db.adminUser.findUnique({ where: { email: d.email } })) throw new HttpError(409, "An admin with this email already exists", { fields: { email: "Already exists" } });
  const password = tempPassword();
  const admin = await db.adminUser.create({ data: { email: d.email, name: d.name, role: d.role, canExport: d.canExport ?? false, passwordHash: await hashPassword(password) } });
  await audit(db, { actorId: actor.id, action: "admin.invite", entity: "admin_user", entityId: admin.id, after: { role: d.role, canExport: d.canExport ?? false }, ip: meta.ip, userAgent: meta.userAgent });
  return { id: admin.id, oneTimePassword: password };
}

async function assertOtherSuperAdmin(exceptId: string) {
  const n = await db.adminUser.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: exceptId } } });
  if (n === 0) throw new HttpError(400, "There must always be at least one active Super Admin");
}

export async function updateAdmin(id: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = updateAdminSchema.parse(raw);
  const before = await db.adminUser.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Admin not found");
  if (id === actor.id && (d.role && d.role !== before.role || d.isActive === false)) throw new HttpError(400, "You can't change your own role or deactivate yourself");
  if (before.role === "SUPER_ADMIN" && ((d.role && d.role !== "SUPER_ADMIN") || d.isActive === false)) await assertOtherSuperAdmin(id);
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data: d });
    if (d.isActive === false || (d.role && d.role !== before.role)) await tx.session.deleteMany({ where: { adminId: id } });
    await audit(tx, { actorId: actor.id, action: "admin.update", entity: "admin_user", entityId: id, before: { name: before.name, role: before.role, isActive: before.isActive, canExport: before.canExport }, after: d, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** AUTH-13: target must re-enrol on next sign-in; all their sessions end. */
export async function resetTwoFactor(id: string, actor: SessionAdmin, meta: Meta, reason?: string) {
  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "Admin not found");
  if (id === actor.id) throw new HttpError(400, "Use Account → Two-factor to manage your own authenticator");
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data: { totpEnabled: false, totpSecretEnc: null, totpLastStep: null } });
    await tx.recoveryCode.deleteMany({ where: { adminId: id } });
    await tx.session.deleteMany({ where: { adminId: id } });
    await audit(tx, { actorId: actor.id, action: "admin.reset_2fa", entity: "admin_user", entityId: id, reason: reason?.slice(0, 500) ?? null, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function resetPassword(id: string, actor: SessionAdmin, meta: Meta) {
  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "Admin not found");
  const password = tempPassword();
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password), failedAttempts: 0 } });
    await tx.session.deleteMany({ where: { adminId: id } });
    await tx.rateLimit.deleteMany({ where: { key: { startsWith: `login:${sha256Hex(target.email)}:` } } }); // unlock this admin only
    await audit(tx, { actorId: actor.id, action: "admin.reset_password", entity: "admin_user", entityId: id, ip: meta.ip, userAgent: meta.userAgent });
  });
  return { oneTimePassword: password };
}

export async function changeOwnPassword(actor: SessionAdmin, current: string, next: string, meta: Meta) {
  const me = await db.adminUser.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(me.passwordHash, current))) throw new HttpError(400, "Current password is incorrect", { fields: { current: "Incorrect" } });
  const problem = passwordProblem(next);
  if (problem) throw new HttpError(400, problem, { fields: { next: problem } });
  await db.adminUser.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(db, { actorId: actor.id, action: "auth.password_changed", entity: "admin_user", entityId: actor.id, ip: meta.ip, userAgent: meta.userAgent });
}
