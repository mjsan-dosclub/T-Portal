import { PageHeader } from "../page-header";
import { OntologyTabs } from "./tabs";

export default function OntologyLayout({ children }: LayoutProps<"/ontology">) {
  return (
    <>
      <PageHeader title="Skills Ontology" subtitle="DOS Club's ICT skills framework for Indian job-market roles. Read-only." />
      <OntologyTabs />
      {children}
    </>
  );
}
