import { z } from "zod";
import { selectionSchema } from "@/lib/validation/student";
import { bulkSoftDelete } from "@/server/students";
import { EDITORS, json, readJson, withAuth } from "@/server/http";

const body = z.object({ selection: selectionSchema, confirmText: z.string().max(20).optional() });

export const POST = withAuth(EDITORS, async (ctx) => {
  const b = await readJson(ctx.req, body);
  return json(await bulkSoftDelete(b.selection, b.confirmText, ctx.admin, ctx));
});
