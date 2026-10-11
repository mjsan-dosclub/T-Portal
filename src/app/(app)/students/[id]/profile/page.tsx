import Link from "next/link";
import { notFound } from "next/navigation";
import { studentAttendance } from "@/server/attendance";
import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { getProfile } from "@/server/profile";
import { HttpError } from "@/server/http";
import { Meter, ReadinessChip } from "@/components/skills/level-bar";
import { ProfileView } from "@/components/profile/profile-view";
import { roleOptions } from "@/server/ontology/queries";
import { PageHeader } from "../../../page-header";
import { AdminGap } from "./admin-gap";

export const metadata = { title: "Student profile" };

export default async function AdminStudentProfile({ params }: PageProps<"/students/[id]/profile">) {
  const admin = await requirePageAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await getProfile(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  });
  if (!profile) notFound();
  const [att, roles] = await Promise.all([studentAttendance(id), roleOptions()]);
  const roleNames = new Map(roles.map((r) => [r.id, r.name]));
  return (
    <>
      <PageHeader
        title={profile.student.fullName}
        subtitle={<><span className="mono">{profile.student.studentCode}</span> · skills, projects &amp; attendance</>}
        actions={canEdit(admin) ? <Link className="btn btn-secondary" href={`/students/${id}/edit`}>Edit record</Link> : undefined}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))", gap: "1.25rem" }}>
        <section className="glass card">
          <div className="hint">Target role</div>
          <div className="display" style={{ fontWeight: 600, fontSize: "1.1rem" }}>{profile.targetRole?.name ?? "Not chosen"}</div>
          <div style={{ marginTop: "0.5rem" }}><ReadinessChip readiness={profile.gap.readiness} /></div>
        </section>
        <section className="glass card">
          <div className="hint">Profile complete</div>
          <div className="stat-num">{profile.completeness}%</div>
          <Meter value={profile.completeness} label="Profile completeness" />
        </section>
        <section className="glass card">
          <div className="hint">27-Day Program</div>
          <div className="stat-num">{att.present}<span className="hint" style={{ fontSize: "1rem" }}> / {att.held} attended</span></div>
          {att.pct !== null && <Meter value={att.pct} label="Attendance" />}
        </section>
      </div>
      <section className="glass-strong card" aria-labelledby="gap-h" style={{ display: "grid", gap: "0.8rem" }}>
        <h2 id="gap-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>Skills vs. target role</h2>
        {canEdit(admin) && <p className="hint">Set a <strong>verified level</strong> after checking evidence (projects, interview, assessment). It counts instead of the self-rating.</p>}
        <AdminGap profile={profile} editable={canEdit(admin)} />
      </section>
      <ProfileView profile={profile} roleNames={roleNames} resumeHref={`/api/students/${id}/resume`} />
    </>
  );
}
