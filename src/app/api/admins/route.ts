import { inviteAdmin, listAdmins } from "@/server/admins";
import { json, SUPER, withAuth } from "@/server/http";

export const GET = withAuth(SUPER, async () => json({ admins: await listAdmins() }));
export const POST = withAuth(SUPER, async (ctx) => json(await inviteAdmin(await ctx.req.json().catch(() => ({})), ctx.admin, ctx), { status: 201 }));
