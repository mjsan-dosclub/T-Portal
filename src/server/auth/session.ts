import "server-only";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "./crypto";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "dos_session";
export const ABSOLUTE_MS = 8 * 60 * 60 * 1000; // FR-AUTH-6
export const IDLE_MS = 30 * 60 * 1000; // FR-AUTH-6
export const PRE_MFA_MS = 10 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;

export type SessionAdmin = {
  id: string;
  email: string;
  name: string;
  role: Role;
  totpEnabled: boolean;
  canExport: boolean;
};

export type ResolvedSession = {
  sessionId: string;
  mfaPassed: boolean;
  admin: SessionAdmin;
};

export async function createSession(adminId: string, opts: { mfaPassed: boolean; ip?: string | null; userAgent?: string | null; now?: Date }) {
  const now = opts.now ?? new Date();
  const token = randomToken();
  await db.session.create({
    data: {
      id: sha256Hex(token),
      adminId,
      mfaPassed: opts.mfaPassed,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + (opts.mfaPassed ? ABSOLUTE_MS : PRE_MFA_MS)),
      ip: opts.ip ?? null,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
    },
  });
  return token;
}

/** Validates absolute + idle expiry and that the admin is still active. Touches lastSeenAt. */
export async function resolveSession(token: string | undefined | null, now = new Date()): Promise<ResolvedSession | null> {
  if (!token || token.length > 200) return null;
  const id = sha256Hex(token);
  const s = await db.session.findUnique({
    where: { id },
    include: { admin: { select: { id: true, email: true, name: true, role: true, totpEnabled: true, canExport: true, isActive: true } } },
  });
  if (!s) return null;
  const idleExpired = now.getTime() - s.lastSeenAt.getTime() > IDLE_MS;
  if (s.expiresAt <= now || idleExpired || !s.admin.isActive) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (now.getTime() - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.session.update({ where: { id }, data: { lastSeenAt: now } });
  }
  const { isActive: _ignored, ...admin } = s.admin;
  void _ignored;
  return { sessionId: id, mfaPassed: s.mfaPassed, admin };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { id: sha256Hex(token) } });
}

export function sessionCookie(token: string, maxAgeMs = ABSOLUTE_MS): string {
  // Secure is accepted by browsers on http://localhost too, so it is always set (AUTH-04).
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function readCookie(header: string | null, name = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
