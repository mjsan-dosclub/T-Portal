import { z } from "zod";
import { cleanText, parseDateInput } from "@/lib/normalize";

export const MASTER_TYPES = ["institutions", "degrees", "departments", "batches", "colour-teams", "statuses"] as const;
export type MasterType = (typeof MASTER_TYPES)[number];

export const MASTER_LABELS: Record<MasterType, { plural: string; singular: string }> = {
  institutions: { plural: "Institutions", singular: "Institution" },
  degrees: { plural: "Degrees", singular: "Degree" },
  departments: { plural: "Departments", singular: "Department" },
  batches: { plural: "DOS Club Batches", singular: "Batch" },
  "colour-teams": { plural: "Colour Teams", singular: "Colour Team" },
  statuses: { plural: "Student Statuses", singular: "Status" },
};

/** Status colours are token keys, never raw hex (CLAUDE.md §7). */
export const STATUS_COLOR_TOKENS = ["accent", "primary", "deep", "muted"] as const;

const name = z.preprocess((v) => cleanText(v), z.string().min(1, "Name is required").max(120));
const optText = (max: number) => z.preprocess((v) => (cleanText(v) === "" ? undefined : cleanText(v)), z.string().max(max).optional());
const bool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  const s = cleanText(v).toLowerCase();
  if (s === "") return undefined;
  return ["true", "yes", "y", "1"].includes(s) ? true : ["false", "no", "n", "0"].includes(s) ? false : v;
}, z.boolean({ error: "Use yes/no" }).optional());
const optDate = z.unknown().transform((v, ctx) => {
  const r = parseDateInput(v);
  if (r === null) return undefined;
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: r.reason });
    return z.NEVER;
  }
  return r.iso;
}).optional();

export const masterSchemas = {
  institutions: z.object({ name, shortCode: optText(20), city: optText(80), state: optText(80), isPartner: bool }).strict(),
  degrees: z
    .object({
      name,
      level: z.preprocess((v) => cleanText(v).toUpperCase(), z.enum(["UG", "PG", "DIPLOMA"], { error: "Level must be UG, PG or Diploma" })),
    })
    .strict(),
  departments: z
    .object({
      name,
      shortCode: optText(20),
      aliases: z.preprocess(
        (v) => (Array.isArray(v) ? v : cleanText(v) === "" ? [] : String(v).split(/[;|]/)).map((a: unknown) => cleanText(a)).filter(Boolean),
        z.array(z.string().max(80)).max(30),
      ),
    })
    .strict(),
  batches: z
    .object({
      batchCode: z.preprocess((v) => cleanText(v), z.string().min(1, "Batch code is required").max(40)),
      year: z.preprocess((v) => Number(cleanText(v)), z.number({ error: "Year is required" }).int().min(2000).max(2100)),
      startDate: optDate,
      endDate: optDate,
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.startDate && v.endDate && v.endDate < v.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
      }
    }),
  "colour-teams": z
    .object({
      name,
      hexColor: z.preprocess(
        (v) => (cleanText(v) === "" ? undefined : cleanText(v).toUpperCase()),
        z.string().regex(/^#[0-9A-F]{6}$/, "Use a hex colour in the form #RRGGBB").optional(),
      ),
    })
    .strict(),
  statuses: z
    .object({
      name,
      color: z.preprocess((v) => (cleanText(v) === "" ? undefined : cleanText(v)), z.enum(STATUS_COLOR_TOKENS).optional()),
      isActiveState: bool,
    })
    .strict(),
} as const;

export type MasterInput<T extends MasterType> = z.output<(typeof masterSchemas)[T]>;
