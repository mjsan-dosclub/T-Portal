"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/select";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { EmptyState } from "@/components/states";
import { useToast } from "@/components/toast";
import type { ManageData } from "@/server/ontology/admin";

type Skill = ManageData["skills"][number];
type Role = ManageData["roles"][number];
type Tab = "skills" | "roles" | "subcategories" | "changes";
const TRACKS = ["IC", "Mgmt", "Exec"] as const;
const LEVELS = [1, 2, 3, 4, 5, 6];

export function OntologyManager({ data }: { data: ManageData }) {
  const [tab, setTab] = useState<Tab>("skills");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1rem" }}>
      <div className="banner" role="note" style={{ display: "block", lineHeight: 1.55 }}>
        ℹ Keep the framework current: <strong>add</strong> new skills as the job market changes, <strong>retire</strong> outdated ones (they disappear from explorers but stay in history), and update each role&apos;s required skills. Every change is logged.
      </div>
      <div className="tabs" role="tablist" aria-label="Manage ontology">
        {(
          [
            ["skills", `Skills (${data.skills.filter((s) => s.isActive).length})`],
            ["roles", `Roles (${data.roles.filter((r) => r.isActive).length})`],
            ["subcategories", "Subcategories"],
            ["changes", "Change log"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ background: "none", cursor: "pointer" }}>
            {l}
          </button>
        ))}
      </div>
      {tab === "skills" && <SkillsPanel data={data} />}
      {tab === "roles" && <RolesPanel data={data} />}
      {tab === "subcategories" && <SubcategoriesPanel data={data} />}
      {tab === "changes" && <ChangeLog data={data} />}
    </div>
  );
}

function useAfter() {
  const router = useRouter();
  const toast = useToast();
  return (message: string) => {
    toast({ message });
    router.refresh();
  };
}

function StatusChip({ active, retiredAt }: { active: boolean; retiredAt: string | null }) {
  return active ? (
    <span className="chip chip-dot tone-primary">Active</span>
  ) : (
    <span className="chip tone-muted" title={retiredAt ? `Retired ${new Date(retiredAt).toLocaleDateString("en-IN")}` : undefined}>
      Retired
    </span>
  );
}

// ── Skills ───────────────────────────────────────────────────────────────

function SkillsPanel({ data }: { data: ManageData }) {
  const after = useAfter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "retired" | "all">("active");
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<null | { skill?: Skill }>(null);
  const [retire, setRetire] = useState<Skill | null>(null);
  const [del, setDel] = useState<Skill | null>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.skills.filter(
      (s) =>
        (status === "all" || (status === "active") === s.isActive) &&
        (!cat || String(s.subcategory.categoryId) === cat) &&
        (!t || s.code.toLowerCase().includes(t) || s.name.toLowerCase().includes(t) || s.description.toLowerCase().includes(t)),
    );
  }, [data.skills, q, status, cat]);

  return (
    <section className="glass-strong" style={{ padding: "0.75rem", display: "grid", gap: "0.75rem" }} aria-label="Skills">
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="sk-q" className="sr-only">Search skills</label>
        <input id="sk-q" className="input" style={{ flex: "1 1 16rem", borderRadius: "var(--r-pill)" }} placeholder="Search code, name or description" value={q} onChange={(e) => setQ(e.target.value)} />
        <label htmlFor="sk-cat" className="sr-only">Category</label>
        <select id="sk-cat" className="select" style={{ width: "auto" }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}. {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="sk-status" className="sr-only">Status</label>
        <select id="sk-status" className="select" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="active">Active</option>
          <option value="retired">Retired</option>
          <option value="all">All</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({})}>
          Add skill
        </button>
      </div>
      <div className="hint" aria-live="polite">{rows.length} skill(s)</div>
      {rows.length === 0 ? (
        <EmptyState title="No skills match" />
      ) : (
        <div className="table-wrap" style={{ maxHeight: "62vh" }}>
          <table className="dtable" data-testid="manage-skills">
            <thead>
              <tr>
                <th>Code</th>
                <th>Skill</th>
                <th>Subcategory</th>
                <th>Used by</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.code} data-testid="manage-skill-row">
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{s.code}</td>
                  <td style={{ minWidth: "16rem" }}>
                    <strong>{s.name}</strong>
                    <div className="hint">{s.description}</div>
                    {!s.isActive && s.retiredReason && <div className="hint">Retired: {s.retiredReason}</div>}
                  </td>
                  <td className="hint" style={{ minWidth: "10rem" }}>{s.subcategory.code} {s.subcategory.name}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{s.usedBy} role(s)</td>
                  <td>
                    <StatusChip active={s.isActive} retiredAt={s.retiredAt} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ skill: s })} aria-label={`Edit ${s.code}`}>
                      Edit
                    </button>
                    {s.isActive ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetire(s)} aria-label={`Retire ${s.code}`}>
                        Retire
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Restore ${s.code}`}
                        onClick={async () => {
                          const r = await api(`/api/ontology/skills/${s.code}/restore`, { body: {} });
                          after(r.ok ? `${s.code} restored` : r.error);
                        }}
                      >
                        Restore
                      </button>
                    )}
                    {s.deletable && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDel(s)} aria-label={`Delete ${s.code}`}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <SkillDialog data={data} skill={edit.skill} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); after(m); }} />}
      {retire && <RetireDialog kind="skill" label={`${retire.code} · ${retire.name}`} url={`/api/ontology/skills/${retire.code}/retire`} onClose={() => setRetire(null)} onDone={(m) => { setRetire(null); after(m); }} />}
      {del && (
        <Modal open onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del.code}?`} description="This skill was added in the portal and no role uses it, so it can be deleted permanently. Framework skills can only be retired.">
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setDel(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                const r = await api(`/api/ontology/skills/${del.code}`, { method: "DELETE" });
                setDel(null);
                after(r.ok ? `${del.code} deleted` : r.error);
              }}
            >
              Delete permanently
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function SkillDialog({ data, skill, onClose, onDone }: { data: ManageData; skill?: Skill; onClose: () => void; onDone: (msg: string) => void }) {
  const [v, setV] = useState({
    code: skill?.code ?? "",
    name: skill?.name ?? "",
    description: skill?.description ?? "",
    categoryId: String(skill?.subcategory.categoryId ?? ""),
    subcategoryId: String(skill?.subcategory.id ?? ""),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const subs = data.categories.find((c) => String(c.id) === v.categoryId)?.subcategories ?? [];
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { name: v.name, description: v.description, subcategoryId: v.subcategoryId };
    const r = skill ? await api(`/api/ontology/skills/${skill.code}`, { method: "PUT", body }) : await api("/api/ontology/skills", { body: { ...body, code: v.code } });
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setErr(r.error);
    }
    onDone(skill ? `${skill.code} updated` : `${v.code.toUpperCase()} added`);
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={skill ? `Edit ${skill.code}` : "Add a new skill"} description={skill ? "The code can't be changed." : "Use a short unique code (3–6 letters/digits). Codes are permanent and can't be reused."}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.9rem" }}>
        {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
        {!skill && (
          <Field id="sk-code" label="Skill code" required error={errors.code} hint="e.g. PRMT">
            <input id="sk-code" className="input mono" value={v.code} maxLength={6} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} />
          </Field>
        )}
        <Field id="sk-name" label="Skill name" required error={errors.name}>
          <input id="sk-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field id="sk-desc" label="Description" required error={errors.description} hint="One or two sentences on what the skill means in practice">
          <textarea id="sk-desc" className="textarea" value={v.description} maxLength={600} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
        <Field id="sk-cat2" label="Category" required>
          <select id="sk-cat2" className="select" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value, subcategoryId: "" })}>
            <option value="">Choose…</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.id}. {c.name}</option>
            ))}
          </select>
        </Field>
        <Field id="sk-sub" label="Subcategory" required error={errors.subcategoryId} hint="Need a new one? Add it on the Subcategories tab first.">
          <Select id="sk-sub" growing value={String(v.subcategoryId)} onChange={(x) => setV({ ...v, subcategoryId: x })} disabled={!v.categoryId} placeholder="Choose…" options={subs.map((s) => ({ value: String(s.id), label: `${s.code} ${s.name}` }))} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{skill ? "Save" : "Add skill"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RetireDialog({ kind, label, url, onClose, onDone }: { kind: "skill" | "role"; label: string; url: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [blocking, setBlocking] = useState<{ id: string; name: string }[] | null>(null);
  const [removeFromRoles, setRemove] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    const r = await api<{ removedFromRoles?: number; linkedStudents?: number }>(url, { body: { reason, removeFromRoles } });
    if (!r.ok) {
      const roles = (r.data as { roles?: { id: string; name: string }[] }).roles;
      if (r.status === 409 && roles) setBlocking(roles);
      return setErr(r.error);
    }
    const extra = r.data.removedFromRoles ? ` and removed from ${r.data.removedFromRoles} role(s)` : r.data.linkedStudents ? ` (${r.data.linkedStudents} student(s) keep it as their target role)` : "";
    onDone(`${label.split(" · ")[0]} retired${extra}`);
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Retire ${kind}: ${label}`} description={kind === "skill" ? "Retired skills disappear from the explorers and role pickers but stay in history. You can restore them later." : "Retired roles disappear from the Role Explorer and the student target-role picker. Students who already have it keep it."}>
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <Field id="retire-reason" label="Why is it being retired?" required hint="e.g. Replaced by AGNT (agentic AI engineering)">
          <input id="retire-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {blocking && (
          <div className="banner" style={{ display: "block" }} data-testid="retire-blocking">
            <strong>{blocking.length} active role(s) still require this skill:</strong>
            <ul style={{ margin: "0.4rem 0 0.6rem 1.1rem" }}>
              {blocking.slice(0, 12).map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
              {blocking.length > 12 && <li>…and {blocking.length - 12} more</li>}
            </ul>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" className="checkbox" checked={removeFromRoles} onChange={(e) => setRemove(e.target.checked)} /> Also remove it from these roles
            </label>
          </div>
        )}
        {err && !blocking && <div className="field-error" role="alert">{err}</div>}
        {err && blocking && removeFromRoles && err.includes("no other skills") && <div className="field-error" role="alert">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={reason.trim().length < 3 || (!!blocking && !removeFromRoles)} onClick={submit}>
            Retire
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Roles ────────────────────────────────────────────────────────────────

function RolesPanel({ data }: { data: ManageData }) {
  const after = useAfter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "retired" | "all">("active");
  const [edit, setEdit] = useState<null | { role?: Role }>(null);
  const [skillsFor, setSkillsFor] = useState<Role | null>(null);
  const [retire, setRetire] = useState<Role | null>(null);
  const catName = new Map(data.categories.map((c) => [c.id, c.name]));
  const rows = data.roles.filter((r) => (status === "all" || (status === "active") === r.isActive) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <section className="glass-strong" style={{ padding: "0.75rem", display: "grid", gap: "0.75rem" }} aria-label="Roles">
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="ro-q" className="sr-only">Search roles</label>
        <input id="ro-q" className="input" style={{ flex: "1 1 16rem", borderRadius: "var(--r-pill)" }} placeholder="Search roles" value={q} onChange={(e) => setQ(e.target.value)} />
        <label htmlFor="ro-status" className="sr-only">Status</label>
        <select id="ro-status" className="select" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="active">Active</option>
          <option value="retired">Retired</option>
          <option value="all">All</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({})}>Add role</button>
      </div>
      <div className="table-wrap" style={{ maxHeight: "62vh" }}>
        <table className="dtable" data-testid="manage-roles">
          <thead>
            <tr><th>Role</th><th>Category</th><th>Track</th><th>Levels</th><th>Skills</th><th>Students</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600, minWidth: "12rem" }}>{r.name}</td>
                <td className="hint">{catName.get(r.categoryId)}</td>
                <td>{r.track}</td>
                <td className="mono">L{r.levelMin}–L{r.levelMax}</td>
                <td className="mono" title={r.skills.map((s) => `${s.skillCode}@L${s.level}`).join(", ")}>{r.skills.length}</td>
                <td className="mono">{r.students}</td>
                <td><StatusChip active={r.isActive} retiredAt={r.retiredAt} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ role: r })} aria-label={`Edit ${r.name}`}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkillsFor(r)} aria-label={`Edit skills for ${r.name}`}>Skills</button>
                  {r.isActive ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetire(r)} aria-label={`Retire ${r.name}`}>Retire</button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Restore ${r.name}`} onClick={async () => { const x = await api(`/api/ontology/roles/${r.id}/restore`, { body: {} }); after(x.ok ? `${r.name} restored` : x.error); }}>Restore</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <RoleDialog data={data} role={edit.role} onClose={() => setEdit(null)} onDone={(m, created) => { setEdit(null); after(m); if (created) setSkillsFor({ ...created }); }} />}
      {skillsFor && <RoleSkillsDialog data={data} role={skillsFor} onClose={() => setSkillsFor(null)} onDone={(m) => { setSkillsFor(null); after(m); }} />}
      {retire && <RetireDialog kind="role" label={retire.name} url={`/api/ontology/roles/${retire.id}/retire`} onClose={() => setRetire(null)} onDone={(m) => { setRetire(null); after(m); }} />}
    </section>
  );
}

function RoleDialog({ data, role, onClose, onDone }: { data: ManageData; role?: Role; onClose: () => void; onDone: (msg: string, created?: Role) => void }) {
  const [v, setV] = useState({ name: role?.name ?? "", categoryId: String(role?.categoryId ?? ""), track: role?.track ?? "IC", levelMin: String(role?.levelMin ?? 1), levelMax: String(role?.levelMax ?? 2) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = role ? await api(`/api/ontology/roles/${role.id}`, { method: "PUT", body: v }) : await api<{ id: string }>("/api/ontology/roles", { body: v });
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setErr(r.error);
    }
    if (role) onDone(`${v.name} updated`);
    else {
      const id = (r.data as { id: string }).id;
      onDone(`${v.name} added. Now choose its required skills.`, { id, name: v.name, track: v.track, levelMin: Number(v.levelMin), levelMax: Number(v.levelMax), isActive: true, retiredAt: null, retiredReason: null, categoryId: Number(v.categoryId), skills: [], students: 0, _count: { students: 0 } });
    }
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={role ? `Edit ${role.name}` : "Add a role"}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.9rem" }}>
        {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
        <Field id="ro-name" label="Role name" required error={errors.name}>
          <input id="ro-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field id="ro-cat" label="Category" required error={errors.categoryId}>
          <select id="ro-cat" className="select" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
            <option value="">Choose…</option>
            {data.categories.map((c) => (<option key={c.id} value={c.id}>{c.id}. {c.name}</option>))}
          </select>
        </Field>
        <Field id="ro-track" label="Track" required hint="IC = individual contributor · Mgmt = manager · Exec = executive">
          <select id="ro-track" className="select" value={v.track} onChange={(e) => setV({ ...v, track: e.target.value })}>
            {TRACKS.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Field id="ro-min" label="Lowest level" required>
            <select id="ro-min" className="select" value={v.levelMin} onChange={(e) => setV({ ...v, levelMin: e.target.value })}>{LEVELS.map((l) => (<option key={l} value={l}>L{l}</option>))}</select>
          </Field>
          <Field id="ro-max" label="Highest level" required error={errors.levelMax}>
            <select id="ro-max" className="select" value={v.levelMax} onChange={(e) => setV({ ...v, levelMax: e.target.value })}>{LEVELS.map((l) => (<option key={l} value={l}>L{l}</option>))}</select>
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{role ? "Save" : "Add role"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RoleSkillsDialog({ data, role, onClose, onDone }: { data: ManageData; role: Role; onClose: () => void; onDone: (msg: string) => void }) {
  const active = data.skills.filter((s) => s.isActive);
  const nameOf = new Map(data.skills.map((s) => [s.code, s.name]));
  const [rows, setRows] = useState(role.skills.map((s) => ({ code: s.skillCode, level: s.level })));
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const available = active.filter((s) => !rows.some((r) => r.code === s.code));
  async function save() {
    const r = await api(`/api/ontology/roles/${role.id}/skills`, { method: "PUT", body: { skills: rows } });
    if (!r.ok) return setErr(r.error);
    onDone(`Skills for ${role.name} saved`);
  }
  return (
    <Modal open wide onOpenChange={(o) => !o && onClose()} title={`Required skills: ${role.name}`} description="Choose the skills this role needs and the level (L1 Foundation → L6 Distinguished) for each.">
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <div className="table-wrap" style={{ maxHeight: "45vh" }}>
          <table className="dtable" data-testid="role-skills-editor">
            <thead><tr><th>Skill</th><th>Level</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {rows.length === 0 && (<tr><td colSpan={3} className="hint">No skills yet. Add at least one below.</td></tr>)}
              {rows.map((r, i) => (
                <tr key={r.code}>
                  <td><code className="mono chip tone-deep">{r.code}</code> {nameOf.get(r.code)}</td>
                  <td>
                    <label className="sr-only" htmlFor={`lvl-${r.code}`}>Level for {r.code}</label>
                    <select id={`lvl-${r.code}`} className="select" style={{ width: "6rem", minHeight: "2rem" }} value={r.level} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}>
                      {LEVELS.map((l) => (<option key={l} value={l}>L{l}</option>))}
                    </select>
                  </td>
                  <td><button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${r.code}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 18rem" }}>
            <label className="label" htmlFor="add-skill">Add a skill</label>
            <Select id="add-skill" growing value={pick} onChange={setPick} placeholder="Choose a skill…" options={available.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` }))} />
          </div>
          <button type="button" className="btn btn-secondary" disabled={!pick} onClick={() => { setRows([...rows, { code: pick, level: Math.max(1, Math.min(6, role.levelMin)) }]); setPick(""); }}>
            Add
          </button>
        </div>
        {err && <div className="field-error" role="alert">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={rows.length === 0} onClick={save}>Save skills</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Subcategories ────────────────────────────────────────────────────────

function SubcategoriesPanel({ data }: { data: ManageData }) {
  const after = useAfter();
  const [catId, setCatId] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    const r = await api<{ code: string }>("/api/ontology/subcategories", { body: { categoryId: catId, name } });
    if (!r.ok) return setErr(r.error);
    setErr(null);
    setName("");
    after(`Subcategory ${r.data.code} added`);
  }
  return (
    <section style={{ display: "grid", gap: "1rem" }} aria-label="Subcategories">
      <form className="glass card" onSubmit={add} noValidate style={{ display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 14rem" }}>
          <label className="label" htmlFor="sc-cat">Category</label>
          <select id="sc-cat" className="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Choose…</option>
            {data.categories.map((c) => (<option key={c.id} value={c.id}>{c.id}. {c.name}</option>))}
          </select>
        </div>
        <div className="field" style={{ flex: "2 1 18rem" }}>
          <label className="label" htmlFor="sc-name">New subcategory name</label>
          <input id="sc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Generative AI Product Engineering" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!catId || name.trim().length < 2}>Add subcategory</button>
        {err && <div className="field-error" role="alert" style={{ flexBasis: "100%" }}>{err}</div>}
      </form>
      <div className="glass-strong" style={{ padding: "0.75rem" }}>
        {data.categories.map((c) => (
          <details key={c.id} style={{ padding: "0.5rem 0.25rem", borderBottom: "1px solid var(--hairline)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{c.id}. {c.name} <span className="hint">· {c.subcategories.length} subcategories</span></summary>
            <ul style={{ listStyle: "none", padding: "0.5rem 0 0 1rem", display: "grid", gap: "0.35rem" }}>
              {c.subcategories.map((s) => (
                <li key={s.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <span className="mono hint">{s.code}</span> {s.name} <span className="hint">({s.skills} skills)</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming({ id: s.id, name: s.name })} aria-label={`Rename ${s.code}`}>Rename</button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      {renaming && (
        <Modal open onOpenChange={(o) => !o && setRenaming(null)} title="Rename subcategory">
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <Field id="sc-rename" label="Name" required>
              <input id="sc-rename" className="input" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setRenaming(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={async () => { const r = await api(`/api/ontology/subcategories/${renaming.id}`, { method: "PUT", body: { name: renaming.name } }); setRenaming(null); after(r.ok ? "Renamed" : r.error); }}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function ChangeLog({ data }: { data: ManageData }) {
  if (!data.changes.length) return <EmptyState title="No ontology changes yet" body="Additions, edits and retirements will be listed here." />;
  return (
    <section className="glass-strong" style={{ padding: "0.5rem" }} aria-label="Recent ontology changes">
      <table className="dtable" data-testid="ontology-changes">
        <thead><tr><th>When</th><th>Who</th><th>Change</th><th>Item</th><th>Reason</th></tr></thead>
        <tbody>
          {data.changes.map((c) => (
            <tr key={c.id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(c.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td>{c.actor}</td>
              <td className="mono">{c.action.replace(/_/g, " ")}</td>
              <td className="mono">{c.entityId}</td>
              <td>{c.reason ?? <span className="hint">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
