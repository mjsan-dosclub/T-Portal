import { createRole } from "@/server/ontology/admin";
import { listRoles } from "@/server/ontology/queries";
import { ALL_ROLES, EDITORS, json, withAuth } from "@/server/http";

// Search term is not PII, so GET query params are fine here.
export const GET = withAuth(ALL_ROLES, async (ctx) => {
  const u = new URL(ctx.req.url);
  const categoryId = Number(u.searchParams.get("category") ?? "") || undefined;
  return json({ roles: await listRoles({ q: u.searchParams.get("q")?.slice(0, 80) ?? undefined, categoryId }) });
});

export const POST = withAuth(EDITORS, async (ctx) => {
  const r = await createRole(await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ id: r.id }, { status: 201 });
});
