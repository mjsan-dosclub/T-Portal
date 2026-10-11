import "server-only";
import { db } from "@/lib/db";

// Read-only ontology access (ONT-08: no mutating API exists). `source` is never selected (D11).

export async function ontologyStats() {
  const [categories, subcategories, skills, roles, levels, workshops, roleSkillLinks] = await Promise.all([
    db.ontCategory.count(),
    db.ontSubcategory.count(),
    db.ontSkill.count(),
    db.ontRole.count(),
    db.ontLevel.count(),
    db.ontWorkshop.count(),
    db.ontRoleSkill.count(),
  ]);
  return { categories, subcategories, skills, roles, levels, workshops, roleSkillLinks };
}

export async function categoriesWithTree() {
  return db.ontCategory.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: { select: { roles: true } },
      subcategories: {
        orderBy: { id: "asc" },
        include: { skills: { orderBy: { code: "asc" }, select: { code: true, name: true, description: true, _count: { select: { roleSkills: true } } } } },
      },
    },
  });
}

export async function listRoles(opts: { q?: string; categoryId?: number }) {
  const q = opts.q?.trim();
  return db.ontRole.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, track: true, levelMin: true, levelMax: true, category: { select: { id: true, name: true } }, _count: { select: { skills: true } } },
  });
}

export async function getRole(id: string) {
  return db.ontRole.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      skills: { orderBy: [{ level: "desc" }, { skillCode: "asc" }], include: { skill: { select: { code: true, name: true, description: true, subcategory: { select: { code: true, name: true } } } } } },
      roadmapSteps: { orderBy: { sort: "asc" } },
    },
  });
}

export async function listLevels() {
  return db.ontLevel.findMany({ orderBy: { n: "asc" } });
}

export async function listWorkshops() {
  return db.ontWorkshop.findMany({ orderBy: { n: "asc" } });
}

export async function roleOptions() {
  return db.ontRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
