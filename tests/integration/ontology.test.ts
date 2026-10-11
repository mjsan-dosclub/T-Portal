import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ontologyCounts, seedOntology } from "@/server/ontology/seed";
import { getRole, listRoles } from "@/server/ontology/queries";

describe("Skills Ontology", () => {
  it("ONT-01 seeded counts are exactly 11 / 51 / 165 / 103 / 103 / 6 / 27 (FACTS F1)", async () => {
    expect(await ontologyCounts(db)).toEqual({ categories: 11, subcategories: 51, skills: 165, roles: 103, roadmaps: 103, levels: 6, workshops: 27 });
  });

  it("ONT-02 re-running the seed is idempotent", async () => {
    const before = await db.ontRoleSkill.count();
    const steps = await db.ontRoadmapStep.count();
    const counts = await seedOntology(db);
    expect(counts).toEqual({ categories: 11, subcategories: 51, skills: 165, roles: 103, roadmaps: 103, levels: 6, workshops: 27 });
    expect(await db.ontRoleSkill.count()).toBe(before);
    expect(await db.ontRoadmapStep.count()).toBe(steps);
  });

  it("ONT-03 Enterprise Architect: STPL, ARCH, ITSP, GOVN, EMRG at L4 and an L4→L5 roadmap", async () => {
    const [r] = await listRoles({ q: "Enterprise Architect" });
    const role = await getRole(r!.id);
    expect(role!.skills.map((s) => `${s.skill.code}@L${s.level}`).sort()).toEqual(["ARCH@L4", "EMRG@L4", "GOVN@L4", "ITSP@L4", "STPL@L4"]);
    expect(role!.roadmapSteps.map((s) => s.levelNum)).toEqual([4, 5]);
  });

  it("ONT-04 role search 'agentic' returns only matching roles", async () => {
    expect((await listRoles({ q: "agentic" })).map((r) => r.name)).toEqual(["Agentic AI Engineer"]);
  });

  it("ONT-05 every role skill code exists in the skills table", async () => {
    const orphans = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ontology_role_skills rs LEFT JOIN ontology_skills s ON s.code = rs."skillCode" WHERE s.code IS NULL`);
    expect(Number(orphans[0]!.n)).toBe(0);
  });

  it("ONT-06 subcategories across the 11 categories sum to 51", async () => {
    const cats = await db.ontCategory.findMany({ include: { _count: { select: { subcategories: true } } } });
    expect(cats).toHaveLength(11);
    expect(cats.reduce((n, c) => n + c._count.subcategories, 0)).toBe(51);
  });

  it("ONT-07 27 workshops in order n = 1..27", async () => {
    const ws = await db.ontWorkshop.findMany({ orderBy: { n: "asc" } });
    expect(ws.map((w) => w.n)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
  });

  it("ONT-08 ontology API is read-only: no mutating handlers exist", () => {
    const dir = path.join(process.cwd(), "src/app/api/ontology");
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : files.push(path.join(d, f))));
    walk(dir);
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/export const (POST|PUT|PATCH|DELETE)\b|export async function (POST|PUT|PATCH|DELETE)\b/);
  });

  it("ONT-09 source is stored for all 165 skills but never selected for display (D11)", async () => {
    expect(await db.ontSkill.count({ where: { source: { not: "" } } })).toBe(165);
    const ui = ["src/server/ontology/queries.ts", "src/app/(app)/ontology"].flatMap((p) => {
      const abs = path.join(process.cwd(), p);
      if (statSync(abs).isFile()) return [readFileSync(abs, "utf8")];
      const out: string[] = [];
      const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : out.push(readFileSync(path.join(d, f), "utf8"))));
      walk(abs);
      return out;
    });
    for (const src of ui) {
      expect(src).not.toMatch(/source:\s*true|\.source\b/);
      expect(src).not.toMatch(/SFIA/i);
    }
  });
});
