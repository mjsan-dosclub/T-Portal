"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api, downloadGet } from "@/components/api";
import { EmptyState } from "@/components/states";
import { useToast } from "@/components/toast";
import { AttendanceMeter, WEEK_STATE, WeekChip, WeekLegend } from "@/components/internship/week-grid";
import { MODE_LABEL } from "@/lib/validation/internship";
import type { StudentProgram } from "@/server/internships";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function MyInternships({ programs, accept, maxMb }: { programs: StudentProgram[]; accept: string; maxMb: number }) {
  if (programs.length === 0)
    return <EmptyState title="No internship assigned yet" body="When the DOS Club team assigns you to an international internship, it appears here with its details and weekly report upload." />;
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {programs.map((p) => (
        <Program key={p.assignmentId} p={p} accept={accept} maxMb={maxMb} />
      ))}
    </div>
  );
}

function Program({ p, accept, maxMb }: { p: StudentProgram; accept: string; maxMb: number }) {
  const g = p.program;
  const [week, setWeek] = useState<number | null>(null);
  return (
    <article className="glass card" style={{ display: "grid", gap: "1rem" }} aria-labelledby={`ip-${p.assignmentId}`} data-testid="my-program">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <span className="chip mono">{g.code}</span>
          <h2 id={`ip-${p.assignmentId}`} className="display" style={{ fontSize: "1.3rem", fontWeight: 600, marginTop: "0.35rem" }}>{g.title}</h2>
          <div className="hint">{g.companyName} · {[g.city, g.country].filter(Boolean).join(", ")} · {MODE_LABEL[g.workMode as keyof typeof MODE_LABEL]}</div>
          <div className="hint">
            {g.durationValue} {g.durationUnit === "WEEKS" ? "week(s)" : "day(s)"} · {g.weeks} weekly report(s){g.startDate ? ` · ${g.startDate} → ${g.endDate}` : " · start date to be announced"}
          </div>
        </div>
        <AttendanceMeter pct={p.grid.pct} attended={p.grid.attended} elapsed={p.grid.elapsed} weeks={g.weeks} />
      </div>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>About this internship</summary>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginTop: "0.5rem" }}>{g.description}</p>
      </details>

      <section aria-label="Weekly reports" style={{ display: "grid", gap: "0.6rem" }}>
        <h3 style={{ fontWeight: 600 }}>Weekly work reports</h3>
        <WeekLegend />
        {!g.startDate && <div className="banner" style={{ background: "var(--accent-wash)" }}>Uploads open once your coordinator sets the start date.</div>}
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {p.grid.cells.map((c) => {
            const r = p.reports.find((x) => x.weekNo === c.weekNo);
            const open = p.openWeeks.includes(c.weekNo);
            const canUpload = open && r?.status !== "ACCEPTED";
            return (
              <li key={c.weekNo} className="glass-strong" style={{ padding: "0.7rem 0.9rem", borderRadius: "var(--r-xl)", display: "grid", gap: "0.5rem" }} data-testid={`my-week-${c.weekNo}`}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                  <WeekChip cell={c} />
                  <span className="hint">{WEEK_STATE[c.state].label}{c.due ? ` · due ${c.due}` : ""}</span>
                  {r && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await downloadGet(`/api/student/me/internship-reports/${r.id}`, r.fileName);
                      }}
                    >
                      {r.fileName} ({kb(r.sizeBytes)})
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  {canUpload && week !== c.weekNo && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeek(c.weekNo)}>
                      {r ? "Replace report" : "Upload report"}
                    </button>
                  )}
                </div>
                {r?.reviewNote && (
                  <div className="banner" style={{ background: r.status === "NEEDS_REVISION" ? "var(--danger-wash)" : "var(--primary-wash)" }} data-testid="review-feedback">
                    <strong>Coordinator feedback:</strong> {r.reviewNote}
                  </div>
                )}
                {week === c.weekNo && <UploadForm assignmentId={p.assignmentId} weekNo={c.weekNo} accept={accept} maxMb={maxMb} onClose={() => setWeek(null)} />}
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}

function UploadForm({ assignmentId, weekNo, accept, maxMb, onClose }: { assignmentId: string; weekNo: number; accept: string; maxMb: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setErr("Choose a file to upload");
    if (file.size > maxMb * 1024 * 1024) return setErr(`Report must be ${maxMb} MB or smaller`);
    const form = new FormData();
    form.set("weekNo", String(weekNo));
    form.set("note", note);
    form.set("file", file);
    setBusy(true);
    const r = await api<{ late: boolean }>(`/api/student/me/internships/${assignmentId}/reports`, { form });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast({ message: `Week ${weekNo} report submitted${r.data.late ? " (after the due date)" : ""}` });
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.6rem" }} aria-label={`Upload week ${weekNo} report`}>
      {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
      <div className="field">
        <label className="label" htmlFor={`rf-${weekNo}`}>Week {weekNo} report file</label>
        <input id={`rf-${weekNo}`} ref={fileRef} type="file" className="input" accept={accept} />
        <span className="hint">PDF, Word, Excel, PowerPoint, CSV, TXT, RTF or OpenDocument · up to {maxMb} MB · no ZIP / compressed files.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor={`rn-${weekNo}`}>Note for your coordinator (optional)</label>
        <textarea id={`rn-${weekNo}`} className="textarea" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Submit report"}</button>
      </div>
    </form>
  );
}
