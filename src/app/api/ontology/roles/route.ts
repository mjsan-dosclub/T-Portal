import { listRoles } from "@/server/ontology/queries";
import { ALL_ROLES, json, withAuth } from "@/server/http";

// Read-only (ONT-08). Search term is not PII, so GET query params are fine here.
export const GET = withAuth(ALL_ROLES, async (ctx) => {
  const u = new URL(ctx.req.url);
  const categoryId = Number(u.searchParams.get("category") ?? "") || undefined;
  return json({ roles: await listRoles({ q: u.searchParams.get("q")?.slice(0, 80) ?? undefined, categoryId }) });
});
