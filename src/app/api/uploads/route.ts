import { readUploadedFile } from "@/server/upload/form-file";
import { createStudentUpload, recentUploads } from "@/server/upload/students-upload";
import { hit } from "@/server/auth/rate-limit";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const POST = withAuth(EDITORS, async (ctx) => {
  if (!(await hit(`upload:${ctx.admin.id}`, 20, 10 * 60_000))) throw new HttpError(429, "Too many uploads. Wait a few minutes."); // SEC-09
  const file = await readUploadedFile(ctx.req);
  return json(await createStudentUpload(file, ctx.admin), { status: 201 });
});

export const GET = withAuth(EDITORS, async (ctx) => json({ uploads: await recentUploads(ctx.admin) }));
