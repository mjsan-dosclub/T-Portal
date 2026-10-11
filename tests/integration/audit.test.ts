import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as studentsPOST } from "@/app/api/students/route";
import { POST as mastersPOST } from "@/app/api/masters/[type]/route";
import { call, resetData, seedMasters, signedIn, studentInput } from "../helpers";

describe("Audit log", () => {
  beforeEach(resetData);

  it("AUD-01 create on student and master writes one audit row with actor, action, entity, id, after, ip, user agent", async () => {
    const m = await seedMasters();
    const { cookie, admin } = await signedIn("ADMIN");
    const s = await call(studentsPOST, { body: studentInput(m, 1), cookie, ip: "10.9.9.9" });
    expect(s.status).toBe(201);
    const a = await db.auditLog.findFirstOrThrow({ where: { entity: "student", entityId: s.json.id as string } });
    expect(a).toMatchObject({ actorId: admin.id, action: "student.create", ip: "10.9.9.9", userAgent: "vitest" });
    expect(a.after).toBeTruthy();
    const mm = await call(mastersPOST, { body: { name: "Mechanical Engineering" }, cookie, params: { type: "departments" } });
    expect(await db.auditLog.count({ where: { entity: "master:departments", entityId: mm.json.id as string, action: "master.create" } })).toBe(1);
  });

  it("AUD-02 audit rows can't be updated or deleted (database trigger)", async () => {
    await db.auditLog.create({ data: { action: "test", entity: "x" } });
    await expect(db.auditLog.updateMany({ data: { action: "changed" } })).rejects.toThrow();
    await expect(db.auditLog.deleteMany({})).rejects.toThrow();
    expect(await db.auditLog.count({ where: { action: "test" } })).toBe(1);
  });

  it("AUD-03 student PII lives in audit before/after only, never in application logs", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("ADMIN");
    const lines: string[] = [];
    const orig = { info: console.info, error: console.error, log: console.log, warn: console.warn };
    for (const k of ["info", "error", "log", "warn"] as const) console[k] = (...a: unknown[]) => lines.push(a.map(String).join(" "));
    process.env.LOG_IN_TESTS = "1";
    try {
      await call(studentsPOST, { body: studentInput(m, 7, { email: "pii.probe@example.test" }), cookie });
      await call(studentsPOST, { body: studentInput(m, 8, { email: "pii.probe@example.test" }), cookie }); // duplicate → error path
    } finally {
      Object.assign(console, orig);
      delete process.env.LOG_IN_TESTS;
    }
    expect(lines.join("\n")).not.toMatch(/pii\.probe|9000010007/);
    const a = await db.auditLog.findFirstOrThrow({ where: { action: "student.create" } });
    expect(JSON.stringify(a.after)).toMatch(/pii\.probe@example\.test/);
  });
});
