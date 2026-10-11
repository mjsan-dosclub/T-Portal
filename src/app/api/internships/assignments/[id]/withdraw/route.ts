import { z } from "zod";
import { withdrawAssignment } from "@/server/internships";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Assignment not found");
  const body = (await ctx.req.json().catch(() => ({}))) as { reason?: unknown };
  await withdrawAssignment(p.id, typeof body.reason === "string" ? body.reason : undefined, ctx.admin, ctx);
  return json({ ok: true });
});
