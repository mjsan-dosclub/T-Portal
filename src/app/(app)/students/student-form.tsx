"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { Select } from "@/components/select";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { GENDER_LABELS, GENDERS } from "@/lib/validation/student";
import type { MasterOptions } from "@/server/masters";
import type { StudentDetail } from "@/server/students";

type Values = Record<string, string>;
const FIELDS = ["fullName", "email", "phone", "gender", "dateOfBirth", "institutionId", "degreeId", "departmentId", "yearOfStudy", "graduationYear", "batchId", "colourTeamId", "statusId", "city", "state", "linkedinUrl", "githubUrl", "notes", "targetRoleId"] as const;

function fromStudent(s?: StudentDetail | null, defaults: Partial<Values> = {}): Values {
  const v: Values = {};
  for (const f of FIELDS) {
    const raw = s ? (s as unknown as Record<string, unknown>)[f] : undefined;
    v[f] = raw === null || raw === undefined ? (defaults[f] ?? "") : String(raw);
  }
  return v;
}

type Dup = { id: string; studentCode: string; field: "email" | "phone"; deleted: boolean };

export function StudentForm({ options, roles, student }: { options: MasterOptions; roles: { id: string; name: string }[]; student?: StudentDetail }) {
  const router = useRouter();
  const toast = useToast();
  const defaultStatus = options.statuses.find((s) => s.isDefault && s.isActive)?.id ?? "";
  const [initial, setInitial] = useState<Values>(() => fromStudent(student, { statusId: defaultStatus }));
  const [values, setValues] = useState<Values>(initial);
  const [version, setVersion] = useState(student?.version ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<StudentDetail | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const dirty = FIELDS.some((f) => values[f] !== initial[f]);
  const saved = useRef(false);

  // Unsaved-changes guard (STU-24): browser-level for reload/close.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty && !saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = (f: string) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f]: e.target.value }));

  async function checkDup() {
    if (!values.email && !values.phone) return;
    const r = await api<{ duplicates: Dup[] }>("/api/students/check-duplicate", { body: { email: values.email || undefined, phone: values.phone || undefined, exceptId: student?.id } });
    if (r.ok) setDups(r.data.duplicates);
  }

  function payload() {
    const p: Record<string, unknown> = {};
    for (const f of FIELDS) p[f] = values[f] === "" ? undefined : values[f];
    return p;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    const r = student
      ? await api<StudentDetail>(`/api/students/${student.id}`, { method: "PUT", body: { version, data: payload() } })
      : await api<{ id: string; studentCode: string }>("/api/students", { body: payload() });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      if (r.status === 409 && (r.data as { conflict?: boolean }).conflict) {
        setConflict((r.data as { current: StudentDetail }).current);
        return;
      }
      const dup = (r.data as { duplicate?: Dup }).duplicate;
      if (dup) setDups([dup]);
      setFormError(r.error);
      document.getElementById("form-error")?.focus();
      return;
    }
    saved.current = true;
    if (student) {
      toast({ message: "Saved" });
      router.push("/students");
    } else {
      toast({ message: `Added ${(r.data as { studentCode: string }).studentCode}` });
      router.push("/students");
    }
    router.refresh();
  }

  const sel = (id: string, label: string, opts: { id: string; label: string; isActive: boolean }[], required = true) => (
    <Field id={id} label={label} required={required} error={errors[id]}>
      {/* Master lists grow over time → searchable (UX-4). */}
      <Select
        id={id}
        growing
        value={values[id]}
        onChange={(v) => set(id)({ target: { value: v } })}
        placeholder={required ? "Choose…" : "None"}
        required={required}
        options={opts.filter((o) => o.isActive || o.id === values[id]).map((o) => ({ value: o.id, label: o.label + (o.isActive ? "" : " (inactive)") }))}
        invalid={!!errors[id]}
        describedBy={errors[id] ? `${id}-error` : undefined}
      />
    </Field>
  );
  const txt = (id: string, label: string, props: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}, required = false, hint?: string) => (
    <Field id={id} label={label} required={required} error={errors[id]} hint={hint}>
      <input id={id} className="input" value={values[id]} onChange={set(id)} aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    </Field>
  );

  const section = (title: string, children: React.ReactNode) => (
    <fieldset className="glass-strong card" style={{ border: 0, display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
      <legend className="display" style={{ fontWeight: 600, fontSize: "1.05rem", float: "left", width: "100%", marginBottom: "0.25rem" }}>{title}</legend>
      {children}
    </fieldset>
  );

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "1.25rem" }}>
      {formError && (
        <div id="form-error" tabIndex={-1} className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>
          ⚠ {formError}
        </div>
      )}
      {dups.length > 0 && (
        <div className="banner" role="status" data-testid="duplicate-banner">
          {dups.map((d) => (
            <span key={d.id + d.field}>
              This {d.field} is already used by{" "}
              {d.deleted ? (
                <strong className="mono">{d.studentCode} (in Recycle Bin)</strong>
              ) : (
                <Link href={`/students/${d.id}/edit`} className="mono">{d.studentCode}</Link>
              )}
              .{" "}
            </span>
          ))}
        </div>
      )}
      {section(
        "Personal",
        <>
          {txt("fullName", "Full name", { autoComplete: "off", maxLength: 100 }, true)}
          {txt("email", "Email", { type: "email", autoComplete: "off", onBlur: checkDup }, true)}
          {txt("phone", "Mobile", { inputMode: "tel", autoComplete: "off", onBlur: checkDup, placeholder: "98765 43210" }, true, "Indian mobile. Stored as +91XXXXXXXXXX")}
          <Field id="gender" label="Gender" error={errors.gender}>
            <select id="gender" className="select" value={values.gender} onChange={set("gender")}>
              <option value="">Not specified</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
          </Field>
          {txt("dateOfBirth", "Date of birth", { type: "date" }, false, "Age 15–40")}
          {txt("city", "City", { maxLength: 80 })}
          {txt("state", "State", { maxLength: 80 })}
        </>,
      )}
      {section(
        "Education",
        <>
          {sel("institutionId", "Institution", options.institutions)}
          {sel("degreeId", "Degree", options.degrees)}
          {sel("departmentId", "Department", options.departments)}
          {txt("yearOfStudy", "Year of study", { type: "number", min: 1, max: 5 })}
          {txt("graduationYear", "Graduation year", { type: "number" }, true)}
        </>,
      )}
      {section(
        "DOS Club",
        <>
          {sel("batchId", "DOS Club batch", options.batches)}
          {sel("statusId", "Status", options.statuses)}
          {sel("colourTeamId", "Colour team", options.colourTeams, false)}
          <Field id="targetRoleId" label="Target role (Skills Ontology)" error={errors.targetRoleId}>
            <Select id="targetRoleId" growing value={values.targetRoleId} onChange={(v) => set("targetRoleId")({ target: { value: v } })} placeholder="None" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Field>
        </>,
      )}
      {section(
        "Links & notes",
        <>
          {txt("linkedinUrl", "LinkedIn URL", { type: "url", placeholder: "https://www.linkedin.com/in/…" })}
          {txt("githubUrl", "GitHub URL", { type: "url", placeholder: "https://github.com/…" })}
          <Field id="notes" label="Admin notes (not visible to Viewers)" error={errors.notes}>
            <textarea id="notes" className="textarea" maxLength={2000} value={values.notes} onChange={set("notes")} />
          </Field>
        </>,
      )}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", position: "sticky", bottom: "1rem" }}>
        <Link
          className="btn btn-secondary"
          href="/students"
          onClick={(e) => {
            if (dirty && !saved.current) {
              e.preventDefault();
              setLeaveOpen(true);
            }
          }}
        >
          Cancel
        </Link>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : student ? "Save changes" : "Add student"}
        </button>
      </div>
      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} onLeave={() => { saved.current = true; router.push("/students"); }} />
      <Modal open={!!conflict} onOpenChange={(o) => !o && setConflict(null)} title="This student was changed by someone else" description="Their version is shown below. Keep your edits to overwrite with your values, or load theirs." wide>
        {conflict && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="table-wrap">
              <table className="dtable" data-testid="conflict-diff">
                <thead>
                  <tr><th>Field</th><th>Their saved value</th><th>Your value</th></tr>
                </thead>
                <tbody>
                  {FIELDS.filter((f) => String((conflict as unknown as Record<string, unknown>)[f] ?? "") !== values[f]).map((f) => (
                    <tr key={f}>
                      <td>{f}</td>
                      <td>{String((conflict as unknown as Record<string, unknown>)[f] ?? "—")}</td>
                      <td>{values[f] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => { const v = fromStudent(conflict); setInitial(v); setValues(v); setVersion(conflict.version); setConflict(null); }}>
                Load their version
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { setVersion(conflict.version); setConflict(null); }}>
                Keep my edits (then Save)
              </button>
            </div>
          </div>
        )}
      </Modal>
    </form>
  );
}

/** In-app unsaved-changes prompt (no window.confirm). */
function LeaveDialog({ open, onOpenChange, onLeave }: { open: boolean; onOpenChange: (o: boolean) => void; onLeave: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Discard unsaved changes?" description="You have edits that haven't been saved.">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)}>
          Keep editing
        </button>
        <button type="button" className="btn btn-danger" onClick={onLeave} data-testid="discard-changes">
          Discard
        </button>
      </div>
    </Modal>
  );
}
