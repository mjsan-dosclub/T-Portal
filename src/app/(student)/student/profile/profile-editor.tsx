"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { Meter } from "@/components/skills/level-bar";
import { useToast } from "@/components/toast";
import type { SectionKey } from "@/lib/completeness";
import { GENDER_LABELS, GENDERS } from "@/lib/validation/student";
import {
  ACCOMPLISHMENT_LABEL, ACCOMPLISHMENT_TYPES, EDUCATION_LABEL, EDUCATION_LEVELS, GRADING, GRADING_LABEL, INDIAN_CITIES, INDIAN_LANGUAGES,
  JOB_TYPE_LABEL, JOB_TYPES, PROJECT_TYPE_LABEL, PROJECT_TYPES, WORK_MODE_LABEL, WORK_MODES,
} from "@/lib/validation/profile";
import type { Profile } from "@/server/profile";
import { ListSection, SectionHead, type Catalog } from "./list-section";

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((v) => ({ value: v, label: labels[v] }));
const fmtMonth = (m: unknown) => (typeof m === "string" && m ? new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "");
const range = (a: unknown, b: unknown, ongoingLabel = "Present") => `${fmtMonth(a)}${a ? " – " : ""}${b ? fmtMonth(b) : a ? ongoingLabel : ""}`;
const SECTION_ANCHOR: Record<SectionKey, string> = {
  personal: "personal", headline: "about", summary: "about", education: "education", skills: "skills", projects: "projects", internships: "internships",
  certifications: "certifications", accomplishments: "accomplishments", preferences: "preferences", resume: "resume", links: "links",
};

export function ProfileEditor({ profile, roles, catalog }: { profile: Profile; roles: { id: string; name: string }[]; catalog: Catalog }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const score = (k: SectionKey) => profile.sections.find((s) => s.key === k);
  const nameOf = new Map(catalog.map((c) => [c.code, c.name]));
  const chips = (codes: unknown) => (
    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
      {((codes as string[]) ?? []).map((c) => <span key={c} className="chip tone-accent">{nameOf.get(c) ?? c}</span>)}
    </div>
  );

  return (
    <div className="profile-layout">
      <aside className="glass card profile-aside" aria-label="Profile strength">
        <div className="hint">Profile strength</div>
        <div className="stat-num" data-testid="completeness">{profile.completeness}%</div>
        <Meter value={profile.completeness} label="Profile completeness" />
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.3rem", marginTop: "0.9rem" }} data-testid="section-scores">
          {profile.sections.map((s) => {
            const pct = Math.round(s.score * 100);
            return (
              <li key={s.key}>
                <a href={`#${SECTION_ANCHOR[s.key]}`} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", textDecoration: "none", color: "var(--text)", fontSize: "0.86rem", padding: "0.2rem 0" }}>
                  <span>{pct === 100 ? "✓" : "○"} {s.label}</span>
                  <span className="mono hint">{pct}% · {s.weight}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <p className="hint" style={{ marginTop: "0.6rem" }}>The number after each section is how much it adds to your total.</p>
      </aside>

      <div style={{ display: "grid", gap: "1.25rem", minWidth: 0 }}>
        <Personal profile={profile} onSaved={refresh} score={score("personal")} />
        <About profile={profile} onSaved={refresh} headline={score("headline")} summary={score("summary")} />

        <ListSection
          id="education" title="Education" kind="education" max={8} addLabel="Add education" onSaved={refresh} score={score("education")}
          items={profile.education as never}
          empty="Add your Class 10, Class 12 (or Diploma) and your degree, as job portals ask for all three."
          fields={[
            { name: "level", label: "Level", kind: "select", options: opts(EDUCATION_LEVELS, EDUCATION_LABEL), required: true },
            { name: "institution", label: "School / college", kind: "text", required: true },
            { name: "board", label: "Board / university", kind: "text", placeholder: "e.g. CBSE, State Board, Anna University" },
            { name: "course", label: "Course / degree", kind: "text", placeholder: "e.g. B.E." },
            { name: "specialization", label: "Specialisation", kind: "text", placeholder: "e.g. Computer Science" },
            { name: "medium", label: "Medium of instruction", kind: "text", placeholder: "e.g. English, Tamil" },
            { name: "startYear", label: "Start year", kind: "number" },
            { name: "endYear", label: "End / passing year", kind: "number" },
            { name: "gradingSystem", label: "Grading system", kind: "select", options: opts(GRADING, GRADING_LABEL), required: true },
            { name: "score", label: "Score", kind: "number", hint: "% or CGPA as per grading system" },
            { name: "ongoing", label: "Currently studying", kind: "checkbox" },
          ]}
          render={(e) => (
            <>
              <strong>{EDUCATION_LABEL[e.level as keyof typeof EDUCATION_LABEL]}</strong> · {String(e.institution)}
              <div className="hint">
                {[e.course, e.specialization, e.board].filter(Boolean).join(" · ")}
                {e.endYear || e.ongoing ? ` · ${e.ongoing ? "Ongoing" : e.endYear}` : ""}
                {e.score != null ? ` · ${e.score}${e.gradingSystem === "PERCENTAGE" ? "%" : e.gradingSystem === "CGPA_10" ? "/10" : e.gradingSystem === "CGPA_4" ? "/4" : ""}` : ""}
              </div>
            </>
          )}
        />

        <ListSection
          id="skills" title="Key skills & tools" kind="tools" max={30} addLabel="Add skill / tool" onSaved={refresh} score={score("skills")}
          items={profile.tools as never}
          empty="Add languages, frameworks and tools you've used, e.g. Python, React, Git, AWS, Figma."
          fields={[
            { name: "name", label: "Skill / tool", kind: "text", required: true, placeholder: "e.g. Python" },
            { name: "version", label: "Version (optional)", kind: "text", placeholder: "e.g. 3.12" },
            { name: "experienceMonths", label: "Experience (months)", kind: "number" },
            { name: "lastUsedYear", label: "Last used (year)", kind: "number" },
          ]}
          render={(t) => (
            <>
              <strong>{String(t.name)}</strong> {t.version ? <span className="hint">v{String(t.version)}</span> : null}
              <div className="hint">{Number(t.experienceMonths) ? `${t.experienceMonths} month(s)` : "Learning"}{t.lastUsedYear ? ` · last used ${t.lastUsedYear}` : ""}</div>
            </>
          )}
        />

        <ListSection
          id="projects" title="Projects" kind="projects" apiBase="/api/student/me" max={10} addLabel="Add project" onSaved={refresh} score={score("projects")} catalog={catalog}
          items={profile.projects as never}
          empty="Projects show what you can actually do. Add at least two, with a GitHub or demo link."
          fields={[
            { name: "title", label: "Title", kind: "text", required: true },
            { name: "projectType", label: "Type", kind: "select", options: opts(PROJECT_TYPES, PROJECT_TYPE_LABEL), required: true },
            { name: "role", label: "Your role", kind: "text", placeholder: "e.g. Backend developer, team lead" },
            { name: "url", label: "Link (GitHub, demo…)", kind: "url", placeholder: "https://github.com/…" },
            { name: "startMonth", label: "Started", kind: "month" },
            { name: "endMonth", label: "Finished (blank = ongoing)", kind: "month" },
            { name: "description", label: "What did you build and what was your part?", kind: "textarea", required: true, max: 1000 },
            { name: "skillCodes", label: "Skills used (up to 10)", kind: "skills" },
          ]}
          render={(p) => (
            <>
              <strong>{String(p.title)}</strong> <span className="chip tone-muted">{PROJECT_TYPE_LABEL[p.projectType as keyof typeof PROJECT_TYPE_LABEL] ?? "Project"}</span>{" "}
              {p.url ? <a href={String(p.url)} target="_blank" rel="noopener noreferrer" className="hint">link ↗</a> : null}
              <div className="hint">{[p.role, range(p.startMonth, p.endMonth)].filter(Boolean).join(" · ")}</div>
              <p style={{ fontSize: "0.9rem", margin: "0.3rem 0 0" }}>{String(p.description)}</p>
              {chips(p.skillCodes)}
            </>
          )}
        />

        <ListSection
          id="internships" title="Internships" kind="internships" max={10} addLabel="Add internship" onSaved={refresh} score={score("internships")} catalog={catalog}
          items={profile.internships as never}
          empty="Add any internship, including short virtual or college-arranged ones."
          fields={[
            { name: "organisation", label: "Organisation", kind: "text", required: true },
            { name: "role", label: "Role / title", kind: "text", required: true },
            { name: "location", label: "Location", kind: "text", list: INDIAN_CITIES },
            { name: "workMode", label: "Work mode", kind: "select", options: opts(WORK_MODES, WORK_MODE_LABEL) },
            { name: "startMonth", label: "Started", kind: "month", required: true },
            { name: "endMonth", label: "Ended (blank = ongoing)", kind: "month" },
            { name: "stipendMonthly", label: "Stipend per month (₹, optional)", kind: "number" },
            { name: "description", label: "What did you do?", kind: "textarea", required: true, max: 1500 },
            { name: "skillCodes", label: "Skills used", kind: "skills" },
          ]}
          render={(i) => (
            <>
              <strong>{String(i.role)}</strong> · {String(i.organisation)}
              <div className="hint">{[range(i.startMonth, i.endMonth), i.location, i.workMode ? WORK_MODE_LABEL[i.workMode as keyof typeof WORK_MODE_LABEL] : null].filter(Boolean).join(" · ")}</div>
              <p style={{ fontSize: "0.9rem", margin: "0.3rem 0 0" }}>{String(i.description)}</p>
              {chips(i.skillCodes)}
            </>
          )}
        />

        <ListSection
          id="certifications" title="Certifications" kind="certifications" max={20} addLabel="Add certification" onSaved={refresh} score={score("certifications")} catalog={catalog}
          items={profile.certifications as never}
          empty="Add courses and certifications (e.g. NPTEL, AWS, Google, Coursera, Microsoft), ideally with a credential link."
          fields={[
            { name: "name", label: "Certification name", kind: "text", required: true },
            { name: "issuer", label: "Issued by", kind: "text", required: true, placeholder: "e.g. NPTEL, AWS, Google" },
            { name: "issueDate", label: "Issue date", kind: "date" },
            { name: "expiryDate", label: "Expiry date", kind: "date" },
            { name: "noExpiry", label: "This credential does not expire", kind: "checkbox" },
            { name: "credentialId", label: "Credential ID", kind: "text" },
            { name: "url", label: "Credential link", kind: "url", placeholder: "https://…" },
            { name: "skillCodes", label: "Related skills", kind: "skills" },
          ]}
          render={(c) => (
            <>
              <strong>{String(c.name)}</strong> · {String(c.issuer)} {c.url ? <a href={String(c.url)} target="_blank" rel="noopener noreferrer" className="hint">verify ↗</a> : null}
              <div className="hint">
                {c.issueDate ? `Issued ${new Date(String(c.issueDate)).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                {c.noExpiry ? " · No expiry" : c.expiryDate ? ` · Expires ${new Date(String(c.expiryDate)).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                {c.credentialId ? ` · ID ${c.credentialId}` : ""}
              </div>
              {chips(c.skillCodes)}
            </>
          )}
        />

        <ListSection
          id="accomplishments" title="Accomplishments" kind="accomplishments" max={20} addLabel="Add accomplishment" onSaved={refresh} score={score("accomplishments")}
          items={profile.accomplishments as never}
          empty="Awards, hackathons, papers, open-source contributions, club or volunteer leadership all count."
          fields={[
            { name: "type", label: "Type", kind: "select", options: opts(ACCOMPLISHMENT_TYPES, ACCOMPLISHMENT_LABEL), required: true },
            { name: "title", label: "Title", kind: "text", required: true, placeholder: "e.g. Winner, Smart India Hackathon 2026" },
            { name: "issuer", label: "Organiser / publisher", kind: "text" },
            { name: "date", label: "Date", kind: "date" },
            { name: "url", label: "Link", kind: "url" },
            { name: "description", label: "Details", kind: "textarea", max: 1000 },
          ]}
          render={(a) => (
            <>
              <span className="chip tone-muted">{ACCOMPLISHMENT_LABEL[a.type as keyof typeof ACCOMPLISHMENT_LABEL]}</span> <strong>{String(a.title)}</strong>{" "}
              {a.url ? <a href={String(a.url)} target="_blank" rel="noopener noreferrer" className="hint">link ↗</a> : null}
              <div className="hint">{[a.issuer, a.date ? new Date(String(a.date)).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : null].filter(Boolean).join(" · ")}</div>
              {a.description ? <p style={{ fontSize: "0.9rem", margin: "0.3rem 0 0" }}>{String(a.description)}</p> : null}
            </>
          )}
        />

        <Preferences profile={profile} roles={roles} onSaved={refresh} score={score("preferences")} />
        <Resume profile={profile} onSaved={refresh} score={score("resume")} />
        <Links profile={profile} onSaved={refresh} score={score("links")} />
      </div>
    </div>
  );
}

type S = ReturnType<Profile["sections"]["find"]>;

export function useSave() {
  const toast = useToast();
  return async (url: string, body: unknown, ok: string) => {
    const r = await api(url, { method: "PUT", body });
    toast({ message: r.ok ? ok : r.error });
    return r;
  };
}

function Personal({ profile, onSaved, score }: { profile: Profile; onSaved: () => void; score: S }) {
  const save = useSave();
  const p = profile.personal;
  const [v, setV] = useState({ gender: p.gender ?? "", dateOfBirth: p.dateOfBirth ?? "", city: p.city ?? "", state: p.state ?? "", hometown: p.hometown ?? "" });
  const [langs, setLangs] = useState(p.languages.length ? p.languages : [{ name: "English", read: true, write: true, speak: true }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const st = profile.student;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await save("/api/student/me/personal", { ...v, gender: v.gender || null, languages: langs.filter((l) => l.name.trim()) }, "Personal details saved");
    if (r.ok) onSaved();
    else setErrors(r.fields ?? {});
  }
  return (
    <form id="personal" className="glass card" onSubmit={submit} noValidate aria-labelledby="personal-h" style={{ display: "grid", gap: "0.9rem", scrollMarginTop: "1rem" }}>
      <SectionHead id="personal" title="Personal details" score={score} />
      <dl className="kv" style={{ background: "var(--bg-soft)", padding: "0.8rem 1rem", borderRadius: "var(--r-xl)" }}>
        {([["Name", st.fullName], ["Email", st.email], ["Mobile", st.phone], ["College", st.institution], ["Degree", `${st.degree} · ${st.department}`], ["Graduating", st.graduationYear], ["DOS Club batch", st.batch]] as [string, unknown][]).map(([k, val]) => (
          <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{String(val)}</dd></div>
        ))}
      </dl>
      <p className="hint">These come from DOS Club&apos;s records. Ask your coordinator to correct them.</p>
      <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))" }}>
        <Field id="p-gender" label="Gender" error={errors.gender}>
          <select id="p-gender" className="select" value={v.gender} onChange={(e) => setV({ ...v, gender: e.target.value })}>
            <option value="">Not specified</option>
            {GENDERS.map((g) => (<option key={g} value={g}>{GENDER_LABELS[g]}</option>))}
          </select>
        </Field>
        <Field id="p-dob" label="Date of birth" error={errors.dateOfBirth}>
          <input id="p-dob" type="date" className="input" value={v.dateOfBirth} onChange={(e) => setV({ ...v, dateOfBirth: e.target.value })} />
        </Field>
        <Field id="p-city" label="Current city" error={errors.city}>
          <input id="p-city" className="input" list="p-city-list" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
          <datalist id="p-city-list">{INDIAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field id="p-state" label="State" error={errors.state}>
          <input id="p-state" className="input" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} />
        </Field>
        <Field id="p-home" label="Hometown" error={errors.hometown}>
          <input id="p-home" className="input" value={v.hometown} onChange={(e) => setV({ ...v, hometown: e.target.value })} />
        </Field>
      </div>
      <fieldset style={{ border: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
        <legend className="label">Languages you know</legend>
        {langs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <label className="sr-only" htmlFor={`lang-${i}`}>Language {i + 1}</label>
            <input id={`lang-${i}`} className="input" style={{ maxWidth: "12rem" }} list="lang-list" value={l.name} onChange={(e) => setLangs(langs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            {(["read", "write", "speak"] as const).map((k) => (
              <label key={k} style={{ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "0.88rem" }}>
                <input type="checkbox" className="checkbox" checked={l[k]} onChange={(e) => setLangs(langs.map((x, j) => (j === i ? { ...x, [k]: e.target.checked } : x)))} /> {k[0]!.toUpperCase() + k.slice(1)}
              </label>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLangs(langs.filter((_, j) => j !== i))} aria-label={`Remove language ${l.name || i + 1}`}>Remove</button>
          </div>
        ))}
        <datalist id="lang-list">{INDIAN_LANGUAGES.map((x) => <option key={x} value={x} />)}</datalist>
        <div><button type="button" className="btn btn-secondary btn-sm" disabled={langs.length >= 10} onClick={() => setLangs([...langs, { name: "", read: true, write: false, speak: true }])}>Add language</button></div>
      </fieldset>
      <div><button type="submit" className="btn btn-primary">Save personal details</button></div>
    </form>
  );
}

function About({ profile, onSaved, headline, summary }: { profile: Profile; onSaved: () => void; headline: S; summary: S }) {
  const save = useSave();
  const [v, setV] = useState({ headline: profile.about.headline ?? "", summary: profile.about.summary ?? "" });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if ((await save("/api/student/me/about", v, "Saved")).ok) onSaved();
  }
  return (
    <form id="about" className="glass card" onSubmit={submit} noValidate aria-labelledby="about-h" style={{ display: "grid", gap: "0.9rem", scrollMarginTop: "1rem" }}>
      <SectionHead id="about" title="Headline & summary" score={headline && summary ? { ...headline, score: (headline.score * headline.weight + summary.score * summary.weight) / (headline.weight + summary.weight), missing: [...headline.missing, ...summary.missing] } : undefined} />
      <Field id="a-head" label="Resume headline" hint={`${v.headline.length}/250 · e.g. "Final-year CSE student skilled in Python, cloud and DevOps"`}>
        <input id="a-head" className="input" maxLength={250} value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} />
      </Field>
      <Field id="a-sum" label="Profile summary" hint={`${v.summary.length}/2000 · Who you are, what you're good at, what you're looking for. 150+ characters`}>
        <textarea id="a-sum" className="textarea" style={{ minHeight: "8rem" }} maxLength={2000} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
      </Field>
      <div><button type="submit" className="btn btn-primary">Save headline & summary</button></div>
    </form>
  );
}

function Preferences({ profile, roles, onSaved, score }: { profile: Profile; roles: { id: string; name: string }[]; onSaved: () => void; score: S }) {
  const save = useSave();
  const p = profile.preferences;
  const [v, setV] = useState({ ...p, expectedCtcLpa: p.expectedCtcLpa ?? "", availableFrom: p.availableFrom ?? "" });
  const [pickRole, setPickRole] = useState("");
  const [loc, setLoc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const toggle = <T extends string>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await save("/api/student/me/preferences", { ...v, expectedCtcLpa: v.expectedCtcLpa === "" ? null : v.expectedCtcLpa, availableFrom: v.availableFrom || null }, "Preferences saved");
    if (r.ok) onSaved();
    else setErrors(r.fields ?? {});
  }
  return (
    <form id="preferences" className="glass card" onSubmit={submit} noValidate aria-labelledby="preferences-h" style={{ display: "grid", gap: "0.9rem", scrollMarginTop: "1rem" }}>
      <SectionHead id="preferences" title="Career preferences" score={score} />
      <div className="field">
        <label className="label" htmlFor="pr-role">Preferred roles (up to 3)</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select id="pr-role" className="select" value={pickRole} onChange={(e) => setPickRole(e.target.value)}>
            <option value="">Choose a role…</option>
            {roles.filter((r) => !v.preferredRoleIds.includes(r.id)).map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
          <button type="button" className="btn btn-secondary" disabled={!pickRole || v.preferredRoleIds.length >= 3} onClick={() => { setV({ ...v, preferredRoleIds: [...v.preferredRoleIds, pickRole] }); setPickRole(""); }}>Add</button>
        </div>
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {v.preferredRoleIds.map((id) => (<button key={id} type="button" className="chip tone-accent" style={{ cursor: "pointer" }} aria-label={`Remove ${roleName.get(id)}`} onClick={() => setV({ ...v, preferredRoleIds: v.preferredRoleIds.filter((x) => x !== id) })}>{roleName.get(id) ?? "Role"} ✕</button>))}
        </div>
        {errors.preferredRoleIds && <span className="field-error" role="alert">{errors.preferredRoleIds}</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="pr-loc">Preferred locations (up to 5)</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input id="pr-loc" className="input" list="pr-loc-list" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Chennai" />
          <datalist id="pr-loc-list">{INDIAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          <button type="button" className="btn btn-secondary" disabled={loc.trim().length < 2 || v.preferredLocations.length >= 5} onClick={() => { setV({ ...v, preferredLocations: [...new Set([...v.preferredLocations, loc.trim()])] }); setLoc(""); }}>Add</button>
        </div>
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {v.preferredLocations.map((l) => (<button key={l} type="button" className="chip tone-accent" style={{ cursor: "pointer" }} aria-label={`Remove ${l}`} onClick={() => setV({ ...v, preferredLocations: v.preferredLocations.filter((x) => x !== l) })}>{l} ✕</button>))}
        </div>
      </div>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="label">Looking for</legend>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
          {JOB_TYPES.map((t) => (<label key={t} style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}><input type="checkbox" className="checkbox" checked={v.jobTypes.includes(t)} onChange={() => setV({ ...v, jobTypes: toggle(v.jobTypes as (typeof JOB_TYPES)[number][], t) })} /> {JOB_TYPE_LABEL[t]}</label>))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="label">Work mode</legend>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
          {WORK_MODES.map((t) => (<label key={t} style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}><input type="checkbox" className="checkbox" checked={v.workModes.includes(t)} onChange={() => setV({ ...v, workModes: toggle(v.workModes as (typeof WORK_MODES)[number][], t) })} /> {WORK_MODE_LABEL[t]}</label>))}
        </div>
      </fieldset>
      <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))" }}>
        <Field id="pr-ctc" label="Expected CTC (LPA)" error={errors.expectedCtcLpa} hint="Lakhs per annum, e.g. 4.5">
          <input id="pr-ctc" className="input" type="number" step="0.1" min={0} value={v.expectedCtcLpa} onChange={(e) => setV({ ...v, expectedCtcLpa: e.target.value })} />
        </Field>
        <Field id="pr-from" label="Available to join from" error={errors.availableFrom}>
          <input id="pr-from" className="input" type="date" value={v.availableFrom} onChange={(e) => setV({ ...v, availableFrom: e.target.value })} />
        </Field>
        <Field id="pr-rel" label="Willing to relocate?">
          <select id="pr-rel" className="select" value={v.willingToRelocate === null ? "" : v.willingToRelocate ? "yes" : "no"} onChange={(e) => setV({ ...v, willingToRelocate: e.target.value === "" ? null : e.target.value === "yes" })}>
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      <div><button type="submit" className="btn btn-primary">Save preferences</button></div>
    </form>
  );
}

function Resume({ profile, onSaved, score }: { profile: Profile; onSaved: () => void; score: S }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const r = profile.resume;
  return (
    <section id="resume" className="glass card" aria-labelledby="resume-h" style={{ display: "grid", gap: "0.8rem", scrollMarginTop: "1rem" }}>
      <SectionHead id="resume" title="Resume" score={score} />
      {r ? (
        <p data-testid="resume-file">
          📄 <strong>{r.fileName}</strong> <span className="hint">· {(r.sizeBytes / 1024).toFixed(0)} KB · uploaded {new Date(r.uploadedAt).toLocaleDateString("en-IN")}</span>{" "}
          <a href="/api/student/me/resume">Download</a>
        </p>
      ) : (
        <p className="hint">Upload a one- or two-page PDF resume (max 2 MB).</p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <label className="btn btn-secondary" htmlFor="resume-file">{r ? "Replace PDF" : "Upload PDF"}</label>
        <input
          id="resume-file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={busy}
          data-testid="resume-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            const form = new FormData();
            form.set("file", f);
            const res = await api("/api/student/me/resume", { form });
            setBusy(false);
            e.target.value = "";
            toast({ message: res.ok ? "Resume uploaded" : res.error });
            if (res.ok) onSaved();
          }}
        />
        {r && (
          <button type="button" className="btn btn-ghost" onClick={async () => { const res = await api("/api/student/me/resume", { method: "DELETE" }); toast({ message: res.ok ? "Resume removed" : res.error }); if (res.ok) onSaved(); }}>
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

function Links({ profile, onSaved, score }: { profile: Profile; onSaved: () => void; score: S }) {
  const save = useSave();
  const [v, setV] = useState({ linkedinUrl: profile.links.linkedinUrl ?? "", githubUrl: profile.links.githubUrl ?? "", portfolioUrl: profile.links.portfolioUrl ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await save("/api/student/me/links", v, "Links saved");
    if (r.ok) {
      setErrors({});
      onSaved();
    } else setErrors(r.fields ?? {});
  }
  return (
    <form id="links" className="glass card" onSubmit={submit} noValidate aria-labelledby="links-h" style={{ display: "grid", gap: "0.85rem", scrollMarginTop: "1rem" }}>
      <SectionHead id="links" title="Online profiles" score={score} />
      <Field id="ln-li" label="LinkedIn" error={errors.linkedinUrl}>
        <input id="ln-li" className="input" type="url" placeholder="https://www.linkedin.com/in/…" value={v.linkedinUrl} onChange={(e) => setV({ ...v, linkedinUrl: e.target.value })} />
      </Field>
      <Field id="ln-gh" label="GitHub" error={errors.githubUrl}>
        <input id="ln-gh" className="input" type="url" placeholder="https://github.com/…" value={v.githubUrl} onChange={(e) => setV({ ...v, githubUrl: e.target.value })} />
      </Field>
      <Field id="ln-pf" label="Portfolio / personal site" error={errors.portfolioUrl}>
        <input id="ln-pf" className="input" type="url" placeholder="https://…" value={v.portfolioUrl} onChange={(e) => setV({ ...v, portfolioUrl: e.target.value })} />
      </Field>
      <div><button type="submit" className="btn btn-primary">Save links</button></div>
    </form>
  );
}
