import Link from "next/link";
import { db } from "@/lib/db";
import { StatusChip } from "@/components/states";
import { requireStudentPage } from "@/server/student/session";
import { StudentNav } from "./student-nav";

export const metadata = { title: "My record" };

export default async function StudentHome() {
  const me = await requireStudentPage();
  const s = await db.student.findUniqueOrThrow({
    where: { id: me.studentId },
    include: {
      institution: { select: { name: true } }, degree: { select: { name: true } }, department: { select: { name: true } }, batch: { select: { batchCode: true } },
      status: { select: { name: true, color: true } }, colourTeam: { select: { name: true } },
      targetRole: { select: { name: true, levelMin: true, levelMax: true, isActive: true, skills: { where: { skill: { isActive: true } }, orderBy: { level: "desc" }, select: { level: true, skill: { select: { code: true, name: true } } } } } },
    },
  });
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
      <section className="glass card" aria-labelledby="role-h">
        <h2 id="role-h" style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.6rem" }}>My target role</h2>
        {s.targetRole ? (
          <>
            <p>
              <strong>{s.targetRole.name}</strong> <span className="hint">· levels L{s.targetRole.levelMin}–L{s.targetRole.levelMax}</span>
              {!s.targetRole.isActive && <span className="chip tone-muted" style={{ marginLeft: "0.5rem" }}>Retired role</span>}
            </p>
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.4rem", marginTop: "0.75rem" }}>
              {s.targetRole.skills.map((k) => (
                <li key={k.skill.code} style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <code className="mono chip tone-deep">{k.skill.code}</code> {k.skill.name} <span className="chip tone-accent mono" style={{ marginLeft: "auto" }}>L{k.level}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="hint">No target role yet. Read <Link href="/how-it-works#skills">how to choose one</Link>, then ask your coordinator to record it.</p>
        )}
      </section>
      <p className="hint" style={{ textAlign: "center" }}>
        Coming soon: build your own job-portal style profile (resume, projects, skills). See <Link href="/how-it-works#next">what&apos;s next</Link>.
      </p>
    </div>
  );
}
