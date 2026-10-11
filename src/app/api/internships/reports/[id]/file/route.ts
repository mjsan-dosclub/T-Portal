import { z } from "zod";
import { reportFile } from "@/server/internships";
import { fileResponse } from "@/server/report-file";
import { ALL_ROLES, HttpError, withAuth } from "@/server/http";

/** Admin download; attachment + sandbox CSP, audited (INT-3). */
export const GET = withAuth<{ id: string }>(ALL_ROLES, async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Report not found");
  return fileResponse(await reportFile(p.id, { adminId: ctx.admin.id }, ctx));
});
