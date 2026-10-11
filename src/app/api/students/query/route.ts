import { studentQuerySchema } from "@/lib/validation/student";
import { queryStudents } from "@/server/students";
import { ALL_ROLES, HttpError, json, readJson, withAuth } from "@/server/http";

// POST so search text stays out of URLs and logs (STU-19).
export const POST = withAuth(ALL_ROLES, async (ctx) => {
  const q = await readJson(ctx.req, studentQuerySchema);
  if (q.deleted && ctx.admin.role !== "SUPER_ADMIN") throw new HttpError(403, "Only a Super Admin can view the Recycle Bin");
  return json(await queryStudents(q));
});
