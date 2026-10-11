import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as mastersPOST } from "@/app/api/masters/[type]/route";
import { DELETE as masterDELETE, PATCH as masterPATCH } from "@/app/api/masters/[type]/[id]/route";
import { POST as importPOST } from "@/app/api/masters/[type]/import/route";
import { masterOptions } from "@/server/masters";
import { evaluateRows } from "@/server/upload/students-upload";
import { bulkStudents, call, resetData, seedMasters, signedIn } from "../helpers";

function csvForm(name: string, text: string, dryRun: boolean) {
  const f = new FormData();
  f.set("file", new File([text], name, { type: "text/csv" }));
  f.set("dryRun", String(dryRun));
  return f;
}

describe("Master tables", () => {
  beforeEach(resetData);

  it("MST-01 'Computer Science' is rejected when 'computer science' exists (case-insensitive)", async () => {
    const { cookie } = await signedIn("ADMIN");
    expect((await call(mastersPOST, { body: { name: "computer science" }, cookie, params: { type: "departments" } })).status).toBe(201);
    const dup = await call(mastersPOST, { body: { name: "Computer Science" }, cookie, params: { type: "departments" } });
    expect(dup.status).toBe(409);
  });

  it("MST-02 deleting a department used by students is blocked and deactivation is offered", async () => {
    const m = await seedMasters();
    await bulkStudents(m, 3);
    const { cookie } = await signedIn("ADMIN");
    const r = await call(masterDELETE, { method: "DELETE", cookie, params: { type: "departments", id: m.cse.id } });
    expect(r.status).toBe(409);
    expect(r.json.canDeactivate).toBe(true);
    expect(r.json.inUse).toBe(3);
    expect(await db.department.count({ where: { id: m.cse.id } })).toBe(1);
    // unused one can be deleted
    expect((await call(masterDELETE, { method: "DELETE", cookie, params: { type: "departments", id: m.ece.id } })).status).toBe(200);
  });

  it("MST-03 a deactivated value is hidden from new-student options but kept for existing records", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("ADMIN");
    expect((await call(masterPATCH, { method: "PATCH", body: { isActive: false }, cookie, params: { type: "departments", id: m.ece.id } })).status).toBe(200);
    const opts = await masterOptions();
    expect(opts.departments.map((d) => d.id)).not.toContain(m.ece.id);
    const forExisting = await masterOptions([m.ece.id]);
    expect(forExisting.departments.find((d) => d.id === m.ece.id)?.isActive).toBe(false);
  });

  it("MST-04 department alias 'CSE' auto-maps during upload", async () => {
    const m = await seedMasters();
    const { evals } = await evaluateRows(
      [{ rowNo: 2, raw: { full_name: "Arun Kumar", email: "arun@example.test", phone: "9000012345", institution: "EIT", degree: "B.E.", department: "cse", graduation_year: String(new Date().getUTCFullYear() + 1), batch: "2026-B1" } }],
      {},
    );
    expect(evals[0]!.status).toBe("VALID");
    expect(evals[0]!.normalized!.departmentId).toBe(m.cse.id);
  });

  it("MST-05 extra spaces are collapsed and still detected as duplicates", async () => {
    const { cookie } = await signedIn("ADMIN");
    const r = await call(mastersPOST, { body: { name: "  Computer   Science " }, cookie, params: { type: "departments" } });
    expect(r.status).toBe(201);
    expect((await db.department.findUniqueOrThrow({ where: { id: r.json.id as string } })).name).toBe("Computer Science");
    expect((await call(mastersPOST, { body: { name: "computer science" }, cookie, params: { type: "departments" } })).status).toBe(409);
  });

  it("MST-06 the same alias can't belong to two departments", async () => {
    const { cookie } = await signedIn("ADMIN");
    expect((await call(mastersPOST, { body: { name: "Computer Science and Engineering", aliases: ["CS"] }, cookie, params: { type: "departments" } })).status).toBe(201);
    const r = await call(mastersPOST, { body: { name: "Computer Science (Hons)", aliases: ["cs"] }, cookie, params: { type: "departments" } });
    expect(r.status).toBe(409);
  });

  it("MST-07 master CSV import: 20 valid + 2 duplicates → preview flags 2, confirm imports 20", async () => {
    const { cookie } = await signedIn("ADMIN");
    await call(mastersPOST, { body: { name: "Existing College" }, cookie, params: { type: "institutions" } });
    const rows = Array.from({ length: 20 }, (_, i) => `College ${String.fromCharCode(65 + i)},C${i},Chennai,Tamil Nadu,yes`);
    const csv = ["name,short_code,city,state,is_partner", ...rows, "existing college,,,,", "College A,,,,"].join("\n");
    const preview = await call(importPOST, { form: csvForm("inst.csv", csv, true), cookie, params: { type: "institutions" } });
    expect(preview.status).toBe(200);
    expect(preview.json.summary).toMatchObject({ total: 22, valid: 20, duplicates: 2, errors: 0 });
    expect(await db.institution.count()).toBe(1); // dry run wrote nothing
    const done = await call(importPOST, { form: csvForm("inst.csv", csv, false), cookie, params: { type: "institutions" } });
    expect((done.json.summary as { imported: number }).imported).toBe(20);
    expect(await db.institution.count()).toBe(21);
  });

  it("MST-08 master CSV with 1,001 rows is rejected", async () => {
    const { cookie } = await signedIn("ADMIN");
    const csv = ["name", ...Array.from({ length: 1001 }, (_, i) => `Team ${i}`)].join("\n");
    const r = await call(importPOST, { form: csvForm("teams.csv", csv, true), cookie, params: { type: "colour-teams" } });
    expect(r.status).toBe(400);
    expect(String(r.json.error)).toMatch(/1,000/);
  });

  it("MST-09 batch end date before start date is rejected", async () => {
    const { cookie } = await signedIn("ADMIN");
    const r = await call(mastersPOST, { body: { batchCode: "2026-B9", year: 2026, startDate: "2026-06-01", endDate: "2026-01-01" }, cookie, params: { type: "batches" } });
    expect(r.status).toBe(400);
    expect((r.json.fields as Record<string, string>).endDate).toMatch(/after/);
  });

  it("MST-10 Viewer can't create or edit masters", async () => {
    const m = await seedMasters();
    const { cookie } = await signedIn("VIEWER");
    expect((await call(mastersPOST, { body: { name: "X" }, cookie, params: { type: "institutions" } })).status).toBe(403);
    expect((await call(masterPATCH, { method: "PATCH", body: { isActive: false }, cookie, params: { type: "institutions", id: m.inst.id } })).status).toBe(403);
  });
});
