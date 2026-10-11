import { z } from "zod";
import { setNewPasswordAfterReset } from "@/server/student/auth";
import { withStudent } from "@/server/student/session";
import { json, readJson } from "@/server/http";

/** PH2-7: the only student endpoint allowed while a one-time password is in use. */
export const POST = withStudent(
  async (ctx) => {
    const b = await readJson(ctx.req, z.object({ next: z.string().max(200) }));
    await setNewPasswordAfterReset(ctx.student.userId, ctx.student.studentId, b.next, ctx);
    return json({ next: "/student" });
  },
  { allowMustChange: true },
);
