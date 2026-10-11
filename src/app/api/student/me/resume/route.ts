import { deleteResume, RESUME_MAX_BYTES, resumeFile, resumeResponse, uploadResume } from "@/server/profile-sections";
import { withStudent } from "@/server/student/session";
import { HttpError, json } from "@/server/http";

export const POST = withStudent(async (ctx) => {
  if (Number(ctx.req.headers.get("content-length") ?? 0) > RESUME_MAX_BYTES + 64 * 1024) throw new HttpError(413, "Resume must be 2 MB or smaller");
  const form = await ctx.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a PDF file");
  await uploadResume(ctx.student.studentId, { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) }, `student:${ctx.student.userId}`, ctx);
  return json({ ok: true }, { status: 201 });
});
export const GET = withStudent(async (ctx) => resumeResponse(await resumeFile(ctx.student.studentId, null, ctx)));
export const DELETE = withStudent(async (ctx) => {
  await deleteResume(ctx.student.studentId, `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
