import { z } from "zod";
import { attendanceSheet, batchOverview, saveSheet } from "@/server/attendance";
import { ALL_ROLES, EDITORS, HttpError, json, withAuth } from "@/server/http";

// Query params are a batch id and a workshop number: no PII.
export const GET = withAuth(ALL_ROLES, async (ctx) => {
  const u = new URL(ctx.req.url);
  const batchId = u.searchParams.get("batch") ?? "";
  if (!z.string().uuid().safeParse(batchId).success) throw new HttpError(400, "Choose a batch");
  const w = Number(u.searchParams.get("workshop") ?? "");
  if (!w) return json({ overview: await batchOverview(batchId) });
  return json({ sheet: await attendanceSheet(batchId, w) });
});

export const PUT = withAuth(EDITORS, async (ctx) => json(await saveSheet(await ctx.req.json().catch(() => ({})), ctx.admin, ctx)));
