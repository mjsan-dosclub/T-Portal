import { z } from "zod";
import { MASTER_TYPES, type MasterType } from "@/lib/validation/masters";
import { deleteMaster, setMasterActive, updateMaster } from "@/server/masters";
import { EDITORS, HttpError, json, readJson, withAuth } from "@/server/http";

type P = { type: string; id: string };
function parse(p: P): { type: MasterType; id: string } {
  if (!(MASTER_TYPES as readonly string[]).includes(p.type) || !z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Not found");
  return { type: p.type as MasterType, id: p.id };
}

export const PUT = withAuth<P>(EDITORS, async (ctx, p) => {
  const { type, id } = parse(p);
  await updateMaster(type, id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx);
  return json({ ok: true });
});

export const PATCH = withAuth<P>(EDITORS, async (ctx, p) => {
  const { type, id } = parse(p);
  const b = await readJson(ctx.req, z.object({ isActive: z.boolean() }));
  await setMasterActive(type, id, b.isActive, ctx.admin, ctx);
  return json({ ok: true });
});

export const DELETE = withAuth<P>(EDITORS, async (ctx, p) => {
  const { type, id } = parse(p);
  await deleteMaster(type, id, ctx.admin, ctx);
  return json({ ok: true });
});
