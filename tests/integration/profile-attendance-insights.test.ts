import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { PUT as targetRolePUT } from "@/app/api/student/me/target-role/route";
import { PUT as skillsPUT } from "@/app/api/student/me/skills/route";
import { PUT as linksPUT } from "@/app/api/student/me/links/route";
import { POST as projectsPOST } from "@/app/api/student/me/projects/route";
import { DELETE as projectDELETE, PUT as projectPUT } from "@/app/api/student/me/projects/[id]/route";
import { GET as profileGET } from "@/app/api/student/me/profile/route";
import { PUT as verifyPUT } from "@/app/api/students/[id]/skills/route";
import { GET as attGET, PUT as attPUT } from "@/app/api/attendance/route";
import { POST as readyExportPOST } from "@/app/api/insights/ready-export/route";
import { hashPassword } from "@/server/auth/password";
import { getProfile } from "@/server/profile";
import { studentAttendance } from "@/server/attendance";
import { insights, readyList } from "@/server/insights";
import { createStudentSession } from "@/server/student/session";
import { bulkStudents, call, resetData, resetOntology, seedMasters, signedIn, type Masters } from "../helpers";

let m: Masters;
let ids: string[];

/** A fully signed-in student session (portal account created directly). */
async function studentCookie(studentId: string) {
  const u = await db.studentUser.create({ data: { studentId, passwordHash: await hashPassword("student-password-123"), totpEnabled: true } });
  return `dos_student_session=${await createStudentSession(u.id, true)}`;
}
async function roleByName(name: string) {
  return db.ontRole.findFirstOrThrow({ where: { name }, include: { skills: true } });
}

describe("Profile, attendance and insights", () => {
  beforeEach(async () => {
    await resetData();
    m = await seedMasters();
    await bulkStudents(m, 6, (i) => ({ batchId: i < 4 ? m.b1.id : m.b2.id }));
    ids = (await db.student.findMany({ orderBy: { studentCode: "asc" }, select: { id: true } })).map((s) => s.id);
  });
  afterAll(resetOntology);

  // ── PRF ──
  it("PRF-02 student sets an active target role; retired or unknown roles are rejected; audited", async () => {
    const c = await studentCookie(ids[0]!);
    const ea = await roleByName("Enterprise Architect");
    expect((await call(targetRolePUT, { method: "PUT", body: { roleId: ea.id }, cookie: c })).status).toBe(200);
    expect((await db.student.findUniqueOrThrow({ where: { id: ids[0] } })).targetRoleId).toBe(ea.id);
    await db.ontRole.update({ where: { id: ea.id }, data: { isActive: false } });
    expect((await call(targetRolePUT, { method: "PUT", body: { roleId: ea.id }, cookie: c })).status).toBe(400);
    await db.ontRole.update({ where: { id: ea.id }, data: { isActive: true } });
    expect((await call(targetRolePUT, { method: "PUT", body: { roleId: "00000000-0000-4000-8000-000000000000" }, cookie: c })).status).toBe(400);
    expect(await db.auditLog.count({ where: { action: "profile.target_role", entityId: ids[0] } })).toBe(1);
  });

  it("PRF-03 self-ratings 0–6 save; bad level / unknown / retired skills rejected; verified untouched", async () => {
    const c = await studentCookie(ids[0]!);
    await db.studentSkill.create({ data: { studentId: ids[0]!, skillCode: "ARCH", selfLevel: 1, verifiedLevel: 3 } });
    expect((await call(skillsPUT, { method: "PUT", body: { ratings: [{ code: "arch", level: 5 }, { code: "STPL", level: 0 }] }, cookie: c })).status).toBe(200);
    const arch = await db.studentSkill.findUniqueOrThrow({ where: { studentId_skillCode: { studentId: ids[0]!, skillCode: "ARCH" } } });
    expect([arch.selfLevel, arch.verifiedLevel]).toEqual([5, 3]);
    expect((await call(skillsPUT, { method: "PUT", body: { ratings: [{ code: "ARCH", level: 7 }] }, cookie: c })).status).toBe(400);
    expect((await call(skillsPUT, { method: "PUT", body: { ratings: [{ code: "NOPE", level: 2 }] }, cookie: c })).status).toBe(400);
    await db.ontSkill.update({ where: { code: "IRMG" }, data: { isActive: false } });
    expect((await call(skillsPUT, { method: "PUT", body: { ratings: [{ code: "IRMG", level: 2 }] }, cookie: c })).status).toBe(400);
    await db.ontSkill.update({ where: { code: "IRMG" }, data: { isActive: true } });
  });

  it("PRF-04 admin verified level wins in the gap and can be cleared; Viewer 403; student 401", async () => {
    const ea = await roleByName("Enterprise Architect");
    await db.student.update({ where: { id: ids[0] }, data: { targetRoleId: ea.id } });
    await db.studentSkill.createMany({ data: ea.skills.map((s) => ({ studentId: ids[0]!, skillCode: s.skillCode, selfLevel: s.level })) });
    expect((await getProfile(ids[0]!)).gap.readiness).toBe("ready");
    const ad = await signedIn("ADMIN");
    expect((await call(verifyPUT, { method: "PUT", body: { ratings: [{ code: "ARCH", verifiedLevel: 2 }] }, cookie: ad.cookie, params: { id: ids[0]! } })).status).toBe(200);
    const p = await getProfile(ids[0]!);
    expect(p.gap.rows.find((r) => r.code === "ARCH")).toMatchObject({ current: 2, source: "verified", met: false });
    expect(p.gap.readiness).toBe("nearly"); // 4 of 5
    expect((await call(verifyPUT, { method: "PUT", body: { ratings: [{ code: "ARCH", verifiedLevel: null }] }, cookie: ad.cookie, params: { id: ids[0]! } })).status).toBe(200);
    expect((await getProfile(ids[0]!)).gap.readiness).toBe("ready");
    const vw = await signedIn("VIEWER");
    expect((await call(verifyPUT, { method: "PUT", body: { ratings: [{ code: "ARCH", verifiedLevel: 4 }] }, cookie: vw.cookie, params: { id: ids[0]! } })).status).toBe(403);
    const sc = await studentCookie(ids[1]!);
    expect((await call(verifyPUT, { method: "PUT", body: { ratings: [{ code: "ARCH", verifiedLevel: 6 }] }, cookie: sc, params: { id: ids[1]! } })).status).toBe(401);
  });

  it("PRF-05 projects: own only, max 10, http(s) links, active skills", async () => {
    const c = await studentCookie(ids[0]!);
    const other = await studentCookie(ids[1]!);
    const body = { title: "Campus bus tracker", description: "Built a live bus tracker with maps for our college.", url: "https://github.com/example/bus", skillCodes: ["ARCH"] };
    const r = await call(projectsPOST, { body, cookie: c });
    expect(r.status).toBe(201);
    const pid = r.json.id as string;
    expect((await call(projectsPOST, { body: { ...body, url: "javascript:alert(1)" }, cookie: c })).status).toBe(400);
    expect((await call(projectsPOST, { body: { ...body, skillCodes: ["NOPE"] }, cookie: c })).status).toBe(400);
    expect((await call(projectPUT, { method: "PUT", body: { ...body, title: "Hijacked title" }, cookie: other, params: { id: pid } })).status).toBe(404);
    expect((await call(projectDELETE, { method: "DELETE", cookie: other, params: { id: pid } })).status).toBe(404);
    expect((await call(projectPUT, { method: "PUT", body: { ...body, title: "Campus bus tracker v2" }, cookie: c, params: { id: pid } })).status).toBe(200);
    for (let i = 0; i < 9; i++) await call(projectsPOST, { body: { ...body, title: `Project number ${i}` }, cookie: c });
    expect((await call(projectsPOST, { body, cookie: c })).status).toBe(400); // 11th
    expect((await call(projectDELETE, { method: "DELETE", cookie: c, params: { id: pid } })).status).toBe(200);
    expect(await db.studentProject.count({ where: { studentId: ids[0] } })).toBe(9);
  });

  it("PRF-06 links: LinkedIn/GitHub on their domain, portfolio any https, blank clears", async () => {
    const c = await studentCookie(ids[0]!);
    expect((await call(linksPUT, { method: "PUT", body: { linkedinUrl: "https://evil.example/in/x", githubUrl: "", portfolioUrl: "" }, cookie: c })).status).toBe(400);
    expect((await call(linksPUT, { method: "PUT", body: { linkedinUrl: "https://www.linkedin.com/in/x", githubUrl: "https://github.com/x", portfolioUrl: "https://x.example.in" }, cookie: c })).status).toBe(200);
    expect((await call(linksPUT, { method: "PUT", body: { linkedinUrl: "", githubUrl: "https://github.com/x", portfolioUrl: "" }, cookie: c })).status).toBe(200);
    const s = await db.student.findUniqueOrThrow({ where: { id: ids[0] } });
    expect([s.linkedinUrl, s.githubUrl, s.portfolioUrl]).toEqual([null, "https://github.com/x", null]);
    const prof = await call(profileGET, { cookie: c });
    expect((prof.json.profile as { completeness: number }).completeness).toBe(5); // online profiles section only (PRF-3 weights)
  });

  // ── ATT ──
  it("ATT-01 saving a sheet: batch members only, null clears, date stored, audit per change", async () => {
    const ad = await signedIn("ADMIN");
    const b1 = ids.slice(0, 4);
    const marks = b1.map((id, i) => ({ studentId: id, status: i === 3 ? "ABSENT" : "PRESENT" }));
    const r = await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: 1, heldOn: "2026-07-01", marks }, cookie: ad.cookie });
    expect(r.json).toEqual({ changed: 4 });
    expect((await db.workshopSession.findUniqueOrThrow({ where: { batchId_workshopN: { batchId: m.b1.id, workshopN: 1 } } })).heldOn!.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(await db.auditLog.count({ where: { action: "attendance.mark" } })).toBe(4);
    const outsider = await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: 1, marks: [{ studentId: ids[5], status: "PRESENT" }] }, cookie: ad.cookie });
    expect(outsider.status).toBe(400);
    const clear = await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: 1, heldOn: "2026-07-01", marks: [{ studentId: b1[3], status: null }, ...marks.slice(0, 3)] }, cookie: ad.cookie });
    expect(clear.json).toEqual({ changed: 1 }); // only the cleared one changed
    expect(await db.attendance.count()).toBe(3);
    const sheet = await call(attGET, { cookie: ad.cookie, url: `http://localhost:3000/api/attendance?batch=${m.b1.id}&workshop=1` });
    expect((sheet.json.sheet as { students: unknown[] }).students).toHaveLength(4);
  });

  it("ATT-02 Viewer can read but not save", async () => {
    const vw = await signedIn("VIEWER");
    expect((await call(attGET, { cookie: vw.cookie, url: `http://localhost:3000/api/attendance?batch=${m.b1.id}` })).status).toBe(200);
    expect((await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: 1, marks: [] }, cookie: vw.cookie })).status).toBe(403);
  });

  it("ATT-03 student attendance % = present ÷ (held − excused)", async () => {
    const ad = await signedIn("ADMIN");
    const s = ids[0]!;
    for (const [n, st] of [[1, "PRESENT"], [2, "ABSENT"], [3, "EXCUSED"], [4, "PRESENT"]] as const) {
      await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: n, marks: [{ studentId: s, status: st }] }, cookie: ad.cookie });
    }
    const a = await studentAttendance(s);
    expect(a).toMatchObject({ present: 2, held: 4, total: 27, pct: 67 }); // 2 ÷ (4 − 1)
  });

  // ── INS ──
  it("INS-01 adoption counts match SQL; deleted excluded; batch filter applies", async () => {
    const ea = await roleByName("Enterprise Architect");
    await db.student.update({ where: { id: ids[0] }, data: { targetRoleId: ea.id } });
    await db.studentSkill.create({ data: { studentId: ids[1]!, skillCode: "ARCH", selfLevel: 2 } });
    await db.studentProject.create({ data: { studentId: ids[2]!, title: "x", description: "y" } });
    await studentCookie(ids[3]!);
    await db.student.update({ where: { id: ids[5] }, data: { deletedAt: new Date(), targetRoleId: ea.id } });
    const all = await insights();
    expect(all.adoption).toMatchObject({ total: 5, activated: 1, withRole: 1, selfRated: 1, verified: 0, withProject: 1 });
    expect((await insights({ batchId: m.b2.id })).adoption.total).toBe(1);
  });

  it("INS-02 readiness classes and the ready list (ready + nearly only, role filter)", async () => {
    const ea = await roleByName("Enterprise Architect");
    for (const [i, meet] of [[0, 5], [1, 4], [2, 2]] as const) {
      await db.student.update({ where: { id: ids[i] }, data: { targetRoleId: ea.id } });
      await db.studentSkill.createMany({ data: ea.skills.slice(0, meet).map((s) => ({ studentId: ids[i]!, skillCode: s.skillCode, selfLevel: s.level })) });
    }
    const d = await insights();
    expect(d.readiness).toEqual({ ready: 1, nearly: 1, developing: 1, "no-role": 3 }); // 6 students, 3 without a role
    const list = await readyList({});
    expect(list.map((r) => [r.id, r.readiness])).toEqual([[ids[0], "ready"], [ids[1], "nearly"]]);
    expect(await readyList({ roleId: (await roleByName("Agentic AI Engineer")).id })).toEqual([]);
    expect((await readyList({ level: "ready" })).length).toBe(1);
  });

  it("INS-03 skill gaps ranked by students not meeting; heatmap share = met ÷ counted", async () => {
    const ea = await roleByName("Enterprise Architect");
    for (const i of [0, 1]) await db.student.update({ where: { id: ids[i] }, data: { targetRoleId: ea.id } });
    await db.studentSkill.create({ data: { studentId: ids[0]!, skillCode: "ARCH", selfLevel: 4 } }); // ARCH met by 1 of 2
    const d = await insights();
    const arch = d.skillGaps.find((g) => g.code === "ARCH")!;
    expect(arch).toMatchObject({ needed: 2, met: 1, notMet: 1 });
    expect(d.skillGaps[0]!.notMet).toBe(2);
    const cells = Object.values(d.heatmap.cells);
    const totals = cells.reduce((a, c) => ({ met: a.met + c.met, n: a.n + c.n }), { met: 0, n: 0 });
    expect(totals).toEqual({ met: 1, n: 10 }); // 2 students × 5 required skills
  });

  it("INS-04 attendance % by batch = present ÷ (held × students − excused)", async () => {
    const ad = await signedIn("ADMIN");
    const b1 = ids.slice(0, 4);
    await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: 1, marks: b1.map((id, i) => ({ studentId: id, status: i === 0 ? "EXCUSED" : i === 1 ? "ABSENT" : "PRESENT" })) }, cookie: ad.cookie });
    await call(attPUT, { method: "PUT", body: { batchId: m.b1.id, workshopN: 2, marks: b1.map((id) => ({ studentId: id, status: "PRESENT" })) }, cookie: ad.cookie });
    const d = await insights({ batchId: m.b1.id });
    expect(d.attendance.byBatch[0]).toMatchObject({ code: "2026-B1", students: 4, held: 2, present: 6, pct: 86 }); // 6 ÷ (8 − 1)
    expect(d.attendance.byWorkshop.find((w) => w.n === 2)!.present).toBe(4);
  });

  it("INS-05 ready-list export needs permission, is CSV-safe and audited", async () => {
    const ea = await roleByName("Enterprise Architect");
    await db.student.update({ where: { id: ids[0] }, data: { targetRoleId: ea.id, fullName: "=cmd" } });
    await db.studentSkill.createMany({ data: ea.skills.map((s) => ({ studentId: ids[0]!, skillCode: s.skillCode, selfLevel: s.level })) });
    const vw = await signedIn("VIEWER");
    expect((await call(readyExportPOST, { body: {}, cookie: vw.cookie })).status).toBe(403);
    const ad = await signedIn("ADMIN");
    const r = await call(readyExportPOST, { body: {}, cookie: ad.cookie });
    expect(r.status).toBe(200);
    expect(r.text).toContain("'=cmd");
    expect(r.text).toContain("Ready for role");
    expect(await db.auditLog.count({ where: { action: "insights.ready_export" } })).toBe(1);
  });
});
