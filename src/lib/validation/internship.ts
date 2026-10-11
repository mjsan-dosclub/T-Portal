import { z } from "zod";
import { cleanText, parseDateInput } from "@/lib/normalize";

export const PROGRAM_STATUSES = ["DRAFT", "OPEN", "ONGOING", "COMPLETED", "CANCELLED"] as const;
export const PROGRAM_STATUS_LABEL: Record<(typeof PROGRAM_STATUSES)[number], string> = { DRAFT: "Draft", OPEN: "Open", ONGOING: "Ongoing", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
export const MODE_LABEL: Record<(typeof MODES)[number], string> = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };

const txt = (min: number, max: number, label: string) => z.preprocess((v) => cleanText(v), z.string().min(min, `${label} is required`).max(max, `${label} is too long`));

export const programSchema = z
  .object({
    companyName: txt(2, 160, "Company name"),
    title: txt(3, 160, "Program title"),
    description: z.preprocess((v) => String(v ?? "").trim(), z.string().min(20, "Describe the internship (20+ characters)").max(5000)),
    country: txt(2, 80, "Country"),
    city: z.preprocess((v) => (cleanText(v) === "" ? null : cleanText(v)), z.string().max(80).nullable()).optional(),
    workMode: z.enum(MODES, { error: "Choose a work mode" }),
    seats: z.coerce.number({ error: "Number of resources is required" }).int().min(1, "At least 1 resource").max(500),
    durationValue: z.coerce.number({ error: "Duration is required" }).int().min(1, "Duration must be at least 1").max(730),
    durationUnit: z.enum(["DAYS", "WEEKS"], { error: "Choose days or weeks" }),
    startDate: z
      .unknown()
      .transform((v, ctx) => {
        const r = parseDateInput(v);
        if (r === null) return null;
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: r.reason });
          return z.NEVER;
        }
        return r.iso;
      })
      .optional(),
    status: z.enum(PROGRAM_STATUSES).default("DRAFT"),
  })
  .strict()
  .refine((p) => totalDaysOf(p) <= 730, { path: ["durationValue"], message: "Maximum duration is 2 years" })
  .refine((p) => !(p.status === "ONGOING" && !p.startDate), { path: ["startDate"], message: "Set a start date before marking the program ongoing" });

function totalDaysOf(p: { durationValue: number; durationUnit: string }) {
  return p.durationUnit === "WEEKS" ? p.durationValue * 7 : p.durationValue;
}
