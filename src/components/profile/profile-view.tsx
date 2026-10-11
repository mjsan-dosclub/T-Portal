import type { ReactNode } from "react";
import { ACCOMPLISHMENT_LABEL, EDUCATION_LABEL, JOB_TYPE_LABEL, PROJECT_TYPE_LABEL, WORK_MODE_LABEL } from "@/lib/validation/profile";
import { GENDER_LABELS } from "@/lib/validation/student";
import type { Profile } from "@/server/profile";

// Read-only full profile for admins (PRF-3). Server component: no client state.

const mon = (m: string | null) => (m ? new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "");
const dt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "");

function Block({ title, pct, children }: { title: string; pct?: number; children: ReactNode }) {
  return (
    <section className="glass card" style={{ display: "grid", gap: "0.6rem" }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600 }}>
        {title} {pct !== undefined && <span className={`chip ${pct === 100 ? "tone-primary" : pct > 0 ? "tone-accent" : "tone-muted"}`}>{pct}%</span>}
      </h2>
      {children}
    </section>
  );
}
const None = () => <p className="hint">Not added yet.</p>;

export function ProfileView({ profile, roleNames, resumeHref }: { profile: Profile; roleNames: Map<string, string>; resumeHref: string }) {
  const pct = (k: string) => Math.round((profile.sections.find((s) => s.key === k)?.score ?? 0) * 100);
  const p = profile.personal;
  const pr = profile.preferences;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))", gap: "1.25rem", alignItems: "start" }} data-testid="profile-view">
      <Block title="Profile completeness">
        <div className="stat-num">{profile.completeness}%</div>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.25rem" }}>
          {profile.sections.map((s) => (
            <li key={s.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem" }}>
              <span>{s.score === 1 ? "✓" : "○"} {s.label}</span>
              <span className="mono hint">{Math.round(s.score * 100)}%</span>
            </li>
          ))}
        </ul>
      </Block>
      <Block title="Personal details & summary" pct={Math.round((pct("personal") * 5 + pct("headline") * 5 + pct("summary") * 10) / 20)}>
        <dl className="kv">
          <dt>Gender</dt><dd>{p.gender ? GENDER_LABELS[p.gender] : "—"}</dd>
          <dt>Date of birth</dt><dd>{p.dateOfBirth ?? "—"}</dd>
          <dt>Location</dt><dd>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</dd>
          <dt>Hometown</dt><dd>{p.hometown ?? "—"}</dd>
          <dt>Languages</dt><dd>{p.languages.map((l) => `${l.name} (${[l.read && "R", l.write && "W", l.speak && "S"].filter(Boolean).join("/")})`).join(", ") || "—"}</dd>
        </dl>
        {profile.about.headline && <p><strong>{profile.about.headline}</strong></p>}
        {profile.about.summary ? <p style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{profile.about.summary}</p> : <p className="hint">No summary yet.</p>}
      </Block>
      <Block title="Education" pct={pct("education")}>
        {profile.education.length === 0 ? <None /> : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
            {profile.education.map((e) => (
              <li key={e.id}><strong>{EDUCATION_LABEL[e.level as keyof typeof EDUCATION_LABEL]}</strong> · {e.institution}
                <div className="hint">{[e.course, e.specialization, e.board].filter(Boolean).join(" · ")}{e.ongoing ? " · Ongoing" : e.endYear ? ` · ${e.endYear}` : ""}{e.score != null ? ` · ${e.score}${e.gradingSystem === "PERCENTAGE" ? "%" : e.gradingSystem === "CGPA_10" ? "/10" : "/4"}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="Technical skills & tools">
        {profile.tools.length === 0 ? <None /> : (
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {profile.tools.map((t) => <span key={t.id} className="chip tone-accent">{t.name}{t.experienceMonths ? ` · ${t.experienceMonths}m` : ""}</span>)}
          </div>
        )}
      </Block>
      <Block title="Internships" pct={pct("internships")}>
        {profile.internships.length === 0 ? <None /> : profile.internships.map((i) => (
          <div key={i.id}><strong>{i.role}</strong> · {i.organisation}<div className="hint">{mon(i.startMonth)} – {i.endMonth ? mon(i.endMonth) : "Present"}{i.location ? ` · ${i.location}` : ""}{i.workMode ? ` · ${WORK_MODE_LABEL[i.workMode as keyof typeof WORK_MODE_LABEL]}` : ""}</div><p style={{ fontSize: "0.88rem" }}>{i.description}</p></div>
        ))}
      </Block>
      <Block title="Certifications" pct={pct("certifications")}>
        {profile.certifications.length === 0 ? <None /> : profile.certifications.map((c) => (
          <div key={c.id}><strong>{c.name}</strong> · {c.issuer} {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="hint">verify ↗</a>}<div className="hint">{dt(c.issueDate)}{c.noExpiry ? " · No expiry" : c.expiryDate ? ` · expires ${dt(c.expiryDate)}` : ""}{c.credentialId ? ` · ID ${c.credentialId}` : ""}</div></div>
        ))}
      </Block>
      <Block title="Projects" pct={pct("projects")}>
        {profile.projects.length === 0 ? <None /> : profile.projects.map((pj) => (
          <div key={pj.id}><strong>{pj.title}</strong> <span className="chip tone-muted">{PROJECT_TYPE_LABEL[pj.projectType as keyof typeof PROJECT_TYPE_LABEL] ?? pj.projectType}</span> {pj.url && <a href={pj.url} target="_blank" rel="noopener noreferrer" className="hint">link ↗</a>}
            <div className="hint">{[pj.role, pj.startMonth ? `${mon(pj.startMonth)} – ${pj.endMonth ? mon(pj.endMonth) : "Present"}` : null].filter(Boolean).join(" · ")}</div>
            <p style={{ fontSize: "0.88rem" }}>{pj.description}</p></div>
        ))}
      </Block>
      <Block title="Accomplishments" pct={pct("accomplishments")}>
        {profile.accomplishments.length === 0 ? <None /> : profile.accomplishments.map((a) => (
          <div key={a.id}><span className="chip tone-muted">{ACCOMPLISHMENT_LABEL[a.type as keyof typeof ACCOMPLISHMENT_LABEL]}</span> <strong>{a.title}</strong><div className="hint">{[a.issuer, dt(a.date)].filter(Boolean).join(" · ")}</div></div>
        ))}
      </Block>
      <Block title="Career preferences" pct={pct("preferences")}>
        <dl className="kv">
          <dt>Preferred roles</dt><dd>{pr.preferredRoleIds.map((id) => roleNames.get(id) ?? "Role").join(", ") || "—"}</dd>
          <dt>Locations</dt><dd>{pr.preferredLocations.join(", ") || "—"}</dd>
          <dt>Looking for</dt><dd>{pr.jobTypes.map((t) => JOB_TYPE_LABEL[t as keyof typeof JOB_TYPE_LABEL]).join(", ") || "—"}</dd>
          <dt>Work mode</dt><dd>{pr.workModes.map((t) => WORK_MODE_LABEL[t as keyof typeof WORK_MODE_LABEL]).join(", ") || "—"}</dd>
          <dt>Expected CTC</dt><dd>{pr.expectedCtcLpa != null ? `₹${pr.expectedCtcLpa} LPA` : "—"}</dd>
          <dt>Available from</dt><dd>{pr.availableFrom ?? "—"}</dd>
          <dt>Relocate</dt><dd>{pr.willingToRelocate === null ? "—" : pr.willingToRelocate ? "Yes" : "No"}</dd>
        </dl>
      </Block>
      <Block title="Resume & online profiles" pct={Math.round((pct("resume") + pct("links")) / 2)}>
        {profile.resume ? <p>📄 {profile.resume.fileName} · <a href={resumeHref}>Download (logged)</a></p> : <p className="hint">No resume uploaded.</p>}
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.25rem", wordBreak: "break-all" }}>
          {(["linkedinUrl", "githubUrl", "portfolioUrl"] as const).map((k) => (
            <li key={k}><span className="hint">{k === "linkedinUrl" ? "LinkedIn" : k === "githubUrl" ? "GitHub" : "Portfolio"}: </span>{profile.links[k] ? <a href={profile.links[k]!} target="_blank" rel="noopener noreferrer">{profile.links[k]}</a> : "—"}</li>
          ))}
        </ul>
      </Block>
    </div>
  );
}
