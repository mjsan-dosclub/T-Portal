import { z } from "zod";
import { selectionSchema } from "@/lib/validation/student";
import { purgeStudents } from "@/server/students";
import { json, readJson, SUPER, withAuth } from "@/server/http";

export const POST = withAuth(SUPER, async (ctx) => {
  const b = await readJson(ctx.req, z.object({ selection: selectionSchema, confirmText: z.string().max(20).optional() }));
  return json(await purgeStudents(b.selection, b.confirmText, ctx.admin, ctx));
});
