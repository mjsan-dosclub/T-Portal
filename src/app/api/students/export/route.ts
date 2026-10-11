import { z } from "zod";
import { selectionSchema, studentQuerySchema } from "@/lib/validation/student";
import { exportStudents } from "@/server/students";
import { canExport } from "@/server/page-auth";
import { ALL_ROLES, HttpError, readJson, withAuth } from "@/server/http";

const body = z.union([
  z.object({ selection: selectionSchema }),
  z.object({ filter: studentQuerySchema.omit({ page: true, pageSize: true, sort: true, dir: true }) }),
]);

export const POST = withAuth(ALL_ROLES, async (ctx) => {
  if (!canExport(ctx.admin)) throw new HttpError(403, "You don't have export permission");
  const b = await readJson(ctx.req, body);
  const csv = await exportStudents("selection" in b ? b.selection : { mode: "query", filter: b.filter }, ctx.admin, ctx);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dos-students-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
