import { resetTwoFactor } from "@/server/admins";
import { json, SUPER, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(SUPER, async (ctx, p) => {
  const b = (await ctx.req.json().catch(() => ({}))) as { reason?: unknown };
  await resetTwoFactor(p.id, ctx.admin, ctx, typeof b.reason === "string" ? b.reason : undefined);
  return json({ ok: true });
});
