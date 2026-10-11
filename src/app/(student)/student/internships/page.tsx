import { db } from "@/lib/db";
import { studentPrograms } from "@/server/internships";
import { ACCEPT_ATTR, REPORT_MAX_BYTES } from "@/server/report-file";
import { requireStudentPage } from "@/server/student/session";
import { StudentNav } from "../student-nav";
import { MyInternships } from "./my-internships";

export const metadata = { title: "My internships" };

export default async function StudentInternshipsPage() {
  const me = await requireStudentPage();
  const [s, programs] = await Promise.all([db.student.findUniqueOrThrow({ where: { id: me.studentId }, select: { fullName: true } }), studentPrograms(me.studentId)]);
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <StudentNav name={s.fullName} />
      <header>
        <h1 className="page-title">My internships</h1>
        <p className="hint" style={{ fontSize: "0.95rem", marginTop: "0.25rem" }}>
          International internship programs you&apos;ve been assigned to. Upload a work report every week: each report counts as your attendance for that week.
        </p>
      </header>
      <MyInternships programs={programs} accept={ACCEPT_ATTR} maxMb={REPORT_MAX_BYTES / 1024 / 1024} />
    </div>
  );
}
