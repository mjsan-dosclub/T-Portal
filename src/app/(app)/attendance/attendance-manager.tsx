"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { Select } from "@/components/select";
import { EmptyState, SkeletonRows } from "@/components/states";
import { useToast } from "@/components/toast";

type Status = "PRESENT" | "ABSENT" | "EXCUSED" | null;
type Overview = { size: number; workshops: { n: number; title: string; held: string | null; present: number; absent: number; excused: number }[] };
type Sheet = { batch: { id: string; batchCode: string }; workshop: { n: number; title: string; roleText: string }; heldOn: string | null; students: { id: string; studentCode: string; fullName: string; institution: string; status: Status }[] };

const LABEL: Record<Exclude<Status, null>, string> = { PRESENT: "Present", ABSENT: "Absent", EXCUSED: "Excused" };

export function AttendanceManager({ batches, workshops, editable }: { batches: { id: string; code: string; students: number }[]; workshops: { n: number; title: string }[]; editable: boolean }) {
  const toast = useToast();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [workshopN, setWorkshopN] = useState(0);
  const [overview, setOverview] = useState<{ key: string; data: Overview } | null>(null);
  const [sheet, setSheet] = useState<{ key: string; data: Sheet } | null>(null);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [heldOn, setHeldOn] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const key = `${batchId}|${workshopN}|${reload}`;

  useEffect(() => {
    if (!batchId) return;
    let live = true;
    api<{ overview?: Overview; sheet?: Sheet }>(`/api/attendance?batch=${batchId}${workshopN ? `&workshop=${workshopN}` : ""}`).then((r) => {
      if (!live || !r.ok) return;
      if (r.data.overview) setOverview({ key, data: r.data.overview });
      if (r.data.sheet) {
        setSheet({ key, data: r.data.sheet });
        setMarks(Object.fromEntries(r.data.sheet.students.map((s) => [s.id, s.status])));
        setHeldOn(r.data.sheet.heldOn ?? new Date().toISOString().slice(0, 10));
      }
    });
    return () => {
      live = false;
    };
  }, [batchId, workshopN, key]);

  const loading = workshopN ? sheet?.key !== key : overview?.key !== key;
  const dirty = sheet ? sheet.data.students.some((s) => (marks[s.id] ?? null) !== s.status) || (sheet.data.heldOn ?? "") !== heldOn : false;
  const counts = sheet ? { PRESENT: 0, ABSENT: 0, EXCUSED: 0, none: 0, ...Object.values(marks).reduce<Record<string, number>>((a, v) => ({ ...a, [v ?? "none"]: (a[v ?? "none"] ?? 0) + 1 }), {}) } : null;

  async function save() {
    if (!sheet) return;
    setBusy(true);
    const r = await api<{ changed: number }>("/api/attendance", { method: "PUT", body: { batchId, workshopN, heldOn: heldOn || null, marks: sheet.data.students.map((s) => ({ studentId: s.id, status: marks[s.id] ?? null })) } });
    setBusy(false);
    toast({ message: r.ok ? `Saved · ${r.data.changed} change(s)` : r.error });
    if (r.ok) setReload((n) => n + 1);
  }

  if (!batches.length) return <EmptyState title="No active batches" body="Add a DOS Club batch in Masters first." />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1rem" }}>
      <section className="glass card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end", padding: "1rem 1.25rem" }}>
        <div className="field" style={{ flex: "1 1 12rem" }}>
          <label className="label" htmlFor="at-batch">DOS Club batch</label>
          <Select id="at-batch" growing value={batchId} onChange={(v) => { setBatchId(v); setWorkshopN(0); }} options={batches.map((b) => ({ value: b.id, label: `${b.code} (${b.students} students)` }))} />
        </div>
        <div className="field" style={{ flex: "2 1 18rem" }}>
          <label className="label" htmlFor="at-day">Workshop day</label>
          <Select id="at-day" value={String(workshopN)} onChange={(v) => setWorkshopN(Number(v))} options={[{ value: "0", label: `Overview of all ${workshops.length} days` }, ...workshops.map((w) => ({ value: String(w.n), label: `Day ${w.n}: ${w.title}` }))]} />
        </div>
      </section>

      {loading ? (
        <SkeletonRows rows={6} cols={4} />
      ) : !workshopN && overview ? (
        <section className="glass-strong card" aria-label="Overview">
          <p className="hint" style={{ marginBottom: "0.75rem" }}>{overview.data.size} students in this batch. Choose a day to mark attendance.</p>
          <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: "0.6rem" }} data-testid="attendance-overview">
            {overview.data.workshops.map((w) => {
              const pct = overview.data.size ? Math.round((w.present / overview.data.size) * 100) : 0;
              return (
                <li key={w.n}>
                  <button type="button" onClick={() => setWorkshopN(w.n)} style={{ width: "100%", textAlign: "left", padding: "0.7rem 0.85rem", borderRadius: "var(--r-lg)", border: "1px solid var(--hairline)", background: "var(--surface)", cursor: "pointer", color: "var(--text)" }} aria-label={`Day ${w.n}: ${w.title}. ${w.held ? `${w.present} present` : "not held yet"}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span className="chip tone-accent mono">Day {w.n}</span>
                      <span className="hint">{w.held ?? "not held"}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", margin: "0.35rem 0" }}>{w.title}</div>
                    {w.held ? (
                      <>
                        <div className="meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                        <div className="hint" style={{ marginTop: "0.25rem" }}>{w.present} present · {w.absent} absent · {w.excused} excused</div>
                      </>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : sheet ? (
        <section className="glass-strong card" aria-label="Attendance sheet" style={{ display: "grid", gap: "0.8rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "end", flexWrap: "wrap" }}>
            <div>
              <div className="display" style={{ fontWeight: 600, fontSize: "1.1rem" }}>Day {sheet.data.workshop.n}: {sheet.data.workshop.title}</div>
              <div className="hint">{sheet.data.workshop.roleText} · batch {sheet.data.batch.batchCode}</div>
            </div>
            <div className="field" style={{ marginLeft: "auto" }}>
              <label className="label" htmlFor="at-date">Session date</label>
              <input id="at-date" type="date" className="input" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} disabled={!editable} />
            </div>
            {editable && (
              <button type="button" className="btn btn-secondary" onClick={() => setMarks(Object.fromEntries(sheet.data.students.map((s) => [s.id, marks[s.id] === "EXCUSED" ? "EXCUSED" : "PRESENT"])))}>
                Mark all present
              </button>
            )}
          </div>
          {counts && <div className="hint" data-testid="attendance-counts">{counts.PRESENT} present · {counts.ABSENT} absent · {counts.EXCUSED} excused · {counts.none} not marked</div>}
          {sheet.data.students.length === 0 ? (
            <EmptyState title="No students in this batch" />
          ) : (
            <div className="table-wrap" style={{ maxHeight: "60vh" }}>
              <table className="dtable" data-testid="attendance-sheet">
                <thead><tr><th>Student</th><th>Code</th><th>Institution</th><th>Attendance</th></tr></thead>
                <tbody>
                  {sheet.data.students.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.fullName}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{s.studentCode}</td>
                      <td className="hint">{s.institution}</td>
                      <td>
                        <fieldset style={{ border: 0, padding: 0, display: "flex", gap: "0.25rem" }} disabled={!editable}>
                          <legend className="sr-only">Attendance for {s.fullName}</legend>
                          {(["PRESENT", "ABSENT", "EXCUSED"] as const).map((st) => (
                            <label key={st} className={`chip ${marks[s.id] === st ? (st === "PRESENT" ? "tone-primary" : st === "EXCUSED" ? "tone-accent" : "tone-deep") : "tone-muted"}`} style={{ cursor: editable ? "pointer" : "default" }}>
                              <input type="radio" className="sr-only" name={`att-${s.id}`} value={st} checked={marks[s.id] === st} onChange={() => setMarks({ ...marks, [s.id]: st })} />
                              {marks[s.id] === st ? "● " : ""}{LABEL[st]}
                            </label>
                          ))}
                        </fieldset>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editable && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", position: "sticky", bottom: "1rem" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setWorkshopN(0)}>Back to overview</button>
              <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save} data-testid="save-attendance">{busy ? "Saving…" : "Save attendance"}</button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
