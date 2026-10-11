// Skill-gap maths (PRF-2, INS-1). Pure functions so they're unit-tested and shared by student, admin and insights views.

export type RequiredSkill = { code: string; name: string; required: number };
export type LevelPair = { self: number; verified: number | null };

export type GapRow = RequiredSkill & {
  current: number;
  source: "verified" | "self" | "none";
  gap: number;
  met: boolean;
};

export type Readiness = "ready" | "nearly" | "developing" | "no-role";
export const NEARLY_READY_SHARE = 0.8; // INS-1

/** Verified level wins over the self-rating; missing = 0 ("not yet"). */
export function currentLevel(p: LevelPair | undefined): { level: number; source: GapRow["source"] } {
  if (!p) return { level: 0, source: "none" };
  if (p.verified !== null && p.verified !== undefined) return { level: p.verified, source: "verified" };
  return { level: p.self, source: p.self > 0 ? "self" : "none" };
}

export function computeGap(required: RequiredSkill[], levels: Map<string, LevelPair>) {
  const rows: GapRow[] = required.map((r) => {
    const c = currentLevel(levels.get(r.code));
    const gap = Math.max(0, r.required - c.level);
    return { ...r, current: c.level, source: c.source, gap, met: gap === 0 };
  });
  rows.sort((a, b) => b.gap - a.gap || a.code.localeCompare(b.code));
  const total = rows.length;
  const met = rows.filter((r) => r.met).length;
  const share = total ? met / total : 0;
  const readiness: Readiness = total === 0 ? "no-role" : met === total ? "ready" : share >= NEARLY_READY_SHARE ? "nearly" : "developing";
  return { rows, total, met, share, totalGapLevels: rows.reduce((n, r) => n + r.gap, 0), readiness };
}

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: "Ready for role",
  nearly: "Nearly ready",
  developing: "Developing",
  "no-role": "No target role",
};
