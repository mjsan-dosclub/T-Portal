import { updateAdmin } from "@/server/admins";
import { json, SUPER, withAuth } from "@/server/http";

export const PATCH = withAuth<{ id: string }>(SUPER, async (ctx, p) => {
  await updateAdmin(p.id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});
