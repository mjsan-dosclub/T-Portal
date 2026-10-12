import { masterOptions } from "@/server/masters";
import { requirePageAdmin } from "@/server/page-auth";
import { recentUploads } from "@/server/upload/students-upload";
import { PageHeader } from "../../page-header";
import { UploadWizard } from "./wizard";

export const metadata = { title: "Upload students" };

export default async function UploadPage({ searchParams }: PageProps<"/students/upload">) {
  const admin = await requirePageAdmin(["SUPER_ADMIN", "ADMIN"]);
  const sp = await searchParams;
  const [options, recent] = await Promise.all([masterOptions(), recentUploads(admin, 8)]);
  return (
    <>
      <PageHeader title="Upload students" subtitle="Bulk add DOS Club members from Excel (.xlsx) or CSV. Up to 10,000 rows / 4 MB per file." />
      <UploadWizard
        options={options}
        initialJobId={typeof sp.job === "string" ? sp.job : undefined}
        recent={recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </>
  );
}
