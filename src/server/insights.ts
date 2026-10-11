import "server-only";
import { db } from "@/lib/db";
import { computeGap, type LevelPair, type Readiness } from "@/lib/gap";
import { toCsv } from "@/lib/normalize";
import { audit } from "./audit";
import type { SessionAdmin } from "./auth/session";

// Insights (INS-1). Aggregates computed from current data; deleted students excluded everywhere.

export type InsightFilter = { batchId?: string; institutionId?: string };

async function loadCohort(f: InsightFilter) {
  const students = await db.student.findMany({
    where: { deletedAt: null, ...(f.batchId ? { batchId: f.batchId } : {}), ...(f.institutionId ? { institutionId: f.institutionId } : {}) },
    select: {
      id: true, studentCode: true, fullName: true, batchId: true, targetRoleId: true,
      batch: { select: { batchCode: true } }, institution: { select: { name: true } },
      portalUser: { select: { id: true } },
      skills: { select: { skillCode: true, selfLevel: true, verifiedLevel: true } },
      _count: { select: { projects: true } },
    },
  });
  const roleIds = [...new Set(students.map((s) => s.targetRoleId).filter((x): x is string => !!x))];
  const roles = await db.ontRole.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, name: true, isActive: true, skills: { where: { skill: { isActive: true } }, select: { level: true, skill: { select: { code: true, name: true, subcategory: { select: { category: { select: { id: true, name: true } } } } } } } } },
  });
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const evaluated = students.map((s) => {
    const role = s.targetRoleId ? roleMap.get(s.targetRoleId) : undefined;
    const levels = new Map<string, LevelPair>(s.skills.map((k) => [k.skillCode, { self: k.selfLevel, verified: k.verifiedLevel }]));
    const required = (role?.skills ?? []).map((r) => ({ code: r.skill.code, name: r.skill.name, required: r.level, category: r.skill.subcategory.category }));
    const gap = computeGap(required, levels);
    return { s, role, required, gap };
  });
  return { evaluated };
}

export async function insights(f: InsightFilter = {}) {
  const { evaluated } = await loadCohort(f);
  const total = evaluated.length;

  const adoption = {
    total,
    activated: evaluated.filter((e) => e.s.portalUser).length,
    withRole: evaluated.filter((e) => e.role).length,
    selfRated: evaluated.filter((e) => e.s.skills.some((k) => k.selfLevel > 0)).length,
    verified: evaluated.filter((e) => e.s.skills.some((k) => k.verifiedLevel !== null)).length,
    withProject: evaluated.filter((e) => e.s._count.projects > 0).length,
  };

  const readiness: Record<Readiness, number> = { ready: 0, nearly: 0, developing: 0, "no-role": 0 };
  for (const e of evaluated) readiness[e.gap.readiness]++;

  // Skill demand: how many students' target roles need each skill, and how many already meet it.
  const demand = new Map<string, { code: string; name: string; needed: number; met: number; gapLevels: number }>();
  for (const e of evaluated)
    for (const r of e.gap.rows) {
      const d = demand.get(r.code) ?? { code: r.code, name: r.name, needed: 0, met: 0, gapLevels: 0 };
      d.needed++;
      if (r.met) d.met++;
      d.gapLevels += r.gap;
      demand.set(r.code, d);
    }
  const skillGaps = [...demand.values()].map((d) => ({ ...d, notMet: d.needed - d.met })).sort((a, b) => b.notMet - a.notMet || b.gapLevels - a.gapLevels || a.code.localeCompare(b.code));

  // Heatmap: category × batch → share of (student, required skill) pairs met.
  const batches = new Map<string, string>();
  const cats = new Map<number, string>();
  const cells = new Map<string, { met: number; n: number }>();
  for (const e of evaluated) {
    batches.set(e.s.batchId, e.s.batch.batchCode);
    for (const r of e.required) {
      cats.set(r.category.id, r.category.name);
      const row = e.gap.rows.find((x) => x.code === r.code)!;
      const k = `${r.category.id}|${e.s.batchId}`;
      const c = cells.get(k) ?? { met: 0, n: 0 };
      c.n++;
      if (row.met) c.met++;
      cells.set(k, c);
    }
  }
  const heatmap = {
    batches: [...batches.entries()].map(([id, code]) => ({ id, code })).sort((a, b) => a.code.localeCompare(b.code)),
    categories: [...cats.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id),
    cells: Object.fromEntries([...cells.entries()].map(([k, v]) => [k, { met: v.met, n: v.n, share: v.n ? v.met / v.n : 0 }])),
  };

  const roleCounts = new Map<string, { id: string; name: string; students: number; ready: number; nearly: number }>();
  for (const e of evaluated) {
    if (!e.role) continue;
    const r = roleCounts.get(e.role.id) ?? { id: e.role.id, name: e.role.name, students: 0, ready: 0, nearly: 0 };
    r.students++;
    if (e.gap.readiness === "ready") r.ready++;
    if (e.gap.readiness === "nearly") r.nearly++;
    roleCounts.set(e.role.id, r);
  }
  const roles = [...roleCounts.values()].sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));

  return { adoption, readiness, skillGaps, heatmap, roles, attendance: await attendanceInsights(f) };
}

/** Attendance % per batch = present ÷ (held sessions × students − excused), and per-workshop present counts. */
export async function attendanceInsights(f: InsightFilter = {}) {
  const studentWhere = { deletedAt: null, ...(f.batchId ? { batchId: f.batchId } : {}), ...(f.institutionId ? { institutionId: f.institutionId } : {}) };
  const [batches, sessions, marks, workshops] = await Promise.all([
    db.batch.findMany({ where: f.batchId ? { id: f.batchId } : {}, select: { id: true, batchCode: true, _count: { select: { students: { where: studentWhere } } } }, orderBy: { batchCode: "asc" } }),
    db.workshopSession.findMany({ where: f.batchId ? { batchId: f.batchId } : {}, select: { batchId: true, workshopN: true } }),
    db.attendance.findMany({ where: { student: studentWhere }, select: { status: true, workshopN: true, student: { select: { batchId: true } } } }),
    db.ontWorkshop.findMany({ orderBy: { n: "asc" }, select: { n: true, title: true } }),
  ]);
  const byBatch = batches
    .filter((b) => b._count.students > 0)
    .map((b) => {
      const held = sessions.filter((s) => s.batchId === b.id).length;
      const mine = marks.filter((m) => m.student.batchId === b.id);
      const present = mine.filter((m) => m.status === "PRESENT").length;
      const excused = mine.filter((m) => m.status === "EXCUSED").length;
      const possible = held * b._count.students - excused;
      return { id: b.id, code: b.batchCode, students: b._count.students, held, present, pct: possible > 0 ? Math.round((present / possible) * 100) : null };
    });
  const byWorkshop = workshops.map((w) => ({ n: w.n, title: w.title, present: marks.filter((m) => m.workshopN === w.n && m.status === "PRESENT").length, sessions: sessions.filter((s) => s.workshopN === w.n).length }));
  return { byBatch, byWorkshop };
}

/** Students whose target role is fully (ready) or ≥80 % (nearly) met. Contains PII; only for admin roles. */
export async function readyList(f: InsightFilter & { roleId?: string; level?: "ready" | "nearly" }) {
  const { evaluated } = await loadCohort(f);
  const want = f.level === "nearly" ? ["nearly"] : f.level === "ready" ? ["ready"] : ["ready", "nearly"];
  return evaluated
    .filter((e) => e.role && want.includes(e.gap.readiness) && (!f.roleId || e.role.id === f.roleId))
    .map((e) => ({
      id: e.s.id, studentCode: e.s.studentCode, fullName: e.s.fullName, batch: e.s.batch.batchCode, institution: e.s.institution.name,
      role: e.role!.name, readiness: e.gap.readiness, met: e.gap.met, total: e.gap.total, verified: e.gap.rows.filter((r) => r.source === "verified").length,
    }))
    .sort((a, b) => (a.readiness === b.readiness ? b.met / b.total - a.met / a.total : a.readiness === "ready" ? -1 : 1) || a.fullName.localeCompare(b.fullName));
}

export async function readyListCsv(f: InsightFilter & { roleId?: string; level?: "ready" | "nearly" }, actor: SessionAdmin, meta: { ip?: string; userAgent?: string | null }) {
  const rows = await readyList(f);
  await audit(db, { actorId: actor.id, action: "insights.ready_export", entity: "student", after: { count: rows.length, filter: f }, ip: meta.ip, userAgent: meta.userAgent });
  return toCsv(
    ["Student code", "Full name", "DOS Club batch", "Institution", "Target role", "Readiness", "Skills met", "Skills required", "Verified skills"],
    rows.map((r) => [r.studentCode, r.fullName, r.batch, r.institution, r.role, r.readiness === "ready" ? "Ready for role" : "Nearly ready", r.met, r.total, r.verified]),
  );
}
