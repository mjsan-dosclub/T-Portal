import { retireRole } from "@/server/ontology/admin";
import { EDITORS, json, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => json(await retireRole(p.id, await ctx.req.json().catch(() => ({})), ctx.admin, ctx)));
