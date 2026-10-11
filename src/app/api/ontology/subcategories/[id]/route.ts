import { renameSubcategory } from "@/server/ontology/admin";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const PUT = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  const id = Number(p.id);
  if (!Number.isInteger(id)) throw new HttpError(404, "Subcategory not found");
  await renameSubcategory(id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});
