import { resetPassword } from "@/server/admins";
import { json, SUPER, withAuth } from "@/server/http";

export const POST = withAuth<{ id: string }>(SUPER, async (ctx, p) => json(await resetPassword(p.id, ctx.admin, ctx)));
