import { z } from "zod";
import { readyListCsv } from "@/server/insights";
import { canExport } from "@/server/page-auth";
import { ALL_ROLES, HttpError, readJson, withAuth } from "@/server/http";

const body = z.object({ batchId: z.string().uuid().optional(), institutionId: z.string().uuid().optional(), roleId: z.string().uuid().optional(), level: z.enum(["ready", "nearly"]).optional() });

export const POST = withAuth(ALL_ROLES, async (ctx) => {
  if (!canExport(ctx.admin)) throw new HttpError(403, "You don't have export permission");
  const csv = await readyListCsv(await readJson(ctx.req, body), ctx.admin, ctx);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="dos-ready-for-role-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
});
