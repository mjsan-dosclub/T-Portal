import { z } from "zod";
import { changeOwnPassword } from "@/server/admins";
import { ALL_ROLES, json, readJson, withAuth } from "@/server/http";

export const POST = withAuth(ALL_ROLES, async (ctx) => {
  const b = await readJson(ctx.req, z.object({ current: z.string().max(200), next: z.string().max(200) }));
  await changeOwnPassword(ctx.admin, b.current, b.next, ctx);
  return json({ ok: true });
});
