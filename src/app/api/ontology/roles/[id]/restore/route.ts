import { restoreRole } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  await restoreRole(p.id, ctx.admin, ctx);
  return json({ ok: true });
});
