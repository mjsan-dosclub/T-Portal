import { requirePageAdmin } from "@/server/page-auth";
import { PageHeader } from "../page-header";
import { AccountForms } from "./account-forms";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await requirePageAdmin();
  return (
    <>
      <PageHeader title="Account" subtitle={`${me.name} · ${me.email}`} />
      <AccountForms />
    </>
  );
}
