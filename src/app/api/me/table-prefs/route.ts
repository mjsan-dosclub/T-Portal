import { z } from "zod";
import { saveTablePrefs } from "@/server/students";
import { ALL_ROLES, json, readJson, withAuth } from "@/server/http";

const body = z.object({ hiddenColumns: z.array(z.string().max(40)).max(30), pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional() });

export const PUT = withAuth(ALL_ROLES, async (ctx) => {
  await saveTablePrefs(ctx.admin.id, await readJson(ctx.req, body));
  return json({ ok: true });
});
