import { retireSkill } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth<{ code: string }>(EDITORS, async (ctx, p) => json(await retireSkill(p.code.toUpperCase(), await ctx.req.json().catch(() => ({})), ctx.admin, ctx)));
