import { db } from "@/lib/db";
import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../page-header";
import { AttendanceManager } from "./attendance-manager";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const admin = await requirePageAdmin();
  const [batches, workshops] = await Promise.all([
    db.batch.findMany({ where: { isActive: true }, orderBy: [{ year: "desc" }, { batchCode: "asc" }], select: { id: true, batchCode: true, _count: { select: { students: { where: { deletedAt: null } } } } } }),
    db.ontWorkshop.findMany({ orderBy: { n: "asc" }, select: { n: true, title: true } }),
  ]);
  return (
    <>
      <PageHeader title="Attendance" subtitle="Runway · CodeZap 3.0. Mark who attended each workshop day, batch by batch." />
      <AttendanceManager batches={batches.map((b) => ({ id: b.id, code: b.batchCode, students: b._count.students }))} workshops={workshops} editable={canEdit(admin)} />
    </>
  );
}
