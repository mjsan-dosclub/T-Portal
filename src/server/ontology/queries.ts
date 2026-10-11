import "server-only";
import { db } from "@/lib/db";

// Ontology read models for the explorer views. Retired skills/roles are hidden (ONT-EDIT). `source` is never selected (D11).

export async function ontologyStats() {
  const [categories, subcategories, skills, roles, levels, workshops, roleSkillLinks] = await Promise.all([
    db.ontCategory.count(),
    db.ontSubcategory.count(),
    db.ontSkill.count({ where: { isActive: true } }),
    db.ontRole.count({ where: { isActive: true } }),
    db.ontLevel.count(),
    db.ontWorkshop.count(),
    db.ontRoleSkill.count({ where: { role: { isActive: true }, skill: { isActive: true } } }),
  ]);
  return { categories, subcategories, skills, roles, levels, workshops, roleSkillLinks };
}

export async function categoriesWithTree() {
  return db.ontCategory.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: { select: { roles: { where: { isActive: true } } } },
      subcategories: {
        orderBy: { id: "asc" },
        include: { skills: { where: { isActive: true }, orderBy: { code: "asc" }, select: { code: true, name: true, description: true, _count: { select: { roleSkills: { where: { role: { isActive: true } } } } } } } },
      },
    },
  });
}

export async function listRoles(opts: { q?: string; categoryId?: number }) {
  const q = opts.q?.trim();
  return db.ontRole.findMany({
    where: {
      isActive: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, track: true, levelMin: true, levelMax: true, category: { select: { id: true, name: true } }, _count: { select: { skills: { where: { skill: { isActive: true } } } } } },
  });
}

export async function getRole(id: string) {
  return db.ontRole.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      skills: { where: { skill: { isActive: true } }, orderBy: [{ level: "desc" }, { skillCode: "asc" }], include: { skill: { select: { code: true, name: true, description: true, subcategory: { select: { code: true, name: true } } } } } },
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

/** Target-role picker: active roles, plus the student's current role even if it has since been retired (ONT-16). */
export async function roleOptions(includeId?: string | null) {
  return db.ontRole.findMany({ where: { OR: [{ isActive: true }, ...(includeId ? [{ id: includeId }] : [])] }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
