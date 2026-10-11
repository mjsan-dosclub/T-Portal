import { MASTER_TYPES, type MasterType } from "@/lib/validation/masters";
import { masterTemplateCsv } from "@/server/upload/masters-import";
import { EDITORS, HttpError, withAuth } from "@/server/http";

export const GET = withAuth<{ type: string }>(EDITORS, async (_ctx, p) => {
  if (!(MASTER_TYPES as readonly string[]).includes(p.type)) throw new HttpError(404, "Unknown master");
  return new Response(masterTemplateCsv(p.type as MasterType), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${p.type}-template.csv"`, "Cache-Control": "no-store" },
  });
});
