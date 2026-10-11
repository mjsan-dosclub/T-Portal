import { createSubcategory } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth(EDITORS, async (ctx) => {
  const sc = await createSubcategory(await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ id: sc.id, code: sc.code }, { status: 201 });
});
