import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { DAY_MS, dueDate, endDate, totalWeeks, weekGrid } from "@/lib/internship";
import { programSchema } from "@/lib/validation/internship";
import { audit, auditMany } from "./audit";
import type { SessionAdmin } from "./auth/session";
import { HttpError } from "./http";
import { checkReportFile } from "./report-file";

// International internship programs, assignments and weekly reports (INT-1..3).
type Meta = { ip?: string; userAgent?: string | null };
const ACTIVE = ["ASSIGNED", "COMPLETED"];
const day = (iso: string | null | undefined) => (iso ? new Date(iso + "T00:00:00Z") : null);

async function nextCode(year: number) {
  const n = await db.internshipProgram.count({ where: { code: { startsWith: `INT-${year}-` } } });
  return `INT-${year}-${String(n + 1).padStart(3, "0")}`;
}

export async function createProgram(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = programSchema.parse(raw);
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await nextCode(new Date().getUTCFullYear());
    try {
      return await db.$transaction(async (tx) => {
        const p = await tx.internshipProgram.create({ data: { ...d, startDate: day(d.startDate), code, createdById: actor.id } });
        await audit(tx, { actorId: actor.id, action: "internship.create", entity: "internship_program", entityId: p.id, after: { code, ...d }, ip: meta.ip, userAgent: meta.userAgent });
        return p;
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // code race: retry
    }
  }
  throw new HttpError(409, "Couldn't create the program. Try again.");
}

export async function updateProgram(id: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const before = await db.internshipProgram.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Program not found");
  const d = programSchema.parse(raw);
  const active = await db.internshipAssignment.count({ where: { programId: id, status: { in: ACTIVE } } });
  if (d.seats < active) throw new HttpError(400, `${active} students are already assigned. Withdraw some before reducing resources to ${d.seats}.`, { fields: { seats: `At least ${active}` } });
  await db.$transaction(async (tx) => {
    await tx.internshipProgram.update({ where: { id }, data: { ...d, startDate: day(d.startDate) } });
    await audit(tx, { actorId: actor.id, action: "internship.update", entity: "internship_program", entityId: id, before: { status: before.status, seats: before.seats, startDate: before.startDate }, after: d, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function listPrograms(status?: string) {
  const programs = await db.internshipProgram.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }],
    include: { assignments: { where: { status: { in: ACTIVE } }, select: { id: true, reports: { select: { weekNo: true, status: true, late: true } } } } },
  });
  const now = new Date();
  return programs.map((p) => {
    const weeks = totalWeeks(p.durationValue, p.durationUnit);
    const grids = p.assignments.map((a) => weekGrid(p.startDate, weeks, a.reports, now));
    const elapsed = grids[0]?.elapsed ?? 0;
    const expected = elapsed * p.assignments.length;
    const attended = grids.reduce((n, g) => n + g.cells.filter((c) => c.weekNo <= elapsed && (c.state === "accepted" || c.state === "submitted")).length, 0);
    const pending = p.assignments.reduce((n, a) => n + a.reports.filter((r) => r.status === "SUBMITTED").length, 0);
    return {
      id: p.id, code: p.code, companyName: p.companyName, title: p.title, country: p.country, city: p.city, workMode: p.workMode, status: p.status,
      seats: p.seats, assigned: p.assignments.length, weeks, durationValue: p.durationValue, durationUnit: p.durationUnit,
      startDate: p.startDate?.toISOString().slice(0, 10) ?? null, endDate: p.startDate ? endDate(p.startDate, p.durationValue, p.durationUnit).toISOString().slice(0, 10) : null,
      compliance: expected ? Math.round((attended / expected) * 100) : null, pendingReviews: pending,
    };
  });
}

/** Full program for admins: details + assignment × week grid. */
export async function getProgram(id: string) {
  const p = await db.internshipProgram.findUnique({
    where: { id },
    include: {
      assignments: {
        orderBy: { assignedAt: "asc" },
        include: {
          student: { select: { id: true, studentCode: true, fullName: true, email: true, institution: { select: { name: true } }, batch: { select: { batchCode: true } }, portalUser: { select: { id: true } } } },
          reports: { select: { id: true, weekNo: true, status: true, late: true, fileName: true, fileType: true, sizeBytes: true, note: true, submittedAt: true, reviewNote: true, reviewedAt: true } },
        },
      },
    },
  });
  if (!p) throw new HttpError(404, "Program not found");
  const weeks = totalWeeks(p.durationValue, p.durationUnit);
  const now = new Date();
  return {
    program: {
      id: p.id, code: p.code, companyName: p.companyName, title: p.title, description: p.description, country: p.country, city: p.city, workMode: p.workMode,
      seats: p.seats, durationValue: p.durationValue, durationUnit: p.durationUnit, status: p.status, weeks,
      startDate: p.startDate?.toISOString().slice(0, 10) ?? null, endDate: p.startDate ? endDate(p.startDate, p.durationValue, p.durationUnit).toISOString().slice(0, 10) : null,
    },
    assignments: p.assignments.map((a) => ({
      id: a.id, status: a.status, assignedAt: a.assignedAt.toISOString(),
      student: { id: a.student.id, studentCode: a.student.studentCode, fullName: a.student.fullName, email: a.student.email, institution: a.student.institution.name, batch: a.student.batch.batchCode, activated: !!a.student.portalUser },
      grid: weekGrid(p.startDate, weeks, a.reports, now),
      reports: a.reports.map((r) => ({ ...r, submittedAt: r.submittedAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() ?? null })),
    })),
  };
}
export type ProgramDetail = Awaited<ReturnType<typeof getProgram>>;

export async function assignStudents(programId: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const { studentIds } = z.object({ studentIds: z.array(z.string().uuid()).min(1).max(500) }).parse(raw);
  const p = await db.internshipProgram.findUnique({ where: { id: programId } });
  if (!p) throw new HttpError(404, "Program not found");
  if (p.status === "CANCELLED" || p.status === "COMPLETED") throw new HttpError(400, `This program is ${p.status.toLowerCase()}. Students can't be assigned.`);
  const ids = [...new Set(studentIds)];
  const students = await db.student.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
  if (students.length !== ids.length) throw new HttpError(400, "Some students weren't found");
  const existing = await db.internshipAssignment.findMany({ where: { programId, studentId: { in: ids } } });
  const already = new Set(existing.filter((e) => ACTIVE.includes(e.status)).map((e) => e.studentId));
  const toAdd = ids.filter((id) => !already.has(id));
  const active = await db.internshipAssignment.count({ where: { programId, status: { in: ACTIVE } } });
  if (active + toAdd.length > p.seats) throw new HttpError(400, `Only ${p.seats - active} seat(s) left in this program (${p.seats} resources).`, { seatsLeft: p.seats - active });
  await db.$transaction(async (tx) => {
    for (const sid of toAdd) {
      await tx.internshipAssignment.upsert({
        where: { programId_studentId: { programId, studentId: sid } },
        create: { programId, studentId: sid, assignedById: actor.id },
        update: { status: "ASSIGNED", assignedById: actor.id, assignedAt: new Date() },
      });
    }
    await auditMany(tx, toAdd.map((sid) => ({ actorId: actor.id, action: "internship.assign", entity: "student", entityId: sid, after: { programId, code: p.code }, ip: meta.ip, userAgent: meta.userAgent })));
  });
  return { assigned: toAdd.length, alreadyAssigned: already.size };
}

export async function withdrawAssignment(assignmentId: string, reason: string | undefined, actor: SessionAdmin, meta: Meta) {
  const a = await db.internshipAssignment.findUnique({ where: { id: assignmentId } });
  if (!a) throw new HttpError(404, "Assignment not found");
  await db.$transaction(async (tx) => {
    await tx.internshipAssignment.update({ where: { id: assignmentId }, data: { status: "WITHDRAWN" } });
    await audit(tx, { actorId: actor.id, action: "internship.withdraw", entity: "student", entityId: a.studentId, after: { programId: a.programId }, reason: reason?.slice(0, 300) ?? null, ip: meta.ip, userAgent: meta.userAgent });
  });
}

// ── Student side ──

export async function studentPrograms(studentId: string) {
  const list = await db.internshipAssignment.findMany({
    where: { studentId, status: { in: ACTIVE }, program: { status: { notIn: ["DRAFT", "CANCELLED"] } } },
    include: { program: true, reports: { select: { id: true, weekNo: true, status: true, late: true, fileName: true, sizeBytes: true, note: true, submittedAt: true, reviewNote: true } } },
    orderBy: { assignedAt: "desc" },
  });
  const now = new Date();
  return list.map((a) => {
    const p = a.program;
    const weeks = totalWeeks(p.durationValue, p.durationUnit);
    return {
      assignmentId: a.id,
      program: {
        code: p.code, companyName: p.companyName, title: p.title, description: p.description, country: p.country, city: p.city, workMode: p.workMode, status: p.status,
        durationValue: p.durationValue, durationUnit: p.durationUnit, weeks, startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: p.startDate ? endDate(p.startDate, p.durationValue, p.durationUnit).toISOString().slice(0, 10) : null,
      },
      grid: weekGrid(p.startDate, weeks, a.reports, now),
      reports: a.reports.map((r) => ({ ...r, submittedAt: r.submittedAt.toISOString() })),
      openWeeks: p.startDate ? Array.from({ length: weeks }, (_, i) => i + 1).filter((w) => p.startDate!.getTime() + (w - 1) * 7 * DAY_MS <= now.getTime()) : [],
    };
  });
}
export type StudentProgram = Awaited<ReturnType<typeof studentPrograms>>[number];

export async function submitReport(studentId: string, assignmentId: string, input: { weekNo: number; note?: string; file: { name: string; buffer: Buffer } }, actorId: string, meta: Meta) {
  const a = await db.internshipAssignment.findFirst({ where: { id: assignmentId, studentId }, include: { program: true } });
  if (!a || !ACTIVE.includes(a.status)) throw new HttpError(404, "Internship not found"); // also blocks other students' assignments
  const p = a.program;
  if (p.status === "DRAFT" || p.status === "CANCELLED") throw new HttpError(400, "This program isn't running.");
  if (!p.startDate) throw new HttpError(400, "The program start date isn't set yet. Ask your coordinator.");
  const weeks = totalWeeks(p.durationValue, p.durationUnit);
  const w = Number(input.weekNo);
  if (!Number.isInteger(w) || w < 1 || w > weeks) throw new HttpError(400, `Choose a week between 1 and ${weeks}`);
  const now = new Date();
  if (p.startDate.getTime() + (w - 1) * 7 * DAY_MS > now.getTime()) throw new HttpError(400, `Week ${w} hasn't started yet.`);
  const fileType = checkReportFile(input.file.name, input.file.buffer);
  const existing = await db.weeklyReport.findUnique({ where: { assignmentId_weekNo: { assignmentId, weekNo: w } } });
  if (existing?.status === "ACCEPTED") throw new HttpError(409, `Week ${w}'s report was already accepted.`);
  const note = input.note ? String(input.note).trim().slice(0, 1000) || null : null;
  const fileName = input.file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const late = now > dueDate(p.startDate, w);
  const data = { fileName, fileType, sizeBytes: input.file.buffer.length, data: new Uint8Array(input.file.buffer), note, status: "SUBMITTED", submittedAt: now, late, reviewNote: null, reviewedById: null, reviewedAt: null };
  await db.$transaction(async (tx) => {
    await tx.weeklyReport.upsert({ where: { assignmentId_weekNo: { assignmentId, weekNo: w } }, create: { assignmentId, weekNo: w, ...data }, update: data });
    await audit(tx, { actorId, action: existing ? "internship.report_resubmit" : "internship.report_submit", entity: "student", entityId: studentId, after: { programId: p.id, weekNo: w, fileName, fileType, late }, ip: meta.ip, userAgent: meta.userAgent });
  });
  return { weekNo: w, late };
}

export async function reviewReport(reportId: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = z.object({ status: z.enum(["ACCEPTED", "NEEDS_REVISION"]), note: z.string().max(1000).optional() }).parse(raw);
  if (d.status === "NEEDS_REVISION" && !d.note?.trim()) throw new HttpError(400, "Tell the student what to fix", { fields: { note: "Required for Needs revision" } });
  const r = await db.weeklyReport.findUnique({ where: { id: reportId }, include: { assignment: true } });
  if (!r) throw new HttpError(404, "Report not found");
  await db.$transaction(async (tx) => {
    await tx.weeklyReport.update({ where: { id: reportId }, data: { status: d.status, reviewNote: d.note?.trim() || null, reviewedById: actor.id, reviewedAt: new Date() } });
    await audit(tx, { actorId: actor.id, action: "internship.report_review", entity: "student", entityId: r.assignment.studentId, after: { weekNo: r.weekNo, status: d.status }, reason: d.note ?? null, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** File download: admins any report (audited); students only their own. */
export async function reportFile(reportId: string, who: { adminId?: string; studentId?: string }, meta: Meta) {
  const r = await db.weeklyReport.findUnique({ where: { id: reportId }, include: { assignment: { select: { studentId: true } } } });
  if (!r || (who.studentId && r.assignment.studentId !== who.studentId)) throw new HttpError(404, "Report not found");
  if (who.adminId) await audit(db, { actorId: who.adminId, action: "internship.report_download", entity: "student", entityId: r.assignment.studentId, after: { reportId, weekNo: r.weekNo }, ip: meta.ip, userAgent: meta.userAgent });
  return r;
}

/** Candidate students for assignment (search by name/email/code; profile % shown). */
export async function assignCandidates(programId: string, q: string) {
  const term = q.trim().replace(/[\\%_]/g, (c) => "\\" + c);
  const assigned = new Set((await db.internshipAssignment.findMany({ where: { programId, status: { in: ACTIVE } }, select: { studentId: true } })).map((a) => a.studentId));
  const rows = await db.student.findMany({
    where: { deletedAt: null, ...(term ? { OR: [{ fullName: { contains: term, mode: "insensitive" } }, { email: { contains: term.toLowerCase() } }, { studentCode: { contains: term, mode: "insensitive" } }] } : {}) },
    orderBy: { fullName: "asc" },
    take: 50,
    select: { id: true, studentCode: true, fullName: true, institution: { select: { name: true } }, batch: { select: { batchCode: true } }, portalUser: { select: { id: true } } },
  });
  return rows.map((r) => ({ id: r.id, studentCode: r.studentCode, fullName: r.fullName, institution: r.institution.name, batch: r.batch.batchCode, activated: !!r.portalUser, assigned: assigned.has(r.id) }));
}
