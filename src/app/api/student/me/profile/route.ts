import { getProfile } from "@/server/profile";
import { studentAttendance } from "@/server/attendance";
import { withStudent } from "@/server/student/session";
import { json } from "@/server/http";

export const GET = withStudent(async (ctx) => json({ profile: await getProfile(ctx.student.studentId), attendance: await studentAttendance(ctx.student.studentId) }));
