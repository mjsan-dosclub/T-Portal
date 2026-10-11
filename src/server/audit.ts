import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

type Tx = Pick<typeof db, "auditLog">;

function json(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val)));
}

export async function audit(tx: Tx, e: AuditEntry) {
  await tx.auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      before: json(e.before),
      after: json(e.after),
      reason: e.reason ?? null,
      ip: e.ip ?? null,
      userAgent: e.userAgent ? e.userAgent.slice(0, 300) : null,
    },
  });
}

export async function auditMany(tx: Pick<typeof db, "auditLog">, entries: AuditEntry[]) {
  if (!entries.length) return;
  await tx.auditLog.createMany({
    data: entries.map((e) => ({
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      before: json(e.before),
      after: json(e.after),
      reason: e.reason ?? null,
      ip: e.ip ?? null,
      userAgent: e.userAgent ? e.userAgent.slice(0, 300) : null,
    })),
  });
}
