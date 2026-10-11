import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { PUT as personalPUT } from "@/app/api/student/me/personal/route";
import { PUT as aboutPUT } from "@/app/api/student/me/about/route";
import { PUT as prefsPUT } from "@/app/api/student/me/preferences/route";
import { POST as addPOST } from "@/app/api/student/me/sections/[kind]/route";
import { DELETE as itemDELETE, PUT as itemPUT } from "@/app/api/student/me/sections/[kind]/[id]/route";
import { DELETE as resumeDELETE, GET as resumeGET, POST as resumePOST } from "@/app/api/student/me/resume/route";
import { GET as adminResumeGET } from "@/app/api/students/[id]/resume/route";
import { PUT as linksPUT } from "@/app/api/student/me/links/route";
import { POST as projectsPOST } from "@/app/api/student/me/projects/route";
import { hashPassword } from "@/server/auth/password";
import { getProfile } from "@/server/profile";
import { insights } from "@/server/insights";
import { createStudentSession } from "@/server/student/session";
import { bulkStudents, call, resetData, seedMasters, signedIn } from "../helpers";

let ids: string[];
async function studentCookie(studentId: string) {
  const u = await db.studentUser.create({ data: { studentId, passwordHash: await hashPassword("student-password-123"), totpEnabled: true } });
  return `dos_student_session=${await createStudentSession(u.id, true)}`;
}
const add = (kind: string, body: unknown, cookie: string) => call(addPOST, { body, cookie, params: { kind } });
const pdf = (bytes = 2000) => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(bytes, 32)]);
const fileForm = (buf: Buffer, name = "resume.pdf", type = "application/pdf") => {
  const f = new FormData();
  f.set("file", new File([new Uint8Array(buf)], name, { type }));
  return f;
};
const pctOf = async (id: string, key: string) => Math.round(((await getProfile(id)).sections.find((s) => s.key === key)?.score ?? 0) * 100);

describe("Detailed fresher profile (PRF-3)", () => {
  beforeEach(async () => {
    await resetData();
    const m = await seedMasters();
    await bulkStudents(m, 3);
    ids = (await db.student.findMany({ orderBy: { studentCode: "asc" }, select: { id: true } })).map((s) => s.id);
  });

  it("PRF-09 personal details save; implausible DOB rejected; admin-owned fields can't be changed", async () => {
    const c = await studentCookie(ids[0]!);
    const body = { gender: "FEMALE", dateOfBirth: "2005-03-15", city: "Chennai", state: "Tamil Nadu", hometown: "Madurai", languages: [{ name: "Tamil", read: true, write: true, speak: true }, { name: "English", read: true, write: true, speak: true }] };
    expect((await call(personalPUT, { method: "PUT", body, cookie: c })).status).toBe(200);
    const p = await getProfile(ids[0]!);
    expect(p.personal).toMatchObject({ gender: "FEMALE", dateOfBirth: "2005-03-15", city: "Chennai", hometown: "Madurai" });
    expect(p.personal.languages).toHaveLength(2);
    expect(await pctOf(ids[0]!, "personal")).toBe(100);
    expect((await call(personalPUT, { method: "PUT", body: { ...body, dateOfBirth: "2020-01-01" }, cookie: c })).status).toBe(400);
    const sneaky = await call(personalPUT, { method: "PUT", body: { ...body, fullName: "Someone Else", email: "x@example.test" }, cookie: c });
    expect(sneaky.status).toBe(400); // strict schema: unknown fields refused
    expect((await db.student.findUniqueOrThrow({ where: { id: ids[0] } })).email).toBe("s0@example.test");
  });

  it("PRF-10 education: score caps per grading system, year order, Pass/Fail without score", async () => {
    const c = await studentCookie(ids[0]!);
    const base = { level: "CLASS_10", institution: "Govt Higher Secondary School", board: "State Board", startYear: 2019, endYear: 2020, gradingSystem: "PERCENTAGE", score: 91.4 };
    expect((await add("education", base, c)).status).toBe(201);
    expect((await add("education", { ...base, score: 104 }, c)).status).toBe(400);
    expect((await add("education", { ...base, level: "UG", gradingSystem: "CGPA_10", score: 11 }, c)).status).toBe(400);
    expect((await add("education", { ...base, level: "CLASS_12", startYear: 2022, endYear: 2021 }, c)).status).toBe(400);
    expect((await add("education", { ...base, level: "DIPLOMA", gradingSystem: "PASS", score: null }, c)).status).toBe(201);
    expect((await add("education", { ...base, level: "UG", institution: "Example Institute of Technology", course: "B.E.", gradingSystem: "CGPA_10", score: null, ongoing: true }, c)).status).toBe(201);
    expect(await pctOf(ids[0]!, "education")).toBe(100); // 10th + diploma + UG
  });

  it("PRF-11 internships, certifications, accomplishments: dates, links and skills validated", async () => {
    const c = await studentCookie(ids[0]!);
    const intern = { organisation: "Example Labs", role: "Cloud intern", location: "Chennai", workMode: "HYBRID", startMonth: "2026-05", endMonth: "2026-07", stipendMonthly: 10000, description: "Automated deployments with Terraform and GitHub Actions.", skillCodes: ["ARCH"] };
    expect((await add("internships", intern, c)).status).toBe(201);
    expect((await add("internships", { ...intern, endMonth: "2026-01" }, c)).status).toBe(400);
    expect((await add("internships", { ...intern, skillCodes: ["NOPE"] }, c)).status).toBe(400);
    const cert = { name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", issueDate: "2026-02-10", expiryDate: "2029-02-10", noExpiry: false, credentialId: "ABC123", url: "https://example.test/verify/ABC123", skillCodes: [] };
    expect((await add("certifications", cert, c)).status).toBe(201);
    expect((await add("certifications", { ...cert, expiryDate: "2025-01-01" }, c)).status).toBe(400);
    expect((await add("certifications", { ...cert, url: "ftp://x" }, c)).status).toBe(400);
    expect((await add("accomplishments", { type: "HACKATHON", title: "Finalist, Smart India Hackathon", issuer: "Govt of India", date: "2025-12-12", url: null, description: null }, c)).status).toBe(201);
    expect((await add("accomplishments", { type: "LOTTERY", title: "Something" }, c)).status).toBe(400);
    for (const k of ["internships", "certifications", "accomplishments"]) expect(await pctOf(ids[0]!, k)).toBe(100);
  });

  it("PRF-12 tools: case-insensitive duplicates 409, limits, and ownership", async () => {
    const c = await studentCookie(ids[0]!);
    const other = await studentCookie(ids[1]!);
    const r = await add("tools", { name: "Python", version: "3.12", experienceMonths: 18, lastUsedYear: 2026 }, c);
    expect(r.status).toBe(201);
    expect((await add("tools", { name: "  python ", experienceMonths: 1 }, c)).status).toBe(409);
    expect((await call(itemPUT, { method: "PUT", body: { name: "Hacked", experienceMonths: 0 }, cookie: other, params: { kind: "tools", id: r.json.id as string } })).status).toBe(404);
    expect((await call(itemDELETE, { method: "DELETE", cookie: other, params: { kind: "tools", id: r.json.id as string } })).status).toBe(404);
    expect((await call(addPOST, { body: {}, cookie: c, params: { kind: "salary" } })).status).toBe(404);
    for (let i = 0; i < 29; i++) await add("tools", { name: `Tool ${i}`, experienceMonths: 1 }, c);
    expect((await add("tools", { name: "One too many", experienceMonths: 1 }, c)).status).toBe(400);
    expect((await call(itemDELETE, { method: "DELETE", cookie: c, params: { kind: "tools", id: r.json.id as string } })).status).toBe(200);
  });

  it("PRF-13 career preferences: up to 3 active roles, 5 locations, enums, CTC, dates", async () => {
    const c = await studentCookie(ids[0]!);
    const roles = (await db.ontRole.findMany({ take: 4, orderBy: { name: "asc" } })).map((r) => r.id);
    const body = { preferredRoleIds: roles.slice(0, 3), preferredLocations: ["Chennai", "Bengaluru"], jobTypes: ["FULL_TIME"], workModes: ["HYBRID", "ONSITE"], expectedCtcLpa: 4.5, availableFrom: "2027-06-01", willingToRelocate: true };
    expect((await call(prefsPUT, { method: "PUT", body, cookie: c })).status).toBe(200);
    expect(await pctOf(ids[0]!, "preferences")).toBe(100);
    expect((await call(prefsPUT, { method: "PUT", body: { ...body, preferredRoleIds: roles }, cookie: c })).status).toBe(400);
    expect((await call(prefsPUT, { method: "PUT", body: { ...body, preferredLocations: ["a1", "b2", "c3", "d4", "e5", "f6"] }, cookie: c })).status).toBe(400);
    expect((await call(prefsPUT, { method: "PUT", body: { ...body, workModes: ["MOON"] }, cookie: c })).status).toBe(400);
    expect((await call(prefsPUT, { method: "PUT", body: { ...body, expectedCtcLpa: 450000 }, cookie: c })).status).toBe(400);
  });

  it("PRF-14 resume: PDF signature, 2 MB cap, replace/remove, downloads as attachment, admin download audited", async () => {
    const c = await studentCookie(ids[0]!);
    expect((await call(resumePOST, { form: fileForm(Buffer.from("MZ not a pdf"), "resume.pdf"), cookie: c })).status).toBe(400);
    expect((await call(resumePOST, { form: fileForm(pdf(), "resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), cookie: c })).status).toBe(400);
    expect((await call(resumePOST, { form: fileForm(pdf(2 * 1024 * 1024), "big.pdf"), cookie: c })).status).toBe(413);
    expect((await call(resumePOST, { form: fileForm(pdf(), "My Resume.pdf"), cookie: c })).status).toBe(201);
    expect((await call(resumePOST, { form: fileForm(pdf(5000), "v2.pdf"), cookie: c })).status).toBe(201); // replace
    expect((await getProfile(ids[0]!)).resume?.fileName).toBe("v2.pdf");
    const own = await call(resumeGET, { cookie: c });
    expect(own.status).toBe(200);
    expect(own.res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(own.res.headers.get("content-type")).toBe("application/pdf");
    const ad = await signedIn("VIEWER");
    const a = await call(adminResumeGET, { cookie: ad.cookie, params: { id: ids[0]! } });
    expect(a.status).toBe(200);
    expect(await db.auditLog.count({ where: { action: "profile.resume_download", actorId: ad.admin.id } })).toBe(1);
    expect((await call(resumeDELETE, { method: "DELETE", cookie: c })).status).toBe(200);
    expect((await call(resumeGET, { cookie: c })).status).toBe(404);
  });

  it("PRF-15 completeness rises section by section", async () => {
    const c = await studentCookie(ids[0]!);
    const seen: number[] = [(await getProfile(ids[0]!)).completeness];
    const step = async (fn: () => Promise<unknown>) => {
      await fn();
      seen.push((await getProfile(ids[0]!)).completeness);
    };
    await step(() => call(aboutPUT, { method: "PUT", body: { headline: "Final-year CSE student into cloud", summary: "x".repeat(160) }, cookie: c }));
    await step(() => call(linksPUT, { method: "PUT", body: { linkedinUrl: "https://www.linkedin.com/in/x", githubUrl: "", portfolioUrl: "" }, cookie: c }));
    await step(() => add("certifications", { name: "NPTEL Cloud Computing", issuer: "NPTEL", noExpiry: true, skillCodes: [] }, c));
    await step(() => add("tools", { name: "Python", experienceMonths: 6 }, c));
    await step(() => call(projectsPOST, { body: { title: "Bus tracker", description: "Live bus tracking for our college.", projectType: "ACADEMIC", skillCodes: [] }, cookie: c }));
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBe(15); // headline 5 + summary 10
  });

  it("INS-07 insights completeness matches each student's own profile %", async () => {
    const c = await studentCookie(ids[0]!);
    await call(aboutPUT, { method: "PUT", body: { headline: "Aspiring data engineer, Python + SQL", summary: "y".repeat(200) }, cookie: c });
    await add("education", { level: "CLASS_10", institution: "School", gradingSystem: "PERCENTAGE", score: 88 }, c);
    await add("tools", { name: "SQL", experienceMonths: 6 }, c);
    const own = await Promise.all(ids.map((id) => getProfile(id).then((p) => p.completeness)));
    const d = await insights();
    expect(d.completeness.average).toBe(Math.round(own.reduce((a, b) => a + b, 0) / own.length));
    const b = d.completeness.bands;
    expect(b.high + b.mid + b.low).toBe(ids.length);
    const edu = d.completeness.sections.find((s) => s.key === "education")!;
    expect(edu.avgPct).toBe(Math.round(((1 / 3) / ids.length) * 100));
  });
});
