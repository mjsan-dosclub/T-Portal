import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as studentsPOST } from "@/app/api/students/route";
import { GET as studentGET, PUT as studentPUT } from "@/app/api/students/[id]/route";
import { POST as queryPOST } from "@/app/api/students/query/route";
import { POST as statusPOST } from "@/app/api/students/bulk/status/route";
import { POST as deletePOST } from "@/app/api/students/bulk/delete/route";
import { POST as undoPOST } from "@/app/api/students/bulk/undo/route";
import { POST as restorePOST } from "@/app/api/students/restore/route";
import { POST as purgePOST } from "@/app/api/students/purge/route";
import { POST as exportPOST } from "@/app/api/students/export/route";
import { POST as dupPOST } from "@/app/api/students/check-duplicate/route";
import { studentSchema } from "@/lib/validation/student";
import { bulkStudents, call, resetData, seedMasters, signedIn, studentInput, type Masters } from "../helpers";

let m: Masters;

describe("Students: CRUD, datatable, bulk actions", () => {
  beforeEach(async () => {
    await resetData();
    m = await seedMasters();
  });

  it("STU-01 manual add of a valid student saves it and generates DOS-YYYY-NNNNN (YYYY = batch year, D13)", async () => {
    const { cookie } = await signedIn("ADMIN");
    const r = await call(studentsPOST, { body: studentInput(m, 1, { batchId: m.b2.id }), cookie });
    expect(r.status).toBe(201);
    expect(r.json.studentCode).toBe("DOS-2025-00001");
    const r2 = await call(studentsPOST, { body: studentInput(m, 2, { batchId: m.b2.id }), cookie });
    expect(r2.json.studentCode).toBe("DOS-2025-00002");
    const s = await db.student.findUniqueOrThrow({ where: { id: r.json.id as string } });
    expect(s.phone).toBe("+919000010001");
  });

  it("STU-02 duplicate email is blocked with a link (id + code) to the existing student", async () => {
    const { cookie } = await signedIn("ADMIN");
    const first = await call(studentsPOST, { body: studentInput(m, 1), cookie });
    const dup = await call(studentsPOST, { body: studentInput(m, 2, { email: "S1@EXAMPLE.TEST" }), cookie });
    expect(dup.status).toBe(409);
    expect(dup.json.duplicate).toMatchObject({ id: first.json.id, studentCode: first.json.studentCode, field: "email" });
    const pre = await call(dupPOST, { body: { phone: "9000010001" }, cookie });
    expect((pre.json.duplicates as unknown[]).length).toBe(1);
  });

  it("STU-03 edit and save updates the record; audit shows only changed fields before/after", async () => {
    const { cookie } = await signedIn("ADMIN");
    const c = await call(studentsPOST, { body: studentInput(m, 1), cookie });
    const id = c.json.id as string;
    const r = await call(studentPUT, { method: "PUT", body: { version: 1, data: studentInput(m, 1, { city: "Madurai" }) }, cookie, params: { id } });
    expect(r.status).toBe(200);
    expect(r.json.city).toBe("Madurai");
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "student.update", entityId: id } });
    expect(a.before).toEqual({ city: null });
    expect(a.after).toEqual({ city: "Madurai" });
  });

  it("STU-04 two admins edit the same student: the second save is blocked with the current record for a diff", async () => {
    const a = await signedIn("ADMIN");
    const b = await signedIn("ADMIN");
    const c = await call(studentsPOST, { body: studentInput(m, 1), cookie: a.cookie });
    const id = c.json.id as string;
    expect((await call(studentPUT, { method: "PUT", body: { version: 1, data: studentInput(m, 1, { city: "Salem" }) }, cookie: a.cookie, params: { id } })).status).toBe(200);
    const late = await call(studentPUT, { method: "PUT", body: { version: 1, data: studentInput(m, 1, { city: "Trichy" }) }, cookie: b.cookie, params: { id } });
    expect(late.status).toBe(409);
    expect(late.json.conflict).toBe(true);
    expect((late.json.current as { city: string }).city).toBe("Salem");
    expect((await db.student.findUniqueOrThrow({ where: { id } })).city).toBe("Salem");
  });

  it("STU-05 search by partial phone matches", async () => {
    await bulkStudents(m, 30);
    const { cookie } = await signedIn("VIEWER");
    const r2 = await call(queryPOST, { body: { q: "10015" }, cookie });
    expect(r2.status).toBe(200);
    expect(r2.json.total).toBe(1);
    expect((r2.json.rows as { phone: string }[])[0]!.phone).toBe("+919000010015");
  });

  it("STU-06 batch + department + status filters combine into a correct server-side count", async () => {
    await bulkStudents(m, 120, (i) => ({ batchId: i % 2 ? m.b1.id : m.b2.id, departmentId: i % 3 ? m.cse.id : m.ece.id, statusId: i % 5 ? m.active.id : m.alumni.id }));
    const expected = Array.from({ length: 120 }, (_, i) => i).filter((i) => i % 2 === 1 && i % 3 !== 0 && i % 5 !== 0).length;
    const { cookie } = await signedIn("VIEWER");
    const r = await call(queryPOST, { body: { batchId: [m.b1.id], departmentId: [m.cse.id], statusId: [m.active.id] }, cookie });
    expect(r.json.total).toBe(expected);
    expect(await db.student.count({ where: { batchId: m.b1.id, departmentId: m.cse.id, statusId: m.active.id, deletedAt: null } })).toBe(expected);
  });

  it("STU-07 sort by name is global across pages, stable, and orders Tamil names consistently", async () => {
    await bulkStudents(m, 60, (i) => ({ fullName: i === 7 ? "அருண் குமார்" : `Name ${String.fromCharCode(90 - (i % 26))}${"x".repeat(i % 4)}` }));
    const { cookie } = await signedIn("VIEWER");
    const all: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const r = await call(queryPOST, { body: { sort: "fullName", dir: "asc", page, pageSize: 25 }, cookie });
      all.push(...(r.json.rows as { fullName: string }[]).map((x) => x.fullName));
    }
    expect(all).toHaveLength(60);
    const sorted = [...all].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // C collation = code-point order
    expect(all).toEqual(sorted);
    expect(all[all.length - 1]).toBe("அருண் குமார்");
  });

  it("STU-08 select-all-on-page (25 ids) → bulk status updates exactly 25", async () => {
    await bulkStudents(m, 60);
    const { cookie } = await signedIn("ADMIN");
    const page = await call(queryPOST, { body: { page: 1, pageSize: 25 }, cookie });
    const ids = (page.json.rows as { id: string }[]).map((r) => r.id);
    const r = await call(statusPOST, { body: { selection: { mode: "ids", ids }, statusId: m.alumni.id }, cookie });
    expect(r.json).toEqual({ updated: 25, skipped: 0 });
    expect(await db.student.count({ where: { statusId: m.alumni.id } })).toBe(25);
  });

  it("STU-09 'select all 812 matching' → bulk status updates exactly 812 and stores the reason", async () => {
    await bulkStudents(m, 1000, (i) => ({ batchId: i < 812 ? m.b1.id : m.b2.id }));
    const { cookie } = await signedIn("ADMIN");
    const filter = { batchId: [m.b1.id] };
    const count = await call(queryPOST, { body: { ...filter, pageSize: 25 }, cookie });
    expect(count.json.total).toBe(812);
    const r = await call(statusPOST, { body: { selection: { mode: "filter", filter, expectedCount: 812 }, statusId: m.alumni.id, reason: "Graduated 2025" }, cookie });
    expect(r.json).toEqual({ updated: 812, skipped: 0 });
    expect(await db.student.count({ where: { statusId: m.alumni.id } })).toBe(812);
    const audits = await db.auditLog.findMany({ where: { action: "student.status_change" } });
    expect(audits).toHaveLength(812);
    expect(new Set(audits.map((a) => a.reason))).toEqual(new Set(["Graduated 2025"]));
    // If the matching set changed since the user confirmed, the server refuses (P12)
    const stale = await call(statusPOST, { body: { selection: { mode: "filter", filter, expectedCount: 800 }, statusId: m.active.id }, cookie });
    expect(stale.status).toBe(409);
  });

  it("STU-10 bulk delete 50 soft-deletes them (hidden from list) and undo restores all 50", async () => {
    await bulkStudents(m, 60);
    const { cookie } = await signedIn("ADMIN");
    const ids = (await db.student.findMany({ take: 50, select: { id: true } })).map((s) => s.id);
    const d = await call(deletePOST, { body: { selection: { mode: "ids", ids }, confirmText: "DELETE" }, cookie });
    expect(d.json.deleted).toBe(50);
    expect(await db.student.count({ where: { deletedAt: { not: null } } })).toBe(50);
    expect((await call(queryPOST, { body: {}, cookie })).json.total).toBe(10);
    const undo = d.json.undo as { ids: string[]; deletedAt: string };
    const u = await call(undoPOST, { body: undo, cookie });
    expect(u.json.restored).toBe(50);
    expect((await call(queryPOST, { body: {}, cookie })).json.total).toBe(60);
  });

  it("STU-11 bulk delete of more than 10 without typing DELETE is refused by the server", async () => {
    await bulkStudents(m, 11);
    const { cookie } = await signedIn("ADMIN");
    const ids = (await db.student.findMany({ select: { id: true } })).map((s) => s.id);
    const r = await call(deletePOST, { body: { selection: { mode: "ids", ids }, confirmText: "delete" }, cookie });
    expect(r.status).toBe(400);
    expect(await db.student.count({ where: { deletedAt: null } })).toBe(11);
    const ten = await call(deletePOST, { body: { selection: { mode: "ids", ids: ids.slice(0, 10) } }, cookie });
    expect(ten.json.deleted).toBe(10);
  });

  it("STU-12 Super Admin restores from the Recycle Bin: record back in list, audit entry; Admin can't", async () => {
    await bulkStudents(m, 3);
    const sa = await signedIn("SUPER_ADMIN");
    const ad = await signedIn("ADMIN");
    const id = (await db.student.findFirstOrThrow()).id;
    await call(deletePOST, { body: { selection: { mode: "ids", ids: [id] } }, cookie: ad.cookie });
    expect((await call(restorePOST, { body: { selection: { mode: "ids", ids: [id] } }, cookie: ad.cookie })).status).toBe(403);
    const bin = await call(queryPOST, { body: { deleted: true }, cookie: sa.cookie });
    expect(bin.json.total).toBe(1);
    expect((await call(queryPOST, { body: { deleted: true }, cookie: ad.cookie })).status).toBe(403);
    const r = await call(restorePOST, { body: { selection: { mode: "ids", ids: [id] } }, cookie: sa.cookie });
    expect(r.json.restored).toBe(1);
    expect((await db.student.findUniqueOrThrow({ where: { id } })).deletedAt).toBeNull();
    expect(await db.auditLog.count({ where: { action: "student.restore", entityId: id, actorId: sa.admin.id } })).toBe(1);
  });

  it("STU-12 purge only removes records deleted at least 30 days ago (D6)", async () => {
    await bulkStudents(m, 2);
    const sa = await signedIn("SUPER_ADMIN");
    const [a, b] = await db.student.findMany({ orderBy: { studentCode: "asc" } });
    await db.student.update({ where: { id: a!.id }, data: { deletedAt: new Date(Date.now() - 31 * 86400000) } });
    await db.student.update({ where: { id: b!.id }, data: { deletedAt: new Date() } });
    const noConfirm = await call(purgePOST, { body: { selection: { mode: "ids", ids: [a!.id, b!.id] } }, cookie: sa.cookie });
    expect(noConfirm.status).toBe(400);
    const r = await call(purgePOST, { body: { selection: { mode: "ids", ids: [a!.id, b!.id] }, confirmText: "PURGE" }, cookie: sa.cookie });
    expect(r.json).toEqual({ purged: 1, notYetEligible: 1 });
    expect(await db.student.count()).toBe(1);
  });

  it("STU-13 preview API returns all fields read-only; notes hidden from Viewers", async () => {
    const ad = await signedIn("ADMIN");
    const c = await call(studentsPOST, { body: studentInput(m, 1, { notes: "Prefers evening batch", city: "Coimbatore" }), cookie: ad.cookie });
    const r = await call(studentGET, { cookie: ad.cookie, params: { id: c.json.id as string } });
    expect(r.json).toMatchObject({ studentCode: c.json.studentCode, institution: m.inst.name, department: m.cse.name, batch: "2026-B1", status: "Active", notes: "Prefers evening batch", city: "Coimbatore" });
    const vw = await signedIn("VIEWER");
    expect((await call(studentGET, { cookie: vw.cookie, params: { id: c.json.id as string } })).json.notes).toBeNull();
  });

  it("STU-14 export: permitted columns only, CSV-injection safe, Viewer needs the export flag", async () => {
    await bulkStudents(m, 2, (i) => ({ fullName: i === 0 ? "Ravi Kumar" : "Normal Name", notes: "secret note" }));
    await db.student.updateMany({ where: { fullName: "Ravi Kumar" }, data: { fullName: "=HYPERLINK(\"http://x\")", city: "+SUM(1)" } });
    const ad = await signedIn("ADMIN");
    const r = await call(exportPOST, { body: { filter: {} }, cookie: ad.cookie });
    expect(r.status).toBe(200);
    expect(r.res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(r.text).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(r.text).not.toMatch(/secret note|Notes|Date of birth/);
    const bytes = new Uint8Array(await r.res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads Tamil correctly (P9)
    expect(r.text.split("\r\n")[0]).toBe("Student code,Full name,Email,Phone,Institution,Degree,Department,DOS Club batch,Graduation year,Status,Colour team");
    const vw = await signedIn("VIEWER");
    expect((await call(exportPOST, { body: { filter: {} }, cookie: vw.cookie })).status).toBe(403);
    const vwx = await signedIn("VIEWER", { canExport: true });
    expect((await call(exportPOST, { body: { filter: {} }, cookie: vwx.cookie })).status).toBe(200);
  });

  it("STU-16 student_code can't be edited through the API", async () => {
    const { cookie } = await signedIn("ADMIN");
    const c = await call(studentsPOST, { body: studentInput(m, 1), cookie });
    const r = await call(studentPUT, { method: "PUT", body: { version: 1, data: { ...studentInput(m, 1), studentCode: "DOS-1999-99999" } }, cookie, params: { id: c.json.id as string } });
    expect(r.status).toBe(400);
    expect((await db.student.findUniqueOrThrow({ where: { id: c.json.id as string } })).studentCode).toBe(c.json.studentCode);
    const create = await call(studentsPOST, { body: { ...studentInput(m, 2), studentCode: "DOS-1999-99999" }, cookie });
    expect(create.status).toBe(400);
  });

  it("STU-20 bulk status skips records deleted after selection", async () => {
    await bulkStudents(m, 5);
    const { cookie } = await signedIn("ADMIN");
    const ids = (await db.student.findMany({ select: { id: true } })).map((s) => s.id);
    await db.student.update({ where: { id: ids[0] }, data: { deletedAt: new Date() } });
    const r = await call(statusPOST, { body: { selection: { mode: "ids", ids }, statusId: m.alumni.id }, cookie });
    expect(r.json).toEqual({ updated: 4, skipped: 1 });
  });

  it("STU-21 form validation: graduation year range, age 15–40, LinkedIn domain; same messages as upload", () => {
    const y = new Date().getUTCFullYear();
    const s = studentSchema();
    const base = studentInput(m, 1);
    const e1 = s.safeParse({ ...base, graduationYear: y + 7 });
    expect(e1.success).toBe(false);
    expect(e1.error!.issues[0]!.message).toBe(`Graduation year must be between ${y - 5} and ${y + 6}`);
    const e2 = s.safeParse({ ...base, dateOfBirth: `${y - 10}-01-01` });
    expect(e2.error!.issues[0]!.message).toBe("Age must be between 15 and 40");
    const e3 = s.safeParse({ ...base, linkedinUrl: "https://evil.example/in/x" });
    expect(e3.error!.issues[0]!.message).toBe("LinkedIn URL must be a linkedin.com link");
    expect(s.safeParse({ ...base, linkedinUrl: "https://www.linkedin.com/in/x" }).success).toBe(true);
  });

  it("SEC-05 IDOR: a Viewer (or Admin) fetching a deleted student's id gets 404", async () => {
    await bulkStudents(m, 1);
    const id = (await db.student.findFirstOrThrow()).id;
    await db.student.update({ where: { id }, data: { deletedAt: new Date() } });
    for (const role of ["VIEWER", "ADMIN"] as const) {
      const { cookie } = await signedIn(role);
      expect((await call(studentGET, { cookie, params: { id } })).status).toBe(404);
    }
    const sa = await signedIn("SUPER_ADMIN");
    expect((await call(studentGET, { cookie: sa.cookie, params: { id } })).status).toBe(200);
  });
});
