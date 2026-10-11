import { listAdmins } from "@/server/admins";
import { requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../../page-header";
import { AdminUsers } from "./admin-users";

export const metadata = { title: "Admin users" };

export default async function AdminUsersPage() {
  const me = await requirePageAdmin(["SUPER_ADMIN"]);
  return (
    <>
      <PageHeader title="Admin users" subtitle="Invite admins, change roles, and reset two-factor for anyone who lost their phone. There is no public sign-up." />
      <AdminUsers admins={await listAdmins()} meId={me.id} />
    </>
  );
}
