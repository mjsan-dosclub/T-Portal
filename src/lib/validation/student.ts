import { z } from "zod";
import { cleanText, normalizeEmail, normalizePhone, parseDateInput } from "@/lib/normalize";

// One schema for form, API and upload (CLAUDE.md §4, PRD §5.3).

export const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .']*$/u;

const optionalText = (max: number) =>
  z.preprocess((v) => (cleanText(v) === "" ? undefined : cleanText(v)), z.string().max(max).optional());

const optionalId = z.preprocess((v) => (cleanText(v) === "" ? undefined : cleanText(v)), z.string().uuid().optional());

const urlOnDomain = (domain: string, label: string) =>
  z.preprocess(
    (v) => (cleanText(v) === "" ? undefined : cleanText(v)),
    z
      .string()
      .max(300)
      .refine((s) => {
        try {
          const u = new URL(s);
          return (u.protocol === "https:" || u.protocol === "http:") && (u.hostname === domain || u.hostname.endsWith("." + domain));
        } catch {
          return false;
        }
      }, `${label} must be a ${domain} link`)
      .optional(),
  );

export function studentSchema(now = new Date()) {
  const year = now.getUTCFullYear();
  return z
    .object({
      fullName: z.preprocess(
        (v) => cleanText(v),
        z
          .string()
          .min(2, "Name must be at least 2 characters")
          .max(100, "Name must be at most 100 characters")
          .regex(NAME_RE, "Name may contain letters, spaces, . and ' only"),
      ),
      email: z.preprocess((v) => normalizeEmail(v), z.email({ error: "Enter a valid email" }).max(254)),
      phone: z.string().transform((v, ctx) => {
        const r = normalizePhone(v);
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: r.reason });
          return z.NEVER;
        }
        return r.e164;
      }),
      gender: z.preprocess((v) => (cleanText(v) === "" ? undefined : v), z.enum(GENDERS, { error: "Choose a valid gender" }).optional()),
      dateOfBirth: z.unknown().transform((v, ctx) => {
        const r = parseDateInput(v);
        if (r === null) return undefined;
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: r.reason });
          return z.NEVER;
        }
        const dob = new Date(r.iso + "T00:00:00Z");
        let age = year - dob.getUTCFullYear();
        const m = now.getUTCMonth() - dob.getUTCMonth();
        if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
        if (age < 15 || age > 40) {
          ctx.addIssue({ code: "custom", message: "Age must be between 15 and 40" });
          return z.NEVER;
        }
        return r.iso;
      }).optional(),
      institutionId: z.string().uuid("Choose an institution"),
      degreeId: z.string().uuid("Choose a degree"),
      departmentId: z.string().uuid("Choose a department"),
      yearOfStudy: z.preprocess(
        (v) => (cleanText(v) === "" ? undefined : Number(v)),
        z.number({ error: "Year of study must be a number" }).int().min(1, "Year of study must be 1–5").max(5, "Year of study must be 1–5").optional(),
      ),
      graduationYear: z.preprocess(
        (v) => (cleanText(v) === "" ? undefined : Number(v)),
        z
          .number({ error: "Graduation year is required" })
          .int()
          .min(year - 5, `Graduation year must be between ${year - 5} and ${year + 6}`)
          .max(year + 6, `Graduation year must be between ${year - 5} and ${year + 6}`),
      ),
      batchId: z.string().uuid("Choose a DOS Club batch"),
      colourTeamId: optionalId,
      statusId: z.string().uuid("Choose a status"),
      city: optionalText(80),
      state: optionalText(80),
      linkedinUrl: urlOnDomain("linkedin.com", "LinkedIn URL"),
      githubUrl: urlOnDomain("github.com", "GitHub URL"),
      notes: optionalText(2000),
      targetRoleId: optionalId,
    })
    .strict();
}

export type StudentInput = z.input<ReturnType<typeof studentSchema>>;
export type StudentData = z.output<ReturnType<typeof studentSchema>>;

/** Field → first error message. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.code === "unrecognized_keys" ? "Unknown field(s) in request" : issue.message;
  }
  return out;
}

/** Filters for the datatable (server-side, P11). Search text travels in the POST body, never the URL (STU-19). */
export const studentQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
  sort: z
    .enum(["studentCode", "fullName", "email", "phone", "institution", "department", "degree", "batch", "graduationYear", "status", "colourTeam", "createdAt", "updatedAt"])
    .default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().max(100).optional(),
  institutionId: z.array(z.string().uuid()).optional(),
  departmentId: z.array(z.string().uuid()).optional(),
  degreeId: z.array(z.string().uuid()).optional(),
  batchId: z.array(z.string().uuid()).optional(),
  colourTeamId: z.array(z.string().uuid()).optional(),
  statusId: z.array(z.string().uuid()).optional(),
  graduationYear: z.array(z.number().int()).optional(),
  deleted: z.boolean().default(false),
});
export type StudentQuery = z.output<typeof studentQuerySchema>;
export type StudentFilter = Omit<StudentQuery, "page" | "pageSize" | "sort" | "dir">;

/** Bulk selection: explicit ids (page selection) OR "all matching filter" (P12). */
export const selectionSchema = z.union([
  z.object({ mode: z.literal("ids"), ids: z.array(z.string().uuid()).min(1).max(1000) }),
  z.object({ mode: z.literal("filter"), filter: studentQuerySchema.omit({ page: true, pageSize: true, sort: true, dir: true }), expectedCount: z.number().int().min(1) }),
]);
export type Selection = z.output<typeof selectionSchema>;
