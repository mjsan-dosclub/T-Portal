import { portalStatus, resetPortalAccess } from "@/server/student/admin";
import { ALL_ROLES, json, SUPER, withAuth } from "@/server/http";

type P = { id: string };
export const GET = withAuth<P>(ALL_ROLES, async (_ctx, p) => json(await portalStatus(p.id)));
export const DELETE = withAuth<P>(SUPER, async (ctx, p) => {
  const b = (await ctx.req.json().catch(() => ({}))) as { reason?: unknown };
  await resetPortalAccess(p.id, typeof b.reason === "string" ? b.reason : undefined, ctx.admin, ctx);
  return json({ ok: true });
});
