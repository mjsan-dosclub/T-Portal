import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/normalize";
import { auditMany } from "./audit";
import type { SessionAdmin } from "./auth/session";
import { HttpError } from "./http";

// Workshop attendance (ATT-1): per batch × workshop day (1–27).
type Meta = { ip?: string; userAgent?: string | null };
export const STATUSES = ["PRESENT", "ABSENT", "EXCUSED"] as const;

export const sheetSchema = z.object({
  batchId: z.string().uuid(),
  workshopN: z.coerce.number().int().min(1).max(99),
  heldOn: z.string().max(20).nullable().optional(),
  marks: z.array(z.object({ studentId: z.string().uuid(), status: z.enum(STATUSES).nullable() })).max(5000),
});

/** Students in a batch with their status for one workshop day. */
export async function attendanceSheet(batchId: string, workshopN: number) {
  const [batch, workshop, session, students] = await Promise.all([
    db.batch.findUnique({ where: { id: batchId }, select: { id: true, batchCode: true } }),
    db.ontWorkshop.findUnique({ where: { n: workshopN } }),
    db.workshopSession.findUnique({ where: { batchId_workshopN: { batchId, workshopN } } }),
    db.student.findMany({
      where: { batchId, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, studentCode: true, fullName: true, institution: { select: { name: true } }, attendance: { where: { workshopN }, select: { status: true } } },
    }),
  ]);
  if (!batch || !workshop) throw new HttpError(404, "Batch or workshop not found");
  return {
    batch,
    workshop: { n: workshop.n, title: workshop.title, roleText: workshop.roleText },
    heldOn: session?.heldOn?.toISOString().slice(0, 10) ?? null,
    students: students.map((s) => ({ id: s.id, studentCode: s.studentCode, fullName: s.fullName, institution: s.institution.name, status: s.attendance[0]?.status ?? null })),
  };
}

/** Save a sheet. Only students of that batch can be marked; null status clears a mark. Audited per changed student. */
export async function saveSheet(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = sheetSchema.parse(raw);
  if (!(await db.ontWorkshop.findUnique({ where: { n: d.workshopN } }))) throw new HttpError(404, "Workshop not found");
  if (!(await db.batch.findUnique({ where: { id: d.batchId } }))) throw new HttpError(404, "Batch not found");
  let heldOn: Date | null = null;
  if (d.heldOn) {
    const p = parseDateInput(d.heldOn);
    if (!p || !p.ok) throw new HttpError(400, "Session date is not valid", { fields: { heldOn: "Use YYYY-MM-DD" } });
    heldOn = new Date(p.iso + "T00:00:00Z");
  }
  const ids = [...new Set(d.marks.map((m) => m.studentId))];
  const inBatch = new Set((await db.student.findMany({ where: { id: { in: ids }, batchId: d.batchId, deletedAt: null }, select: { id: true } })).map((s) => s.id));
  const outside = ids.filter((id) => !inBatch.has(id));
  if (outside.length) throw new HttpError(400, `${outside.length} student(s) are not in this batch`);
  const before = new Map((await db.attendance.findMany({ where: { workshopN: d.workshopN, studentId: { in: ids } } })).map((a) => [a.studentId, a.status]));
  const changed = d.marks.filter((m) => (before.get(m.studentId) ?? null) !== m.status);
  await db.$transaction(
    async (tx) => {
      await tx.workshopSession.upsert({
        where: { batchId_workshopN: { batchId: d.batchId, workshopN: d.workshopN } },
        create: { batchId: d.batchId, workshopN: d.workshopN, heldOn, updatedById: actor.id },
        update: { heldOn, updatedById: actor.id },
      });
      for (const m of changed) {
        if (m.status === null) await tx.attendance.deleteMany({ where: { studentId: m.studentId, workshopN: d.workshopN } });
        else
          await tx.attendance.upsert({
            where: { studentId_workshopN: { studentId: m.studentId, workshopN: d.workshopN } },
            create: { studentId: m.studentId, workshopN: d.workshopN, status: m.status, markedById: actor.id },
            update: { status: m.status, markedById: actor.id, markedAt: new Date() },
          });
      }
      await auditMany(
        tx,
        changed.map((m) => ({ actorId: actor.id, action: "attendance.mark", entity: "student", entityId: m.studentId, before: { workshop: d.workshopN, status: before.get(m.studentId) ?? null }, after: { workshop: d.workshopN, status: m.status }, ip: meta.ip, userAgent: meta.userAgent })),
      );
    },
    { timeout: 60_000 },
  );
  return { changed: changed.length };
}

/** Per-workshop counts for a batch (attendance page overview). */
export async function batchOverview(batchId: string) {
  const [workshops, sessions, counts, size] = await Promise.all([
    db.ontWorkshop.findMany({ orderBy: { n: "asc" } }),
    db.workshopSession.findMany({ where: { batchId } }),
    db.attendance.groupBy({ by: ["workshopN", "status"], where: { student: { batchId, deletedAt: null } }, _count: true }),
    db.student.count({ where: { batchId, deletedAt: null } }),
  ]);
  const held = new Map(sessions.map((s) => [s.workshopN, s.heldOn?.toISOString().slice(0, 10) ?? "date not set"]));
  return {
    size,
    workshops: workshops.map((w) => {
      const c = (st: string) => counts.find((x) => x.workshopN === w.n && x.status === st)?._count ?? 0;
      return { n: w.n, title: w.title, held: held.get(w.n) ?? null, present: c("PRESENT"), absent: c("ABSENT"), excused: c("EXCUSED") };
    }),
  };
}

/** A student's own attendance (student portal + admin profile). Attendance % = present ÷ (held sessions − excused). */
export async function studentAttendance(studentId: string) {
  const s = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { batchId: true } });
  const [workshops, sessions, marks] = await Promise.all([
    db.ontWorkshop.findMany({ orderBy: { n: "asc" } }),
    db.workshopSession.findMany({ where: { batchId: s.batchId } }),
    db.attendance.findMany({ where: { studentId } }),
  ]);
  const heldSet = new Set(sessions.map((x) => x.workshopN));
  const byN = new Map(marks.map((m) => [m.workshopN, m.status]));
  const rows = workshops.map((w) => ({ n: w.n, title: w.title, roleText: w.roleText, held: heldSet.has(w.n), status: byN.get(w.n) ?? null }));
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const excused = rows.filter((r) => r.status === "EXCUSED").length;
  const counted = Math.max(0, heldSet.size - excused);
  return { rows, present, held: heldSet.size, total: workshops.length, pct: counted ? Math.round((present / counted) * 100) : null };
}
