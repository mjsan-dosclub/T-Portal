import { runImport } from "@/server/upload/students-upload";
import { EDITORS, json, withAuth } from "@/server/http";

export const maxDuration = 300;

export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => json(await runImport(p.id, ctx.admin, ctx)));
