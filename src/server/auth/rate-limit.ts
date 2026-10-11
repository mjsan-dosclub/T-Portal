import "server-only";
import { db } from "@/lib/db";

export const MAX_FAILURES = 5; // FR-AUTH-5
export const LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

export async function isLocked(key: string, now = new Date()): Promise<boolean> {
  const r = await db.rateLimit.findUnique({ where: { key } });
  return !!r?.lockedUntil && r.lockedUntil > now;
}

/** Records a failure; returns true if this failure triggered a lock. */
export async function recordFailure(key: string, now = new Date()): Promise<boolean> {
  const r = await db.rateLimit.findUnique({ where: { key } });
  const fresh = !r || now.getTime() - r.windowStart.getTime() > WINDOW_MS || (r.lockedUntil && r.lockedUntil <= now);
  const count = fresh ? 1 : r.count + 1;
  const lock = count >= MAX_FAILURES;
  await db.rateLimit.upsert({
    where: { key },
    create: { key, count, windowStart: now, lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : null },
    update: {
      count: lock ? 0 : count,
      windowStart: fresh ? now : undefined,
      lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : fresh ? null : undefined,
    },
  });
  return lock;
}

export async function clearFailures(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Simple fixed-window limiter for non-login endpoints (SEC-09). */
export async function hit(key: string, limit: number, windowMs: number, now = new Date()): Promise<boolean> {
  const r = await db.rateLimit.findUnique({ where: { key } });
  if (!r || now.getTime() - r.windowStart.getTime() > windowMs) {
    await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, windowStart: now }, update: { count: 1, windowStart: now, lockedUntil: null } });
    return true;
  }
  if (r.count >= limit) return false;
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}
