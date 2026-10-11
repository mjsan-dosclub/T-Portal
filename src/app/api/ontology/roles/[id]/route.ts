import { updateRole } from "@/server/ontology/admin";
import { getRole } from "@/server/ontology/queries";
import { ALL_ROLES, EDITORS, HttpError, json, withAuth } from "@/server/http";

export const GET = withAuth<{ id: string }>(ALL_ROLES, async (_ctx, p) => {
  const role = await getRole(p.id);
  if (!role) throw new HttpError(404, "Role not found");
  return json(role);
});

export const PUT = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  await updateRole(p.id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});
