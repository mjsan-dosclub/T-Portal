"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { GapTable } from "@/components/skills/gap-table";
import { LevelBar, Meter } from "@/components/skills/level-bar";
import { useToast } from "@/components/toast";
import type { Profile } from "@/server/profile";

type Catalog = { code: string; name: string; category: string }[];
type Project = Profile["projects"][number];

export function ProfileEditor({ profile, roles, catalog }: { profile: Profile; roles: { id: string; name: string }[]; catalog: Catalog }) {
  const router = useRouter();
  const toast = useToast();
  const refresh = () => router.refresh();
  const [roleId, setRoleId] = useState(profile.targetRole?.id ?? "");
  const nameOf = new Map(catalog.map((c) => [c.code, c.name]));

  return (
    <>
      <section className="glass card" style={{ display: "grid", gap: "0.6rem" }}>
        <div className="hint">My profile</div>
        <h1 className="page-title">Skills &amp; career plan</h1>
        <div style={{ maxWidth: "28rem" }}>
          <div className="hint" style={{ marginBottom: "0.3rem" }}>Profile complete: <strong data-testid="completeness">{profile.completeness}%</strong></div>
          <Meter value={profile.completeness} label="Profile completeness" />
        </div>
        <p className="hint">Steps: choose a target role → rate yourself on its skills → add projects as evidence → add your links. DOS Club may verify your levels.</p>
      </section>

      <section className="glass card" aria-labelledby="tr-h" style={{ display: "grid", gap: "0.8rem" }}>
        <h2 id="tr-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>1. Target role</h2>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
          <div className="field" style={{ flex: "1 1 18rem" }}>
            <label className="label" htmlFor="role">The job role you&apos;re aiming for</label>
            <select id="role" className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Choose a role…</option>
              {roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={roleId === (profile.targetRole?.id ?? "")}
            onClick={async () => {
              const r = await api("/api/student/me/target-role", { method: "PUT", body: { roleId: roleId || null } });
              toast({ message: r.ok ? "Target role saved" : r.error });
              if (r.ok) refresh();
            }}
          >
            Save role
          </button>
        </div>
        {profile.targetRole && (
          <p className="hint">
            {profile.targetRole.category} · levels L{profile.targetRole.levelMin}–L{profile.targetRole.levelMax}
            {profile.targetRole.roadmap[0] && <> · First step: {profile.targetRole.roadmap[0].whatYouDo}</>}
          </p>
        )}
      </section>

      <section className="glass-strong card" aria-labelledby="gap-h" style={{ display: "grid", gap: "0.8rem" }}>
        <h2 id="gap-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>2. You vs. the role</h2>
        <p className="hint">Rate yourself honestly. Most students start at L1–L2, and that&apos;s expected.</p>
        <GapTable key={JSON.stringify(profile.ratings)} profile={profile} mode="student" saveUrl="/api/student/me/skills" onSaved={refresh} />
      </section>

      <OtherSkills profile={profile} catalog={catalog} onSaved={refresh} />

      <Projects profile={profile} catalog={catalog} nameOf={nameOf} onSaved={refresh} />

      <Links profile={profile} onSaved={refresh} />
    </>
  );
}

function OtherSkills({ profile, catalog, onSaved }: { profile: Profile; catalog: Catalog; onSaved: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [level, setLevel] = useState(1);
  const required = new Set(profile.gap.rows.map((r) => r.code));
  const options = catalog.filter((c) => !required.has(c.code));
  return (
    <section className="glass card" aria-labelledby="os-h" style={{ display: "grid", gap: "0.8rem" }}>
      <h2 id="os-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>3. Other skills you have</h2>
      {profile.otherSkills.length ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.45rem" }}>
          {profile.otherSkills.map((s) => (
            <li key={s.code} style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <code className="mono chip tone-deep">{s.code}</code> {s.name}
              <span style={{ marginLeft: "auto" }}><LevelBar current={s.verified ?? s.self} label={s.verified != null ? `L${s.verified} ✓` : `L${s.self}`} /></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">None yet. Add skills beyond your target role, e.g. from hackathons or open-source work.</p>
      )}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
        <div className="field" style={{ flex: "2 1 16rem" }}>
          <label className="label" htmlFor="os-skill">Skill</label>
          <select id="os-skill" className="select" value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">Choose a skill…</option>
            {options.map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.code}) · {c.category}</option>))}
          </select>
        </div>
        <div className="field" style={{ flex: "0 1 8rem" }}>
          <label className="label" htmlFor="os-level">Your level</label>
          <select id="os-level" className="select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6].map((l) => (<option key={l} value={l}>L{l}</option>))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!code}
          onClick={async () => {
            const r = await api("/api/student/me/skills", { method: "PUT", body: { ratings: [{ code, level }] } });
            toast({ message: r.ok ? "Skill saved" : r.error });
            if (r.ok) {
              setCode("");
              onSaved();
            }
          }}
        >
          Add / update
        </button>
      </div>
    </section>
  );
}

function Projects({ profile, catalog, nameOf, onSaved }: { profile: Profile; catalog: Catalog; nameOf: Map<string, string>; onSaved: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState<null | { p?: Project }>(null);
  return (
    <section className="glass card" aria-labelledby="pj-h" style={{ display: "grid", gap: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h2 id="pj-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>4. Projects (evidence)</h2>
        <button type="button" className="btn btn-secondary" onClick={() => setEdit({})} disabled={profile.projects.length >= 10}>Add project</button>
      </div>
      {profile.projects.length === 0 && <p className="hint">Projects show what you can actually do. Add one with a GitHub or demo link.</p>}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }} data-testid="projects">
        {profile.projects.map((p) => (
          <li key={p.id} className="glass-strong" style={{ padding: "0.8rem 1rem", borderRadius: "var(--r-xl)" }}>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", flexWrap: "wrap" }}>
              <strong>{p.title}</strong>
              {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="hint">link ↗</a>}
              <span style={{ marginLeft: "auto", display: "flex", gap: "0.25rem" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ p })} aria-label={`Edit ${p.title}`}>Edit</button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Remove ${p.title}`}
                  onClick={async () => {
                    const r = await api(`/api/student/me/projects/${p.id}`, { method: "DELETE" });
                    toast({ message: r.ok ? "Project removed" : r.error });
                    if (r.ok) onSaved();
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
            <p style={{ fontSize: "0.9rem", margin: "0.3rem 0" }}>{p.description}</p>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              {p.skillCodes.map((c) => (<span key={c} className="chip tone-accent" title={nameOf.get(c)}>{c}</span>))}
            </div>
          </li>
        ))}
      </ul>
      {edit && <ProjectDialog project={edit.p} catalog={catalog} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onSaved(); }} />}
    </section>
  );
}

function ProjectDialog({ project, catalog, onClose, onSaved }: { project?: Project; catalog: Catalog; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ title: project?.title ?? "", description: project?.description ?? "", url: project?.url ?? "", skillCodes: project?.skillCodes ?? [] });
  const [pick, setPick] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = project ? await api(`/api/student/me/projects/${project.id}`, { method: "PUT", body: v }) : await api("/api/student/me/projects", { body: v });
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setErr(r.error);
    }
    toast({ message: project ? "Project updated" : "Project added" });
    onSaved();
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={project ? "Edit project" : "Add a project"}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.85rem" }}>
        {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
        <Field id="pj-title" label="Title" required error={errors.title}>
          <input id="pj-title" className="input" value={v.title} maxLength={120} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field id="pj-desc" label="What did you build and what was your part?" required error={errors.description}>
          <textarea id="pj-desc" className="textarea" value={v.description} maxLength={1000} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
        <Field id="pj-url" label="Link (GitHub, demo…)" error={errors.url}>
          <input id="pj-url" className="input" type="url" placeholder="https://github.com/…" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />
        </Field>
        <div className="field">
          <label className="label" htmlFor="pj-skill">Skills used (up to 10)</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select id="pj-skill" className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a skill…</option>
              {catalog.filter((c) => !v.skillCodes.includes(c.code)).map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.code})</option>))}
            </select>
            <button type="button" className="btn btn-secondary" disabled={!pick || v.skillCodes.length >= 10} onClick={() => { setV({ ...v, skillCodes: [...v.skillCodes, pick] }); setPick(""); }}>Add</button>
          </div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {v.skillCodes.map((c) => (
              <button key={c} type="button" className="chip tone-accent" onClick={() => setV({ ...v, skillCodes: v.skillCodes.filter((x) => x !== c) })} aria-label={`Remove ${c}`} style={{ cursor: "pointer" }}>
                {c} ✕
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{project ? "Save" : "Add project"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Links({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ linkedinUrl: profile.links.linkedinUrl ?? "", githubUrl: profile.links.githubUrl ?? "", portfolioUrl: profile.links.portfolioUrl ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await api("/api/student/me/links", { method: "PUT", body: v });
    if (!r.ok) return setErrors(r.fields ?? { linkedinUrl: r.error });
    setErrors({});
    toast({ message: "Links saved" });
    onSaved();
  }
  return (
    <form className="glass card" onSubmit={submit} noValidate aria-labelledby="ln-h" style={{ display: "grid", gap: "0.85rem" }}>
      <h2 id="ln-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>5. Links</h2>
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
