import Link from "next/link";
import { db } from "@/lib/db";
import { StatusChip } from "@/components/states";
import { Meter, ReadinessChip } from "@/components/skills/level-bar";
import { studentAttendance } from "@/server/attendance";
import { getProfile } from "@/server/profile";
import { requireStudentPage } from "@/server/student/session";
import { StudentNav } from "./student-nav";

export const metadata = { title: "My record" };

export default async function StudentHome() {
  const me = await requireStudentPage();
  const s = await db.student.findUniqueOrThrow({
    where: { id: me.studentId },
    include: {
      institution: { select: { name: true } }, degree: { select: { name: true } }, department: { select: { name: true } }, batch: { select: { batchCode: true } },
      status: { select: { name: true, color: true } }, colourTeam: { select: { name: true } }
    },
  });
  const [profile, att] = await Promise.all([getProfile(me.studentId), studentAttendance(me.studentId)]);
  const dash = <span className="hint">Not set</span>;
  const rows: [string, React.ReactNode][] = [
    ["Student code", <span key="c" className="mono">{s.studentCode}</span>],
    ["Status", <StatusChip key="s" name={s.status.name} color={s.status.color} />],
    ["Email", s.email],
    ["Mobile", <span key="p" className="mono">{s.phone}</span>],
    ["Institution", s.institution.name],
    ["Degree", s.degree.name],
    ["Department", s.department.name],
    ["Year of study", s.yearOfStudy ?? dash],
    ["Graduation year", s.graduationYear],
    ["DOS Club batch", s.batch.batchCode],
    ["Colour team", s.colourTeam?.name ?? dash],
    ["LinkedIn", s.linkedinUrl ?? dash],
    ["GitHub", s.githubUrl ?? dash],
  ];
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <StudentNav name={s.fullName} />
      <section className="glass card">
        <div className="hint">Welcome</div>
        <h1 className="page-title">{s.fullName}</h1>
        <p className="hint" style={{ marginTop: "0.3rem" }}>This is the record DOS Club holds for you. It&apos;s read-only here.</p>
      </section>
      <section className="glass-strong card" aria-labelledby="rec-h" data-testid="my-record">
        <h2 id="rec-h" style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.9rem" }}>My details</h2>
        <dl className="kv">
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="banner" style={{ marginTop: "1.25rem" }}>
          Something wrong? Tell your <strong>DOS Club coordinator</strong> with your student code <span className="mono">{s.studentCode}</span>, and they&apos;ll correct it.
        </div>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "1.25rem" }}>
        <section className="glass card" aria-labelledby="role-h" style={{ display: "grid", gap: "0.6rem" }}>
          <h2 id="role-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>My career plan</h2>
          {profile.targetRole ? (
            <>
              <p><strong>{profile.targetRole.name}</strong></p>
              <ReadinessChip readiness={profile.gap.readiness} />
              <p className="hint">{profile.gap.met} of {profile.gap.total} skills at the required level</p>
            </>
          ) : (
            <p className="hint">No target role yet.</p>
          )}
          <div className="hint">Profile {profile.completeness}% complete</div>
          <Meter value={profile.completeness} label="Profile completeness" />
          <Link className="btn btn-primary" href="/student/profile">{profile.targetRole ? "Update my profile" : "Choose a target role"}</Link>
        </section>
        <section className="glass card" aria-labelledby="att-h" style={{ display: "grid", gap: "0.6rem" }}>
          <h2 id="att-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>27-Day Program</h2>
          <div className="stat-num" data-testid="my-attendance">{att.present}<span className="hint" style={{ fontSize: "1rem" }}> / {att.held} sessions attended</span></div>
          {att.pct !== null && <><Meter value={att.pct} label="Attendance" /><div className="hint">{att.pct}% attendance</div></>}
          <details>
            <summary style={{ cursor: "pointer" }} className="hint">See all {att.total} days</summary>
            <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.3rem", marginTop: "0.5rem" }}>
              {att.rows.map((r) => (
                <li key={r.n} style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem" }}>
                  <span className="chip tone-muted mono">Day {r.n}</span>
                  <span style={{ flex: 1 }}>{r.title}</span>
                  <span className={`chip ${r.status === "PRESENT" ? "tone-primary" : r.status === "EXCUSED" ? "tone-accent" : "tone-muted"}`}>
                    {r.status === "PRESENT" ? "✓ Present" : r.status === "ABSENT" ? "Absent" : r.status === "EXCUSED" ? "Excused" : r.held ? "Not marked" : "Upcoming"}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </section>
      </div>
      <p className="hint" style={{ textAlign: "center" }}>
        Your skills and projects are on <Link href="/student/profile">My profile</Link>. Coming later: resume upload and job preferences.
      </p>
    </div>
  );
}
