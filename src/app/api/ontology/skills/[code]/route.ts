import { deleteSkill, updateSkill } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

type P = { code: string };

export const PUT = withAuth<P>(EDITORS, async (ctx, p) => {
  await updateSkill(p.code.toUpperCase(), await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});

export const DELETE = withAuth<P>(EDITORS, async (ctx, p) => {
  await deleteSkill(p.code.toUpperCase(), ctx.admin, ctx);
  return json({ ok: true });
});
