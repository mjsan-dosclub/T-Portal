import { studentPrograms } from "@/server/internships";
import { withStudent } from "@/server/student/session";
import { json } from "@/server/http";

export const GET = withStudent(async (ctx) => json({ programs: await studentPrograms(ctx.student.studentId) }));
