import { z } from "zod";
import { assignCandidates } from "@/server/internships";
import { EDITORS, HttpError, json, withAuth } from "@/server/http";

export const GET = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  if (!z.string().uuid().safeParse(p.id).success) throw new HttpError(404, "Program not found");
  const sp = new URL(ctx.req.url).searchParams;
  return json({ students: await assignCandidates(p.id, (sp.get("q") ?? "").slice(0, 80), sp.get("partner") === "1") });
});
