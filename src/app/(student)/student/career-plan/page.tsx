import { roleOptions } from "@/server/ontology/queries";
import { getProfile, skillCatalog } from "@/server/profile";
import { requireStudentPage } from "@/server/student/session";
import { StudentNav } from "../student-nav";
import { CareerPlan } from "./career-plan";

export const metadata = { title: "Career plan" };

export default async function CareerPlanPage() {
  const me = await requireStudentPage();
  const [profile, roles, catalog] = await Promise.all([getProfile(me.studentId), roleOptions(), skillCatalog()]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.25rem" }}>
      <StudentNav name={me.fullName} />
      <header>
        <h1 className="page-title">Career plan</h1>
        <p className="hint" style={{ fontSize: "0.95rem", marginTop: "0.25rem" }}>
          Pick the role you&apos;re aiming for, rate yourself on the skills it needs and follow the roadmap. This is your plan; it isn&apos;t part of your job-portal profile.
        </p>
      </header>
      <CareerPlan profile={profile} roles={roles} catalog={catalog.map((c) => ({ code: c.code, name: c.name, category: c.subcategory.category.name, description: c.description }))} />
    </div>
  );
}
