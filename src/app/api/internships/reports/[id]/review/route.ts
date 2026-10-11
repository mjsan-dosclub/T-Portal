import { z } from "zod";
import { reviewReport } from "@/server/internships";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Report not found");
  await reviewReport(p.id, await ctx.req.json(), ctx.admin, ctx);
  return json({ ok: true });
});
