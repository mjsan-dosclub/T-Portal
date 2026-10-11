import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/normalize";
import { audit } from "@/server/audit";
import type { SessionAdmin } from "@/server/auth/session";
import { HttpError } from "@/server/http";

// Ontology maintenance (DECISIONS ONT-EDIT, PRD §5.4.1). "Remove" = retire; hard delete only for unused admin-added skills.

type Meta = { ip?: string; userAgent?: string | null };
export const ADMIN_SOURCE = "DOS Club"; // source value for skills added in the portal (stored, not displayed: D11)
export const TRACKS = ["IC", "Mgmt", "Exec"] as const;

const text = (min: number, max: number, label: string) => z.preprocess((v) => cleanText(v), z.string().min(min, `${label} is required`).max(max, `${label} is too long`));

export const skillCreateSchema = z
  .object({
    code: z.preprocess((v) => cleanText(v).toUpperCase(), z.string().regex(/^[A-Z][A-Z0-9]{2,5}$/, "Code must be 3–6 letters/digits, starting with a letter (e.g. PRMT)")),
    name: text(2, 120, "Name"),
    description: text(10, 600, "Description"),
    subcategoryId: z.coerce.number().int().positive("Choose a subcategory"),
  })
  .strict();
export const skillUpdateSchema = skillCreateSchema.omit({ code: true });

export const subcategorySchema = z.object({ categoryId: z.coerce.number().int().min(1).max(99), name: text(2, 120, "Name") }).strict();

export const roleSchema = z
  .object({
    name: text(2, 120, "Role name"),
    categoryId: z.coerce.number().int().positive("Choose a category"),
    track: z.enum(TRACKS, { error: "Track must be IC, Mgmt or Exec" }),
    levelMin: z.coerce.number().int().min(1).max(6),
    levelMax: z.coerce.number().int().min(1).max(6),
  })
  .strict()
  .refine((r) => r.levelMin <= r.levelMax, { path: ["levelMax"], message: "Highest level must be ≥ lowest level" });

export const roleSkillsSchema = z.object({
  skills: z
    .array(z.object({ code: z.string().max(10), level: z.coerce.number().int().min(1, "Level must be L1–L6").max(6, "Level must be L1–L6") }))
    .min(1, "A role needs at least one skill")
    .max(40),
});

export const retireSchema = z.object({ reason: text(3, 300, "Reason"), removeFromRoles: z.boolean().optional() });

async function assertSubcategory(id: number) {
  if (!(await db.ontSubcategory.findUnique({ where: { id } }))) throw new HttpError(400, "Unknown subcategory", { fields: { subcategoryId: "Unknown subcategory" } });
}

// ── Skills ───────────────────────────────────────────────────────────────

export async function createSkill(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = skillCreateSchema.parse(raw);
  await assertSubcategory(d.subcategoryId);
  if (await db.ontSkill.findUnique({ where: { code: d.code } })) throw new HttpError(409, `Skill code ${d.code} already exists`, { fields: { code: "Already used (codes can't be reused, even when retired)" } });
  const nameClash = await db.ontSkill.findFirst({ where: { name: { equals: d.name, mode: "insensitive" } } });
  if (nameClash) throw new HttpError(409, `A skill named "${nameClash.name}" already exists (${nameClash.code})`, { fields: { name: "Already exists" } });
  return db.$transaction(async (tx) => {
    const s = await tx.ontSkill.create({ data: { ...d, source: ADMIN_SOURCE } });
    await audit(tx, { actorId: actor.id, action: "ontology.skill_create", entity: "ontology_skill", entityId: s.code, after: d, ip: meta.ip, userAgent: meta.userAgent });
    return s;
  });
}

export async function updateSkill(code: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const before = await db.ontSkill.findUnique({ where: { code } });
  if (!before) throw new HttpError(404, "Skill not found");
  const d = skillUpdateSchema.parse(raw);
  await assertSubcategory(d.subcategoryId);
  const nameClash = await db.ontSkill.findFirst({ where: { name: { equals: d.name, mode: "insensitive" }, code: { not: code } } });
  if (nameClash) throw new HttpError(409, `A skill named "${nameClash.name}" already exists (${nameClash.code})`, { fields: { name: "Already exists" } });
  await db.$transaction(async (tx) => {
    await tx.ontSkill.update({ where: { code }, data: d });
    await audit(tx, { actorId: actor.id, action: "ontology.skill_update", entity: "ontology_skill", entityId: code, before: { name: before.name, description: before.description, subcategoryId: before.subcategoryId }, after: d, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Active roles that still require this skill. */
export async function rolesUsingSkill(code: string) {
  return db.ontRole.findMany({ where: { isActive: true, skills: { some: { skillCode: code } } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function retireSkill(code: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const s = await db.ontSkill.findUnique({ where: { code } });
  if (!s) throw new HttpError(404, "Skill not found");
  if (!s.isActive) throw new HttpError(409, "Skill is already retired");
  const d = retireSchema.parse(raw);
  const roles = await rolesUsingSkill(code);
  if (roles.length && !d.removeFromRoles) {
    throw new HttpError(409, `${roles.length} active role(s) still require ${code}. Remove it from them first, or choose "also remove from these roles".`, { roles });
  }
  await db.$transaction(async (tx) => {
    if (roles.length) {
      // A role must keep at least one skill.
      for (const r of roles) {
        const n = await tx.ontRoleSkill.count({ where: { roleId: r.id } });
        if (n <= 1) throw new HttpError(409, `"${r.name}" has no other skills. Add a replacement skill to it before retiring ${code}.`, { roles: [r] });
      }
      await tx.ontRoleSkill.deleteMany({ where: { skillCode: code, roleId: { in: roles.map((r) => r.id) } } });
    }
    await tx.ontSkill.update({ where: { code }, data: { isActive: false, retiredAt: new Date(), retiredReason: d.reason } });
    await audit(tx, { actorId: actor.id, action: "ontology.skill_retire", entity: "ontology_skill", entityId: code, before: { isActive: true, roles: roles.map((r) => r.name) }, after: { isActive: false }, reason: d.reason, ip: meta.ip, userAgent: meta.userAgent });
  });
  return { removedFromRoles: roles.length };
}

export async function restoreSkill(code: string, actor: SessionAdmin, meta: Meta) {
  const s = await db.ontSkill.findUnique({ where: { code } });
  if (!s) throw new HttpError(404, "Skill not found");
  await db.$transaction(async (tx) => {
    await tx.ontSkill.update({ where: { code }, data: { isActive: true, retiredAt: null, retiredReason: null } });
    await audit(tx, { actorId: actor.id, action: "ontology.skill_restore", entity: "ontology_skill", entityId: code, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Hard delete: only portal-added skills that no role (active or retired) has ever used. Seeded skills can only be retired. */
export async function deleteSkill(code: string, actor: SessionAdmin, meta: Meta) {
  const s = await db.ontSkill.findUnique({ where: { code }, include: { _count: { select: { roleSkills: true } } } });
  if (!s) throw new HttpError(404, "Skill not found");
  if (s.source !== ADMIN_SOURCE) throw new HttpError(409, "Framework skills can't be deleted. Retire it instead.", { canRetire: true });
  if (s._count.roleSkills > 0) throw new HttpError(409, `${code} is linked to ${s._count.roleSkills} role(s). Retire it instead.`, { canRetire: true });
  await db.$transaction(async (tx) => {
    await tx.ontSkill.delete({ where: { code } });
    await audit(tx, { actorId: actor.id, action: "ontology.skill_delete", entity: "ontology_skill", entityId: code, before: { name: s.name, description: s.description }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

// ── Subcategories ────────────────────────────────────────────────────────

export async function createSubcategory(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = subcategorySchema.parse(raw);
  const cat = await db.ontCategory.findUnique({ where: { id: d.categoryId }, include: { subcategories: { select: { code: true, name: true } } } });
  if (!cat) throw new HttpError(400, "Unknown category", { fields: { categoryId: "Unknown category" } });
  if (cat.subcategories.some((s) => s.name.toLowerCase() === d.name.toLowerCase())) throw new HttpError(409, "That subcategory already exists in this category", { fields: { name: "Already exists" } });
  const next = Math.max(0, ...cat.subcategories.map((s) => Number(s.code.split(".")[1]) || 0)) + 1;
  return db.$transaction(async (tx) => {
    const sc = await tx.ontSubcategory.create({ data: { categoryId: d.categoryId, name: d.name, code: `${d.categoryId}.${next}` } });
    await audit(tx, { actorId: actor.id, action: "ontology.subcategory_create", entity: "ontology_subcategory", entityId: sc.code, after: d, ip: meta.ip, userAgent: meta.userAgent });
    return sc;
  });
}

export async function renameSubcategory(id: number, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const sc = await db.ontSubcategory.findUnique({ where: { id } });
  if (!sc) throw new HttpError(404, "Subcategory not found");
  const name = text(2, 120, "Name").parse((raw as { name?: unknown })?.name);
  await db.$transaction(async (tx) => {
    await tx.ontSubcategory.update({ where: { id }, data: { name } });
    await audit(tx, { actorId: actor.id, action: "ontology.subcategory_update", entity: "ontology_subcategory", entityId: sc.code, before: { name: sc.name }, after: { name }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

// ── Roles ────────────────────────────────────────────────────────────────

export async function createRole(raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = roleSchema.parse(raw);
  if (!(await db.ontCategory.findUnique({ where: { id: d.categoryId } }))) throw new HttpError(400, "Unknown category", { fields: { categoryId: "Unknown category" } });
  if (await db.ontRole.findFirst({ where: { name: { equals: d.name, mode: "insensitive" } } })) throw new HttpError(409, "A role with this name already exists", { fields: { name: "Already exists" } });
  return db.$transaction(async (tx) => {
    const r = await tx.ontRole.create({ data: d });
    await audit(tx, { actorId: actor.id, action: "ontology.role_create", entity: "ontology_role", entityId: r.id, after: d, ip: meta.ip, userAgent: meta.userAgent });
    return r;
  });
}

export async function updateRole(id: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const before = await db.ontRole.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Role not found");
  const d = roleSchema.parse(raw);
  if (await db.ontRole.findFirst({ where: { name: { equals: d.name, mode: "insensitive" }, id: { not: id } } })) throw new HttpError(409, "A role with this name already exists", { fields: { name: "Already exists" } });
  await db.$transaction(async (tx) => {
    await tx.ontRole.update({ where: { id }, data: d });
    await audit(tx, { actorId: actor.id, action: "ontology.role_update", entity: "ontology_role", entityId: id, before: { name: before.name, categoryId: before.categoryId, track: before.track, levelMin: before.levelMin, levelMax: before.levelMax }, after: d, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Replace a role's required skills (ONT-14). Only active skills; levels L1–L6. */
export async function setRoleSkills(id: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const role = await db.ontRole.findUnique({ where: { id }, include: { skills: true } });
  if (!role) throw new HttpError(404, "Role not found");
  const d = roleSkillsSchema.parse(raw);
  const codes = d.skills.map((s) => s.code.toUpperCase());
  if (new Set(codes).size !== codes.length) throw new HttpError(400, "Each skill can appear only once");
  const found = await db.ontSkill.findMany({ where: { code: { in: codes } }, select: { code: true, isActive: true } });
  const ok = new Set(found.filter((f) => f.isActive).map((f) => f.code));
  const bad = codes.filter((c) => !ok.has(c));
  if (bad.length) throw new HttpError(400, `Unknown or retired skill(s): ${bad.join(", ")}`, { badCodes: bad });
  await db.$transaction(async (tx) => {
    await tx.ontRoleSkill.deleteMany({ where: { roleId: id } });
    await tx.ontRoleSkill.createMany({ data: d.skills.map((s) => ({ roleId: id, skillCode: s.code.toUpperCase(), level: s.level })) });
    await audit(tx, {
      actorId: actor.id, action: "ontology.role_skills_update", entity: "ontology_role", entityId: id,
      before: role.skills.map((s) => `${s.skillCode}@L${s.level}`), after: d.skills.map((s) => `${s.code.toUpperCase()}@L${s.level}`), ip: meta.ip, userAgent: meta.userAgent,
    });
  });
}

export async function retireRole(id: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const r = await db.ontRole.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Role not found");
  if (!r.isActive) throw new HttpError(409, "Role is already retired");
  const d = retireSchema.parse(raw);
  const linkedStudents = await db.student.count({ where: { targetRoleId: id, deletedAt: null } });
  await db.$transaction(async (tx) => {
    await tx.ontRole.update({ where: { id }, data: { isActive: false, retiredAt: new Date(), retiredReason: d.reason } });
    await audit(tx, { actorId: actor.id, action: "ontology.role_retire", entity: "ontology_role", entityId: id, before: { isActive: true }, after: { isActive: false, linkedStudents }, reason: d.reason, ip: meta.ip, userAgent: meta.userAgent });
  });
  return { linkedStudents };
}

export async function restoreRole(id: string, actor: SessionAdmin, meta: Meta) {
  const r = await db.ontRole.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Role not found");
  await db.$transaction(async (tx) => {
    await tx.ontRole.update({ where: { id }, data: { isActive: true, retiredAt: null, retiredReason: null } });
    await audit(tx, { actorId: actor.id, action: "ontology.role_restore", entity: "ontology_role", entityId: id, ip: meta.ip, userAgent: meta.userAgent });
  });
}

// ── Read models for the manage page ──────────────────────────────────────

export async function manageData() {
  const [categories, skills, roles, changes] = await Promise.all([
    db.ontCategory.findMany({ orderBy: { id: "asc" }, include: { subcategories: { orderBy: { id: "asc" }, select: { id: true, code: true, name: true, _count: { select: { skills: true } } } } } }),
    db.ontSkill.findMany({
      orderBy: { code: "asc" },
      select: { code: true, name: true, description: true, isActive: true, retiredAt: true, retiredReason: true, source: true, subcategory: { select: { id: true, code: true, name: true, categoryId: true } }, _count: { select: { roleSkills: true } } },
    }),
    db.ontRole.findMany({
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, track: true, levelMin: true, levelMax: true, isActive: true, retiredAt: true, retiredReason: true, categoryId: true, skills: { select: { skillCode: true, level: true }, orderBy: { skillCode: "asc" } }, _count: { select: { students: true } } },
    }),
    db.auditLog.findMany({ where: { action: { startsWith: "ontology." } }, orderBy: { id: "desc" }, take: 25 }),
  ]);
  const actorIds = [...new Set(changes.map((c) => c.actorId).filter((x): x is string => !!x))];
  const actors = new Map((await db.adminUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })).map((a) => [a.id, a.name]));
  const roleNames = new Map(roles.map((r) => [r.id, r.name]));
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, subcategories: c.subcategories.map((s) => ({ id: s.id, code: s.code, name: s.name, skills: s._count.skills })) })),
    skills: skills.map(({ source, ...s }) => ({ ...s, deletable: source === ADMIN_SOURCE && s._count.roleSkills === 0, usedBy: s._count.roleSkills, retiredAt: s.retiredAt?.toISOString() ?? null })),
    roles: roles.map((r) => ({ ...r, retiredAt: r.retiredAt?.toISOString() ?? null, students: r._count.students })),
    changes: changes.map((c) => ({
      id: c.id.toString(), action: c.action.replace("ontology.", ""), entityId: c.entity === "ontology_role" ? (roleNames.get(c.entityId ?? "") ?? c.entityId) : c.entityId,
      reason: c.reason, actor: c.actorId ? (actors.get(c.actorId) ?? "Unknown") : "System", createdAt: c.createdAt.toISOString(),
    })),
  };
}
export type ManageData = Awaited<ReturnType<typeof manageData>>;
