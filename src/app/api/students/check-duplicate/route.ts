import { z } from "zod";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { findDuplicates } from "@/server/students";
import { EDITORS, json, readJson, withAuth } from "@/server/http";

const body = z.object({ email: z.string().max(254).optional(), phone: z.string().max(40).optional(), exceptId: z.string().uuid().optional() });

/** Pre-save duplicate check for the form (FR-STU-FORM). POST so email/phone never appear in URLs. */
export const POST = withAuth(EDITORS, async (ctx) => {
  const b = await readJson(ctx.req, body);
  const email = b.email ? normalizeEmail(b.email) : "";
  const p = b.phone ? normalizePhone(b.phone) : null;
  const phone = p && p.ok ? p.e164 : "";
  return json({ duplicates: await findDuplicates(email || null, phone || null, b.exceptId) });
});
