"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { MODES, MODE_LABEL, PROGRAM_STATUSES, PROGRAM_STATUS_LABEL } from "@/lib/validation/internship";

export type ProgramValues = { companyName: string; title: string; description: string; country: string; city: string; workMode: string; seats: string; durationValue: string; durationUnit: string; startDate: string; status: string };
export const EMPTY_PROGRAM: ProgramValues = { companyName: "", title: "", description: "", country: "", city: "", workMode: "", seats: "", durationValue: "", durationUnit: "WEEKS", startDate: "", status: "DRAFT" };

/** Create / edit an internship program (INT-1). */
export function ProgramForm({ initial, programId, onDone, onCancel }: { initial: ProgramValues; programId?: string; onDone: (id: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ProgramValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { ...v, city: v.city || null, startDate: v.startDate || null };
    const r = programId ? await api(`/api/internships/${programId}`, { method: "PUT", body }) : await api<{ id: string }>("/api/internships", { body });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setErr(r.error);
    }
    onDone(programId ?? (r.data as { id: string }).id);
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" }}>
      {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)", gridColumn: "1 / -1" }}>⚠ {err}</div>}
      <Field id="p-company" label="Company (client) name" required error={errors.companyName}><input id="p-company" className="input" value={v.companyName} onChange={set("companyName")} maxLength={160} /></Field>
      <Field id="p-title" label="Program title" required error={errors.title} hint="e.g. Data Analyst Intern"><input id="p-title" className="input" value={v.title} onChange={set("title")} maxLength={160} /></Field>
      <div style={{ gridColumn: "1 / -1" }}>
        <Field id="p-desc" label="Description" required error={errors.description} hint="What the interns will do, the team, the tools and what is expected each week.">
          <textarea id="p-desc" className="textarea" rows={5} value={v.description} onChange={set("description")} maxLength={5000} />
        </Field>
      </div>
      <Field id="p-country" label="Country" required error={errors.country}><input id="p-country" className="input" value={v.country} onChange={set("country")} maxLength={80} /></Field>
      <Field id="p-city" label="City" error={errors.city}><input id="p-city" className="input" value={v.city} onChange={set("city")} maxLength={80} /></Field>
      <Field id="p-mode" label="Work mode" required error={errors.workMode}>
        <select id="p-mode" className="select" value={v.workMode} onChange={set("workMode")}>
          <option value="">Choose…</option>
          {MODES.map((m) => (<option key={m} value={m}>{MODE_LABEL[m]}</option>))}
        </select>
      </Field>
      <Field id="p-seats" label="Number of resources" required error={errors.seats} hint="How many students the client needs."><input id="p-seats" className="input" type="number" min={1} value={v.seats} onChange={set("seats")} /></Field>
      <Field id="p-dur" label="Duration" required error={errors.durationValue}><input id="p-dur" className="input" type="number" min={1} value={v.durationValue} onChange={set("durationValue")} /></Field>
      <Field id="p-unit" label="Duration unit" required error={errors.durationUnit}>
        <select id="p-unit" className="select" value={v.durationUnit} onChange={set("durationUnit")}>
          <option value="WEEKS">Weeks</option>
          <option value="DAYS">Days</option>
        </select>
      </Field>
      <Field id="p-start" label="Start date" error={errors.startDate} hint="Weekly reports open from this date."><input id="p-start" className="input" type="date" value={v.startDate} onChange={set("startDate")} /></Field>
      <Field id="p-status" label="Status" required error={errors.status} hint="Students see the program once it is Open.">
        <select id="p-status" className="select" value={v.status} onChange={set("status")}>
          {PROGRAM_STATUSES.map((s) => (<option key={s} value={s}>{PROGRAM_STATUS_LABEL[s]}</option>))}
        </select>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", gridColumn: "1 / -1" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : programId ? "Save changes" : "Create program"}</button>
      </div>
    </form>
  );
}
