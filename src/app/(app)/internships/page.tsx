import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { listPrograms } from "@/server/internships";
import { PageHeader } from "../page-header";
import { ProgramsList } from "./programs-list";

export const metadata = { title: "Internships" };

export default async function InternshipsPage() {
  const admin = await requirePageAdmin();
  const programs = await listPrograms();
  return (
    <>
      <PageHeader title="International internships" subtitle="Add client internship programs, assign students and follow their weekly work reports. A report each week counts as internship attendance." />
      <ProgramsList programs={programs} editable={canEdit(admin)} />
    </>
  );
}
