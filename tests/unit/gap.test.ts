import { describe, expect, it } from "vitest";
import { computeGap, currentLevel } from "@/lib/gap";
import { overallCompleteness, scoreSections, SECTIONS, type ProfileFacts } from "@/lib/completeness";

const req = (code: string, required: number) => ({ code, name: code, required });

describe("Skill gap maths", () => {
  it("PRF-01 verified wins over self; missing counts as L0; readiness thresholds", () => {
    expect(currentLevel(undefined)).toEqual({ level: 0, source: "none" });
    expect(currentLevel({ self: 4, verified: 2 })).toEqual({ level: 2, source: "verified" });
    expect(currentLevel({ self: 3, verified: null })).toEqual({ level: 3, source: "self" });
    const five = ["A", "B", "C", "D", "E"].map((c) => req(c, 3));
    const lv = (n: number) => new Map(five.slice(0, n).map((r) => [r.code, { self: 3, verified: null }]));
    expect(computeGap(five, lv(5)).readiness).toBe("ready");
    expect(computeGap(five, lv(4)).readiness).toBe("nearly"); // 80 %
    expect(computeGap(five, lv(3)).readiness).toBe("developing");
    expect(computeGap([], new Map()).readiness).toBe("no-role");
    const g = computeGap([req("X", 4), req("Y", 2)], new Map([["X", { self: 6, verified: 1 }]]));
    expect(g.rows.map((r) => [r.code, r.current, r.gap])).toEqual([["X", 1, 3], ["Y", 0, 2]]); // sorted by gap
    expect(g.totalGapLevels).toBe(5);
  });

  it("PRF-07 completeness: 12 sections, weights sum to 100, partial credit, empty = 0 and full = 100", () => {
    expect(SECTIONS.reduce((n, x) => n + x.weight, 0)).toBe(100);
    const empty: ProfileFacts = { gender: false, dateOfBirth: false, cityState: false, languages: 0, headlineLength: 0, summaryLength: 0, educationLevels: [], tools: 0, projects: 0, internships: 0, certifications: 0, accomplishments: 0, prefRoles: 0, prefLocations: 0, jobTypes: 0, workModes: 0, availableFrom: false, resume: false, links: 0 };
    expect(overallCompleteness(scoreSections(empty))).toBe(0);
    const full: ProfileFacts = { gender: true, dateOfBirth: true, cityState: true, languages: 2, headlineLength: 40, summaryLength: 300, educationLevels: ["CLASS_10", "DIPLOMA", "UG"], tools: 5, projects: 2, internships: 1, certifications: 1, accomplishments: 1, prefRoles: 1, prefLocations: 2, jobTypes: 1, workModes: 1, availableFrom: true, resume: true, links: 1 };
    const sf = scoreSections(full);
    expect(sf.every((x) => x.score === 1 && x.missing.length === 0)).toBe(true);
    expect(overallCompleteness(sf)).toBe(100);
    const partial = scoreSections({ ...empty, educationLevels: ["CLASS_10"], projects: 1, summaryLength: 80 });
    expect(partial.find((x) => x.key === "education")!.score).toBeCloseTo(1 / 3);
    expect(partial.find((x) => x.key === "education")!.missing).toEqual(["Class 12 or Diploma", "your degree (UG/PG)"]);
    expect(partial.find((x) => x.key === "projects")!.score).toBe(0.5);
    expect(partial.find((x) => x.key === "summary")!.score).toBe(0.5);
    expect(overallCompleteness(partial)).toBe(Math.round(15 / 3 + 5 + 5)); // 5 + 5 + 5 = 15
  });

  it("PRF-17 key skills = tools only (career plan is separate): 0 → 0, 1–2 → 30%, 3–4 → 60%, 5+ → 100%", () => {
    const none: ProfileFacts = { gender: false, dateOfBirth: false, cityState: false, languages: 0, headlineLength: 0, summaryLength: 0, educationLevels: [], tools: 0, projects: 0, internships: 0, certifications: 0, accomplishments: 0, prefRoles: 0, prefLocations: 0, jobTypes: 0, workModes: 0, availableFrom: false, resume: false, links: 0 };
    const at = (tools: number) => scoreSections({ ...none, tools }).find((x) => x.key === "skills")!;
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => at(n).score)).toEqual([0, 0.3, 0.3, 0.6, 0.6, 1, 1]);
    expect(at(3).missing).toEqual(["2 more key skill(s) (5 in total)"]);
    expect(at(5).missing).toEqual([]);
    expect(overallCompleteness(scoreSections({ ...none, tools: 3 }))).toBe(9); // 15 × 0.6
  });
});
