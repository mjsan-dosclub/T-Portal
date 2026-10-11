import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../page-header";
import { OntologyTabs } from "./tabs";

export default async function OntologyLayout({ children }: LayoutProps<"/ontology">) {
  const admin = await requirePageAdmin();
  return (
    <>
      <PageHeader title="Skills Ontology" subtitle={canEdit(admin) ? "DOS Club's ICT skills framework for Indian job-market roles. Use Manage to keep it current." : "DOS Club's ICT skills framework for Indian job-market roles."} />
      <OntologyTabs canManage={canEdit(admin)} />
      {children}
    </>
  );
}
