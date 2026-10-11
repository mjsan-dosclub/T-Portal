import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** Dashboard counts (PRD §5.6). Aggregates only, no PII rows (DSH-02). */
export async function dashboardStats() {
  const live = { deletedAt: null };
  const [total, activeCount, byBatch, byInstitution, byStatus, recentUploads, recentActivity, batches, institutions, statuses] = await Promise.all([
    db.student.count({ where: live }),
    db.student.count({ where: { ...live, status: { isActiveState: true } } }),
    db.student.groupBy({ by: ["batchId"], where: live, _count: true }),
    db.student.groupBy({ by: ["institutionId"], where: live, _count: true }),
    db.student.groupBy({ by: ["statusId"], where: live, _count: true }),
    db.uploadJob.findMany({ where: { kind: "students" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, fileName: true, status: true, total: true, imported: true, createdAt: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, entity: true, createdAt: true, actorId: true } }),
    db.batch.findMany({ select: { id: true, batchCode: true } }),
    db.institution.findMany({ select: { id: true, name: true } }),
    db.studentStatus.findMany({ select: { id: true, name: true, color: true } }),
  ]);
  const actors = await db.adminUser.findMany({ where: { id: { in: recentActivity.map((a) => a.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = new Map(actors.map((a) => [a.id, a.name]));
  const label = <T extends { id: string }>(rows: T[], key: keyof T) => new Map(rows.map((r) => [r.id, String(r[key])]));
  const bl = label(batches, "batchCode");
  const il = label(institutions, "name");
  const sl = new Map(statuses.map((s) => [s.id, s]));
  return {
    total,
    active: activeCount,
    byBatch: byBatch.map((b) => ({ label: bl.get(b.batchId) ?? "?", count: b._count })).sort((a, b) => b.count - a.count),
    byInstitution: byInstitution.map((b) => ({ label: il.get(b.institutionId) ?? "?", count: b._count })).sort((a, b) => b.count - a.count),
    byStatus: byStatus.map((b) => ({ label: sl.get(b.statusId)?.name ?? "?", color: sl.get(b.statusId)?.color ?? null, count: b._count })).sort((a, b) => b.count - a.count),
    recentUploads: recentUploads.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    recentActivity: recentActivity.map((a) => ({ id: a.id.toString(), action: a.action, entity: a.entity, createdAt: a.createdAt.toISOString(), actor: a.actorId ? (a.actorId.startsWith("student:") ? "Student (self-service)" : (nameOf.get(a.actorId) ?? "Unknown")) : "System" })),
  };
}

export type AuditFilter = { actorId?: string; entity?: string; action?: string; from?: string; to?: string; page?: number };

export async function queryAudit(f: AuditFilter) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: new Date(f.from + "T00:00:00Z") } : {}), ...(f.to ? { lte: new Date(f.to + "T23:59:59Z") } : {}) } } : {}),
  };
  const pageSize = 50;
  const page = Math.max(1, f.page ?? 1);
  const [total, rows, actors, entities] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.adminUser.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  const nameOf = new Map(actors.map((a) => [a.id, a.name]));
  return {
    total,
    page,
    pageSize,
    actors,
    entities: entities.map((e) => e.entity),
    rows: rows.map((r) => ({
      id: r.id.toString(), actor: r.actorId ? (r.actorId.startsWith("student:") ? "Student (self-service)" : (nameOf.get(r.actorId) ?? r.actorId)) : "System", action: r.action, entity: r.entity, entityId: r.entityId,
      before: r.before, after: r.after, reason: r.reason, ip: r.ip, userAgent: r.userAgent, createdAt: r.createdAt.toISOString(),
    })),
  };
}
