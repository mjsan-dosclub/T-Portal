import { resumeFile, resumeResponse } from "@/server/profile-sections";
import { ALL_ROLES, withAuth } from "@/server/http";

/** Admin download; always as an attachment and audited (PRF-5). */
export const GET = withAuth<{ id: string }>(ALL_ROLES, async (ctx, p) => resumeResponse(await resumeFile(p.id, ctx.admin.id, ctx)));
