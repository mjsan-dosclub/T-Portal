"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/states";

type RoleListItem = { id: string; name: string; track: string; levelMin: number; levelMax: number; category: { id: number; name: string }; _count: { skills: number } };
type RoleDetail = {
  id: string; name: string; track: string; levelMin: number; levelMax: number; category: { id: number; name: string };
  skills: { level: number; skill: { code: string; name: string; description: string; subcategory: { code: string; name: string } } }[];
  roadmapSteps: { sort: number; levelNum: number; levelLabel: string; whatYouDo: string; tools: string; next: string }[];
};

export function RoleExplorer({ categories }: { categories: { id: number; name: string }[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [roles, setRoles] = useState<RoleListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<RoleDetail | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ ...(q.trim() ? { q: q.trim() } : {}), ...(cat ? { category: cat } : {}) });
      const r = await api<{ roles: RoleListItem[] }>(`/api/ontology/roles?${qs}`);
      if (!r.ok) return setError(r.error);
      setError(null);
      setRoles(r.data.roles);
    }, 200);
    return () => clearTimeout(t);
  }, [q, cat]);

  useEffect(() => {
    if (!activeId) return;
    void api<RoleDetail>(`/api/ontology/roles/${activeId}`).then((r) => r.ok && setActive(r.data));
  }, [activeId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(18rem, 26rem) 1fr", gap: "1.25rem", alignItems: "start" }} className="role-grid">
      <section className="glass card" style={{ display: "grid", gap: "0.75rem", padding: "1rem" }} aria-label="Roles">
        <label htmlFor="role-search" className="sr-only">Search roles</label>
        <input id="role-search" className="input" placeholder="Search roles, e.g. agentic" value={q} onChange={(e) => setQ(e.target.value)} style={{ borderRadius: "var(--r-pill)" }} />
        <label htmlFor="role-cat" className="sr-only">Category</label>
        <select id="role-cat" className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.id}. {c.name}</option>
          ))}
        </select>
        <div className="hint" aria-live="polite" data-testid="role-count">{roles ? `${roles.length} role${roles.length === 1 ? "" : "s"}` : "Loading…"}</div>
        {error ? (
          <ErrorState message={error} />
        ) : !roles ? (
          <SkeletonRows rows={6} cols={1} />
        ) : roles.length === 0 ? (
          <p className="hint">No roles match.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.35rem", maxHeight: "62vh", overflow: "auto" }} data-testid="role-list">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  aria-pressed={activeId === r.id}
                  style={{ width: "100%", textAlign: "left", padding: "0.6rem 0.8rem", borderRadius: "var(--r-lg)", border: "1px solid var(--hairline)", background: activeId === r.id ? "var(--bg-2)" : "var(--surface)", cursor: "pointer", color: "var(--text)" }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.name}</div>
                  <div className="hint">L{r.levelMin}–L{r.levelMax} · {r._count.skills} skills · {r.category.name}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-live="polite">
        {!active ? (
          <EmptyState title="Choose a role" body="See the skills it needs at each level and its growth roadmap." />
        ) : (
          <div className="glass card" style={{ display: "grid", gap: "1.25rem" }} data-testid="role-detail">
            <header>
              <div className="hint">{active.category.id}. {active.category.name} · Track {active.track}</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{active.name}</h2>
              <div className="hint">Levels L{active.levelMin}–L{active.levelMax}</div>
            </header>
            <div>
              <h3 style={{ fontSize: "1.02rem", fontWeight: 600, marginBottom: "0.6rem" }}>Required skills</h3>
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }} data-testid="role-skills">
                {active.skills.map((s) => (
                  <li key={s.skill.code} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.75rem", alignItems: "center", padding: "0.6rem 0.75rem", background: "var(--glass-strong)", borderRadius: "var(--r-lg)" }}>
                    <code className="mono chip tone-deep">{s.skill.code}</code>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.skill.name}</div>
                      <div className="hint">{s.skill.subcategory.code} {s.skill.subcategory.name}</div>
                    </div>
                    <span className="chip tone-accent mono" data-testid="skill-level">L{s.level}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: "1.02rem", fontWeight: 600, marginBottom: "0.6rem" }}>Growth roadmap</h3>
              <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem", borderLeft: "2px solid var(--dos-accent)", marginLeft: "0.5rem" }} data-testid="roadmap">
                {active.roadmapSteps.map((st) => (
                  <li key={st.sort} style={{ paddingLeft: "1rem", position: "relative" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: "-0.45rem", top: "0.3rem", width: "0.8rem", height: "0.8rem", borderRadius: "50%", background: "var(--dos-primary)", border: "2px solid var(--surface)" }} />
                    <div className="display" style={{ fontWeight: 600 }}>{st.levelLabel}</div>
                    <p style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>{st.whatYouDo}</p>
                    <p className="hint" style={{ marginTop: "0.2rem" }}><strong>Tools:</strong> {st.tools}</p>
                    <p className="hint" style={{ marginTop: "0.2rem" }}><strong>Next:</strong> {st.next}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
