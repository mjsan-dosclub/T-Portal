import { describe, expect, it } from "vitest";
import { completeness, computeGap, currentLevel } from "@/lib/gap";

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

  it("PRF-07 completeness is 25 % per part", () => {
    expect(completeness({ hasRole: false, ratedRequired: 0, requiredTotal: 0, projects: 0, links: 0 })).toBe(0);
    expect(completeness({ hasRole: true, ratedRequired: 2, requiredTotal: 3, projects: 1, links: 0 })).toBe(50);
    expect(completeness({ hasRole: true, ratedRequired: 3, requiredTotal: 3, projects: 1, links: 2 })).toBe(100);
  });
});
