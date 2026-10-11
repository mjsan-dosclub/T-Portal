import Link from "next/link";
import { db } from "@/lib/db";
import { masterOptions } from "@/server/masters";
import { invitationMessage } from "@/server/student/invite";
import { canEdit, canExport, requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../page-header";
import { StudentsTableClient as StudentsTable } from "./students-table-client";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const admin = await requirePageAdmin();
  const [options, me] = await Promise.all([masterOptions(), db.adminUser.findUnique({ where: { id: admin.id }, select: { tablePrefs: true } })]);
  const prefs = (me?.tablePrefs ?? {}) as { hiddenColumns?: string[]; pageSize?: number };
  return (
    <>
      <PageHeader
        title="Students"
        subtitle="DOS Club student master. Search, filter and manage member records."
        actions={
          canEdit(admin) ? (
            <>
              <Link className="btn btn-secondary" href="/students/upload">Upload file</Link>
              <Link className="btn btn-primary" href="/students/new">Add student</Link>
            </>
          ) : undefined
        }
      />
      <StudentsTable options={options} role={admin.role} canExport={canExport(admin)} initialHidden={prefs.hiddenColumns ?? ["degree", "colourTeam"]} initialPageSize={prefs.pageSize} invitationText={canEdit(admin) ? invitationMessage() : undefined} />
    </>
  );
}
