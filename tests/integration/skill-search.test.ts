import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { SKILL_KEYWORDS, STARTER_SKILLS } from "@/lib/skill-search";

describe("Skill keyword map is grounded in the ontology (UX-2)", () => {
  it("UX-05 every skill code in the keyword map and the starter list exists and is active", async () => {
    const codes = [...new Set([...Object.keys(SKILL_KEYWORDS), ...STARTER_SKILLS])];
    const found = new Set((await db.ontSkill.findMany({ where: { code: { in: codes }, isActive: true }, select: { code: true } })).map((s) => s.code));
    expect(codes.filter((c) => !found.has(c)), "unknown or retired codes in src/lib/skill-search.ts").toEqual([]);
    expect(Object.values(SKILL_KEYWORDS).flat().every((k) => k === k.toLowerCase().trim())).toBe(true);
  });
});
