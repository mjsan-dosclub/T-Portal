import { z } from "zod";
import { assignStudents } from "@/server/internships";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Program not found");
  return json(await assignStudents(p.id, await ctx.req.json(), ctx.admin, ctx));
});
