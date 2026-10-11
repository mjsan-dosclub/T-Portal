import { z } from "zod";
import { cleanText, parseDateInput } from "@/lib/normalize";
import { GENDERS } from "@/lib/validation/student";

// One schema per profile section (PRF-3), shared by the student UI and the API.

export const EDUCATION_LEVELS = ["CLASS_10", "CLASS_12", "DIPLOMA", "UG", "PG", "DOCTORATE", "OTHER"] as const;
export const EDUCATION_LABEL: Record<(typeof EDUCATION_LEVELS)[number], string> = { CLASS_10: "Class 10", CLASS_12: "Class 12", DIPLOMA: "Diploma", UG: "Graduation (UG)", PG: "Post-graduation (PG)", DOCTORATE: "Doctorate", OTHER: "Other" };
export const GRADING = ["PERCENTAGE", "CGPA_10", "CGPA_4", "PASS"] as const;
export const GRADING_LABEL: Record<(typeof GRADING)[number], string> = { PERCENTAGE: "Percentage", CGPA_10: "CGPA (out of 10)", CGPA_4: "CGPA (out of 4)", PASS: "Pass / Fail" };
export const PROJECT_TYPES = ["ACADEMIC", "PERSONAL", "INTERNSHIP", "OPEN_SOURCE", "HACKATHON"] as const;
export const PROJECT_TYPE_LABEL: Record<(typeof PROJECT_TYPES)[number], string> = { ACADEMIC: "Academic", PERSONAL: "Personal", INTERNSHIP: "Internship", OPEN_SOURCE: "Open source", HACKATHON: "Hackathon" };
export const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
export const WORK_MODE_LABEL: Record<(typeof WORK_MODES)[number], string> = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };
export const JOB_TYPES = ["FULL_TIME", "INTERNSHIP", "APPRENTICESHIP"] as const;
export const JOB_TYPE_LABEL: Record<(typeof JOB_TYPES)[number], string> = { FULL_TIME: "Full-time job", INTERNSHIP: "Internship", APPRENTICESHIP: "Apprenticeship" };
export const ACCOMPLISHMENT_TYPES = ["AWARD", "HACKATHON", "PUBLICATION", "OPEN_SOURCE", "VOLUNTEERING", "OTHER"] as const;
export const ACCOMPLISHMENT_LABEL: Record<(typeof ACCOMPLISHMENT_TYPES)[number], string> = { AWARD: "Award / scholarship", HACKATHON: "Hackathon / competition", PUBLICATION: "Publication / paper", OPEN_SOURCE: "Open-source contribution", VOLUNTEERING: "Volunteering / leadership", OTHER: "Other" };
export const INDIAN_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Odia", "Urdu", "Assamese"];
export const INDIAN_CITIES = ["Bengaluru", "Chennai", "Hyderabad", "Pune", "Mumbai", "Delhi NCR", "Noida", "Gurugram", "Kolkata", "Ahmedabad", "Coimbatore", "Kochi", "Thiruvananthapuram", "Madurai", "Tiruchirappalli", "Mysuru", "Visakhapatnam", "Chandigarh", "Jaipur", "Indore", "Bhubaneswar", "Anywhere in India"];

const txt = (min: number, max: number, label: string) => z.preprocess((v) => cleanText(v), z.string().min(min, min > 1 ? `${label} needs at least ${min} characters` : `${label} is required`).max(max, `${label} is too long (max ${max})`));
// Zod 4 treats a missing key as an error unless the field is .optional(), so every optional field ends in .optional().
const optTxt = (max: number) => z.preprocess((v) => (cleanText(v) === "" ? null : cleanText(v)), z.string().max(max).nullable()).optional();
const month = z.preprocess((v) => (cleanText(v) === "" ? null : cleanText(v)), z.string().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, "Use month and year").nullable()).optional();
const reqMonth = z.preprocess((v) => cleanText(v), z.string().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, "Start month is required"));
const date = z.unknown().transform((v, ctx) => {
  const r = parseDateInput(v);
  if (r === null) return null;
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: r.reason });
    return z.NEVER;
  }
  return r.iso;
}).optional();
const url = z.preprocess(
  (v) => (cleanText(v) === "" ? null : cleanText(v)),
  z.string().max(300).refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Must be a web link starting with https://").nullable(),
).optional();
const year = (label: string) => z.preprocess((v) => (cleanText(v) === "" ? null : Number(v)), z.number({ error: `${label} must be a year` }).int().min(1990, `${label} looks wrong`).max(2040, `${label} looks wrong`).nullable()).optional();
const skillCodes = z.array(z.string().max(10)).max(10, "Up to 10 skills").default([]);

export const personalSchema = z
  .object({
    gender: z.preprocess((v) => (cleanText(v) === "" ? null : v), z.enum(GENDERS).nullable()).optional(),
    dateOfBirth: date,
    city: optTxt(80),
    state: optTxt(80),
    hometown: optTxt(80),
    languages: z.array(z.object({ name: txt(2, 40, "Language"), read: z.boolean(), write: z.boolean(), speak: z.boolean() })).max(10).default([]),
  })
  .strict();

export const aboutSchema = z.object({ headline: optTxt(250), summary: optTxt(2000) }).strict();

export const educationSchema = z
  .object({
    level: z.enum(EDUCATION_LEVELS, { error: "Choose the level" }),
    board: optTxt(120),
    institution: txt(2, 160, "School / college"),
    course: optTxt(120),
    specialization: optTxt(120),
    medium: optTxt(40),
    startYear: year("Start year"),
    endYear: year("End year"),
    ongoing: z.boolean().default(false),
    gradingSystem: z.enum(GRADING, { error: "Choose the grading system" }),
    score: z.preprocess((v) => (cleanText(v) === "" ? null : Number(v)), z.number({ error: "Score must be a number" }).min(0).nullable()).optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const max = e.gradingSystem === "PERCENTAGE" ? 100 : e.gradingSystem === "CGPA_10" ? 10 : e.gradingSystem === "CGPA_4" ? 4 : null;
    if (max !== null && e.score != null && e.score > max) ctx.addIssue({ code: "custom", path: ["score"], message: `Score can't be more than ${max}` });
    if (e.gradingSystem !== "PASS" && (e.score === null || e.score === undefined) && !e.ongoing) ctx.addIssue({ code: "custom", path: ["score"], message: "Enter your score (or mark as ongoing)" });
    if (e.startYear && e.endYear && e.endYear < e.startYear) ctx.addIssue({ code: "custom", path: ["endYear"], message: "End year is before start year" });
  });

export const internshipSchema = z
  .object({
    organisation: txt(2, 120, "Organisation"),
    role: txt(2, 120, "Role"),
    location: optTxt(80),
    workMode: z.preprocess((v) => (cleanText(v) === "" ? null : v), z.enum(WORK_MODES).nullable()).optional(),
    startMonth: reqMonth,
    endMonth: month,
    stipendMonthly: z.preprocess((v) => (cleanText(v) === "" ? null : Number(v)), z.number({ error: "Stipend must be a number" }).int().min(0).max(1_000_000).nullable()).optional(),
    description: txt(20, 1500, "Description"),
    skillCodes,
  })
  .strict()
  .refine((i) => !i.endMonth || i.endMonth >= i.startMonth, { path: ["endMonth"], message: "End is before start" });

export const certificationSchema = z
  .object({
    name: txt(2, 160, "Certification name"),
    issuer: txt(2, 120, "Issued by"),
    issueDate: date,
    expiryDate: date,
    noExpiry: z.boolean().default(false),
    credentialId: optTxt(120),
    url,
    skillCodes,
  })
  .strict()
  .refine((c) => !c.issueDate || !c.expiryDate || c.expiryDate >= c.issueDate, { path: ["expiryDate"], message: "Expiry is before issue date" });

export const accomplishmentSchema = z
  .object({
    type: z.enum(ACCOMPLISHMENT_TYPES, { error: "Choose a type" }),
    title: txt(3, 160, "Title"),
    issuer: optTxt(120),
    date,
    url,
    description: optTxt(1000),
  })
  .strict();

export const toolSchema = z
  .object({
    name: txt(1, 60, "Skill / tool"),
    version: optTxt(30),
    experienceMonths: z.preprocess((v) => (cleanText(v) === "" ? 0 : Number(v)), z.number({ error: "Experience must be a number" }).int().min(0).max(240)),
    lastUsedYear: year("Last used"),
  })
  .strict();

export const preferencesSchema = z
  .object({
    preferredRoleIds: z.array(z.string().uuid()).max(3, "Choose up to 3 roles").default([]),
    preferredLocations: z.array(txt(2, 60, "Location")).max(5, "Choose up to 5 locations").default([]),
    jobTypes: z.array(z.enum(JOB_TYPES)).max(3).default([]),
    workModes: z.array(z.enum(WORK_MODES)).max(3).default([]),
    expectedCtcLpa: z.preprocess((v) => (cleanText(v) === "" ? null : Number(v)), z.number({ error: "CTC must be a number" }).min(0).max(100, "Enter CTC in lakhs per annum (LPA)").nullable()).optional(),
    availableFrom: date,
    willingToRelocate: z.boolean().nullable().optional(),
  })
  .strict();

export const projectDetailSchema = z
  .object({
    title: txt(3, 120, "Title"),
    description: txt(10, 1000, "Description"),
    url,
    skillCodes,
    projectType: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(PROJECT_TYPES).default("ACADEMIC")),
    role: optTxt(80),
    startMonth: month,
    endMonth: month,
  })
  .strict()
  .refine((p) => !p.startMonth || !p.endMonth || p.endMonth >= p.startMonth, { path: ["endMonth"], message: "End is before start" });

export const LIST_KINDS = ["education", "internships", "certifications", "accomplishments", "tools"] as const;
export type ListKind = (typeof LIST_KINDS)[number];
export const LIST_LIMITS: Record<ListKind, number> = { education: 8, internships: 10, certifications: 20, accomplishments: 20, tools: 30 };
