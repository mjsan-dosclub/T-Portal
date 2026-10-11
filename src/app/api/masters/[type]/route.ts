import { MASTER_TYPES, type MasterType } from "@/lib/validation/masters";
import { createMaster, listMaster } from "@/server/masters";
import { ALL_ROLES, EDITORS, HttpError, json, withAuth } from "@/server/http";

type P = { type: string };
function masterType(t: string): MasterType {
  if (!(MASTER_TYPES as readonly string[]).includes(t)) throw new HttpError(404, "Unknown master");
  return t as MasterType;
}

export const GET = withAuth<P>(ALL_ROLES, async (_ctx, p) => json({ rows: await listMaster(masterType(p.type)) }));

export const POST = withAuth<P>(EDITORS, async (ctx, p) => {
  const id = await createMaster(masterType(p.type), await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ id }, { status: 201 });
});
