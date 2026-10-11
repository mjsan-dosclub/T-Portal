import { z } from "zod";
import { setTargetRole } from "@/server/profile";
import { withStudent } from "@/server/student/session";
import { json, readJson } from "@/server/http";

export const PUT = withStudent(async (ctx) => {
  const b = await readJson(ctx.req, z.object({ roleId: z.string().uuid().nullable() }));
  await setTargetRole(ctx.student.studentId, b.roleId, `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
