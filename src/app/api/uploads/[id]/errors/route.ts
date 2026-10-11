import { errorReportCsv } from "@/server/upload/students-upload";
import { EDITORS, withAuth } from "@/server/http";

export const GET = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  const csv = await errorReportCsv(p.id, ctx.admin);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="upload-errors-${p.id.slice(0, 8)}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
});
