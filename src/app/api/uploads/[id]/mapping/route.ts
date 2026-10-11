import { z } from "zod";
import { saveMapping } from "@/server/upload/students-upload";
import { EDITORS, json, readJson, withAuth } from "@/server/http";

const body = z.object({ mapping: z.record(z.string(), z.record(z.string().max(200), z.string().uuid().nullable())) });

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  const b = await readJson(ctx.req, body);
  return json(await saveMapping(p.id, b.mapping, ctx.admin));
});
