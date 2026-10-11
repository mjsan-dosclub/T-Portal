import { createProgram, listPrograms } from "@/server/internships";
import { ALL_ROLES, EDITORS, json, withAuth } from "@/server/http";

export const GET = withAuth(ALL_ROLES, async (ctx) => {
  const status = new URL(ctx.req.url).searchParams.get("status") ?? undefined;
  return json({ programs: await listPrograms(status || undefined) });
});
export const POST = withAuth(EDITORS, async (ctx) => {
  const p = await createProgram(await ctx.req.json(), ctx.admin, ctx);
  return json({ id: p.id, code: p.code }, { status: 201 });
});
