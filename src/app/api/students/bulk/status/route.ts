import { z } from "zod";
import { selectionSchema } from "@/lib/validation/student";
import { bulkUpdateStatus } from "@/server/students";
import { EDITORS, json, readJson, withAuth } from "@/server/http";

const body = z.object({ selection: selectionSchema, statusId: z.string().uuid(), reason: z.string().max(500).optional() });

export const POST = withAuth(EDITORS, async (ctx) => {
  const b = await readJson(ctx.req, body);
  return json(await bulkUpdateStatus(b.selection, b.statusId, b.reason, ctx.admin, ctx));
});
