import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/normalize";
import { computeGap, type LevelPair } from "@/lib/gap";
import { overallCompleteness, scoreSections } from "@/lib/completeness";
import { projectDetailSchema } from "@/lib/validation/profile";
import { audit } from "./audit";
import type { SessionAdmin } from "./auth/session";
import { HttpError } from "./http";

// Student profile & skills (PRF-1, PRF-2). Actor is either an admin id or "student:<userId>".

type Meta = { ip?: string; userAgent?: string | null };
export const MAX_PROJECTS = 10;
export const MAX_PROJECT_SKILLS = 10;

const optUrl = (label: string, domain?: string) =>
  z.preprocess(
    (v) => (cleanText(v) === "" ? null : cleanText(v)),
    z
      .string()
      .max(300)
      .refine((s) => {
        try {
          const u = new URL(s);
          return (u.protocol === "https:" || u.protocol === "http:") && (!domain || u.hostname === domain || u.hostname.endsWith("." + domain));
        } catch {
          return false;
        }
      }, domain ? `${label} must be a ${domain} link` : `${label} must be a web link starting with https://`)
      .nullable(),
  );

export const linksSchema = z.object({ linkedinUrl: optUrl("LinkedIn URL", "linkedin.com"), githubUrl: optUrl("GitHub URL", "github.com"), portfolioUrl: optUrl("Portfolio URL") }).strict();

export const ratingsSchema = z.object({
  ratings: z.array(z.object({ code: z.string().max(10), level: z.coerce.number().int().min(0, "Level must be 0–6").max(6, "Level must be 0–6") })).min(1).max(200),
});

// verifiedLevel: null clears it. Deliberately no z.coerce here: it turns null into 0 (found by PRF-04).
export const verifySchema = z.object({
  ratings: z.array(z.object({ code: z.string().max(10), verifiedLevel: z.union([z.null(), z.number().int().min(0).max(6)]) })).min(1).max(200),
});

export async function assertActiveSkills(codes: string[]) {
  const up = [...new Set(codes.map((c) => c.toUpperCase()))];
  if (!up.length) return up;
  const found = await db.ontSkill.findMany({ where: { code: { in: up }, isActive: true }, select: { code: true } });
  const ok = new Set(found.map((f) => f.code));
  const bad = up.filter((c) => !ok.has(c));
  if (bad.length) throw new HttpError(400, `Unknown or retired skill(s): ${bad.join(", ")}`, { badCodes: bad });
  return up;
}

/** Everything the profile, gap and completeness views need, for one student (PRF-1..3). */
export async function getProfile(studentId: string) {
  const s = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, studentCode: true, fullName: true, email: true, phone: true, deletedAt: true, gender: true, dateOfBirth: true, city: true, state: true,
      linkedinUrl: true, githubUrl: true, portfolioUrl: true, batchId: true, graduationYear: true,
      institution: { select: { name: true } }, degree: { select: { name: true } }, department: { select: { name: true } }, batch: { select: { batchCode: true } },
      targetRole: { select: { id: true, name: true, isActive: true, levelMin: true, levelMax: true, category: { select: { name: true } }, skills: { where: { skill: { isActive: true } }, select: { level: true, skill: { select: { code: true, name: true } } } }, roadmapSteps: { orderBy: { sort: "asc" }, select: { levelLabel: true, whatYouDo: true, next: true } } } },
      skills: { select: { skillCode: true, selfLevel: true, verifiedLevel: true, verifiedAt: true, skill: { select: { name: true, isActive: true } } } },
      projects: { orderBy: { createdAt: "desc" } },
      profile: true,
      educations: { orderBy: [{ endYear: "desc" }, { createdAt: "desc" }] },
      internships: { orderBy: { startMonth: "desc" } },
      certifications: { orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }] },
      accomplishments: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      tools: { orderBy: { name: "asc" } },
      resume: { select: { fileName: true, sizeBytes: true, uploadedAt: true } },
    },
  });
  if (!s || s.deletedAt) throw new HttpError(404, "Student not found");
  const levels = new Map<string, LevelPair>(s.skills.map((k) => [k.skillCode, { self: k.selfLevel, verified: k.verifiedLevel }]));
  const required = (s.targetRole?.skills ?? []).map((r) => ({ code: r.skill.code, name: r.skill.name, required: r.level }));
  const gap = computeGap(required, levels);
  const links = [s.linkedinUrl, s.githubUrl, s.portfolioUrl].filter(Boolean).length;
  const pr = s.profile;
  const languages = (Array.isArray(pr?.languages) ? pr!.languages : []) as { name: string; read: boolean; write: boolean; speak: boolean }[];
  const day = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;
  const sections = scoreSections({
    gender: !!s.gender, dateOfBirth: !!s.dateOfBirth, cityState: !!(s.city && s.state), languages: languages.length,
    headlineLength: pr?.headline?.length ?? 0, summaryLength: pr?.summary?.length ?? 0,
    educationLevels: s.educations.map((e) => e.level),
    tools: s.tools.length,
    projects: s.projects.length, internships: s.internships.length, certifications: s.certifications.length, accomplishments: s.accomplishments.length,
    prefRoles: pr?.preferredRoleIds.length ?? 0, prefLocations: pr?.preferredLocations.length ?? 0, jobTypes: pr?.jobTypes.length ?? 0, workModes: pr?.workModes.length ?? 0,
    availableFrom: !!pr?.availableFrom, resume: !!s.resume, links,
  });
  return {
    student: {
      id: s.id, studentCode: s.studentCode, fullName: s.fullName, email: s.email, phone: s.phone, batchId: s.batchId, batch: s.batch.batchCode,
      institution: s.institution.name, degree: s.degree.name, department: s.department.name, graduationYear: s.graduationYear,
    },
    personal: { gender: s.gender, dateOfBirth: day(s.dateOfBirth), city: s.city, state: s.state, hometown: pr?.hometown ?? null, languages },
    about: { headline: pr?.headline ?? null, summary: pr?.summary ?? null },
    preferences: {
      preferredRoleIds: pr?.preferredRoleIds ?? [], preferredLocations: pr?.preferredLocations ?? [], jobTypes: pr?.jobTypes ?? [], workModes: pr?.workModes ?? [],
      expectedCtcLpa: pr?.expectedCtcLpa ?? null, availableFrom: day(pr?.availableFrom), willingToRelocate: pr?.willingToRelocate ?? null,
    },
    targetRole: s.targetRole ? { id: s.targetRole.id, name: s.targetRole.name, isActive: s.targetRole.isActive, levelMin: s.targetRole.levelMin, levelMax: s.targetRole.levelMax, category: s.targetRole.category.name, roadmap: s.targetRole.roadmapSteps } : null,
    gap,
    otherSkills: s.skills
      .filter((k) => !required.some((r) => r.code === k.skillCode) && k.skill.isActive && (k.selfLevel > 0 || k.verifiedLevel != null))
      .map((k) => ({ code: k.skillCode, name: k.skill.name, self: k.selfLevel, verified: k.verifiedLevel })),
    ratings: Object.fromEntries(s.skills.map((k) => [k.skillCode, { self: k.selfLevel, verified: k.verifiedLevel, verifiedAt: k.verifiedAt?.toISOString() ?? null }])),
    tools: s.tools.map((t) => ({ id: t.id, name: t.name, version: t.version, experienceMonths: t.experienceMonths, lastUsedYear: t.lastUsedYear })),
    projects: s.projects.map((p) => ({ id: p.id, title: p.title, description: p.description, url: p.url, skillCodes: p.skillCodes, projectType: p.projectType, role: p.role, startMonth: p.startMonth, endMonth: p.endMonth, updatedAt: p.updatedAt.toISOString() })),
    education: s.educations.map((e) => ({ id: e.id, level: e.level, board: e.board, institution: e.institution, course: e.course, specialization: e.specialization, medium: e.medium, startYear: e.startYear, endYear: e.endYear, ongoing: e.ongoing, gradingSystem: e.gradingSystem, score: e.score })),
    internships: s.internships.map((i) => ({ id: i.id, organisation: i.organisation, role: i.role, location: i.location, workMode: i.workMode, startMonth: i.startMonth, endMonth: i.endMonth, stipendMonthly: i.stipendMonthly, description: i.description, skillCodes: i.skillCodes })),
    certifications: s.certifications.map((c) => ({ id: c.id, name: c.name, issuer: c.issuer, issueDate: day(c.issueDate), expiryDate: day(c.expiryDate), noExpiry: c.noExpiry, credentialId: c.credentialId, url: c.url, skillCodes: c.skillCodes })),
    accomplishments: s.accomplishments.map((a) => ({ id: a.id, type: a.type, title: a.title, issuer: a.issuer, date: day(a.date), url: a.url, description: a.description })),
    resume: s.resume ? { fileName: s.resume.fileName, sizeBytes: s.resume.sizeBytes, uploadedAt: s.resume.uploadedAt.toISOString() } : null,
    links: { linkedinUrl: s.linkedinUrl, githubUrl: s.githubUrl, portfolioUrl: s.portfolioUrl },
    sections,
    completeness: overallCompleteness(sections),
  };
}
export type Profile = Awaited<ReturnType<typeof getProfile>>;

export async function setTargetRole(studentId: string, roleId: string | null, actorId: string, meta: Meta) {
  const before = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { targetRoleId: true } });
  if (roleId) {
    const role = await db.ontRole.findUnique({ where: { id: roleId }, select: { isActive: true } });
    if (!role || !role.isActive) throw new HttpError(400, "Choose an active role", { fields: { roleId: "Unknown or retired role" } });
  }
  await db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { targetRoleId: roleId, version: { increment: 1 } } });
    await audit(tx, { actorId, action: "profile.target_role", entity: "student", entityId: studentId, before: { targetRoleId: before.targetRoleId }, after: { targetRoleId: roleId }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Student self-ratings (0–6). Doesn't touch verified levels. */
export async function saveSelfRatings(studentId: string, raw: unknown, actorId: string, meta: Meta) {
  const d = ratingsSchema.parse(raw);
  const codes = await assertActiveSkills(d.ratings.map((r) => r.code));
  if (codes.length !== d.ratings.length) throw new HttpError(400, "Each skill can appear only once");
  await db.$transaction(async (tx) => {
    for (const r of d.ratings) {
      const code = r.code.toUpperCase();
      await tx.studentSkill.upsert({ where: { studentId_skillCode: { studentId, skillCode: code } }, create: { studentId, skillCode: code, selfLevel: r.level }, update: { selfLevel: r.level } });
    }
    await audit(tx, { actorId, action: "profile.self_ratings", entity: "student", entityId: studentId, after: d.ratings.map((r) => `${r.code.toUpperCase()}=${r.level}`), ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Admin verification (PRF-2). null clears a verified level. */
export async function verifyLevels(studentId: string, raw: unknown, actor: SessionAdmin, meta: Meta) {
  const d = verifySchema.parse(raw);
  const s = await db.student.findUnique({ where: { id: studentId }, select: { deletedAt: true } });
  if (!s || s.deletedAt) throw new HttpError(404, "Student not found");
  await assertActiveSkills(d.ratings.map((r) => r.code));
  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const r of d.ratings) {
      const code = r.code.toUpperCase();
      const data = r.verifiedLevel === null ? { verifiedLevel: null, verifiedById: null, verifiedAt: null } : { verifiedLevel: r.verifiedLevel, verifiedById: actor.id, verifiedAt: now };
      await tx.studentSkill.upsert({ where: { studentId_skillCode: { studentId, skillCode: code } }, create: { studentId, skillCode: code, selfLevel: 0, ...data }, update: data });
    }
    await audit(tx, { actorId: actor.id, action: "profile.verify_levels", entity: "student", entityId: studentId, after: d.ratings.map((r) => `${r.code.toUpperCase()}=${r.verifiedLevel ?? "cleared"}`), ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function updateLinks(studentId: string, raw: unknown, actorId: string, meta: Meta) {
  const d = linksSchema.parse(raw);
  const before = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { linkedinUrl: true, githubUrl: true, portfolioUrl: true } });
  await db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { ...d, version: { increment: 1 } } });
    await audit(tx, { actorId, action: "profile.links", entity: "student", entityId: studentId, before, after: d, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function addProject(studentId: string, raw: unknown, actorId: string, meta: Meta) {
  const d = projectDetailSchema.parse(raw);
  if ((await db.studentProject.count({ where: { studentId } })) >= MAX_PROJECTS) throw new HttpError(400, `You can add up to ${MAX_PROJECTS} projects. Remove one first.`);
  const skillCodes = await assertActiveSkills(d.skillCodes);
  return db.$transaction(async (tx) => {
    const p = await tx.studentProject.create({ data: { studentId, title: d.title, description: d.description, url: d.url, skillCodes, projectType: d.projectType, role: d.role, startMonth: d.startMonth, endMonth: d.endMonth } });
    await audit(tx, { actorId, action: "profile.project_add", entity: "student", entityId: studentId, after: { projectId: p.id, title: d.title }, ip: meta.ip, userAgent: meta.userAgent });
    return p;
  });
}

export async function updateProject(studentId: string, projectId: string, raw: unknown, actorId: string, meta: Meta) {
  const existing = await db.studentProject.findFirst({ where: { id: projectId, studentId } });
  if (!existing) throw new HttpError(404, "Project not found"); // also stops editing someone else's project
  const d = projectDetailSchema.parse(raw);
  const skillCodes = await assertActiveSkills(d.skillCodes);
  await db.$transaction(async (tx) => {
    await tx.studentProject.update({ where: { id: projectId }, data: { title: d.title, description: d.description, url: d.url, skillCodes, projectType: d.projectType, role: d.role, startMonth: d.startMonth, endMonth: d.endMonth } });
    await audit(tx, { actorId, action: "profile.project_update", entity: "student", entityId: studentId, after: { projectId, title: d.title }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function deleteProject(studentId: string, projectId: string, actorId: string, meta: Meta) {
  const existing = await db.studentProject.findFirst({ where: { id: projectId, studentId } });
  if (!existing) throw new HttpError(404, "Project not found");
  await db.$transaction(async (tx) => {
    await tx.studentProject.delete({ where: { id: projectId } });
    await audit(tx, { actorId, action: "profile.project_delete", entity: "student", entityId: studentId, before: { projectId, title: existing.title }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

/** Active skills for pickers (grouped by category for the UI). */
export async function skillCatalog() {
  return db.ontSkill.findMany({ where: { isActive: true }, orderBy: [{ subcategory: { categoryId: "asc" } }, { code: "asc" }], select: { code: true, name: true, description: true, subcategory: { select: { category: { select: { id: true, name: true } } } } } });
}

