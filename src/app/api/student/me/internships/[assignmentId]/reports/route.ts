import { z } from "zod";
import { submitReport } from "@/server/internships";
import { REPORT_MAX_BYTES } from "@/server/report-file";
import { withStudent } from "@/server/student/session";
import { HttpError, json } from "@/server/http";

/** Weekly work report upload (INT-2): multipart weekNo + file (+ note). */
export const POST = withStudent<{ assignmentId: string }>(async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.assignmentId).success) throw new HttpError(404, "Internship not found");
  if (Number(ctx.req.headers.get("content-length") ?? 0) > REPORT_MAX_BYTES + 64 * 1024) throw new HttpError(413, "Report must be 10 MB or smaller");
  const form = await ctx.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload");
  if (file.size > REPORT_MAX_BYTES) throw new HttpError(413, "Report must be 10 MB or smaller");
  const r = await submitReport(
    ctx.student.studentId,
    p.assignmentId,
    { weekNo: Number(form!.get("weekNo")), note: String(form!.get("note") ?? ""), file: { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) } },
    `student:${ctx.student.userId}`,
    ctx,
  );
  return json(r, { status: 201 });
});
