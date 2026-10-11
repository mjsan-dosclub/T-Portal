"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, downloadGet } from "@/components/api";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { EmptyState, StatusChip } from "@/components/states";
import { useToast } from "@/components/toast";
import { MASTER_LABELS, STATUS_COLOR_TOKENS, type MasterType } from "@/lib/validation/masters";
import type { MasterRow } from "@/server/masters";

type FieldDef = { key: string; label: string; kind?: "text" | "bool" | "select" | "date" | "number" | "list"; options?: string[]; required?: boolean; hint?: string };

const FIELDS: Record<MasterType, FieldDef[]> = {
  institutions: [
    { key: "name", label: "Name", required: true },
    { key: "shortCode", label: "Short code" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "isPartner", label: "Academic partner", kind: "bool" },
  ],
  degrees: [
    { key: "name", label: "Name", required: true, hint: "e.g. B.E., B.Tech, MCA" },
    { key: "level", label: "Level", kind: "select", options: ["UG", "PG", "DIPLOMA"], required: true },
  ],
  departments: [
    { key: "name", label: "Name", required: true },
    { key: "shortCode", label: "Short code", hint: "Also used to match uploads" },
    { key: "aliases", label: "Aliases", kind: "list", hint: "Separate with ; e.g. CSE; Computer Science; Comp Sci" },
  ],
  batches: [
    { key: "batchCode", label: "Batch code", required: true, hint: "e.g. 2026-B1" },
    { key: "year", label: "Year", kind: "number", required: true, hint: "Used in student codes DOS-YYYY-NNNNN" },
    { key: "startDate", label: "Start date", kind: "date" },
    { key: "endDate", label: "End date", kind: "date" },
  ],
  "colour-teams": [
    { key: "name", label: "Name", required: true },
    { key: "hexColor", label: "Colour (hex)", hint: "Optional, format #RRGGBB" },
  ],
  statuses: [
    { key: "name", label: "Name", required: true },
    { key: "color", label: "Chip colour", kind: "select", options: [...STATUS_COLOR_TOKENS] },
    { key: "isActiveState", label: "Counts as active", kind: "bool" },
  ],
};

function display(v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="hint">—</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : <span className="hint">—</span>;
  return String(v);
}

export function MasterManager({ type, rows, editable }: { type: MasterType; rows: MasterRow[]; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const label = MASTER_LABELS[type];
  const defs = FIELDS[type];
  const [editing, setEditing] = useState<null | { id?: string; values: Record<string, unknown> }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [inUse, setInUse] = useState<null | { row: MasterRow; count: number }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const visible = rows.filter((r) => showInactive || r.isActive);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body: Record<string, unknown> = {};
    for (const d of defs) {
      const v = editing.values[d.key];
      body[d.key] = d.kind === "bool" ? !!v : d.kind === "list" ? (Array.isArray(v) ? v : String(v ?? "")) : v === "" || v === null ? undefined : v;
    }
    const r = editing.id ? await api(`/api/masters/${type}/${editing.id}`, { method: "PUT", body }) : await api(`/api/masters/${type}`, { body });
    if (!r.ok) {
      setErrors(r.fields ?? {});
      setFormError(r.error);
      return;
    }
    toast({ message: editing.id ? "Saved" : `${label.singular} added` });
    setEditing(null);
    router.refresh();
  }

  async function setActive(row: MasterRow, isActive: boolean) {
    const r = await api(`/api/masters/${type}/${row.id}`, { method: "PATCH", body: { isActive } });
    toast({ message: r.ok ? `${row.label} ${isActive ? "activated" : "deactivated"}` : r.error });
    setInUse(null);
    router.refresh();
  }

  async function remove(row: MasterRow) {
    const r = await api(`/api/masters/${type}/${row.id}`, { method: "DELETE" });
    if (!r.ok && r.status === 409) return setInUse({ row, count: Number((r.data as { inUse?: number }).inUse ?? 0) });
    toast({ message: r.ok ? `${row.label} deleted` : r.error });
    router.refresh();
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>{label.plural}</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <label className="hint" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <input type="checkbox" className="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
          </label>
          {editable && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>Import CSV</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrors({});
                  setFormError(null);
                  setEditing({ values: type === "statuses" ? { isActiveState: true } : {} });
                }}
              >
                Add {label.singular.toLowerCase()}
              </button>
            </>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={`No ${label.plural.toLowerCase()} yet`} body={editable ? `Add one, or import a CSV.` : undefined} />
      ) : (
        <div className="glass-strong" style={{ padding: "0.5rem" }}>
          <div className="table-wrap">
            <table className="dtable" data-testid="master-table">
              <thead>
                <tr>
                  {defs.map((d) => (
                    <th key={d.key}>{d.label}</th>
                  ))}
                  <th>Students</th>
                  <th>State</th>
                  {editable && <th><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} data-testid="master-row">
                    {defs.map((d) => (
                      <td key={d.key} style={d.key === "name" || d.key === "batchCode" ? { fontWeight: 600 } : undefined}>
                        {d.key === "color" && r.fields.color ? <StatusChip name={String(r.fields.color)} color={String(r.fields.color)} /> : display(r.fields[d.key])}
                      </td>
                    ))}
                    <td className="mono">{r.usage}</td>
                    <td>{r.isActive ? <span className="chip chip-dot tone-primary">Active</span> : <span className="chip tone-muted">Inactive</span>}</td>
                    {editable && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setErrors({}); setFormError(null); setEditing({ id: r.id, values: { ...r.fields } }); }}>Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActive(r, !r.isActive)}>{r.isActive ? "Deactivate" : "Activate"}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(r)} aria-label={`Delete ${r.label}`}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? `Edit ${label.singular.toLowerCase()}` : `Add ${label.singular.toLowerCase()}`}>
        {editing && (
          <form onSubmit={save} noValidate style={{ display: "grid", gap: "0.9rem" }}>
            {formError && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {formError}</div>}
            {defs.map((d) => {
              const id = `m-${d.key}`;
              const v = editing.values[d.key];
              const setV = (nv: unknown) => setEditing((e) => (e ? { ...e, values: { ...e.values, [d.key]: nv } } : e));
              if (d.kind === "bool")
                return (
                  <label key={d.key} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input type="checkbox" className="checkbox" checked={!!v} onChange={(e) => setV(e.target.checked)} /> {d.label}
                  </label>
                );
              return (
                <Field key={d.key} id={id} label={d.label} required={d.required} error={errors[d.key]} hint={d.hint}>
                  {d.kind === "select" ? (
                    <select id={id} className="select" value={String(v ?? "")} onChange={(e) => setV(e.target.value)}>
                      <option value="">{d.required ? "Choose…" : "None"}</option>
                      {d.options!.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      className="input"
                      type={d.kind === "date" ? "date" : d.kind === "number" ? "number" : "text"}
                      value={Array.isArray(v) ? v.join("; ") : String(v ?? "")}
                      onChange={(e) => setV(e.target.value)}
                      aria-invalid={!!errors[d.key]}
                    />
                  )}
                </Field>
              );
            })}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!inUse} onOpenChange={(o) => !o && setInUse(null)} title="Can't delete a value that's in use" description={inUse ? `"${inUse.row.label}" is used by ${inUse.count} student record(s). Deactivate it instead: it disappears from new-student dropdowns but stays on existing records.` : ""}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => setInUse(null)}>Cancel</button>
          {inUse?.row.isActive && (
            <button type="button" className="btn btn-primary" onClick={() => setActive(inUse.row, false)} data-testid="deactivate-instead">
              Deactivate instead
            </button>
          )}
        </div>
      </Modal>

      <ImportDialog type={type} open={importOpen} onOpenChange={setImportOpen} onDone={() => router.refresh()} />
    </section>
  );
}

type Preview = { dryRun: boolean; summary: { total: number; valid: number; duplicates: number; errors: number; imported?: number }; rows: { rowNo: number; values: Record<string, string>; status: string; message?: string }[] };

function ImportDialog({ type, open, onOpenChange, onDone }: { type: MasterType; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("dryRun", String(dryRun));
    const r = await api<Preview>(`/api/masters/${type}/import`, { form });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (dryRun) setPreview(r.data);
    else {
      toast({ message: `Imported ${r.data.summary.imported ?? 0} value(s)` });
      onOpenChange(false);
      setPreview(null);
      setFile(null);
      onDone();
    }
  }
  return (
    <Modal open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setPreview(null); setFile(null); setError(null); } }} title={`Import ${MASTER_LABELS[type].plural.toLowerCase()}`} description="Upload a CSV, review the preview, then confirm. Duplicates are flagged, never merged. Max 1,000 rows." wide>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadGet(`/api/masters/${type}/template`, `${type}-template.csv`)}>Download template</button>
          <label className="btn btn-secondary btn-sm" htmlFor="master-file">Choose file</label>
          <input id="master-file" type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
          <span className="hint">{file?.name ?? "No file chosen"}</span>
        </div>
        {error && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {error}</div>}
        {preview && (
          <>
            <div className="banner" data-testid="master-import-summary">
              {preview.summary.valid} valid · {preview.summary.duplicates} duplicates · {preview.summary.errors} errors (of {preview.summary.total})
            </div>
            <div className="table-wrap" style={{ maxHeight: "40vh" }}>
              <table className="dtable">
                <thead><tr><th>Row</th><th>Result</th><th>Values</th><th>Message</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.rowNo}>
                      <td className="mono">{r.rowNo}</td>
                      <td><span className={`chip ${r.status === "VALID" ? "tone-primary" : r.status === "ERROR" ? "tone-deep" : "tone-accent"}`}>{r.status.toLowerCase()}</span></td>
                      <td style={{ fontSize: "0.82rem" }}>{Object.values(r.values).filter(Boolean).join(" · ")}</td>
                      <td style={{ fontSize: "0.82rem" }}>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
          {!preview ? (
            <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={() => send(true)}>{busy ? "Checking…" : "Preview"}</button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy || preview.summary.valid === 0} onClick={() => send(false)}>{busy ? "Importing…" : `Import ${preview.summary.valid}`}</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
