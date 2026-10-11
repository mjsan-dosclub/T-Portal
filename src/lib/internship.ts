// Internship week maths (INT-2). Pure, unit-tested.

export const DAY_MS = 86_400_000;

export function totalDays(value: number, unit: string) {
  return unit === "WEEKS" ? value * 7 : value;
}

/** Number of weekly reports = ceil(duration ÷ 7 days), at least 1. */
export function totalWeeks(value: number, unit: string) {
  return Math.max(1, Math.ceil(totalDays(value, unit) / 7));
}

/** Week N (1-based) is due at the end of its 7th day: start + 7N days (UTC midnight). */
export function dueDate(start: Date, weekNo: number) {
  return new Date(start.getTime() + weekNo * 7 * DAY_MS);
}

export function endDate(start: Date, value: number, unit: string) {
  return new Date(start.getTime() + (totalDays(value, unit) - 1) * DAY_MS);
}

/** Weeks whose due date has passed (these count towards attendance %). */
export function weeksElapsed(start: Date | null, weeks: number, now = new Date()) {
  if (!start) return 0;
  let n = 0;
  for (let w = 1; w <= weeks; w++) if (dueDate(start, w) <= now) n++;
  return n;
}

export type ReportLite = { weekNo: number; status: string; late: boolean };
export type WeekCell = { weekNo: number; due: string | null; state: "accepted" | "submitted" | "revision" | "missing" | "upcoming"; late: boolean };

/** Per-week state + attendance (INT-2): attended = Submitted or Accepted; Needs revision doesn't count. */
export function weekGrid(start: Date | null, weeks: number, reports: ReportLite[], now = new Date()) {
  const byWeek = new Map(reports.map((r) => [r.weekNo, r]));
  const cells: WeekCell[] = [];
  for (let w = 1; w <= weeks; w++) {
    const r = byWeek.get(w);
    const due = start ? dueDate(start, w) : null;
    const state: WeekCell["state"] = r
      ? r.status === "ACCEPTED" ? "accepted" : r.status === "NEEDS_REVISION" ? "revision" : "submitted"
      : due && due <= now ? "missing" : "upcoming";
    cells.push({ weekNo: w, due: due?.toISOString().slice(0, 10) ?? null, state, late: !!r?.late });
  }
  const attended = cells.filter((c) => c.state === "accepted" || c.state === "submitted").length;
  const elapsed = weeksElapsed(start, weeks, now);
  const counted = Math.max(elapsed, attended); // early submissions count too
  return { cells, attended, elapsed, pct: counted ? Math.round((attended / counted) * 100) : null };
}
