import Link from "next/link";
import { notFound } from "next/navigation";
import { studentAttendance } from "@/server/attendance";
import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { getProfile } from "@/server/profile";
import { HttpError } from "@/server/http";
import { Meter, LevelBar, ReadinessChip } from "@/components/skills/level-bar";
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
  const att = await studentAttendance(id);
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.25rem", alignItems: "start" }}>
        <section className="glass card" aria-labelledby="os-h">
          <h2 id="os-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.6rem" }}>Other skills</h2>
          {profile.otherSkills.length === 0 ? <p className="hint">None added.</p> : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.4rem" }}>
              {profile.otherSkills.map((s) => (
                <li key={s.code} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <code className="mono chip tone-deep">{s.code}</code> {s.name}
                  <span style={{ marginLeft: "auto" }}><LevelBar current={s.verified ?? s.self} label={s.verified != null ? `L${s.verified} ✓` : `L${s.self} (self)`} /></span>
                </li>
              ))}
            </ul>
          )}
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "1rem 0 0.6rem" }}>Links</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.3rem", wordBreak: "break-all" }}>
            {(["linkedinUrl", "githubUrl", "portfolioUrl"] as const).map((k) => (
              <li key={k}><span className="hint">{k === "linkedinUrl" ? "LinkedIn" : k === "githubUrl" ? "GitHub" : "Portfolio"}: </span>{profile.links[k] ? <a href={profile.links[k]!} target="_blank" rel="noopener noreferrer">{profile.links[k]}</a> : <span className="hint">—</span>}</li>
            ))}
          </ul>
        </section>
        <section className="glass card" aria-labelledby="pj-h">
          <h2 id="pj-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.6rem" }}>Projects</h2>
          {profile.projects.length === 0 ? <p className="hint">No projects yet.</p> : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
              {profile.projects.map((p) => (
                <li key={p.id}>
                  <strong>{p.title}</strong> {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="hint">link ↗</a>}
                  <p style={{ fontSize: "0.88rem", margin: "0.2rem 0" }}>{p.description}</p>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>{p.skillCodes.map((c) => <span key={c} className="chip tone-accent">{c}</span>)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
