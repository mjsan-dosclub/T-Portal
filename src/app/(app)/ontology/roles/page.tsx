import { db } from "@/lib/db";
import { requirePageAdmin } from "@/server/page-auth";
import { RoleExplorer } from "./role-explorer";

export const metadata = { title: "Role Explorer" };

export default async function RolesPage() {
  await requirePageAdmin();
  const categories = await db.ontCategory.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } });
  return <RoleExplorer categories={categories} />;
}
