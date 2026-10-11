import { studentTemplate } from "@/server/upload/templates";
import { EDITORS, withAuth } from "@/server/http";

export const GET = withAuth(EDITORS, async (ctx) => {
  const format = new URL(ctx.req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const t = studentTemplate(format);
  return new Response(typeof t.body === "string" ? t.body : new Uint8Array(t.body), {
    headers: { "Content-Type": t.type, "Content-Disposition": `attachment; filename="${t.name}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
});
