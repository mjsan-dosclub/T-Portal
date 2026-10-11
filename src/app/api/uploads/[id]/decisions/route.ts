import { z } from "zod";
import { setDecisions } from "@/server/upload/students-upload";
import { EDITORS, json, readJson, withAuth } from "@/server/http";

const body = z.object({ decision: z.enum(["skip", "update"]), rows: z.union([z.literal("all"), z.array(z.number().int()).max(10000)]) });

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => {
  const b = await readJson(ctx.req, body);
  return json(await setDecisions(p.id, b.decision, b.rows, ctx.admin));
});
