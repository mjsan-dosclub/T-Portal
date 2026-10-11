import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as studentsPOST } from "@/app/api/students/route";
import { POST as queryPOST } from "@/app/api/students/query/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as uploadsPOST } from "@/app/api/uploads/route";
import { POST as exportPOST } from "@/app/api/students/export/route";
import { masterOptions } from "@/server/masters";
import { dashboardStats } from "@/server/reports";
import { bulkStudents, call, resetData, seedMasters, signedIn, studentInput } from "../helpers";

describe("Dashboard, performance, logging, dependencies", () => {
  beforeEach(resetData);

  it("DSH-01 dashboard totals by status, batch and institution match SQL counts", async () => {
    const m = await seedMasters();
    await bulkStudents(m, 40, (i) => ({ batchId: i < 25 ? m.b1.id : m.b2.id, institutionId: i % 4 ? m.inst.id : m.inst2.id, statusId: i % 5 ? m.active.id : m.alumni.id }));
    await db.student.updateMany({ where: { studentCode: "DOS-2026-00001" }, data: { deletedAt: new Date() } }); // deleted rows don't count
    const s = await dashboardStats();
    expect(s.total).toBe(await db.student.count({ where: { deletedAt: null } }));
    expect(s.active).toBe(await db.student.count({ where: { deletedAt: null, status: { isActiveState: true } } }));
    expect(s.byBatch.find((b) => b.label === "2026-B1")!.count).toBe(await db.student.count({ where: { deletedAt: null, batchId: m.b1.id } }));
    expect(s.byInstitution.find((b) => b.label === m.inst2.name)!.count).toBe(await db.student.count({ where: { deletedAt: null, institutionId: m.inst2.id } }));
    expect(s.byStatus.find((b) => b.label === "Alumni")!.count).toBe(await db.student.count({ where: { deletedAt: null, statusId: m.alumni.id } }));
  });

  it("STU-15 with 10,000 students the list API p95 is under 800 ms", async () => {
    const m = await seedMasters();
    await bulkStudents(m, 10_000, (i) => ({ batchId: i % 2 ? m.b1.id : m.b2.id, departmentId: i % 3 ? m.cse.id : m.ece.id }));
    const { cookie } = await signedIn("VIEWER");
    const bodies = [
      { page: 1, pageSize: 25 },
      { page: 200, pageSize: 50, sort: "fullName", dir: "asc" },
      { q: "Student", pageSize: 100, sort: "institution", dir: "desc" },
      { batchId: [m.b1.id], departmentId: [m.cse.id], sort: "studentCode" },
      { q: "10077" },
    ];
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      const r = await call(queryPOST, { body: bodies[i % bodies.length], cookie });
      times.push(performance.now() - t0);
      expect(r.status).toBe(200);
    }
    times.sort((a, b) => a - b);
    const p95 = times[94]!;
    console.info(`STU-15 p95=${p95.toFixed(1)}ms median=${times[49]!.toFixed(1)}ms over 100 requests at 10k rows`);
    expect(p95).toBeLessThan(800);
  }, 180_000);

  it("STU-22 form dropdown options contain only active master values", async () => {
    const m = await seedMasters();
    await db.batch.update({ where: { id: m.b2.id }, data: { isActive: false } });
    await db.studentStatus.update({ where: { id: m.alumni.id }, data: { isActive: false } });
    const o = await masterOptions();
    expect(o.batches.map((b) => b.id)).toEqual([m.b1.id]);
    expect(o.statuses.map((s) => s.id)).not.toContain(m.alumni.id);
    const { cookie } = await signedIn("ADMIN");
    const r = await call(studentsPOST, { body: studentInput(m, 1, { batchId: m.b2.id }), cookie });
    expect(r.status).toBe(400);
    expect((r.json.fields as Record<string, string>).batchId).toBe("This value is inactive");
  });

  it("SEC-03 server logs contain no student PII across normal and error paths", async () => {
    const m = await seedMasters();
    const lines: string[] = [];
    const orig = { info: console.info, error: console.error, log: console.log, warn: console.warn, debug: console.debug };
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => lines.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    process.env.LOG_IN_TESTS = "1";
    try {
      const { cookie } = await signedIn("ADMIN");
      const probe = { fullName: "Probe Person", email: "probe.person@example.test", phone: "+919000077777" };
      await call(studentsPOST, { body: studentInput(m, 1, probe), cookie });
      await call(studentsPOST, { body: studentInput(m, 2, probe), cookie }); // duplicate
      await call(studentsPOST, { body: { ...studentInput(m, 3), email: "bad" }, cookie }); // validation
      await call(queryPOST, { body: { q: "probe.person@example.test" }, cookie });
      await call(exportPOST, { body: { filter: {} }, cookie });
      await call(loginPOST, { body: { email: "probe.person@example.test", password: "nope" } });
      const form = new FormData();
      form.set("file", new File(["full_name,email\nProbe Person,probe.person@example.test"], "x.csv", { type: "text/csv" }));
      await call(uploadsPOST, { form, cookie });
    } finally {
      Object.assign(console, orig);
      delete process.env.LOG_IN_TESTS;
    }
    expect(lines.join("\n")).not.toMatch(/probe\.person|Probe Person|9000077777/i);
  });

  it("SEC-04 secret scan of tracked files is clean (same scanner as GRD-07)", () => {
    const src = readFileSync("tests/unit/guard.test.ts", "utf8");
    expect(src).toMatch(/GRD-07 basic secret scan/);
    const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !/\.(png|ico)$/.test(f) && f !== "package-lock.json" && !f.startsWith("reference/"));
    const hits = tracked.filter((f) => /-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|(APP_ENCRYPTION_KEY|RECOVERY_PEPPER)\s*=\s*["']?[A-Za-z0-9+/=]{20,}/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("SEC-10 npm audit (production deps): no high/critical advisories except documented ones", () => {
    let out = "";
    try {
      out = execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (e) {
      out = (e as { stdout: string }).stdout; // npm exits 1 when advisories exist
    }
    const j = JSON.parse(out) as { vulnerabilities?: Record<string, { severity: string }> };
    const severe = Object.entries(j.vulnerabilities ?? {}).filter(([, v]) => v.severity === "high" || v.severity === "critical").map(([n]) => n);
    const doc = readFileSync("docs/SECURITY_EXCEPTIONS.md", "utf8");
    const rows = doc.split("\n").filter((l) => l.startsWith("| ")).map((l) => l.split("|")[1] ?? "");
    const undocumented = severe.filter((n) => !rows.some((cell) => cell.split(",").map((x) => x.trim()).includes(n)));
    expect(undocumented).toEqual([]);
  }, 120_000);
});
