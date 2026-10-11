import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/normalize";
import { studentSchema, type Selection, type StudentData, type StudentFilter, type StudentQuery } from "@/lib/validation/student";
import { audit, auditMany } from "./audit";
import type { SessionAdmin } from "./auth/session";
import { HttpError } from "./http";

type Meta = { ip?: string; userAgent?: string | null };
type Tx = Prisma.TransactionClient;

export const UNDO_WINDOW_MS = 60_000; // UI toast is 10 s; server allows a little slack.
export const PURGE_AFTER_DAYS = 30; // D6
export const TYPE_DELETE_THRESHOLD = 10; // FR-STU-DEL

const listInclude = {
  institution: { select: { name: true } },
  department: { select: { name: true } },
  degree: { select: { name: true } },
  batch: { select: { batchCode: true } },
  status: { select: { name: true, color: true } },
  colourTeam: { select: { name: true } },
} satisfies Prisma.StudentInclude;

export function buildWhere(f: Partial<StudentFilter>): Prisma.StudentWhereInput {
  const and: Prisma.StudentWhereInput[] = [{ deletedAt: f.deleted ? { not: null } : null }];
  // Prisma's `contains` maps to LIKE without escaping, so % and _ would act as wildcards (SEC-02).
  const q = f.q?.trim().replace(/[\\%_]/g, (c) => "\\" + c);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.StudentWhereInput[] = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase() } },
      { studentCode: { contains: q, mode: "insensitive" } },
    ];
    if (digits.length >= 3) or.push({ phone: { contains: digits } });
    and.push({ OR: or });
  }
  if (f.institutionId?.length) and.push({ institutionId: { in: f.institutionId } });
  if (f.departmentId?.length) and.push({ departmentId: { in: f.departmentId } });
  if (f.degreeId?.length) and.push({ degreeId: { in: f.degreeId } });
  if (f.batchId?.length) and.push({ batchId: { in: f.batchId } });
  if (f.colourTeamId?.length) and.push({ colourTeamId: { in: f.colourTeamId } });
  if (f.statusId?.length) and.push({ statusId: { in: f.statusId } });
  if (f.graduationYear?.length) and.push({ graduationYear: { in: f.graduationYear } });
  return { AND: and };
}

function orderBy(sort: StudentQuery["sort"], dir: "asc" | "desc"): Prisma.StudentOrderByWithRelationInput[] {
  const by: Record<StudentQuery["sort"], Prisma.StudentOrderByWithRelationInput> = {
    studentCode: { studentCode: dir },
    fullName: { fullName: dir },
    email: { email: dir },
    phone: { phone: dir },
    institution: { institution: { name: dir } },
    department: { department: { name: dir } },
    degree: { degree: { name: dir } },
    batch: { batch: { batchCode: dir } },
    graduationYear: { graduationYear: dir },
    status: { status: { name: dir } },
    colourTeam: { colourTeam: { name: dir } },
    createdAt: { createdAt: dir },
    updatedAt: { updatedAt: dir },
  };
  return [by[sort], { id: "asc" }]; // stable tie-break so paging never repeats/skips rows (STU-07)
}

export type StudentRow = {
  id: string;
  studentCode: string;
  fullName: string;
  email: string;
  phone: string;
  institution: string;
  department: string;
  degree: string;
  batch: string;
  graduationYear: number;
  status: string;
  statusColor: string | null;
  colourTeam: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type ListRecord = Prisma.StudentGetPayload<{ include: typeof listInclude }>;
function toRow(s: ListRecord): StudentRow {
  return {
    id: s.id,
    studentCode: s.studentCode,
    fullName: s.fullName,
    email: s.email,
    phone: s.phone,
    institution: s.institution.name,
    department: s.department.name,
    degree: s.degree.name,
    batch: s.batch.batchCode,
    graduationYear: s.graduationYear,
    status: s.status.name,
    statusColor: s.status.color,
    colourTeam: s.colourTeam?.name ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    deletedAt: s.deletedAt?.toISOString() ?? null,
  };
}

export async function queryStudents(q: StudentQuery) {
  const where = buildWhere(q);
  const [total, records] = await Promise.all([
    db.student.count({ where }),
    db.student.findMany({ where, include: listInclude, orderBy: orderBy(q.sort, q.dir), skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, rows: records.map(toRow) };
}

const detailInclude = {
  ...listInclude,
  targetRole: { select: { id: true, name: true } },
} satisfies Prisma.StudentInclude;

export type StudentDetail = Awaited<ReturnType<typeof getStudent>>;

/** Deleted records are visible only to Super Admin (SEC-05). Notes are admin-only (PRD §5.3). */
export async function getStudent(id: string, viewer: SessionAdmin) {
  const s = await db.student.findUnique({ where: { id }, include: detailInclude });
  if (!s || (s.deletedAt && viewer.role !== "SUPER_ADMIN")) throw new HttpError(404, "Student not found");
  return {
    id: s.id,
    studentCode: s.studentCode,
    version: s.version,
    fullName: s.fullName,
    email: s.email,
    phone: s.phone,
    gender: s.gender,
    dateOfBirth: s.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    institutionId: s.institutionId,
    institution: s.institution.name,
    degreeId: s.degreeId,
    degree: s.degree.name,
    departmentId: s.departmentId,
    department: s.department.name,
    yearOfStudy: s.yearOfStudy,
    graduationYear: s.graduationYear,
    batchId: s.batchId,
    batch: s.batch.batchCode,
    colourTeamId: s.colourTeamId,
    colourTeam: s.colourTeam?.name ?? null,
    statusId: s.statusId,
    status: s.status.name,
    statusColor: s.status.color,
    city: s.city,
    state: s.state,
    linkedinUrl: s.linkedinUrl,
    githubUrl: s.githubUrl,
    notes: viewer.role === "VIEWER" ? null : s.notes,
    targetRoleId: s.targetRoleId,
    targetRole: s.targetRole?.name ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    deletedAt: s.deletedAt?.toISOString() ?? null,
  };
}

/** Masters must exist; new values must be active. Unchanged (already-linked) inactive values are allowed (MST-03). */
async function assertMasters(d: StudentData, existing?: Pick<StudentData, "institutionId" | "degreeId" | "departmentId" | "batchId" | "statusId"> & { colourTeamId?: string | null; targetRoleId?: string | null }) {
  const checks: [string, string | undefined, () => Promise<{ isActive: boolean } | null>, string | null | undefined][] = [
    ["institutionId", d.institutionId, () => db.institution.findUnique({ where: { id: d.institutionId }, select: { isActive: true } }), existing?.institutionId],
    ["degreeId", d.degreeId, () => db.degree.findUnique({ where: { id: d.degreeId }, select: { isActive: true } }), existing?.degreeId],
    ["departmentId", d.departmentId, () => db.department.findUnique({ where: { id: d.departmentId }, select: { isActive: true } }), existing?.departmentId],
    ["batchId", d.batchId, () => db.batch.findUnique({ where: { id: d.batchId }, select: { isActive: true } }), existing?.batchId],
    ["statusId", d.statusId, () => db.studentStatus.findUnique({ where: { id: d.statusId }, select: { isActive: true } }), existing?.statusId],
    ["colourTeamId", d.colourTeamId, () => db.colourTeam.findUnique({ where: { id: d.colourTeamId! }, select: { isActive: true } }), existing?.colourTeamId],
  ];
  const fields: Record<string, string> = {};
  for (const [field, value, load, prev] of checks) {
    if (!value) continue;
    const row = await load();
    if (!row) fields[field] = "Value no longer exists";
    else if (!row.isActive && value !== prev) fields[field] = "This value is inactive";
  }
  if (d.targetRoleId) {
    const role = await db.ontRole.findUnique({ where: { id: d.targetRoleId }, select: { id: true, isActive: true } });
    if (!role) fields.targetRoleId = "Unknown role";
    else if (!role.isActive && d.targetRoleId !== existing?.targetRoleId) fields.targetRoleId = "This role has been retired";
  }
  if (Object.keys(fields).length) throw new HttpError(400, "Some selections are not valid", { fields });
}

export async function findDuplicates(email: string | null, phone: string | null, exceptId?: string) {
  const or: Prisma.StudentWhereInput[] = [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])];
  if (!or.length) return [];
  const hits = await db.student.findMany({
    where: { OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, studentCode: true, email: true, phone: true, deletedAt: true },
  });
  return hits.map((h) => ({ id: h.id, studentCode: h.studentCode, field: h.email === email ? ("email" as const) : ("phone" as const), deleted: !!h.deletedAt }));
}

function duplicateError(dups: Awaited<ReturnType<typeof findDuplicates>>): never {
  const d = dups[0]!;
  const where = d.deleted ? " (in the Recycle Bin)" : "";
  throw new HttpError(409, `A student with this ${d.field} already exists: ${d.studentCode}${where}`, {
    duplicate: { id: d.id, studentCode: d.studentCode, field: d.field, deleted: d.deleted },
    fields: { [d.field]: `Already used by ${d.studentCode}` },
  });
}

/** DOS-{YYYY}-{00001}; YYYY = batch year (D13). Counter row is locked by the UPDATE inside the transaction. */
export async function nextStudentCode(tx: Tx, year: number): Promise<string> {
  const c = await tx.codeCounter.upsert({ where: { year }, create: { year, last: 1 }, update: { last: { increment: 1 } } });
  return `DOS-${year}-${String(c.last).padStart(5, "0")}`;
}

function dataFor(d: StudentData) {
  return {
    fullName: d.fullName,
    email: d.email,
    phone: d.phone,
    gender: d.gender ?? null,
    dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth + "T00:00:00Z") : null,
    institutionId: d.institutionId,
    degreeId: d.degreeId,
    departmentId: d.departmentId,
    yearOfStudy: d.yearOfStudy ?? null,
    graduationYear: d.graduationYear,
    batchId: d.batchId,
    colourTeamId: d.colourTeamId ?? null,
    statusId: d.statusId,
    city: d.city ?? null,
    state: d.state ?? null,
    linkedinUrl: d.linkedinUrl ?? null,
    githubUrl: d.githubUrl ?? null,
    notes: d.notes ?? null,
    targetRoleId: d.targetRoleId ?? null,
  };
}

export async function createStudentFromData(tx: Tx, d: StudentData, actorId: string, meta: Meta, action = "student.create") {
  const batch = await tx.batch.findUniqueOrThrow({ where: { id: d.batchId }, select: { year: true } });
  const studentCode = await nextStudentCode(tx, batch.year);
  const s = await tx.student.create({ data: { ...dataFor(d), studentCode, createdById: actorId, updatedById: actorId } });
  await audit(tx, { actorId, action, entity: "student", entityId: s.id, after: { ...d, studentCode }, ip: meta.ip, userAgent: meta.userAgent });
  return s;
}

export async function createStudent(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = studentSchema().parse(raw);
  await assertMasters(d);
  const dups = await findDuplicates(d.email, d.phone);
  if (dups.length) duplicateError(dups);
  try {
    return await db.$transaction((tx) => createStudentFromData(tx, d, actor.id, meta));
  } catch (e) {
    // Race: a concurrent insert won the unique index.
    if ((e as { code?: string }).code === "P2002") duplicateError(await findDuplicates(d.email, d.phone));
    throw e;
  }
}

const AUDITED_FIELDS = Object.keys(dataFor({} as StudentData)) as (keyof ReturnType<typeof dataFor>)[];

function snapshot(s: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of AUDITED_FIELDS) {
    const v = s[k];
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  return out;
}

/** Optimistic concurrency (STU-04): the caller sends the version it loaded. student_code is immutable (STU-16). */
export async function updateStudent(id: string, raw: unknown, version: number, actor: SessionAdmin, meta: Meta) {
  const existing = await db.student.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError(404, "Student not found");
  const d = studentSchema().parse(raw);
  await assertMasters(d, existing);
  const dups = await findDuplicates(d.email, d.phone, id);
  if (dups.length) duplicateError(dups);

  const before = snapshot(existing);
  const next = dataFor(d);
  const result = await db.$transaction(async (tx) => {
    const r = await tx.student.updateMany({ where: { id, version, deletedAt: null }, data: { ...next, version: { increment: 1 }, updatedById: actor.id } });
    if (r.count !== 1) return null;
    const after = snapshot({ ...existing, ...next });
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};
    for (const k of AUDITED_FIELDS) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        changedBefore[k] = before[k];
        changedAfter[k] = after[k];
      }
    }
    await audit(tx, { actorId: actor.id, action: "student.update", entity: "student", entityId: id, before: changedBefore, after: changedAfter, ip: meta.ip, userAgent: meta.userAgent });
    return true;
  });
  if (!result) {
    const current = await getStudent(id, actor).catch(() => null);
    throw new HttpError(409, "Someone else changed this student after you opened it. Review their changes, then re-apply yours.", { conflict: true, current });
  }
  return getStudent(id, actor);
}

/** Resolve a bulk selection to concrete ids on the server (P12). Filter mode must match the count the user confirmed. */
export async function resolveSelection(sel: Selection, opts: { deleted?: boolean } = {}): Promise<string[]> {
  if (sel.mode === "ids") {
    const rows = await db.student.findMany({ where: { id: { in: sel.ids }, deletedAt: opts.deleted ? { not: null } : null }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  const where = buildWhere({ ...sel.filter, deleted: !!opts.deleted });
  const rows = await db.student.findMany({ where, select: { id: true } });
  if (rows.length !== sel.expectedCount) {
    throw new HttpError(409, `The matching set changed from ${sel.expectedCount} to ${rows.length} students. Review and confirm again.`, { actualCount: rows.length });
  }
  return rows.map((r) => r.id);
}

export async function bulkUpdateStatus(sel: Selection, statusId: string, reason: string | undefined, actor: SessionAdmin, meta: Meta) {
  const status = await db.studentStatus.findUnique({ where: { id: statusId } });
  if (!status || !status.isActive) throw new HttpError(400, "Choose an active status");
  const requested = sel.mode === "ids" ? sel.ids.length : sel.expectedCount;
  const ids = await resolveSelection(sel);
  const cleanReason = reason?.trim().slice(0, 500) || null;
  const updated = await db.$transaction(
    async (tx) => {
      const current = await tx.student.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, statusId: true } });
      const liveIds = current.map((c) => c.id);
      await tx.student.updateMany({ where: { id: { in: liveIds } }, data: { statusId, updatedById: actor.id, version: { increment: 1 } } });
      await auditMany(
        tx,
        current.map((c) => ({ actorId: actor.id, action: "student.status_change", entity: "student", entityId: c.id, before: { statusId: c.statusId }, after: { statusId }, reason: cleanReason, ip: meta.ip, userAgent: meta.userAgent })),
      );
      return liveIds.length;
    },
    { timeout: 60_000 },
  );
  return { updated, skipped: requested - updated };
}

export async function bulkSoftDelete(sel: Selection, confirmText: string | undefined, actor: SessionAdmin, meta: Meta) {
  const ids = await resolveSelection(sel);
  if (ids.length > TYPE_DELETE_THRESHOLD && confirmText !== "DELETE") {
    throw new HttpError(400, `Type DELETE to confirm deleting ${ids.length} students`);
  }
  const deletedAt = new Date();
  await db.$transaction(
    async (tx) => {
      await tx.student.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt, deletedById: actor.id } });
      await auditMany(tx, ids.map((id) => ({ actorId: actor.id, action: "student.soft_delete", entity: "student", entityId: id, after: { deletedAt }, ip: meta.ip, userAgent: meta.userAgent })));
    },
    { timeout: 60_000 },
  );
  return { deleted: ids.length, undo: { ids, deletedAt: deletedAt.toISOString() } };
}

/** Undo by the same admin, for the exact batch, within the undo window (STU-10). */
export async function undoDelete(ids: string[], deletedAtIso: string, actor: SessionAdmin, meta: Meta) {
  const deletedAt = new Date(deletedAtIso);
  if (Number.isNaN(deletedAt.getTime()) || Date.now() - deletedAt.getTime() > UNDO_WINDOW_MS) throw new HttpError(410, "Undo window has passed. A Super Admin can restore from the Recycle Bin.");
  return db.$transaction(async (tx) => {
    const r = await tx.student.updateMany({ where: { id: { in: ids }, deletedAt, deletedById: actor.id }, data: { deletedAt: null, deletedById: null } });
    await auditMany(tx, ids.map((id) => ({ actorId: actor.id, action: "student.undo_delete", entity: "student", entityId: id, ip: meta.ip, userAgent: meta.userAgent })));
    return { restored: r.count };
  });
}

export async function restoreStudents(sel: Selection, actor: SessionAdmin, meta: Meta) {
  const ids = await resolveSelection(sel, { deleted: true });
  return db.$transaction(async (tx) => {
    const r = await tx.student.updateMany({ where: { id: { in: ids }, deletedAt: { not: null } }, data: { deletedAt: null, deletedById: null, updatedById: actor.id } });
    await auditMany(tx, ids.map((id) => ({ actorId: actor.id, action: "student.restore", entity: "student", entityId: id, ip: meta.ip, userAgent: meta.userAgent })));
    return { restored: r.count };
  });
}

/** Permanent purge (Super Admin) only for records deleted ≥ 30 days ago (D6). */
export async function purgeStudents(sel: Selection, confirmText: string | undefined, actor: SessionAdmin, meta: Meta, now = new Date()) {
  if (confirmText !== "PURGE") throw new HttpError(400, "Type PURGE to confirm permanent deletion");
  const ids = await resolveSelection(sel, { deleted: true });
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 86_400_000);
  const eligible = await db.student.findMany({ where: { id: { in: ids }, deletedAt: { lte: cutoff } } });
  await db.$transaction(async (tx) => {
    await tx.student.deleteMany({ where: { id: { in: eligible.map((e) => e.id) } } });
    await auditMany(tx, eligible.map((e) => ({ actorId: actor.id, action: "student.purge", entity: "student", entityId: e.id, before: { studentCode: e.studentCode, ...snapshot(e) }, ip: meta.ip, userAgent: meta.userAgent })));
  });
  return { purged: eligible.length, notYetEligible: ids.length - eligible.length };
}

export const EXPORT_COLUMNS = [
  ["studentCode", "Student code"],
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["institution", "Institution"],
  ["degree", "Degree"],
  ["department", "Department"],
  ["batch", "DOS Club batch"],
  ["graduationYear", "Graduation year"],
  ["status", "Status"],
  ["colourTeam", "Colour team"],
] as const;

/** CSV export with formula-injection escaping (P10, STU-14). Notes and DOB are never exported. */
export async function exportStudents(sel: Selection | { mode: "query"; filter: StudentFilter }, actor: SessionAdmin, meta: Meta) {
  const where = sel.mode === "query" ? buildWhere({ ...sel.filter, deleted: false }) : { id: { in: await resolveSelection(sel) } };
  const rows = (await db.student.findMany({ where, include: listInclude, orderBy: { studentCode: "asc" }, take: 20_000 })).map(toRow);
  await audit(db, { actorId: actor.id, action: "student.export", entity: "student", after: { count: rows.length, columns: EXPORT_COLUMNS.map((c) => c[0]) }, ip: meta.ip, userAgent: meta.userAgent });
  return toCsv(
    EXPORT_COLUMNS.map((c) => c[1]),
    rows.map((r) => EXPORT_COLUMNS.map(([k]) => r[k])),
  );
}

export async function saveTablePrefs(adminId: string, prefs: { hiddenColumns: string[]; pageSize?: number }) {
  await db.adminUser.update({ where: { id: adminId }, data: { tablePrefs: prefs } });
}
