import { z } from "zod";
import { selectionSchema } from "@/lib/validation/student";
import { restoreStudents } from "@/server/students";
import { json, readJson, SUPER, withAuth } from "@/server/http";

export const POST = withAuth(SUPER, async (ctx) => {
  const b = await readJson(ctx.req, z.object({ selection: selectionSchema }));
  return json(await restoreStudents(b.selection, ctx.admin, ctx));
});
