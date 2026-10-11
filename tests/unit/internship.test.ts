import { describe, expect, it } from "vitest";
import { dueDate, endDate, totalWeeks, weekGrid } from "@/lib/internship";

const start = new Date("2026-09-01T00:00:00Z");

describe("Internship week maths (INT-2)", () => {
  it("INT-07 weeks, due dates and end date from days or weeks", () => {
    expect(totalWeeks(4, "WEEKS")).toBe(4);
    expect(totalWeeks(30, "DAYS")).toBe(5);
    expect(totalWeeks(3, "DAYS")).toBe(1);
    expect(dueDate(start, 1).toISOString().slice(0, 10)).toBe("2026-09-08");
    expect(endDate(start, 4, "WEEKS").toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(endDate(start, 30, "DAYS").toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("INT-08 attendance = submitted or accepted ÷ weeks due; revision and missing don't count; no start → no %", () => {
    const now = new Date("2026-09-23T12:00:00Z"); // weeks 1–3 due
    const g = weekGrid(start, 4, [
      { weekNo: 1, status: "ACCEPTED", late: false },
      { weekNo: 2, status: "NEEDS_REVISION", late: true },
      { weekNo: 4, status: "SUBMITTED", late: false }, // early
    ], now);
    expect(g.cells.map((c) => c.state)).toEqual(["accepted", "revision", "missing", "submitted"]);
    expect(g).toMatchObject({ attended: 2, elapsed: 3, pct: 67 });
    expect(weekGrid(null, 4, [], now)).toMatchObject({ elapsed: 0, pct: null });
    expect(weekGrid(start, 4, [], new Date("2026-09-02T00:00:00Z")).cells.every((c) => c.state === "upcoming")).toBe(true);
  });
});
