import { masterOptions } from "@/server/masters";
import { requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../page-header";
import { StudentsTableClient as StudentsTable } from "../students/students-table-client";

export const metadata = { title: "Recycle Bin" };

export default async function RecycleBinPage() {
  const admin = await requirePageAdmin(["SUPER_ADMIN"]);
  return (
    <>
      <PageHeader title="Recycle Bin" subtitle="Soft-deleted students. Restore them, or permanently purge records deleted more than 30 days ago." />
      <StudentsTable options={await masterOptions()} role={admin.role} canExport={false} initialHidden={["degree", "colourTeam", "email"]} mode="recycle" />
    </>
  );
}
