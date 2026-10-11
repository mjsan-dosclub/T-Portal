import { getUpload } from "@/server/upload/students-upload";
import { EDITORS, json, withAuth } from "@/server/http";

export const GET = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  const u = new URL(ctx.req.url);
  const status = u.searchParams.get("status") ?? undefined;
  return json(
    await getUpload(p.id, ctx.admin, {
      status: status && ["VALID", "DUPLICATE_FILE", "DUPLICATE_DB", "ERROR"].includes(status) ? status : undefined,
      page: Number(u.searchParams.get("page") ?? 1) || 1,
      pageSize: Number(u.searchParams.get("pageSize") ?? 50) || 50,
    }),
  );
});
