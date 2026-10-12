import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { GET as listGET, POST as createPOST } from "@/app/api/internships/route";
import { GET as oneGET, PUT as onePUT } from "@/app/api/internships/[id]/route";
import { POST as assignPOST } from "@/app/api/internships/[id]/assign/route";
import { GET as candidatesGET } from "@/app/api/internships/[id]/candidates/route";
import { POST as withdrawPOST } from "@/app/api/internships/assignments/[id]/withdraw/route";
import { GET as adminFileGET } from "@/app/api/internships/reports/[id]/file/route";
import { POST as reviewPOST } from "@/app/api/internships/reports/[id]/review/route";
import { GET as myGET } from "@/app/api/student/me/internships/route";
import { POST as reportPOST } from "@/app/api/student/me/internships/[assignmentId]/reports/route";
import { GET as myFileGET } from "@/app/api/student/me/internship-reports/[id]/route";
import { hashPassword } from "@/server/auth/password";
import { createStudentSession } from "@/server/student/session";
import { bulkStudents, call, resetData, seedMasters, signedIn } from "../helpers";

const DAY = 86_400_000;
const isoDaysAgo = (n: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - n * DAY).toISOString().slice(0, 10);
const program = (over: Record<string, unknown> = {}) => ({
  companyName: "Nordlicht Analytics GmbH", title: "Data Analyst Intern", description: "Build weekly dashboards and clean sales data with the Berlin analytics team.",
  country: "Germany", city: "Berlin", workMode: "REMOTE", seats: 2, durationValue: 4, durationUnit: "WEEKS", startDate: isoDaysAgo(15), status: "ONGOING", ...over,
});
const pdf = (bytes = 2000) => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(bytes, 32)]);
const zipLike = (...parts: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(parts.join("\0"), "latin1"), Buffer.alloc(200)]);
const form = (buf: Buffer, name: string, weekNo: number | string, note = "") => {
  const f = new FormData();
  f.set("weekNo", String(weekNo));
  f.set("note", note);
  f.set("file", new File([new Uint8Array(buf)], name));
  return f;
};

let ids: string[];
let editor: Awaited<ReturnType<typeof signedIn>>;
async function studentCookie(studentId: string) {
  const u = await db.studentUser.create({ data: { studentId, passwordHash: await hashPassword("student-password-123"), totpEnabled: true } });
  return `dos_student_session=${await createStudentSession(u.id, true)}`;
}
async function newProgram(over: Record<string, unknown> = {}) {
  const r = await call(createPOST, { body: program(over), cookie: editor.cookie });
  expect(r.status).toBe(201);
  return r.json.id as string;
}
async function assignmentOf(programId: string, studentId: string) {
  return (await db.internshipAssignment.findUniqueOrThrow({ where: { programId_studentId: { programId, studentId } } })).id;
}

describe("International internships (INT-1..3)", () => {
  beforeEach(async () => {
    await resetData();
    const m = await seedMasters();
    await bulkStudents(m, 4);
    ids = (await db.student.findMany({ orderBy: { studentCode: "asc" }, select: { id: true } })).map((s) => s.id);
    editor = await signedIn("ADMIN");
  });

  it("INT-01 create a program: code INT-YYYY-NNN, validation, Viewer read-only", async () => {
    const id = await newProgram();
    const p = await db.internshipProgram.findUniqueOrThrow({ where: { id } });
    expect(p.code).toBe(`INT-${new Date().getUTCFullYear()}-001`);
    expect(await newProgram({ title: "Second program" })).not.toBe(id);
    expect((await db.internshipProgram.findFirstOrThrow({ where: { title: "Second program" } })).code).toMatch(/-002$/);

    const bad = await call(createPOST, { body: program({ seats: 0, description: "short", workMode: "" }), cookie: editor.cookie });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.json.fields as object)).toEqual(expect.arrayContaining(["seats", "description", "workMode"]));
    expect((await call(createPOST, { body: program({ startDate: null }), cookie: editor.cookie })).status).toBe(400); // ongoing needs a start date
    expect((await call(createPOST, { body: program({ durationValue: 120, durationUnit: "WEEKS" }), cookie: editor.cookie })).status).toBe(400); // > 2 years

    const viewer = await signedIn("VIEWER");
    expect((await call(createPOST, { body: program(), cookie: viewer.cookie })).status).toBe(403);
    expect((await call(onePUT, { method: "PUT", body: program(), cookie: viewer.cookie, params: { id } })).status).toBe(403);
    const list = await call(listGET, { cookie: viewer.cookie });
    expect(list.status).toBe(200);
    expect((list.json.programs as unknown[]).length).toBe(2);
    expect(await db.auditLog.count({ where: { action: "internship.create" } })).toBe(2);
  });

  it("INT-02 assign students within the seat limit; withdraw frees a seat; seats can't drop below assigned", async () => {
    const id = await newProgram({ seats: 2 });
    const over = await call(assignPOST, { body: { studentIds: ids.slice(0, 3) }, cookie: editor.cookie, params: { id } });
    expect(over.status).toBe(400);
    expect(over.json.error).toMatch(/Only 2 seat/);
    const ok = await call(assignPOST, { body: { studentIds: ids.slice(0, 2) }, cookie: editor.cookie, params: { id } });
    expect(ok.json).toEqual({ assigned: 2, alreadyAssigned: 0 });
    expect((await call(assignPOST, { body: { studentIds: [ids[0]] }, cookie: editor.cookie, params: { id } })).json).toEqual({ assigned: 0, alreadyAssigned: 1 });
    expect((await call(assignPOST, { body: { studentIds: [ids[2]] }, cookie: editor.cookie, params: { id } })).status).toBe(400); // full

    expect((await call(onePUT, { method: "PUT", body: program({ seats: 1 }), cookie: editor.cookie, params: { id } })).status).toBe(400);
    const cand = await call(candidatesGET, { cookie: editor.cookie, params: { id }, url: "http://localhost:3000/api/x?q=" });
    expect((cand.json.students as { assigned: boolean }[]).filter((s) => s.assigned).length).toBe(2);

    const a0 = await assignmentOf(id, ids[0]!);
    expect((await call(withdrawPOST, { body: { reason: "Visa delayed" }, cookie: editor.cookie, params: { id: a0 } })).status).toBe(200);
    expect((await call(assignPOST, { body: { studentIds: [ids[2]] }, cookie: editor.cookie, params: { id } })).json).toEqual({ assigned: 1, alreadyAssigned: 0 });
    expect((await call(assignPOST, { body: { studentIds: [ids[0]] }, cookie: editor.cookie, params: { id } })).status).toBe(400); // full again
    const d = await call(oneGET, { cookie: editor.cookie, params: { id } });
    const statuses = (d.json.assignments as { status: string }[]).map((a) => a.status).sort();
    expect(statuses).toEqual(["ASSIGNED", "ASSIGNED", "WITHDRAWN"]);

    const cancelled = await newProgram({ status: "CANCELLED" });
    expect((await call(assignPOST, { body: { studentIds: [ids[3]] }, cookie: editor.cookie, params: { id: cancelled } })).status).toBe(400);
    const viewer = await signedIn("VIEWER");
    expect((await call(assignPOST, { body: { studentIds: [ids[3]] }, cookie: viewer.cookie, params: { id } })).status).toBe(403);
    expect(await db.auditLog.count({ where: { action: "internship.assign" } })).toBe(3);
  });

  it("INT-03 a student sees only their own assigned, published programs", async () => {
    const live = await newProgram();
    const draft = await newProgram({ status: "DRAFT", title: "Hidden draft" });
    const other = await newProgram({ title: "Someone else's" });
    await call(assignPOST, { body: { studentIds: [ids[0]] }, cookie: editor.cookie, params: { id: live } });
    await call(assignPOST, { body: { studentIds: [ids[0]] }, cookie: editor.cookie, params: { id: draft } });
    await call(assignPOST, { body: { studentIds: [ids[1]] }, cookie: editor.cookie, params: { id: other } });
    const c0 = await studentCookie(ids[0]!);
    const mine = (await call(myGET, { cookie: c0 })).json.programs as { program: { title: string; weeks: number }; openWeeks: number[] }[];
    expect(mine.map((p) => p.program.title)).toEqual(["Data Analyst Intern"]);
    expect(mine[0]!.program.weeks).toBe(4);
    expect(mine[0]!.openWeeks).toEqual([1, 2, 3]); // started 15 days ago

    // Another student's assignment can't be used, and withdrawn programs disappear
    const otherAssignment = await assignmentOf(other, ids[1]!);
    expect((await call(reportPOST, { form: form(pdf(), "w1.pdf", 1), cookie: c0, params: { assignmentId: otherAssignment } })).status).toBe(404);
    await call(withdrawPOST, { body: {}, cookie: editor.cookie, params: { id: await assignmentOf(live, ids[0]!) } });
    expect(((await call(myGET, { cookie: c0 })).json.programs as unknown[]).length).toBe(0);
    expect((await call(myGET, {})).status).toBe(401);
  });

  it("INT-04 weekly report files: office/PDF/text accepted by content; archives, renamed and executable files rejected", async () => {
    const id = await newProgram();
    await call(assignPOST, { body: { studentIds: [ids[0]] }, cookie: editor.cookie, params: { id } });
    const aid = await assignmentOf(id, ids[0]!);
    const c = await studentCookie(ids[0]!);
    const up = (buf: Buffer, name: string, week = 1) => call(reportPOST, { form: form(buf, name, week), cookie: c, params: { assignmentId: aid } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Task", "Hours"], ["Dashboard", 12]]), "Week");
    const xlsx = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const docx = zipLike("[Content_Types].xml", "word/document.xml");

    expect((await up(Buffer.from("PK\x03\x04 just an archive"), "report.zip")).status).toBe(400);
    expect((await up(zipLike("notes/a.txt", "notes/b.txt"), "report.docx")).status).toBe(400); // a zip renamed to .docx
    expect((await up(xlsx, "report.docx")).status).toBe(400); // an Excel file renamed to .docx
    expect((await up(Buffer.from("MZ\x90\x00 program"), "report.pdf")).status).toBe(400);
    expect((await up(Buffer.from("MZ\x90\x00 program"), "report.txt")).status).toBe(400);
    expect((await up(pdf(), "report.png")).status).toBe(400);
    expect((await up(Buffer.alloc(0), "empty.pdf")).status).toBe(400);
    expect((await up(pdf(4 * 1024 * 1024), "big.pdf")).status).toBe(413);

    expect((await up(pdf(), "week1.pdf", 1)).status).toBe(201);
    expect((await up(xlsx, "week2-hours.xlsx", 2)).status).toBe(201);
    expect((await up(docx, "week3.docx", 3)).status).toBe(201);
    expect((await up(Buffer.from("task,hours\ndashboard,12\n"), "week3.csv", 3)).status).toBe(201); // replaces week 3
    expect((await up(pdf(), "week4.pdf", 4)).status).toBe(400); // week 4 hasn't started
    expect((await up(pdf(), "week9.pdf", 9)).status).toBe(400); // beyond the program
    const rows = await db.weeklyReport.findMany({ where: { assignmentId: aid }, orderBy: { weekNo: "asc" }, select: { weekNo: true, fileType: true, late: true } });
    expect(rows).toEqual([{ weekNo: 1, fileType: "pdf", late: true }, { weekNo: 2, fileType: "xlsx", late: true }, { weekNo: 3, fileType: "csv", late: false }]);
    expect(await db.auditLog.count({ where: { action: "internship.report_resubmit" } })).toBe(1);
  });

  it("INT-05 review: needs-revision requires a note and doesn't count as attendance; accepted reports are locked", async () => {
    const id = await newProgram();
    await call(assignPOST, { body: { studentIds: [ids[0]] }, cookie: editor.cookie, params: { id } });
    const aid = await assignmentOf(id, ids[0]!);
    const c = await studentCookie(ids[0]!);
    for (const w of [1, 2]) await call(reportPOST, { form: form(pdf(), `w${w}.pdf`, w), cookie: c, params: { assignmentId: aid } });
    const [r1, r2] = await db.weeklyReport.findMany({ where: { assignmentId: aid }, orderBy: { weekNo: "asc" } });
    const att = async () => ((await call(myGET, { cookie: c })).json.programs as { grid: { pct: number | null; attended: number; elapsed: number } }[])[0]!.grid;
    expect(await att()).toMatchObject({ attended: 2, elapsed: 2, pct: 100 });

    expect((await call(reviewPOST, { body: { status: "NEEDS_REVISION" }, cookie: editor.cookie, params: { id: r2!.id } })).status).toBe(400);
    expect((await call(reviewPOST, { body: { status: "NEEDS_REVISION", note: "Add the hours per task" }, cookie: editor.cookie, params: { id: r2!.id } })).status).toBe(200);
    expect(await att()).toMatchObject({ attended: 1, pct: 50 });
    const feedback = ((await call(myGET, { cookie: c })).json.programs as { reports: { weekNo: number; reviewNote: string | null }[] }[])[0]!.reports.find((r) => r.weekNo === 2);
    expect(feedback!.reviewNote).toBe("Add the hours per task");

    await call(reportPOST, { form: form(pdf(3000), "w2-v2.pdf", 2), cookie: c, params: { assignmentId: aid } });
    const again = await db.weeklyReport.findUniqueOrThrow({ where: { id: r2!.id } });
    expect(again).toMatchObject({ status: "SUBMITTED", reviewNote: null, fileName: "w2-v2.pdf" });
    expect(await att()).toMatchObject({ attended: 2, pct: 100 });

    expect((await call(reviewPOST, { body: { status: "ACCEPTED" }, cookie: editor.cookie, params: { id: r1!.id } })).status).toBe(200);
    expect((await call(reportPOST, { form: form(pdf(), "w1-again.pdf", 1), cookie: c, params: { assignmentId: aid } })).status).toBe(409);
    const viewer = await signedIn("VIEWER");
    expect((await call(reviewPOST, { body: { status: "ACCEPTED" }, cookie: viewer.cookie, params: { id: r2!.id } })).status).toBe(403);
    const list = (await call(listGET, { cookie: editor.cookie })).json.programs as { compliance: number; pendingReviews: number }[];
    expect(list[0]).toMatchObject({ compliance: 100, pendingReviews: 1 });
  });

  it("INT-06 downloads: students get only their own; admin downloads are audited attachments", async () => {
    const id = await newProgram();
    await call(assignPOST, { body: { studentIds: [ids[0], ids[1]] }, cookie: editor.cookie, params: { id } });
    const c0 = await studentCookie(ids[0]!);
    const c1 = await studentCookie(ids[1]!);
    await call(reportPOST, { form: form(Buffer.from("Week 1: cleaned the sales data.\n"), "week1.txt", 1, "First week"), cookie: c0, params: { assignmentId: await assignmentOf(id, ids[0]!) } });
    const r = await db.weeklyReport.findFirstOrThrow();
    const own = await call(myFileGET, { cookie: c0, params: { id: r.id } });
    expect(own.status).toBe(200);
    expect(own.text).toContain("cleaned the sales data");
    expect(own.res.headers.get("content-disposition")).toBe('attachment; filename="week1.txt"');
    expect(own.res.headers.get("content-security-policy")).toContain("sandbox");
    expect((await call(myFileGET, { cookie: c1, params: { id: r.id } })).status).toBe(404);

    const viewer = await signedIn("VIEWER");
    const a = await call(adminFileGET, { cookie: viewer.cookie, params: { id: r.id } });
    expect(a.status).toBe(200);
    expect(a.res.headers.get("content-type")).toBe("text/plain");
    expect(await db.auditLog.count({ where: { action: "internship.report_download", actorId: viewer.admin.id } })).toBe(1);
    expect((await call(adminFileGET, { cookie: viewer.cookie, params: { id: "not-a-uuid" } })).status).toBe(404);
  });

  it("INT-10 partner-college students are listed first and flagged; 'partner only' filter; others can still be assigned", async () => {
    const partner = await db.institution.create({ data: { name: "Partner College of Engineering", nameKey: "partner college of engineering", isPartner: true } });
    await db.student.updateMany({ where: { id: { in: [ids[2]!, ids[3]!] } }, data: { institutionId: partner.id } });
    const id = await newProgram({ seats: 4 });
    const url = (q: string) => `http://localhost:3000/api/x?${q}`;
    const all = (await call(candidatesGET, { cookie: editor.cookie, params: { id }, url: url("q=") })).json.students as { id: string; partner: boolean }[];
    expect(all.map((s) => s.partner)).toEqual([true, true, false, false]);
    expect(all.slice(0, 2).map((s) => s.id).sort()).toEqual([ids[2], ids[3]].sort());
    const only = (await call(candidatesGET, { cookie: editor.cookie, params: { id }, url: url("q=&partner=1") })).json.students as { partner: boolean }[];
    expect(only.length).toBe(2);
    expect(only.every((s) => s.partner)).toBe(true);

    expect((await call(assignPOST, { body: { studentIds: [ids[0], ids[2]] }, cookie: editor.cookie, params: { id } })).json).toEqual({ assigned: 2, alreadyAssigned: 0 });
    const roster = (await call(oneGET, { cookie: editor.cookie, params: { id } })).json.assignments as { student: { id: string; partner: boolean } }[];
    expect(Object.fromEntries(roster.map((a) => [a.student.id, a.student.partner]))).toEqual({ [ids[0]!]: false, [ids[2]!]: true });
  });
});
