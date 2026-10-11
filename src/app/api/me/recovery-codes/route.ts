import { z } from "zod";
import { regenerateRecoveryCodes } from "@/server/auth/service";
import { ALL_ROLES, HttpError, json, readJson, withAuth } from "@/server/http";

export const POST = withAuth(ALL_ROLES, async (ctx) => {
  const b = await readJson(ctx.req, z.object({ code: z.string().max(10) }));
  const codes = await regenerateRecoveryCodes(ctx.admin.id, b.code, ctx);
  if (!codes) throw new HttpError(400, "That authenticator code didn't work");
  return json({ recoveryCodes: codes });
});
