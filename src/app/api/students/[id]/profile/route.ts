import { getProfile } from "@/server/profile";
import { studentAttendance } from "@/server/attendance";
import { ALL_ROLES, json, withAuth } from "@/server/http";

export const GET = withAuth<{ id: string }>(ALL_ROLES, async (_ctx, p) => json({ profile: await getProfile(p.id), attendance: await studentAttendance(p.id) }));
