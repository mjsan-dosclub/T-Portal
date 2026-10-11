import Link from "next/link";
import { notFound } from "next/navigation";
import { MASTER_LABELS, MASTER_TYPES, type MasterType } from "@/lib/validation/masters";
import { listMaster } from "@/server/masters";
import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../../page-header";
import { MasterManager } from "./master-manager";

export async function generateMetadata({ params }: PageProps<"/masters/[type]">) {
  const { type } = await params;
  return { title: MASTER_LABELS[type as MasterType]?.plural ?? "Masters" };
}

export default async function MasterPage({ params }: PageProps<"/masters/[type]">) {
  const admin = await requirePageAdmin();
  const { type } = await params;
  if (!(MASTER_TYPES as readonly string[]).includes(type)) notFound();
  const t = type as MasterType;
  const rows = await listMaster(t);
  return (
    <>
      <PageHeader title="Masters" subtitle="Lookup values used by student records. In-use values can't be deleted, only deactivated." />
      <nav className="tabs glass" style={{ padding: "0.4rem", borderRadius: "var(--r-pill)" }} aria-label="Master tables">
        {MASTER_TYPES.map((m) => (
          <Link key={m} href={`/masters/${m}`} className="tab" aria-current={m === t ? "page" : undefined}>
            {MASTER_LABELS[m].plural}
          </Link>
        ))}
      </nav>
      <MasterManager type={t} rows={rows} editable={canEdit(admin)} />
    </>
  );
}
