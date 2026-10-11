import { z } from "zod";
import { getProgram, updateProgram } from "@/server/internships";
import { ALL_ROLES, EDITORS, HttpError, json, withAuth } from "@/server/http";

type P = { id: string };
const uuid = z.string().uuid();
const check = (id: string) => {
  if (!uuid.safeParse(id).success) throw new HttpError(404, "Program not found");
};

export const GET = withAuth<P>(ALL_ROLES, async (_ctx, p) => {
  check(p.id);
  return json(await getProgram(p.id));
});
export const PUT = withAuth<P>(EDITORS, async (ctx, p) => {
  check(p.id);
  await updateProgram(p.id, await ctx.req.json(), ctx.admin, ctx);
  return json({ ok: true });
});
