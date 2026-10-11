import type { PrismaClient } from "@/generated/prisma/client";
import { levelNum, loadReference, splitNumbered } from "./reference";

/**
 * Idempotent ontology seed (ONT-01, ONT-02). Insert-only: rows that already exist are left alone,
 * so admin edits, retirements and additions survive a re-seed (ONT-13). Never invents data.
 */
export async function seedOntology(db: PrismaClient, path?: string) {
  const ref = loadReference(path);

  const categories = new Map<string, { id: number; name: string }>();
  const subcats = new Map<string, { code: string; name: string; categoryId: number }>();
  for (const s of ref.skills) {
    const c = splitNumbered(s.Category);
    categories.set(s.Category.trim(), { id: Number(c.code), name: c.name });
    const sc = splitNumbered(s.Subcategory);
    subcats.set(sc.code, { code: sc.code, name: sc.name, categoryId: Number(c.code) });
  }

  await db.$transaction(
    async (tx) => {
      for (const c of categories.values()) await tx.ontCategory.upsert({ where: { id: c.id }, create: c, update: {} });
      const subIds = new Map<string, number>();
      for (const sc of subcats.values()) {
        const row = await tx.ontSubcategory.upsert({ where: { code: sc.code }, create: sc, update: {} });
        subIds.set(sc.code, row.id);
      }
      const existingSkills = new Set((await tx.ontSkill.findMany({ select: { code: true } })).map((s) => s.code));
      const newSkills = ref.skills.filter((s) => !existingSkills.has(s["Skill Code"]));
      if (newSkills.length) {
        await tx.ontSkill.createMany({
          data: newSkills.map((s) => ({
            code: s["Skill Code"],
            name: s["Skill Name"],
            description: s["Overall Description"],
            source: s.Source,
            subcategoryId: subIds.get(splitNumbered(s.Subcategory).code)!,
          })),
        });
      }
      const existingRoles = new Set((await tx.ontRole.findMany({ select: { name: true } })).map((r) => r.name));
      for (const r of ref.roles) {
        if (existingRoles.has(r.role)) continue;
        const cat = categories.get(r.category.trim());
        if (!cat) throw new Error(`Role ${r.role} has unknown category ${r.category}`);
        const role = await tx.ontRole.create({ data: { name: r.role, categoryId: cat.id, track: r.track, levelMin: r.levelMin, levelMax: r.levelMax } });
        await tx.ontRoleSkill.createMany({ data: r.skills.map((s) => ({ roleId: role.id, skillCode: s.code, level: levelNum(s.level) })) });
        const steps = ref.roadmap[r.role] ?? [];
        await tx.ontRoadmapStep.createMany({
          data: steps.map((st, i) => ({ roleId: role.id, sort: i + 1, levelNum: st.levelNum, levelLabel: st.level, whatYouDo: st.whatYouDo, tools: st.tools, next: st.next })),
        });
      }
      for (const l of ref.levels) await tx.ontLevel.upsert({ where: { n: l.n }, create: { n: l.n, name: l.name, description: l.desc }, update: {} });
      for (const w of ref.workshops) await tx.ontWorkshop.upsert({ where: { n: w.n }, create: { n: w.n, title: w.t, roleText: w.r }, update: {} });
    },
    { timeout: 120_000 },
  );

  return ontologyCounts(db);
}

export async function ontologyCounts(db: PrismaClient) {
  const [categories, subcategories, skills, roles, roadmaps, levels, workshops] = await Promise.all([
    db.ontCategory.count(),
    db.ontSubcategory.count(),
    db.ontSkill.count(),
    db.ontRole.count(),
    db.ontRole.count({ where: { roadmapSteps: { some: {} } } }),
    db.ontLevel.count(),
    db.ontWorkshop.count(),
  ]);
  return { categories, subcategories, skills, roles, roadmaps, levels, workshops };
}
