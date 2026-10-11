import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { nameKey } from "@/lib/normalize";
import {
  aboutSchema, accomplishmentSchema, certificationSchema, educationSchema, internshipSchema, LIST_LIMITS, personalSchema, preferencesSchema, toolSchema,
  type ListKind,
} from "@/lib/validation/profile";
import { audit } from "./audit";
import { HttpError } from "./http";
import { assertActiveSkills } from "./profile";

// Detailed fresher profile sections (PRF-3). Every write is scoped to the student's own id and audited.
type Meta = { ip?: string; userAgent?: string | null };
const day = (iso: string | null | undefined) => (iso ? new Date(iso + "T00:00:00Z") : null);

export async function updatePersonal(studentId: string, raw: unknown, actorId: string, meta: Meta) {
  const d = personalSchema.parse(raw);
  if (d.dateOfBirth) {
    const age = new Date().getUTCFullYear() - Number(d.dateOfBirth.slice(0, 4));
    if (age < 14 || age > 45) throw new HttpError(400, "Check your date of birth", { fields: { dateOfBirth: "Age looks wrong" } });
  }
  await db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { gender: d.gender, dateOfBirth: day(d.dateOfBirth), city: d.city, state: d.state, version: { increment: 1 } } });
    await tx.studentProfile.upsert({ where: { studentId }, create: { studentId, hometown: d.hometown, languages: d.languages }, update: { hometown: d.hometown, languages: d.languages } });
    await audit(tx, { actorId, action: "profile.personal", entity: "student", entityId: studentId, after: { gender: d.gender, city: d.city, state: d.state, languages: d.languages.map((l) => l.name) }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function updateAbout(studentId: string, raw: unknown, actorId: string, meta: Meta) {
  const d = aboutSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.studentProfile.upsert({ where: { studentId }, create: { studentId, ...d }, update: d });
    await audit(tx, { actorId, action: "profile.about", entity: "student", entityId: studentId, after: { headlineLength: d.headline?.length ?? 0, summaryLength: d.summary?.length ?? 0 }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function updatePreferences(studentId: string, raw: unknown, actorId: string, meta: Meta) {
  const d = preferencesSchema.parse(raw);
  if (d.preferredRoleIds.length) {
    const n = await db.ontRole.count({ where: { id: { in: d.preferredRoleIds }, isActive: true } });
    if (n !== new Set(d.preferredRoleIds).size) throw new HttpError(400, "Choose active roles only", { fields: { preferredRoleIds: "Unknown or retired role" } });
  }
  const data = { ...d, preferredLocations: [...new Set(d.preferredLocations)], availableFrom: day(d.availableFrom) };
  await db.$transaction(async (tx) => {
    await tx.studentProfile.upsert({ where: { studentId }, create: { studentId, ...data }, update: data });
    await audit(tx, { actorId, action: "profile.preferences", entity: "student", entityId: studentId, after: { ...d }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

// ── List sections: education, internships, certifications, accomplishments, tools ──

async function count(kind: ListKind, studentId: string) {
  switch (kind) {
    case "education": return db.studentEducation.count({ where: { studentId } });
    case "internships": return db.studentInternship.count({ where: { studentId } });
    case "certifications": return db.studentCertification.count({ where: { studentId } });
    case "accomplishments": return db.studentAccomplishment.count({ where: { studentId } });
    case "tools": return db.studentTool.count({ where: { studentId } });
  }
}

async function owned(kind: ListKind, studentId: string, id: string) {
  const where = { id, studentId };
  const row =
    kind === "education" ? await db.studentEducation.findFirst({ where })
    : kind === "internships" ? await db.studentInternship.findFirst({ where })
    : kind === "certifications" ? await db.studentCertification.findFirst({ where })
    : kind === "accomplishments" ? await db.studentAccomplishment.findFirst({ where })
    : await db.studentTool.findFirst({ where });
  if (!row) throw new HttpError(404, "Item not found"); // also blocks editing another student's item
  return row;
}

/** Parse + normalise input for a list section into the Prisma data shape. */
async function toData(kind: ListKind, raw: unknown) {
  switch (kind) {
    case "education": {
      const d = educationSchema.parse(raw);
      return { label: d.institution, data: { ...d, score: d.gradingSystem === "PASS" ? null : d.score } };
    }
    case "internships": {
      const d = internshipSchema.parse(raw);
      return { label: `${d.role} @ ${d.organisation}`, data: { ...d, skillCodes: await assertActiveSkills(d.skillCodes) } };
    }
    case "certifications": {
      const d = certificationSchema.parse(raw);
      return { label: d.name, data: { ...d, issueDate: day(d.issueDate), expiryDate: d.noExpiry ? null : day(d.expiryDate), skillCodes: await assertActiveSkills(d.skillCodes) } };
    }
    case "accomplishments": {
      const d = accomplishmentSchema.parse(raw);
      return { label: d.title, data: { ...d, date: day(d.date) } };
    }
    case "tools": {
      const d = toolSchema.parse(raw);
      return { label: d.name, data: { ...d, nameKey: nameKey(d.name) } };
    }
  }
}

export async function addItem(kind: ListKind, studentId: string, raw: unknown, actorId: string, meta: Meta) {
  if ((await count(kind, studentId)) >= LIST_LIMITS[kind]) throw new HttpError(400, `You can add up to ${LIST_LIMITS[kind]} here. Remove one first.`);
  const { label, data } = await toData(kind, raw);
  try {
    return await db.$transaction(async (tx) => {
      const base = { studentId };
      const row =
        kind === "education" ? await tx.studentEducation.create({ data: { ...base, ...(data as Omit<Prisma.StudentEducationUncheckedCreateInput, "studentId">) } })
        : kind === "internships" ? await tx.studentInternship.create({ data: { ...base, ...(data as Omit<Prisma.StudentInternshipUncheckedCreateInput, "studentId">) } })
        : kind === "certifications" ? await tx.studentCertification.create({ data: { ...base, ...(data as Omit<Prisma.StudentCertificationUncheckedCreateInput, "studentId">) } })
        : kind === "accomplishments" ? await tx.studentAccomplishment.create({ data: { ...base, ...(data as Omit<Prisma.StudentAccomplishmentUncheckedCreateInput, "studentId">) } })
        : await tx.studentTool.create({ data: { ...base, ...(data as Omit<Prisma.StudentToolUncheckedCreateInput, "studentId">) } });
      await audit(tx, { actorId, action: `profile.${kind}_add`, entity: "student", entityId: studentId, after: { id: row.id, label }, ip: meta.ip, userAgent: meta.userAgent });
      return row;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "You've already added that", { fields: { name: "Already added" } });
    throw e;
  }
}

export async function updateItem(kind: ListKind, studentId: string, id: string, raw: unknown, actorId: string, meta: Meta) {
  await owned(kind, studentId, id);
  const { label, data } = await toData(kind, raw);
  try {
    await db.$transaction(async (tx) => {
      if (kind === "education") await tx.studentEducation.update({ where: { id }, data: data as Prisma.StudentEducationUncheckedUpdateInput });
      else if (kind === "internships") await tx.studentInternship.update({ where: { id }, data: data as Prisma.StudentInternshipUncheckedUpdateInput });
      else if (kind === "certifications") await tx.studentCertification.update({ where: { id }, data: data as Prisma.StudentCertificationUncheckedUpdateInput });
      else if (kind === "accomplishments") await tx.studentAccomplishment.update({ where: { id }, data: data as Prisma.StudentAccomplishmentUncheckedUpdateInput });
      else await tx.studentTool.update({ where: { id }, data: data as Prisma.StudentToolUncheckedUpdateInput });
      await audit(tx, { actorId, action: `profile.${kind}_update`, entity: "student", entityId: studentId, after: { id, label }, ip: meta.ip, userAgent: meta.userAgent });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "You've already added that", { fields: { name: "Already added" } });
    throw e;
  }
}

export async function deleteItem(kind: ListKind, studentId: string, id: string, actorId: string, meta: Meta) {
  await owned(kind, studentId, id);
  await db.$transaction(async (tx) => {
    if (kind === "education") await tx.studentEducation.delete({ where: { id } });
    else if (kind === "internships") await tx.studentInternship.delete({ where: { id } });
    else if (kind === "certifications") await tx.studentCertification.delete({ where: { id } });
    else if (kind === "accomplishments") await tx.studentAccomplishment.delete({ where: { id } });
    else await tx.studentTool.delete({ where: { id } });
    await audit(tx, { actorId, action: `profile.${kind}_delete`, entity: "student", entityId: studentId, before: { id }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

// ── Resume (PRF-5) ──

export const RESUME_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadResume(studentId: string, file: { name: string; type: string; buffer: Buffer }, actorId: string, meta: Meta) {
  if (file.buffer.length === 0) throw new HttpError(400, "The file is empty");
  if (file.buffer.length > RESUME_MAX_BYTES) throw new HttpError(413, "Resume must be 2 MB or smaller");
  const isPdf = file.buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!file.name.toLowerCase().endsWith(".pdf") || !isPdf || (file.type && file.type !== "application/pdf")) throw new HttpError(400, "Upload your resume as a PDF file");
  const fileName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  await db.$transaction(async (tx) => {
    const data = { fileName, sizeBytes: file.buffer.length, data: new Uint8Array(file.buffer), uploadedAt: new Date() };
    await tx.studentResume.upsert({ where: { studentId }, create: { studentId, ...data }, update: data });
    await audit(tx, { actorId, action: "profile.resume_upload", entity: "student", entityId: studentId, after: { fileName, sizeBytes: file.buffer.length }, ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function deleteResume(studentId: string, actorId: string, meta: Meta) {
  const r = await db.studentResume.deleteMany({ where: { studentId } });
  if (!r.count) throw new HttpError(404, "No resume uploaded");
  await audit(db, { actorId, action: "profile.resume_delete", entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
}

/** Download. Admin downloads are audited (PRF-5). */
export async function resumeFile(studentId: string, actorId: string | null, meta: Meta) {
  const r = await db.studentResume.findUnique({ where: { studentId } });
  if (!r) throw new HttpError(404, "No resume uploaded");
  if (actorId) await audit(db, { actorId, action: "profile.resume_download", entity: "student", entityId: studentId, ip: meta.ip, userAgent: meta.userAgent });
  return r;
}

export function resumeResponse(r: { fileName: string; data: Uint8Array }) {
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
