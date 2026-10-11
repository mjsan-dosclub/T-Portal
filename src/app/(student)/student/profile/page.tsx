import { roleOptions } from "@/server/ontology/queries";
import { getProfile, skillCatalog } from "@/server/profile";
import { requireStudentPage } from "@/server/student/session";
import { StudentNav } from "../student-nav";
import { ProfileEditor } from "./profile-editor";

export const metadata = { title: "My profile" };

export default async function StudentProfilePage() {
  const me = await requireStudentPage();
  const [profile, roles, catalog] = await Promise.all([getProfile(me.studentId), roleOptions(), skillCatalog()]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.25rem" }}>
      <StudentNav name={me.fullName} />
      <ProfileEditor profile={profile} roles={roles} catalog={catalog.map((c) => ({ code: c.code, name: c.name, category: c.subcategory.category.name }))} />
    </div>
  );
}
