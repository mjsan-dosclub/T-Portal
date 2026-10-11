import { manageData } from "@/server/ontology/admin";
import { requirePageAdmin } from "@/server/page-auth";
import { OntologyManager } from "./ontology-manager";

export const metadata = { title: "Manage ontology" };

export default async function ManageOntologyPage() {
  await requirePageAdmin(["SUPER_ADMIN", "ADMIN"]);
  return <OntologyManager data={await manageData()} />;
}
