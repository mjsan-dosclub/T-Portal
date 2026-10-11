import { LIST_KINDS, type ListKind } from "@/lib/validation/profile";
import { deleteItem, updateItem } from "@/server/profile-sections";
import { withStudent } from "@/server/student/session";
import { HttpError, json } from "@/server/http";

type P = { kind: string; id: string };
const kindOf = (k: string) => {
  if (!(LIST_KINDS as readonly string[]).includes(k)) throw new HttpError(404, "Unknown section");
  return k as ListKind;
};

export const PUT = withStudent<P>(async (ctx, p) => {
  await updateItem(kindOf(p.kind), ctx.student.studentId, p.id, await ctx.req.json().catch(() => ({})), `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
export const DELETE = withStudent<P>(async (ctx, p) => {
  await deleteItem(kindOf(p.kind), ctx.student.studentId, p.id, `student:${ctx.student.userId}`, ctx);
  return json({ ok: true });
});
