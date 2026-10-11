import { resetStudentPassword } from "@/server/student/admin";
import { EDITORS, json, withAuth } from "@/server/http";

/** PH2-7: Admin or Super Admin issues a one-time password (shown once). */
export const POST = withAuth<{ id: string }>(EDITORS, async (ctx, p) => json(await resetStudentPassword(p.id, ctx.admin, ctx)));
