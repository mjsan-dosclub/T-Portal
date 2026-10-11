import { updatePersonal } from "@/server/profile-sections";
import { withStudent } from "@/server/student/session";
import { json } from "@/server/http";

export const PUT = withStudent(async (ctx) => {
  await updatePersonal(ctx.student.studentId, await ctx.req.json().catch(() => ({})), `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
