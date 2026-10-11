import { LIST_KINDS, type ListKind } from "@/lib/validation/profile";
import { addItem } from "@/server/profile-sections";
import { withStudent } from "@/server/student/session";
import { HttpError, json } from "@/server/http";

export const POST = withStudent<{ kind: string }>(async (ctx, p) => {
  if (!(LIST_KINDS as readonly string[]).includes(p.kind)) throw new HttpError(404, "Unknown section");
  const row = await addItem(p.kind as ListKind, ctx.student.studentId, await ctx.req.json().catch(() => ({})), `student:${ctx.student.userId}`, ctx);
  return json({ id: row.id }, { status: 201 });
});
