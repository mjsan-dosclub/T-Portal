import { z } from "zod";
import { studentChangePassword } from "@/server/student/auth";
import { withStudent } from "@/server/student/session";
import { json, readJson } from "@/server/http";

export const POST = withStudent(async (ctx) => {
  const b = await readJson(ctx.req, z.object({ current: z.string().max(200), next: z.string().max(200) }));
  await studentChangePassword(ctx.student.userId, ctx.student.studentId, b.current, b.next, ctx);
  return json({ ok: true });
});
