import { masterOptions } from "@/server/masters";
import { roleOptions } from "@/server/ontology/queries";
import { requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../../page-header";
import { StudentForm } from "../student-form";

export const metadata = { title: "Add student" };

export default async function NewStudentPage() {
  await requirePageAdmin(["SUPER_ADMIN", "ADMIN"]);
  const [options, roles] = await Promise.all([masterOptions(), roleOptions()]);
  return (
    <>
      <PageHeader title="Add student" subtitle="A student code (DOS-YYYY-NNNNN) is generated when you save." />
      <StudentForm options={options} roles={roles} />
    </>
  );
}
