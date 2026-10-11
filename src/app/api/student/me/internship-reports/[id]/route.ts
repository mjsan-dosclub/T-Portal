import { z } from "zod";
import { reportFile } from "@/server/internships";
import { fileResponse } from "@/server/report-file";
import { withStudent } from "@/server/student/session";
import { HttpError } from "@/server/http";

/** A student can download only their own reports (404 otherwise). */
export const GET = withStudent<{ id: string }>(async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Report not found");
  return fileResponse(await reportFile(p.id, { studentId: ctx.student.studentId }, ctx));
});
