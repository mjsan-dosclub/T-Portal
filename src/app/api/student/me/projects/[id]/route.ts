import { deleteProject, updateProject } from "@/server/profile";
import { withStudent } from "@/server/student/session";
import { json } from "@/server/http";

type P = { id: string };
export const PUT = withStudent<P>(async (ctx, p) => {
  await updateProject(ctx.student.studentId, p.id, await ctx.req.json().catch(() => ({})), `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
export const DELETE = withStudent<P>(async (ctx, p) => {
  await deleteProject(ctx.student.studentId, p.id, `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
