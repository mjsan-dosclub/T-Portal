import { z } from "zod";
import { studentRegenerateCodes } from "@/server/student/auth";
import { withStudent } from "@/server/student/session";
import { HttpError, json, readJson } from "@/server/http";

export const POST = withStudent(async (ctx) => {
  const b = await readJson(ctx.req, z.object({ code: z.string().max(10) }));
  const codes = await studentRegenerateCodes(ctx.student.userId, ctx.student.studentId, b.code, ctx);
  if (!codes) throw new HttpError(400, "That authenticator code didn't work");
  return json({ recoveryCodes: codes });
});
