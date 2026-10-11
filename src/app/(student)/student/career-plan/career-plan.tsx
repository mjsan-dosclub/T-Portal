"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GapTable } from "@/components/skills/gap-table";
import { LevelBar, Meter, ReadinessChip } from "@/components/skills/level-bar";
import type { Profile } from "@/server/profile";
import { useSave } from "../profile/profile-editor";
import type { Catalog } from "../profile/list-section";

// Career plan (CP-1): target role, skill gap, other framework skills and the role roadmap. Separate from profile completeness.
export function CareerPlan({ profile, roles, catalog }: { profile: Profile; roles: { id: string; name: string }[]; catalog: Catalog }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const g = profile.gap;
  const pct = g.total ? Math.round((g.met / g.total) * 100) : 0;
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="glass card" aria-labelledby="cp-role-h" style={{ display: "grid", gap: "0.9rem" }}>
        <h2 id="cp-role-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>1 · Target role</h2>
        <TargetRole profile={profile} roles={roles} onSaved={refresh} />
        {profile.targetRole && (
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }} data-testid="cp-summary">
            <ReadinessChip readiness={g.readiness} />
            <span className="hint">{g.met} of {g.total} required skills met</span>
            <div style={{ flex: "1 1 12rem", maxWidth: "20rem" }}><Meter value={pct} label="Required skills met" /></div>
          </div>
        )}
      </section>

      <section className="glass-strong card" aria-labelledby="cp-gap-h" style={{ display: "grid", gap: "0.9rem" }}>
        <h2 id="cp-gap-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>2 · Skill gap</h2>
        <GapTable key={JSON.stringify(profile.ratings)} profile={profile} mode="student" saveUrl="/api/student/me/skills" onSaved={refresh} />
        <OtherSkills profile={profile} catalog={catalog} onSaved={refresh} />
      </section>

      {profile.targetRole && profile.targetRole.roadmap.length > 0 && (
        <section className="glass card" aria-labelledby="cp-road-h" style={{ display: "grid", gap: "0.8rem" }}>
          <h2 id="cp-road-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>3 · Roadmap for {profile.targetRole.name}</h2>
          <ol style={{ display: "grid", gap: "0.6rem", paddingLeft: "1.2rem" }} data-testid="cp-roadmap">
            {profile.targetRole.roadmap.map((r, i) => (
              <li key={i}>
                <strong>{r.levelLabel}</strong>: {r.whatYouDo}
                {r.next && <div className="hint">Next: {r.next}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function TargetRole({ profile, roles, onSaved }: { profile: Profile; roles: { id: string; name: string }[]; onSaved: () => void }) {
  const save = useSave();
  const [roleId, setRoleId] = useState(profile.targetRole?.id ?? "");
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
        <div className="field" style={{ flex: "1 1 18rem" }}>
          <label className="label" htmlFor="role">Target role (the job you&apos;re aiming for)</label>
          <select id="role" className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Choose a role…</option>
            {roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={roleId === (profile.targetRole?.id ?? "")} onClick={async () => { if ((await save("/api/student/me/target-role", { roleId: roleId || null }, "Target role saved")).ok) onSaved(); }}>
          Save role
        </button>
      </div>
      {profile.targetRole && (
        <p className="hint">{profile.targetRole.category} · levels L{profile.targetRole.levelMin}–L{profile.targetRole.levelMax}{profile.targetRole.roadmap[0] && <> · First step: {profile.targetRole.roadmap[0].whatYouDo}</>}</p>
      )}
    </div>
  );
}

function OtherSkills({ profile, catalog, onSaved }: { profile: Profile; catalog: Catalog; onSaved: () => void }) {
  const save = useSave();
  const [code, setCode] = useState("");
  const [level, setLevel] = useState(1);
  const required = new Set(profile.gap.rows.map((r) => r.code));
  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Other framework skills</h3>
      {profile.otherSkills.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.4rem" }}>
          {profile.otherSkills.map((s) => (
            <li key={s.code} style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <code className="mono chip tone-deep">{s.code}</code> {s.name}
              <span style={{ marginLeft: "auto" }}><LevelBar current={s.verified ?? s.self} label={s.verified != null ? `L${s.verified} ✓` : `L${s.self}`} /></span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
        <div className="field" style={{ flex: "2 1 16rem" }}>
          <label className="label" htmlFor="os-skill">Skill</label>
          <select id="os-skill" className="select" value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">Choose a skill…</option>
            {catalog.filter((c) => !required.has(c.code)).map((c) => (<option key={c.code} value={c.code}>{c.name} ({c.code}) · {c.category}</option>))}
          </select>
        </div>
        <div className="field" style={{ flex: "0 1 8rem" }}>
          <label className="label" htmlFor="os-level">Your level</label>
          <select id="os-level" className="select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6].map((l) => (<option key={l} value={l}>L{l}</option>))}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" disabled={!code} onClick={async () => { if ((await save("/api/student/me/skills", { ratings: [{ code, level }] }, "Skill saved")).ok) { setCode(""); onSaved(); } }}>
          Add / update
        </button>
      </div>
    </div>
  );
}
