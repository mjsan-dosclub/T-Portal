import { verifyLevels } from "@/server/profile";
import { EDITORS, json, withAuth } from "@/server/http";

/** PRF-2: admin sets / clears verified levels. */
export const PUT = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  await verifyLevels(p.id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});
