import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { cleanText, nameKey, toCsv } from "@/lib/normalize";
import { GENDERS, studentSchema, type StudentData } from "@/lib/validation/student";
import { audit } from "@/server/audit";
import type { SessionAdmin } from "@/server/auth/session";
import { HttpError } from "@/server/http";
import { masterLookups, type MasterLookups } from "@/server/masters";
import { createStudentFromData } from "@/server/students";
import { checkHeaders, parseFile } from "./parse";

export const MAX_ROWS = 10_000; // P6
export const IMPORT_BATCH = 500;

export const REQUIRED_HEADERS = ["full_name", "email", "phone", "institution", "degree", "department", "graduation_year", "batch"] as const;
export const OPTIONAL_HEADERS = ["gender", "date_of_birth", "year_of_study", "colour_team", "status", "city", "state", "linkedin_url", "github_url", "notes"] as const;
export const TEMPLATE_HEADERS = ["full_name", "email", "phone", "gender", "date_of_birth", "institution", "degree", "department", "year_of_study", "graduation_year", "batch", "colour_team", "status", "city", "state", "linkedin_url", "github_url", "notes"] as const;

/** Columns that reference master tables; unknown values go through the mapping step (P2, UPL-07). */
export const MAPPED_FIELDS = {
  institution: { lookup: "institution", target: "institutionId", label: "Institution", master: "institutions" },
  degree: { lookup: "degree", target: "degreeId", label: "Degree", master: "degrees" },
  department: { lookup: "department", target: "departmentId", label: "Department", master: "departments" },
  batch: { lookup: "batch", target: "batchId", label: "DOS Club batch", master: "batches" },
  colour_team: { lookup: "colourTeam", target: "colourTeamId", label: "Colour team", master: "colour-teams" },
  status: { lookup: "status", target: "statusId", label: "Status", master: "statuses" },
} as const;
type MappedHeader = keyof typeof MAPPED_FIELDS;
export type Mapping = Partial<Record<MappedHeader, Record<string, string | null>>>; // nameKey(raw) → master id | null (reject)

/** Example row shipped in the template. Rows with this exact email are skipped on upload. */
export const EXAMPLE_ROW: Record<(typeof TEMPLATE_HEADERS)[number], string> = {
  full_name: "Example Student", email: "example.student@example.test", phone: "+91 90000 12345", gender: "Female", date_of_birth: "2005-03-15",
  institution: "(exact name from Masters → Institutions)", degree: "B.E.", department: "CSE", year_of_study: "2", graduation_year: "",
  batch: "(exact batch code from Masters → Batches)", colour_team: "", status: "Active", city: "Chennai", state: "Tamil Nadu",
  linkedin_url: "https://www.linkedin.com/in/example", github_url: "https://github.com/example", notes: "",
};

const FIELD_FOR_HEADER: Record<string, string> = {
  full_name: "fullName", email: "email", phone: "phone", gender: "gender", date_of_birth: "dateOfBirth",
  year_of_study: "yearOfStudy", graduation_year: "graduationYear", city: "city", state: "state",
  linkedin_url: "linkedinUrl", github_url: "githubUrl", notes: "notes",
};
const HEADER_FOR_FIELD: Record<string, string> = Object.fromEntries([
  ...Object.entries(FIELD_FOR_HEADER).map(([h, f]) => [f, h]),
  ...Object.entries(MAPPED_FIELDS).map(([h, m]) => [m.target, h]),
]);

const GENDER_WORDS: Record<string, (typeof GENDERS)[number]> = {
  male: "MALE", m: "MALE", female: "FEMALE", f: "FEMALE", other: "OTHER",
  "prefer not to say": "PREFER_NOT_TO_SAY", prefer_not_to_say: "PREFER_NOT_TO_SAY",
};

type RowEval = {
  rowNo: number;
  raw: Record<string, string>;
  status: "VALID" | "DUPLICATE_FILE" | "DUPLICATE_DB" | "ERROR";
  normalized: StudentData | null;
  errors: Record<string, string>;
  duplicateStudentId: string | null;
  decision: "skip" | "update" | null;
};

function toInput(raw: Record<string, string>, lk: MasterLookups, mapping: Mapping, unknown: Map<MappedHeader, Map<string, string>>) {
  const input: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [h, f] of Object.entries(FIELD_FOR_HEADER)) if (h in raw) input[f] = raw[h];
  if (cleanText(raw.gender)) {
    const g = GENDER_WORDS[nameKey(raw.gender)];
    input.gender = g ?? "__invalid__";
  }
  for (const [h, m] of Object.entries(MAPPED_FIELDS) as [MappedHeader, (typeof MAPPED_FIELDS)[MappedHeader]][]) {
    const value = cleanText(raw[h]);
    if (!value) {
      if (h === "status" && lk.defaultStatusId) input.statusId = lk.defaultStatusId;
      continue;
    }
    const key = nameKey(value);
    const mapped = mapping[h]?.[key];
    const id = mapped !== undefined ? mapped : (lk[m.lookup] as Map<string, string>).get(key);
    if (id) input[m.target] = id;
    else {
      if (!unknown.has(h)) unknown.set(h, new Map());
      if (mapped === undefined) unknown.get(h)!.set(key, value);
      errors[h] = mapped === null ? `"${value}" was rejected in mapping` : `Unknown ${m.label.toLowerCase()} "${value}". Map it to an existing value or add it to Masters`;
    }
  }
  return { input, errors };
}

/** Validate every row: schema + masters + duplicates in-file and vs DB (UPL-03/04). */
export async function evaluateRows(rows: { rowNo: number; raw: Record<string, string>; problem?: string; decision?: string | null }[], mapping: Mapping) {
  const lk = await masterLookups();
  const schema = studentSchema();
  const unknown = new Map<MappedHeader, Map<string, string>>();
  const evals: RowEval[] = rows.map((r) => {
    const { input, errors } = toInput(r.raw, lk, mapping, unknown);
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "_");
        const header = HEADER_FOR_FIELD[field] ?? field;
        if (!errors[header] && !(header in MAPPED_FIELDS && errors[header])) {
          errors[header] = field === "gender" ? "Gender must be Male, Female, Other or Prefer not to say" : issue.message;
        }
      }
    }
    if (r.problem) errors._row = r.problem;
    const ok = parsed.success && !Object.keys(errors).length;
    return { rowNo: r.rowNo, raw: r.raw, status: ok ? "VALID" : "ERROR", normalized: ok ? parsed.data : null, errors, duplicateStudentId: null, decision: (r.decision as RowEval["decision"]) ?? null };
  });

  // In-file duplicates: every row sharing an email or phone is flagged (UPL-03).
  const byEmail = new Map<string, RowEval[]>();
  const byPhone = new Map<string, RowEval[]>();
  for (const e of evals) {
    if (!e.normalized) continue;
    (byEmail.get(e.normalized.email) ?? byEmail.set(e.normalized.email, []).get(e.normalized.email)!).push(e);
    (byPhone.get(e.normalized.phone) ?? byPhone.set(e.normalized.phone, []).get(e.normalized.phone)!).push(e);
  }
  for (const [field, group] of [...[...byEmail.values()].map((g) => ["email", g] as const), ...[...byPhone.values()].map((g) => ["phone", g] as const)]) {
    if (group.length < 2) continue;
    const others = group.map((g) => g.rowNo);
    for (const e of group) {
      e.status = "DUPLICATE_FILE";
      e.errors[field] = `Same ${field} as row(s) ${others.filter((n) => n !== e.rowNo).join(", ")}`;
    }
  }

  // Database duplicates (UPL-04): skip (default) or update existing.
  const live = evals.filter((e) => e.status === "VALID" && e.normalized);
  const emails = live.map((e) => e.normalized!.email);
  const phones = live.map((e) => e.normalized!.phone);
  const existing = emails.length
    ? await db.student.findMany({ where: { OR: [{ email: { in: emails } }, { phone: { in: phones } }] }, select: { id: true, email: true, phone: true, studentCode: true, deletedAt: true } })
    : [];
  const exEmail = new Map(existing.map((s) => [s.email, s]));
  const exPhone = new Map(existing.map((s) => [s.phone, s]));
  for (const e of live) {
    const a = exEmail.get(e.normalized!.email);
    const b = exPhone.get(e.normalized!.phone);
    if (!a && !b) continue;
    if (a && b && a.id !== b.id) {
      e.status = "ERROR";
      e.errors.email = `Email matches ${a.studentCode} but phone matches ${b.studentCode}. Fix manually`;
      continue;
    }
    const hit = (a ?? b)!;
    if (hit.deletedAt) {
      e.status = "ERROR";
      e.errors[a ? "email" : "phone"] = `Matches ${hit.studentCode}, which is in the Recycle Bin. Ask a Super Admin to restore it`;
      continue;
    }
    e.status = "DUPLICATE_DB";
    e.duplicateStudentId = hit.id;
    e.decision = e.decision === "update" ? "update" : "skip";
    e.errors[a ? "email" : "phone"] = `Already exists as ${hit.studentCode}`;
  }

  const unknownValues = Object.fromEntries(
    [...unknown.entries()].map(([h, m]) => [h, [...m.entries()].map(([key, value]) => ({ key, value }))]),
  ) as Partial<Record<MappedHeader, { key: string; value: string }[]>>;
  return { evals, unknownValues };
}

async function persistEvaluation(jobId: string, evals: RowEval[]) {
  const counts = { total: evals.length, valid: 0, duplicates: 0, errors: 0 };
  for (const e of evals) {
    if (e.status === "VALID") counts.valid++;
    else if (e.status === "ERROR") counts.errors++;
    else counts.duplicates++;
  }
  await db.$transaction(
    async (tx) => {
      await tx.uploadRow.deleteMany({ where: { jobId } });
      for (let i = 0; i < evals.length; i += 1000) {
        await tx.uploadRow.createMany({
          data: evals.slice(i, i + 1000).map((e) => ({
            jobId,
            rowNo: e.rowNo,
            raw: e.raw,
            normalized: (e.normalized ?? undefined) as Prisma.InputJsonValue | undefined,
            status: e.status,
            errors: Object.keys(e.errors).length ? e.errors : undefined,
            duplicateStudentId: e.duplicateStudentId,
            decision: e.decision,
          })),
        });
      }
      await tx.uploadJob.update({ where: { id: jobId }, data: counts });
    },
    { timeout: 120_000 },
  );
  return counts;
}

export async function createStudentUpload(file: { name: string; type: string; buffer: Buffer }, actor: SessionAdmin) {
  const sheet = parseFile(file.name, file.type, file.buffer, MAX_ROWS);
  checkHeaders(sheet.headers, REQUIRED_HEADERS, OPTIONAL_HEADERS);
  if (sheet.rows.length > MAX_ROWS) throw new HttpError(400, `The file has more than ${MAX_ROWS.toLocaleString("en-IN")} data rows. Split it into smaller files.`);
  const before = sheet.rows.length;
  sheet.rows = sheet.rows.filter((r) => cleanText(r.cells.email).toLowerCase() !== EXAMPLE_ROW.email);
  if (sheet.rows.length < before) sheet.notes.push("The template's example row was ignored.");
  if (sheet.rows.length === 0) throw new HttpError(400, "The file has a header row but no data rows");

  const job = await db.uploadJob.create({ data: { kind: "students", fileName: file.name.slice(0, 200), uploadedById: actor.id, mapping: {} } });
  const { evals, unknownValues } = await evaluateRows(sheet.rows.map((r) => ({ rowNo: r.rowNo, raw: r.cells, problem: r.problem })), {});
  const counts = await persistEvaluation(job.id, evals);
  return { jobId: job.id, ...counts, unknownValues, notes: sheet.notes };
}

async function loadJob(jobId: string, actor: SessionAdmin) {
  const job = await db.uploadJob.findUnique({ where: { id: jobId } });
  // Admins see their own jobs; Super Admin sees all.
  if (!job || job.kind !== "students" || (job.uploadedById !== actor.id && actor.role !== "SUPER_ADMIN")) throw new HttpError(404, "Upload not found");
  return job;
}

export async function getUpload(jobId: string, actor: SessionAdmin, opts: { status?: string; page?: number; pageSize?: number } = {}) {
  const job = await loadJob(jobId, actor);
  const pageSize = Math.min(opts.pageSize ?? 50, 200);
  const page = Math.max(opts.page ?? 1, 1);
  const where: Prisma.UploadRowWhereInput = { jobId, ...(opts.status ? { status: opts.status as RowEval["status"] } : {}) };
  const [rows, filtered] = await Promise.all([
    db.uploadRow.findMany({ where, orderBy: { rowNo: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.uploadRow.count({ where }),
  ]);
  let unknownValues: Partial<Record<MappedHeader, { key: string; value: string }[]>> = {};
  if (job.status === "PREVIEW") {
    const errRows = await db.uploadRow.findMany({ where: { jobId, status: "ERROR" }, select: { raw: true } });
    const lk = await masterLookups();
    const unknown = new Map<MappedHeader, Map<string, string>>();
    for (const r of errRows) toInput(r.raw as Record<string, string>, lk, (job.mapping ?? {}) as Mapping, unknown);
    unknownValues = Object.fromEntries([...unknown.entries()].map(([h, m]) => [h, [...m.entries()].map(([key, value]) => ({ key, value }))]));
  }
  return {
    job: {
      id: job.id, fileName: job.fileName, status: job.status, total: job.total, valid: job.valid, duplicates: job.duplicates, errors: job.errors,
      imported: job.imported, updated: job.updated, skipped: job.skipped, failed: job.failed, failure: job.failure,
      createdAt: job.createdAt.toISOString(), completedAt: job.completedAt?.toISOString() ?? null, mapping: job.mapping,
    },
    unknownValues,
    rows: rows.map((r) => ({ rowNo: r.rowNo, raw: r.raw as Record<string, string>, status: r.status, errors: (r.errors ?? {}) as Record<string, string>, decision: r.decision, duplicateStudentId: r.duplicateStudentId })),
    page,
    pageSize,
    filtered,
  };
}

async function reevaluate(jobId: string, mapping: Mapping) {
  const rows = await db.uploadRow.findMany({ where: { jobId }, orderBy: { rowNo: "asc" } });
  const { evals } = await evaluateRows(
    rows.map((r) => ({ rowNo: r.rowNo, raw: r.raw as Record<string, string>, decision: r.decision, problem: (r.errors as Record<string, string> | null)?._row })),
    mapping,
  );
  return persistEvaluation(jobId, evals);
}

/** Save mapping choices ("Comp Sci" → Computer Science & Engineering, or null = reject) and re-validate. */
export async function saveMapping(jobId: string, mapping: Mapping, actor: SessionAdmin) {
  const job = await loadJob(jobId, actor);
  if (job.status !== "PREVIEW") throw new HttpError(409, "This upload can no longer be changed");
  const merged: Mapping = { ...((job.mapping ?? {}) as Mapping) };
  for (const [h, m] of Object.entries(mapping) as [MappedHeader, Record<string, string | null>][]) {
    if (!(h in MAPPED_FIELDS)) continue;
    merged[h] = { ...(merged[h] ?? {}), ...Object.fromEntries(Object.entries(m).map(([k, v]) => [nameKey(k), v])) };
  }
  await db.uploadJob.update({ where: { id: jobId }, data: { mapping: merged } });
  return reevaluate(jobId, merged);
}

export async function setDecisions(jobId: string, decision: "skip" | "update", rowNos: number[] | "all", actor: SessionAdmin) {
  const job = await loadJob(jobId, actor);
  if (job.status !== "PREVIEW") throw new HttpError(409, "This upload can no longer be changed");
  const r = await db.uploadRow.updateMany({ where: { jobId, status: "DUPLICATE_DB", ...(rowNos === "all" ? {} : { rowNo: { in: rowNos } }) }, data: { decision } });
  return { changed: r.count };
}

/**
 * Import valid rows (and DB duplicates marked "update") in transactions of IMPORT_BATCH rows.
 * A failing batch rolls back completely and stops the job (UPL-13).
 */
export async function runImport(jobId: string, actor: SessionAdmin, meta: { ip?: string; userAgent?: string | null }, hooks: { beforeBatch?: (n: number) => void | Promise<void> } = {}) {
  const job = await loadJob(jobId, actor);
  if (job.status !== "PREVIEW") throw new HttpError(409, "This upload was already imported");
  const claimed = await db.uploadJob.updateMany({ where: { id: jobId, status: "PREVIEW" }, data: { status: "IMPORTING" } });
  if (claimed.count !== 1) throw new HttpError(409, "This upload is already being imported");

  // Re-validate right before importing so new duplicates / deactivated masters are caught.
  await reevaluate(jobId, (job.mapping ?? {}) as Mapping);
  const rows = await db.uploadRow.findMany({ where: { jobId, OR: [{ status: "VALID" }, { status: "DUPLICATE_DB", decision: "update" }] }, orderBy: { rowNo: "asc" } });
  const all = await db.uploadRow.groupBy({ by: ["status"], where: { jobId }, _count: true });
  const totalRows = all.reduce((n, g) => n + g._count, 0);
  let imported = 0;
  let updated = 0;
  try {
    for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
      const batch = rows.slice(i, i + IMPORT_BATCH);
      await hooks.beforeBatch?.(i / IMPORT_BATCH);
      const r = await db.$transaction(
        async (tx) => {
          let ins = 0;
          let upd = 0;
          for (const row of batch) {
            const d = row.normalized as unknown as StudentData;
            if (row.status === "DUPLICATE_DB" && row.duplicateStudentId) {
              const before = await tx.student.findUniqueOrThrow({ where: { id: row.duplicateStudentId } });
              await tx.student.update({
                where: { id: row.duplicateStudentId },
                data: {
                  fullName: d.fullName, email: d.email, phone: d.phone, gender: d.gender ?? before.gender, dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth + "T00:00:00Z") : before.dateOfBirth,
                  institutionId: d.institutionId, degreeId: d.degreeId, departmentId: d.departmentId, yearOfStudy: d.yearOfStudy ?? before.yearOfStudy,
                  graduationYear: d.graduationYear, batchId: d.batchId, colourTeamId: d.colourTeamId ?? before.colourTeamId, statusId: d.statusId,
                  city: d.city ?? before.city, state: d.state ?? before.state, linkedinUrl: d.linkedinUrl ?? before.linkedinUrl, githubUrl: d.githubUrl ?? before.githubUrl, notes: d.notes ?? before.notes,
                  version: { increment: 1 }, updatedById: actor.id,
                },
              });
              await audit(tx, { actorId: actor.id, action: "student.update_from_upload", entity: "student", entityId: before.id, before: { fullName: before.fullName, email: before.email, phone: before.phone, statusId: before.statusId }, after: d, reason: `upload ${jobId} row ${row.rowNo}`, ip: meta.ip, userAgent: meta.userAgent });
              upd++;
            } else {
              await createStudentFromData(tx, d, actor.id, meta, "student.create_from_upload");
              ins++;
            }
          }
          return { ins, upd };
        },
        { timeout: 120_000 },
      );
      imported += r.ins;
      updated += r.upd;
      await db.uploadJob.update({ where: { id: jobId }, data: { imported, updated } });
    }
  } catch {
    await db.uploadJob.update({
      where: { id: jobId },
      data: { status: "FAILED", imported, updated, failed: rows.length - imported - updated, failure: "Import stopped because a database error occurred. Rows already imported are kept; the failing batch was rolled back.", completedAt: new Date() },
    });
    await audit(db, { actorId: actor.id, action: "upload.failed", entity: "upload_job", entityId: jobId, after: { imported, updated }, ip: meta.ip, userAgent: meta.userAgent });
    throw new HttpError(500, "Import failed. The failing batch was rolled back. See the upload summary.");
  }
  const skipped = totalRows - imported - updated;
  await db.uploadJob.update({ where: { id: jobId }, data: { status: "COMPLETED", imported, updated, skipped, completedAt: new Date() } });
  await audit(db, { actorId: actor.id, action: "upload.completed", entity: "upload_job", entityId: jobId, after: { imported, updated, skipped, total: totalRows }, ip: meta.ip, userAgent: meta.userAgent });
  return { imported, updated, skipped, total: totalRows };
}

/** Row-level error report (P3, P14, UPL-12): original columns + row number + reasons. */
export async function errorReportCsv(jobId: string, actor: SessionAdmin) {
  await loadJob(jobId, actor);
  const rows = await db.uploadRow.findMany({ where: { jobId, status: { in: ["ERROR", "DUPLICATE_FILE", "DUPLICATE_DB"] } }, orderBy: { rowNo: "asc" } });
  return toCsv(
    ["row_number", "result", "reasons", ...TEMPLATE_HEADERS],
    rows.map((r) => {
      const errs = (r.errors ?? {}) as Record<string, string>;
      const result = r.status === "ERROR" ? "error" : r.status === "DUPLICATE_FILE" ? "duplicate in file" : r.decision === "update" ? "duplicate (updated existing)" : "duplicate (skipped)";
      const raw = r.raw as Record<string, string>;
      return [r.rowNo, result, Object.entries(errs).map(([k, v]) => (k === "_row" ? v : `${k}: ${v}`)).join(" | "), ...TEMPLATE_HEADERS.map((h) => raw[h] ?? "")];
    }),
  );
}

export async function recentUploads(actor: SessionAdmin, take = 10) {
  return db.uploadJob.findMany({
    where: { kind: "students", ...(actor.role === "SUPER_ADMIN" ? {} : { uploadedById: actor.id }) },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, fileName: true, status: true, total: true, imported: true, updated: true, skipped: true, errors: true, createdAt: true },
  });
}
