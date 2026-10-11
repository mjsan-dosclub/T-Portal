import { createSkill } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth(EDITORS, async (ctx) => {
  const s = await createSkill(await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ code: s.code }, { status: 201 });
});
