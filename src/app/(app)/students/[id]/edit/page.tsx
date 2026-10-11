import { notFound } from "next/navigation";
import { masterOptions } from "@/server/masters";
import { roleOptions } from "@/server/ontology/queries";
import { requirePageAdmin } from "@/server/page-auth";
import { getStudent } from "@/server/students";
import { HttpError } from "@/server/http";
import { PageHeader } from "../../../page-header";
import { StudentForm } from "../../student-form";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  const admin = await requirePageAdmin(["SUPER_ADMIN", "ADMIN"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const student = await getStudent(id, admin).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  });
  if (!student || student.deletedAt) notFound();
  const [options, roles] = await Promise.all([
    masterOptions([student.institutionId, student.degreeId, student.departmentId, student.batchId, student.statusId, student.colourTeamId].filter((x): x is string => !!x)),
    roleOptions(student.targetRoleId),
  ]);
  return (
    <>
      <PageHeader title={`Edit ${student.fullName}`} subtitle={<span className="mono">{student.studentCode} · code can&apos;t be changed</span>} />
      <StudentForm options={options} roles={roles} student={student} />
    </>
  );
}
