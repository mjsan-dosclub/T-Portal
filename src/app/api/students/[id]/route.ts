import { z } from "zod";
import { bulkSoftDelete, getStudent, updateStudent } from "@/server/students";
import { ALL_ROLES, EDITORS, HttpError, json, withAuth } from "@/server/http";

type P = { id: string };
const id = z.string().uuid();

export const GET = withAuth<P>(ALL_ROLES, async (ctx, p) => {
  if (!id.safeParse(p.id).success) throw new HttpError(404, "Student not found");
  return json(await getStudent(p.id, ctx.admin));
});

export const PUT = withAuth<P>(EDITORS, async (ctx, p) => {
  if (!id.safeParse(p.id).success) throw new HttpError(404, "Student not found");
  const body = (await ctx.req.json().catch(() => ({}))) as { version?: unknown; data?: unknown };
  const version = Number(body.version);
  if (!Number.isInteger(version)) throw new HttpError(400, "version is required");
  return json(await updateStudent(p.id, body.data, version, ctx.admin, ctx));
});

export const DELETE = withAuth<P>(EDITORS, async (ctx, p) => {
  if (!id.safeParse(p.id).success) throw new HttpError(404, "Student not found");
  const r = await bulkSoftDelete({ mode: "ids", ids: [p.id] }, undefined, ctx.admin, ctx);
  if (!r.deleted) throw new HttpError(404, "Student not found");
  return json(r);
});
