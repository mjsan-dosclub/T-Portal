import { setRoleSkills } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const PUT = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  await setRoleSkills(p.id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});
