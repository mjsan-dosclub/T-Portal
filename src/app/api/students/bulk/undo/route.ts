import { z } from "zod";
import { undoDelete } from "@/server/students";
import { EDITORS, json, readJson, withAuth } from "@/server/http";

const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(20000), deletedAt: z.string() });

export const POST = withAuth(EDITORS, async (ctx) => {
  const b = await readJson(ctx.req, body);
  return json(await undoDelete(b.ids, b.deletedAt, ctx.admin, ctx));
});
