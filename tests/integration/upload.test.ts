import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as uploadsPOST } from "@/app/api/uploads/route";
import { excelSerialToISO, normalizePhone } from "@/lib/normalize";
import type { SessionAdmin } from "@/server/auth/session";
import { HttpError } from "@/server/http";
import { createStudentUpload, errorReportCsv, getUpload, runImport, saveMapping, setDecisions, TEMPLATE_HEADERS } from "@/server/upload/students-upload";
import { studentTemplate } from "@/server/upload/templates";
import { call, resetData, seedMasters, signedIn, type Masters } from "../helpers";

let m: Masters;
let actor: SessionAdmin;
const YEAR = new Date().getUTCFullYear() + 1;
const HEADER = "full_name,email,phone,institution,degree,department,graduation_year,batch,date_of_birth,notes";

function row(i: number, over: Partial<Record<string, string>> = {}) {
  const r = { full_name: `Student ${"abcdefghij"[i % 10]}${"klmnopqrst"[Math.floor(i / 10) % 10]}${"uvwxyz"[Math.floor(i / 100) % 6]}`, email: `u${i}@example.test`, phone: `90000${String(10000 + i).slice(-5)}`, institution: "Example Institute of Technology", degree: "B.E.", department: "CSE", graduation_year: String(YEAR), batch: "2026-B1", date_of_birth: "", notes: "", ...over };
  return HEADER.split(",").map((h) => csvCell(r[h as keyof typeof r] ?? "")).join(",");
}
function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function csvFile(lines: string[], name = "students.csv", bom = true) {
  return { name, type: "text/csv", buffer: Buffer.from((bom ? "﻿" : "") + [HEADER, ...lines].join("\r\n"), "utf8") };
}
function xlsxFile(aoa: unknown[][], opts: { merges?: XLSX.Range[]; extraSheet?: boolean; formulaAt?: { r: number; c: number; f: string } } = {}) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (opts.merges) ws["!merges"] = opts.merges;
  if (opts.formulaAt) ws[XLSX.utils.encode_cell(opts.formulaAt)] = { t: "s", f: opts.formulaAt.f, v: "Click me" };
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  if (opts.extraSheet) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["notes"]]), "Notes");
  return { name: "students.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer };
}
function aoaRow(i: number, over: Partial<Record<string, unknown>> = {}) {
  const base: Record<string, unknown> = { full_name: `Student ${"abcdefghij"[i % 10]}`, email: `x${i}@example.test`, phone: `90000${String(20000 + i).slice(-5)}`, institution: "EIT", degree: "B.E.", department: "CSE", graduation_year: YEAR, batch: "2026-B1", date_of_birth: "", notes: "", ...over };
  return HEADER.split(",").map((h) => base[h]);
}
async function rejects(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as HttpError;
  }
  throw new Error("expected rejection");
}

describe("Bulk upload", () => {
  beforeEach(async () => {
    await resetData();
    m = await seedMasters();
    const s = await signedIn("ADMIN");
    actor = { id: s.admin.id, email: s.admin.email, name: s.admin.name, role: "ADMIN", totpEnabled: true, canExport: false };
  });

  it("UPL-01 the template with 3 valid rows imports 3 students", async () => {
    const t = studentTemplate("csv");
    const text = (t.body as string).replace(/^﻿/, "");
    const header = text.split("\r\n")[0]!;
    expect(header.split(",")).toEqual([...TEMPLATE_HEADERS]);
    const rows = [0, 1, 2].map((i) =>
      TEMPLATE_HEADERS.map((h) => ({ full_name: `Priya ${"abc"[i]}`, email: `p${i}@example.test`, phone: `9000030${i}00`, institution: "EIT", degree: "B.Tech", department: "Computer Science", graduation_year: String(YEAR), batch: "2026-B1", status: "Active" } as Record<string, string>)[h] ?? "").join(","),
    );
    const job = await createStudentUpload({ name: "t.csv", type: "text/csv", buffer: Buffer.from([text.trimEnd(), ...rows].join("\r\n")) }, actor);
    expect(job.notes.join(" ")).toMatch(/example row was ignored/);
    expect(job).toMatchObject({ total: 3, valid: 3, errors: 0 });
    const r = await runImport(job.jobId, actor, {});
    expect(r.imported).toBe(3);
    expect(await db.student.count()).toBe(3);
  });

  it("UPL-02 wrong or missing headers are rejected before preview, listing expected headers", async () => {
    const f = { name: "bad.csv", type: "text/csv", buffer: Buffer.from("name,mail\nA,b@example.test") };
    const e = await rejects(createStudentUpload(f, actor));
    expect(e.status).toBe(400);
    expect(e.details?.missing).toEqual(expect.arrayContaining(["full_name", "email", "phone"]));
    expect(e.details?.expectedHeaders).toEqual(expect.arrayContaining([...TEMPLATE_HEADERS]));
    expect(await db.uploadJob.count()).toBe(0);
  });

  it("UPL-03 the same email twice in one file flags both rows as duplicate-in-file", async () => {
    const job = await createStudentUpload(csvFile([row(1), row(2, { email: "U1@example.test" }), row(3)]), actor);
    expect(job).toMatchObject({ total: 3, valid: 1, duplicates: 2 });
    const d = await getUpload(job.jobId, actor, { status: "DUPLICATE_FILE" });
    expect(d.rows.map((r) => r.rowNo)).toEqual([2, 3]);
    expect(d.rows[0]!.errors.email).toMatch(/row\(s\) 3/);
  });

  it("UPL-04 an email already in the DB is flagged; default skip, or update existing", async () => {
    const first = await createStudentUpload(csvFile([row(1)]), actor);
    await runImport(first.jobId, actor, {});
    const job = await createStudentUpload(csvFile([row(1, { full_name: "Renamed Person" }), row(2)]), actor);
    expect(job).toMatchObject({ valid: 1, duplicates: 1 });
    const d = await getUpload(job.jobId, actor, { status: "DUPLICATE_DB" });
    expect(d.rows[0]!.decision).toBe("skip");
    await setDecisions(job.jobId, "update", [2], actor);
    const r = await runImport(job.jobId, actor, {});
    expect(r).toMatchObject({ imported: 1, updated: 1 });
    expect((await db.student.findUniqueOrThrow({ where: { email: "u1@example.test" } })).fullName).toBe("Renamed Person");
  });

  it("UPL-05 phone formats normalise to +919876543210; 9.18E+11 is a row error", async () => {
    expect(normalizePhone("09876543210")).toEqual({ ok: true, e164: "+919876543210" });
    expect(normalizePhone("+91 98765-43210")).toEqual({ ok: true, e164: "+919876543210" });
    expect(normalizePhone("98765 43210")).toEqual({ ok: true, e164: "+919876543210" });
    expect(normalizePhone("9.18E+11").ok).toBe(false);
    const job = await createStudentUpload(csvFile([row(1, { phone: "9.18E+11" }), row(2, { phone: "+91 90000-10002" })]), actor);
    const d = await getUpload(job.jobId, actor);
    expect(d.rows[0]!.status).toBe("ERROR");
    expect(d.rows[0]!.errors.phone).toMatch(/scientific notation/);
    expect(d.rows[1]!.status).toBe("VALID");
  });

  it("UPL-06 Excel serial dates parse correctly (38426 → 2005-03-15; 45123 → 2023-07-16, then fails the age rule)", async () => {
    expect(excelSerialToISO(38426)).toBe("2005-03-15");
    expect(excelSerialToISO(45123)).toBe("2023-07-16");
    const f = xlsxFile([HEADER.split(","), aoaRow(1, { date_of_birth: 38426 }), aoaRow(2, { date_of_birth: 45123 })]);
    const job = await createStudentUpload(f, actor);
    const d = await getUpload(job.jobId, actor);
    expect(d.rows[0]!.status).toBe("VALID");
    expect(d.rows[1]!.errors.date_of_birth).toBe("Age must be between 15 and 40");
    await runImport(job.jobId, actor, {});
    expect((await db.student.findFirstOrThrow()).dateOfBirth!.toISOString().slice(0, 10)).toBe("2005-03-15");
  });

  it("UPL-07 unknown department 'Comp Sci' goes to the mapping step; unmapped rows stay errors", async () => {
    const job = await createStudentUpload(csvFile([row(1, { department: "Comp Sci" }), row(2, { department: "Comp Sci" }), row(3, { department: "Basket Weaving" })]), actor);
    expect(job.errors).toBe(3);
    expect(job.unknownValues.department!.map((v) => v.value).sort()).toEqual(["Basket Weaving", "Comp Sci"]);
    await saveMapping(job.jobId, { department: { "comp sci": m.cse.id, "basket weaving": null } }, actor);
    const d = await getUpload(job.jobId, actor);
    expect(d.rows.map((r) => r.status)).toEqual(["VALID", "VALID", "ERROR"]);
    expect(d.rows[2]!.errors.department).toMatch(/rejected in mapping/);
    expect(d.unknownValues.department ?? []).toEqual([]);
  });

  it("UPL-08 Tamil names survive CSV with BOM, CSV without BOM, and XLSX", async () => {
    const name = "அருண் குமார்";
    const a = await createStudentUpload(csvFile([row(1, { full_name: name })], "a.csv", true), actor);
    const b = await createStudentUpload(csvFile([row(2, { full_name: name })], "b.csv", false), actor);
    const c = await createStudentUpload(xlsxFile([HEADER.split(","), aoaRow(3, { full_name: name })]), actor);
    for (const j of [a, b, c]) {
      expect(j.valid).toBe(1);
      await runImport(j.jobId, actor, {});
    }
    const names = (await db.student.findMany()).map((s) => s.fullName);
    expect(names).toEqual([name, name, name]);
  });

  it("UPL-09 10,001 rows are rejected with a limit message", async () => {
    const lines = Array.from({ length: 10_001 }, (_, i) => row(i));
    const e = await rejects(createStudentUpload(csvFile(lines), actor));
    expect(e.status).toBe(400);
    expect(e.publicMessage).toMatch(/10,000/);
  });

  it("UPL-10 an .exe renamed to .xlsx is rejected (magic bytes)", async () => {
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(200)]);
    const e = await rejects(createStudentUpload({ name: "students.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: exe }, actor));
    expect(e.status).toBe(400);
    const e2 = await rejects(createStudentUpload({ name: "students.csv", type: "text/csv", buffer: exe }, actor));
    expect(e2.status).toBe(400);
    const e3 = await rejects(createStudentUpload({ name: "students.exe", type: "application/octet-stream", buffer: exe }, actor));
    expect(e3.status).toBe(400);
    // and via the real multipart endpoint
    const { cookie } = await signedIn("ADMIN");
    const form = new FormData();
    form.set("file", new File([exe], "students.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect((await call(uploadsPOST, { form, cookie })).status).toBe(400);
  });

  it("UPL-11 =HYPERLINK(...) is stored as plain text, never evaluated", async () => {
    const f = xlsxFile([HEADER.split(","), aoaRow(1), aoaRow(2)], { formulaAt: { r: 1, c: 9, f: 'HYPERLINK("http://evil.example","x")' } });
    const csv = csvFile([row(5, { notes: '=HYPERLINK("http://evil.example","x")' })]);
    for (const file of [f, csv]) {
      const j = await createStudentUpload(file, actor);
      await runImport(j.jobId, actor, {});
    }
    const notes = (await db.student.findMany({ orderBy: { createdAt: "asc" } })).map((s) => s.notes).filter(Boolean);
    expect(notes).toEqual(['=HYPERLINK("http://evil.example","x")', '=HYPERLINK("http://evil.example","x")']);
  });

  it("UPL-12 90 valid + 10 errors → 90 imported; error CSV lists the 10 with row numbers and reasons", async () => {
    const lines = Array.from({ length: 100 }, (_, i) => (i % 10 === 9 ? row(i, { email: "not-an-email" }) : row(i)));
    const job = await createStudentUpload(csvFile(lines), actor);
    expect(job).toMatchObject({ total: 100, valid: 90, errors: 10 });
    expect((await runImport(job.jobId, actor, {})).imported).toBe(90);
    const csv = await errorReportCsv(job.jobId, actor);
    const body = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(body).toHaveLength(11);
    expect(body[1]).toMatch(/^11,error,email: Enter a valid email/);
  });

  it("UPL-13 a DB failure mid-import rolls back that whole batch and marks the job failed", async () => {
    const lines = Array.from({ length: 600 }, (_, i) => row(i)); // 2 batches of 500 + 100
    const job = await createStudentUpload(csvFile(lines), actor);
    expect(job.valid).toBe(600);
    // A conflicting student appears in the DB just before batch 2 runs (e.g. another admin's insert).
    const err = await rejects(
      runImport(job.jobId, actor, {}, {
        beforeBatch: async (n) => {
          if (n !== 1) return;
          await db.student.create({
            data: { studentCode: "DOS-2099-00001", fullName: "Race Condition", email: "u550@example.test", phone: "+919000099999", institutionId: m.inst.id, degreeId: m.degree.id, departmentId: m.cse.id, graduationYear: YEAR, batchId: m.b1.id, statusId: m.active.id },
          });
        },
      }),
    );
    expect(err.status).toBe(500);
    const j = await db.uploadJob.findUniqueOrThrow({ where: { id: job.jobId } });
    expect(j.status).toBe("FAILED");
    expect(j.imported).toBe(500); // batch 1 committed
    expect(await db.student.count({ where: { NOT: { fullName: "Race Condition" } } })).toBe(500); // none of batch 2's 100 rows
  });

  it("UPL-14 leading/trailing spaces are trimmed and email is lower-cased", async () => {
    const job = await createStudentUpload(csvFile([row(1, { full_name: "   Meena   Raj  ", email: "  MEENA.RAJ@Example.TEST " })]), actor);
    await runImport(job.jobId, actor, {});
    const s = await db.student.findFirstOrThrow();
    expect(s.fullName).toBe("Meena Raj");
    expect(s.email).toBe("meena.raj@example.test");
  });

  it("UPL-15 empty rows at the end of the sheet are ignored, not counted as errors", async () => {
    const f = csvFile([row(1), row(2), ",,,,,,,,,", "", ",,,,,,,,,"]);
    const job = await createStudentUpload(f, actor);
    expect(job).toMatchObject({ total: 2, valid: 2, errors: 0 });
    const x = await createStudentUpload(xlsxFile([HEADER.split(","), aoaRow(1), [], [], ["", "", ""]]), actor);
    expect(x.total).toBe(1);
  });

  it("UPL-16 a 5,000-row file validates in under 30 seconds", async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => row(i));
    const t0 = performance.now();
    const job = await createStudentUpload(csvFile(lines), actor);
    const secs = (performance.now() - t0) / 1000;
    expect(job.valid).toBe(5000);
    expect(secs).toBeLessThan(30);
    console.info(`UPL-16 validation of 5000 rows: ${secs.toFixed(2)}s`);
  }, 120_000);

  it("UPL-18 multi-sheet workbook reads only the first sheet (with a note); merged cells give a clear row error", async () => {
    const f = xlsxFile([HEADER.split(","), aoaRow(1), aoaRow(2), aoaRow(3)], { extraSheet: true, merges: [{ s: { r: 2, c: 3 }, e: { r: 3, c: 3 } }] });
    const job = await createStudentUpload(f, actor);
    expect(job.notes.join(" ")).toMatch(/Only the first sheet/);
    const d = await getUpload(job.jobId, actor);
    expect(d.rows.find((r) => r.rowNo === 2)!.status).toBe("VALID");
    expect(d.rows.find((r) => r.rowNo === 3)!.errors._row).toMatch(/merged cells/);
  });
});
