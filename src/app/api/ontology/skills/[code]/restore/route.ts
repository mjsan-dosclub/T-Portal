import { restoreSkill } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth<{ code: string }>(EDITORS, async (ctx, p) => {
  await restoreSkill(p.code.toUpperCase(), ctx.admin, ctx);
  return json({ ok: true });
});
