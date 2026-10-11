import { addProject } from "@/server/profile";
import { withStudent } from "@/server/student/session";
import { json } from "@/server/http";

export const POST = withStudent(async (ctx) => {
  const p = await addProject(ctx.student.studentId, await ctx.req.json().catch(() => ({})), `student:${ctx.student.userId}`, ctx);
  return json({ id: p.id }, { status: 201 });
});
