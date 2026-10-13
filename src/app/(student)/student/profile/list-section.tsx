"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { SkillPicker } from "@/components/skills/skill-picker";
import { useToast } from "@/components/toast";
import type { SectionScore } from "@/lib/completeness";
import type { SkillOption } from "@/lib/skill-search";

export type Option = { value: string; label: string };
export type FieldDef =
  | { name: string; label: string; kind: "text" | "textarea" | "number" | "month" | "date" | "url"; required?: boolean; hint?: string; placeholder?: string; list?: string[]; max?: number }
  | { name: string; label: string; kind: "select"; options: Option[]; required?: boolean; hint?: string }
  | { name: string; label: string; kind: "checkbox"; hint?: string }
  | { name: string; label: string; kind: "skills"; hint?: string };

export type Catalog = SkillOption[];
type Item = { id: string } & Record<string, unknown>;

/** Section header with its own completeness (PRF-3). */
export function SectionHead({ id, title, score, action }: { id: string; title: string; score?: SectionScore; action?: ReactNode }) {
  const pct = score ? Math.round(score.score * 100) : null;
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h2 id={`${id}-h`} style={{ fontSize: "1.15rem", fontWeight: 600 }}>
          {title}{" "}
          {pct !== null && (
            <span className={`chip ${pct === 100 ? "tone-primary" : pct > 0 ? "tone-accent" : "tone-muted"}`} data-testid={`score-${id}`} style={{ marginLeft: "0.35rem", verticalAlign: "middle" }}>
              {pct === 100 ? "✓ " : ""}
              {pct}%
            </span>
          )}
        </h2>
        {action}
      </div>
      {score && score.missing.length > 0 && <p className="hint">To complete: add {score.missing.join(", ")}.</p>}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month + year as two dropdowns (UX-1): desktop Safari has no month picker, so `type="month"` showed an empty box there.
 *  Value stays "YYYY-MM" ("" when both are empty; a half-filled pair is sent as-is and the server asks for both). */
export function MonthField({ id, label, value, onChange, required, error, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; error?: string; hint?: string }) {
  const [y = "", m = ""] = (value ?? "").split("-");
  const now = new Date().getUTCFullYear();
  const years = Array.from({ length: now + 2 - 2008 + 1 }, (_, i) => String(now + 2 - i));
  const emit = (ny: string, nm: string) => onChange(ny || nm ? `${ny}-${nm}` : "");
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className={`label ${required ? "req" : ""}`} style={{ padding: 0, marginBottom: "0.35rem" }}>{label}</legend>
      <div className="month-field">
        <select id={id} className="select" aria-label={`${label}: month`} value={m} onChange={(e) => emit(y, e.target.value)} aria-invalid={!!error}>
          <option value="">Month</option>
          {MONTHS.map((n, i) => (<option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>))}
        </select>
        <select id={`${id}-y`} className="select" aria-label={`${label}: year`} value={y} onChange={(e) => emit(e.target.value, m)} aria-invalid={!!error}>
          <option value="">Year</option>
          {years.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </div>
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
    </fieldset>
  );
}

export function DynamicForm({ fields, values, setValues, errors, catalog }: { fields: FieldDef[]; values: Record<string, unknown>; setValues: (v: Record<string, unknown>) => void; errors: Record<string, string>; catalog?: Catalog }) {
  return (
    <>
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const v = values[f.name];
        const set = (nv: unknown) => setValues({ ...values, [f.name]: nv });
        if (f.kind === "checkbox")
          return (
            <label key={f.name} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" className="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /> {f.label}
            </label>
          );
        if (f.kind === "skills")
          return (
            <div key={f.name} style={{ gridColumn: "1 / -1" }}>
              <SkillPicker id={id} label={f.label} catalog={catalog ?? []} selected={(v as string[] | undefined) ?? []} onChange={set} max={10} hint={f.hint} error={errors[f.name]} />
            </div>
          );
        if (f.kind === "month")
          return <MonthField key={f.name} id={id} label={f.label} value={(v as string) ?? ""} onChange={set} required={"required" in f && f.required} error={errors[f.name]} hint={f.hint} />;
        return (
          <Field key={f.name} id={id} label={f.label} required={"required" in f && f.required} error={errors[f.name]} hint={f.hint}>
            {f.kind === "select" ? (
              <select id={id} className="select" value={(v as string) ?? ""} onChange={(e) => set(e.target.value)}>
                <option value="">{f.required ? "Choose…" : "Not specified"}</option>
                {f.options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            ) : f.kind === "textarea" ? (
              <textarea id={id} className="textarea" maxLength={f.max} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />
            ) : (
              <>
                <input
                  id={id}
                  className="input"
                  type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : f.kind === "url" ? "url" : "text"}
                  value={(v as string | number | undefined) ?? ""}
                  placeholder={f.placeholder}
                  maxLength={f.max}
                  list={f.list ? `${id}-list` : undefined}
                  onChange={(e) => set(e.target.value)}
                  aria-invalid={!!errors[f.name]}
                />
                {f.list && <datalist id={`${id}-list`}>{f.list.map((x) => <option key={x} value={x} />)}</datalist>}
              </>
            )}
          </Field>
        );
      })}
    </>
  );
}

/** Generic add / edit / remove list section (education, internships, certifications, accomplishments, tools). */
export function ListSection({
  id, title, kind, items, fields, empty, render, score, max, catalog, onSaved, addLabel, apiBase = "/api/student/me/sections",
}: {
  id: string; title: string; kind: string; items: Item[]; fields: FieldDef[]; empty: string; render: (it: Item) => ReactNode; score?: SectionScore; max: number; catalog?: Catalog; onSaved: () => void; addLabel: string; apiBase?: string;
}) {
  const toast = useToast();
  const [edit, setEdit] = useState<null | { item?: Item }>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(item?: Item) {
    const v: Record<string, unknown> = {};
    for (const f of fields) v[f.name] = item ? item[f.name] ?? (f.kind === "checkbox" ? false : f.kind === "skills" ? [] : "") : f.kind === "checkbox" ? false : f.kind === "skills" ? [] : "";
    setValues(v);
    setErrors({});
    setErr(null);
    setEdit({ item });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body: Record<string, unknown> = {};
    for (const f of fields) body[f.name] = values[f.name] ?? null;
    const r = edit?.item ? await api(`${apiBase}/${kind}/${edit.item.id}`, { method: "PUT", body }) : await api(`${apiBase}/${kind}`, { body });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setErr(r.error);
    }
    toast({ message: edit?.item ? "Saved" : "Added" });
    setEdit(null);
    onSaved();
  }

  return (
    <section id={id} className="glass card" aria-labelledby={`${id}-h`} style={{ display: "grid", gap: "0.8rem", scrollMarginTop: "1rem" }}>
      <SectionHead id={id} title={title} score={score} action={<button type="button" className="btn btn-secondary" onClick={() => open()} disabled={items.length >= max}>{addLabel}</button>} />
      {items.length === 0 ? (
        <p className="hint">{empty}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }} data-testid={`list-${id}`}>
          {items.map((it) => (
            <li key={it.id} className="glass-strong" style={{ padding: "0.8rem 1rem", borderRadius: "var(--r-xl)", display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem", alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>{render(it)}</div>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(it)}>Edit</button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const r = await api(`${apiBase}/${kind}/${it.id}`, { method: "DELETE" });
                    toast({ message: r.ok ? "Removed" : r.error });
                    if (r.ok) onSaved();
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Modal open wide onOpenChange={(o) => !o && setEdit(null)} title={`${edit.item ? "Edit" : "Add"}: ${title.toLowerCase()}`}>
          <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" }}>
            {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)", gridColumn: "1 / -1" }}>⚠ {err}</div>}
            <DynamicForm fields={fields} values={values} setValues={setValues} errors={errors} catalog={catalog} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", gridColumn: "1 / -1" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
