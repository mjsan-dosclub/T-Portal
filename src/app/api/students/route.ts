import { createStudent } from "@/server/students";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth(EDITORS, async (ctx) => {
  const body = await ctx.req.json().catch(() => ({}));
  const s = await createStudent(body, ctx.admin, ctx);
  return json({ id: s.id, studentCode: s.studentCode }, { status: 201 });
});
