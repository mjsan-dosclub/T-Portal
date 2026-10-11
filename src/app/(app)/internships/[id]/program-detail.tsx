"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, downloadGet } from "@/components/api";
import { Modal } from "@/components/modal";
import { EmptyState } from "@/components/states";
import { useToast } from "@/components/toast";
import { ProgramForm } from "@/components/internship/program-form";
import { WeekChip, WeekLegend } from "@/components/internship/week-grid";
import { MODE_LABEL, PROGRAM_STATUS_LABEL } from "@/lib/validation/internship";
import type { ProgramDetail } from "@/server/internships";
import { STATUS_TONE } from "../programs-list";

type Assignment = ProgramDetail["assignments"][number];
type Report = Assignment["reports"][number];
type Candidate = { id: string; studentCode: string; fullName: string; institution: string; batch: string; activated: boolean; assigned: boolean };

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function ProgramDetailView({ data, editable }: { data: ProgramDetail; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const p = data.program;
  const active = data.assignments.filter((a) => a.status !== "WITHDRAWN");
  const withdrawn = data.assignments.filter((a) => a.status === "WITHDRAWN");
  const seatsLeft = p.seats - active.length;
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [review, setReview] = useState<{ a: Assignment; r: Report } | null>(null);
  const [withdraw, setWithdraw] = useState<Assignment | null>(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1rem" }}>
      <section className="glass card" aria-labelledby="pd-h" style={{ display: "grid", gap: "0.8rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <h2 id="pd-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>
            Program details <span className={`chip ${STATUS_TONE[p.status]}`} style={{ marginLeft: "0.35rem", verticalAlign: "middle" }} data-testid="program-status">{PROGRAM_STATUS_LABEL[p.status as keyof typeof PROGRAM_STATUS_LABEL]}</span>
          </h2>
          {editable && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit program</button>}
        </div>
        <dl className="kv" data-testid="program-facts">
          <dt>Company</dt><dd>{p.companyName}</dd>
          <dt>Location</dt><dd>{[p.city, p.country].filter(Boolean).join(", ")} · {MODE_LABEL[p.workMode as keyof typeof MODE_LABEL]}</dd>
          <dt>Resources</dt><dd>{p.seats} ({active.length} assigned, {seatsLeft} seat(s) left)</dd>
          <dt>Duration</dt><dd>{p.durationValue} {p.durationUnit === "WEEKS" ? "week(s)" : "day(s)"} · {p.weeks} weekly report(s)</dd>
          <dt>Dates</dt><dd>{p.startDate ? `${p.startDate} → ${p.endDate}` : "Start date not set (students can't upload reports yet)"}</dd>
        </dl>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{p.description}</p>
      </section>

      <section className="glass-strong card" aria-labelledby="ps-h" style={{ display: "grid", gap: "0.8rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <h2 id="ps-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>Students & weekly reports</h2>
          {editable && (
            <button type="button" className="btn btn-primary" onClick={() => setAssigning(true)} disabled={seatsLeft <= 0 || p.status === "CANCELLED" || p.status === "COMPLETED"}>
              {seatsLeft <= 0 ? "All seats filled" : `Assign students (${seatsLeft} left)`}
            </button>
          )}
        </div>
        <WeekLegend />
        {active.length === 0 ? (
          <EmptyState title="No students assigned yet" body={editable ? "Assign students from the master list. They'll see this program on their portal." : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="dtable" data-testid="assignment-table">
              <thead><tr><th>Student</th><th>Attendance</th><th>Weekly reports</th>{editable && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {active.map((a) => (
                  <tr key={a.id} data-testid={`assignment-${a.student.studentCode}`}>
                    <td>
                      <Link href={`/students/${a.student.id}/profile`} style={{ fontWeight: 600 }}>{a.student.fullName}</Link>
                      <div className="hint"><span className="mono">{a.student.studentCode}</span> · {a.student.institution} · {a.student.batch}</div>
                      {!a.student.activated && <span className="chip tone-muted" style={{ marginTop: "0.25rem" }}>Portal not activated</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <strong data-testid="row-attendance">{a.grid.pct === null ? "—" : `${a.grid.pct}%`}</strong>
                      <div className="hint">{a.grid.attended} / {Math.max(a.grid.elapsed, a.grid.attended)} due</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {a.grid.cells.map((c) => {
                          const r = a.reports.find((x) => x.weekNo === c.weekNo);
                          return <WeekChip key={c.weekNo} cell={c} onClick={r ? () => setReview({ a, r }) : undefined} testId={`week-${a.student.studentCode}-${c.weekNo}`} />;
                        })}
                      </div>
                    </td>
                    {editable && (
                      <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setWithdraw(a)}>Withdraw</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {withdrawn.length > 0 && (
          <details>
            <summary className="hint" style={{ cursor: "pointer" }}>Withdrawn ({withdrawn.length})</summary>
            <ul style={{ margin: "0.5rem 0 0 1rem" }}>
              {withdrawn.map((a) => (<li key={a.id} className="hint">{a.student.fullName} ({a.student.studentCode}) · {a.reports.length} report(s) kept</li>))}
            </ul>
          </details>
        )}
      </section>

      {editing && (
        <Modal open wide onOpenChange={(o) => !o && setEditing(false)} title="Edit program">
          <ProgramForm
            programId={p.id}
            initial={{ companyName: p.companyName, title: p.title, description: p.description, country: p.country, city: p.city ?? "", workMode: p.workMode, seats: String(p.seats), durationValue: String(p.durationValue), durationUnit: p.durationUnit, startDate: p.startDate ?? "", status: p.status }}
            onCancel={() => setEditing(false)}
            onDone={() => {
              setEditing(false);
              toast({ message: "Program saved" });
              router.refresh();
            }}
          />
        </Modal>
      )}
      {assigning && <AssignModal programId={p.id} seatsLeft={seatsLeft} onClose={(changed) => { setAssigning(false); if (changed) router.refresh(); }} />}
      {review && <ReviewModal a={review.a} r={review.r} editable={editable} onClose={(changed) => { setReview(null); if (changed) router.refresh(); }} />}
      {withdraw && (
        <Modal open onOpenChange={(o) => !o && setWithdraw(null)} title={`Withdraw ${withdraw.student.fullName}?`} description="The student will no longer see this program. Reports already submitted are kept, and the seat is freed.">
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setWithdraw(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                const r = await api(`/api/internships/assignments/${withdraw.id}/withdraw`, { body: {} });
                toast({ message: r.ok ? "Student withdrawn" : r.error });
                setWithdraw(null);
                if (r.ok) router.refresh();
              }}
            >
              Withdraw
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AssignModal({ programId, seatsLeft, onClose }: { programId: string; seatsLeft: number; onClose: (changed: boolean) => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; list: Candidate[] } | null>(null);
  const [picked, setPicked] = useState<Map<string, Candidate>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api<{ students: Candidate[] }>(`/api/internships/${programId}/candidates?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.ok && setResult({ q, list: r.data.students }))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, programId]);

  function toggle(c: Candidate) {
    const m = new Map(picked);
    if (m.has(c.id)) m.delete(c.id);
    else m.set(c.id, c);
    setPicked(m);
  }
  async function assign() {
    setBusy(true);
    const r = await api<{ assigned: number }>(`/api/internships/${programId}/assign`, { body: { studentIds: [...picked.keys()] } });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast({ message: `${r.data.assigned} student(s) assigned` });
    onClose(true);
  }

  return (
    <Modal open wide onOpenChange={(o) => !o && onClose(false)} title="Assign students" description={`${seatsLeft} seat(s) left. Students who haven't activated the portal can be assigned; they'll see the program once they sign in.`}>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
        <div className="field">
          <label className="label" htmlFor="as-q">Search by name, email or student code</label>
          <input id="as-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="table-wrap" style={{ maxHeight: "45vh" }}>
          {!result ? (
            <p className="hint" style={{ padding: "0.75rem" }}>Loading…</p>
          ) : result.list.length === 0 ? (
            <p className="hint" style={{ padding: "0.75rem" }}>No students match.</p>
          ) : (
            <table className="dtable" data-testid="candidate-table">
              <thead><tr><th><span className="sr-only">Select</span></th><th>Student</th><th>Institution · batch</th><th>Portal</th></tr></thead>
              <tbody>
                {result.list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label={`Select ${c.fullName}`}
                        checked={c.assigned || picked.has(c.id)}
                        disabled={c.assigned || (!picked.has(c.id) && picked.size >= seatsLeft)}
                        onChange={() => toggle(c)}
                      />
                    </td>
                    <td><span style={{ fontWeight: 600 }}>{c.fullName}</span> <span className="hint mono">{c.studentCode}</span>{c.assigned && <span className="chip tone-primary" style={{ marginLeft: "0.35rem" }}>Assigned</span>}</td>
                    <td className="hint">{c.institution} · {c.batch}</td>
                    <td>{c.activated ? <span className="chip tone-primary">Active</span> : <span className="chip tone-muted">Not activated</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span className="hint" data-testid="picked-count">{picked.size} selected{picked.size >= seatsLeft ? " · seat limit reached" : ""}</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || picked.size === 0} onClick={assign}>{busy ? "Assigning…" : `Assign ${picked.size || ""}`.trim()}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ReviewModal({ a, r, editable, onClose }: { a: Assignment; r: Report; editable: boolean; onClose: (changed: boolean) => void }) {
  const toast = useToast();
  const [note, setNote] = useState(r.reviewNote ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(status: "ACCEPTED" | "NEEDS_REVISION") {
    setBusy(true);
    const res = await api(`/api/internships/reports/${r.id}/review`, { body: { status, note: note.trim() || undefined } });
    setBusy(false);
    if (!res.ok) return setErr(res.fields?.note ? `${res.error}: ${res.fields.note}` : res.error);
    toast({ message: status === "ACCEPTED" ? `Week ${r.weekNo} accepted` : `Sent back for revision` });
    onClose(true);
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose(false)} title={`Week ${r.weekNo} report · ${a.student.fullName}`}>
      <div style={{ display: "grid", gap: "0.8rem" }}>
        {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
        <dl className="kv">
          <dt>File</dt><dd><span className="mono">{r.fileName}</span> ({r.fileType.toUpperCase()}, {kb(r.sizeBytes)})</dd>
          <dt>Submitted</dt><dd>{when(r.submittedAt)}{r.late && <span className="chip tone-deep" style={{ marginLeft: "0.35rem" }}>Late</span>}</dd>
          <dt>Status</dt><dd data-testid="review-status">{r.status === "ACCEPTED" ? "Accepted" : r.status === "NEEDS_REVISION" ? "Needs revision" : "Awaiting review"}</dd>
          {r.note && (<><dt>Student note</dt><dd style={{ whiteSpace: "pre-wrap" }}>{r.note}</dd></>)}
        </dl>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const e = await downloadGet(`/api/internships/reports/${r.id}/file`, r.fileName);
            if (e) toast({ message: e });
          }}
        >
          Download report
        </button>
        {editable ? (
          <>
            <div className="field">
              <label className="label" htmlFor="rv-note">Feedback for the student</label>
              <textarea id="rv-note" className="textarea" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              <span className="hint">Required when asking for a revision.</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide("NEEDS_REVISION")}>Needs revision</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide("ACCEPTED")}>Accept</button>
            </div>
          </>
        ) : (
          r.reviewNote && <p className="hint">Feedback: {r.reviewNote}</p>
        )}
      </div>
    </Modal>
  );
}
