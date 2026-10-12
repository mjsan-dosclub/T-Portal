"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, downloadGet } from "@/components/api";
import { ErrorState } from "@/components/states";
import { useToast } from "@/components/toast";
import type { MasterOptions } from "@/server/masters";

type Job = { id: string; fileName: string; status: "PREVIEW" | "IMPORTING" | "COMPLETED" | "FAILED"; total: number; valid: number; duplicates: number; errors: number; imported: number; updated: number; skipped: number; failed: number; failure: string | null };
type Row = { rowNo: number; raw: Record<string, string>; status: "VALID" | "DUPLICATE_FILE" | "DUPLICATE_DB" | "ERROR"; errors: Record<string, string>; decision: "skip" | "update" | null };
type Unknown = Partial<Record<string, { key: string; value: string }[]>>;
type Detail = { job: Job; unknownValues: Unknown; rows: Row[]; page: number; pageSize: number; filtered: number };
type Recent = { id: string; fileName: string; status: string; total: number; imported: number; createdAt: string };

const STEP_LABELS = ["Template", "Upload", "Preview & fix", "Import"];
const MASTER_FOR: Record<string, keyof MasterOptions> = { institution: "institutions", degree: "degrees", department: "departments", batch: "batches", colour_team: "colourTeams", status: "statuses" };
const MASTER_ROUTE: Record<string, string> = { institution: "institutions", degree: "degrees", department: "departments", batch: "batches", colour_team: "colour-teams", status: "statuses" };
const STATUS_LABEL: Record<Row["status"], string> = { VALID: "✓ Valid", DUPLICATE_FILE: "⚠ Duplicate in file", DUPLICATE_DB: "⚠ Already exists", ERROR: "✕ Error" };
const SHOW_COLS = ["full_name", "email", "phone", "institution", "degree", "department", "batch", "graduation_year", "status"];

export function UploadWizard({ options, initialJobId, recent }: { options: MasterOptions; initialJobId?: string; recent: Recent[] }) {
  const router = useRouter();
  const toast = useToast();
  const [jobId, setJobId] = useState<string | undefined>(initialJobId);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ message: string; expected?: string[] } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"" | Row["status"]>("");
  const [page, setPage] = useState(1);
  const [mapping, setMapping] = useState<Record<string, Record<string, string>>>({});
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!jobId) return;
    const qs = new URLSearchParams({ page: String(page), ...(tab ? { status: tab } : {}) });
    let live = true;
    api<Detail>(`/api/uploads/${jobId}?${qs}`).then((r) => {
      if (!live) return;
      if (!r.ok) return setLoadError(r.error);
      setLoadError(null);
      setDetail(r.data);
    });
    return () => {
      live = false;
    };
  }, [jobId, tab, page, refresh]);

  const step = !jobId ? 1 : detail?.job.status === "PREVIEW" ? 3 : 4;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setBusy("Reading and checking your file…");
    const form = new FormData();
    form.set("file", file);
    const r = await api<{ jobId: string; notes: string[] }>("/api/uploads", { form });
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) {
      setUploadError({ message: r.error, expected: (r.data as { expectedHeaders?: string[] }).expectedHeaders });
      return;
    }
    setNotes(r.data.notes ?? []);
    setTab("");
    setPage(1);
    setJobId(r.data.jobId);
    router.replace(`/students/upload?job=${r.data.jobId}`); // job id only: no PII (lets the admin resume, UPL-17)
  }

  async function applyMapping() {
    if (!jobId) return;
    const body: Record<string, Record<string, string | null>> = {};
    for (const [h, m] of Object.entries(mapping)) {
      body[h] = {};
      for (const [k, v] of Object.entries(m)) if (v) body[h][k] = v === "__reject" ? null : v;
    }
    setBusy("Re-checking rows with your mapping…");
    const r = await api(`/api/uploads/${jobId}/mapping`, { body: { mapping: body } });
    setBusy(null);
    if (!r.ok) return toast({ message: r.error });
    setMapping({});
    setRefresh((n) => n + 1);
  }

  async function decide(decision: "skip" | "update", rows: number[] | "all") {
    if (!jobId) return;
    const r = await api(`/api/uploads/${jobId}/decisions`, { body: { decision, rows } });
    if (!r.ok) return toast({ message: r.error });
    setRefresh((n) => n + 1);
  }

  async function runImport() {
    if (!jobId) return;
    setBusy("Importing…");
    const poll = setInterval(() => setRefresh((n) => n + 1), 1000);
    const r = await api<{ imported: number; updated: number; skipped: number; total: number }>(`/api/uploads/${jobId}/import`, { body: {} });
    clearInterval(poll);
    setBusy(null);
    if (r.ok) setResult(r.data);
    else toast({ message: r.error });
    setRefresh((n) => n + 1);
  }

  function reset() {
    setJobId(undefined);
    setDetail(null);
    setResult(null);
    setNotes([]);
    setUploadError(null);
    router.replace("/students/upload");
  }

  const job = detail?.job;
  const unknownEntries = Object.entries(detail?.unknownValues ?? {}).filter(([, v]) => v && v.length);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.25rem" }}>
      <ol className="glass card" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", listStyle: "none", padding: "0.85rem 1rem" }} aria-label="Upload steps">
        {STEP_LABELS.map((l, i) => (
          <li key={l} aria-current={step === i + 1 ? "step" : undefined} className={`chip ${step === i + 1 ? "tone-accent" : step > i + 1 ? "tone-primary" : "tone-muted"}`} style={{ padding: "0.35rem 0.85rem", fontSize: "0.85rem" }}>
            {step > i + 1 ? "✓" : i + 1}. {l}
          </li>
        ))}
      </ol>

      {busy && (
        <div className="banner banner-row" role="status" aria-live="polite" data-testid="upload-progress">
          <span className="skeleton" style={{ width: "1rem", height: "1rem", borderRadius: "50%" }} /> {busy}
          {job?.status === "IMPORTING" && <span className="mono">{job.imported + job.updated} done</span>}
        </div>
      )}

      {!jobId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.25rem" }}>
          <section className="glass card" aria-labelledby="s1">
            <h2 id="s1" style={{ fontSize: "1.1rem", fontWeight: 600 }}>1. Download the template</h2>
            <p className="hint" style={{ fontSize: "0.9rem", margin: "0.4rem 0 1rem" }}>
              Keep the header row exactly as it is. Row 2 is an example and is ignored. Institution, degree, department and batch must match values in Masters (department aliases like &ldquo;CSE&rdquo; work too).
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={() => downloadGet("/api/uploads/template?format=xlsx", "dos-students-template.xlsx")}>Excel template (.xlsx)</button>
              <button type="button" className="btn btn-secondary" onClick={() => downloadGet("/api/uploads/template?format=csv", "dos-students-template.csv")}>CSV template</button>
            </div>
          </section>
          <section className="glass card" aria-labelledby="s2">
            <h2 id="s2" style={{ fontSize: "1.1rem", fontWeight: 600 }}>2. Upload your file</h2>
            <label
              htmlFor="upload-file"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void onFile(e.dataTransfer.files[0]);
              }}
              style={{ display: "grid", placeItems: "center", gap: "0.35rem", marginTop: "0.75rem", padding: "2rem 1rem", border: "2px dashed var(--stroke)", borderRadius: "var(--r-xl)", background: "var(--glass-strong)", cursor: "pointer", textAlign: "center" }}
            >
              <span className="display" style={{ fontWeight: 600 }}>Drop a file here or choose one</span>
              <span className="hint">.xlsx or .csv · max 4 MB · max 10,000 rows</span>
            </label>
            <input id="upload-file" ref={fileRef} type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} disabled={!!busy} data-testid="upload-input" />
            {uploadError && (
              <div className="banner" role="alert" style={{ marginTop: "1rem", background: "var(--danger-wash)", display: "block" }} data-testid="upload-error">
                <strong>⚠ {uploadError.message}</strong>
                {uploadError.expected && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                    Expected headers: <span className="mono">{uploadError.expected.join(", ")}</span>
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {jobId && loadError && <ErrorState message={loadError} onRetry={reset} />}

      {job && (
        <>
          {notes.map((n) => (
            <div key={n} className="banner">ℹ {n}</div>
          ))}
          <section className="glass card" style={{ display: "grid", gap: "1rem" }} aria-label="Upload summary">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{job.fileName}</h2>
                <p className="hint">{job.status === "PREVIEW" ? "3. Review the rows below, fix mappings, then import." : job.status === "COMPLETED" ? "4. Import complete." : job.status === "FAILED" ? "4. Import failed." : "4. Importing…"}</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(job.errors > 0 || job.duplicates > 0) && (
                  <button type="button" className="btn btn-secondary" onClick={() => downloadGet(`/api/uploads/${job.id}/errors`, "upload-errors.csv")} data-testid="download-errors">
                    Download error report
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={reset}>Upload another file</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" }} data-testid="upload-counts">
              <Count label="Rows" value={job.total} />
              <Count label="Valid" value={job.valid} testId="count-valid" />
              <Count label="Duplicates" value={job.duplicates} testId="count-duplicates" />
              <Count label="Errors" value={job.errors} testId="count-errors" />
              {job.status !== "PREVIEW" && (
                <>
                  <Count label="Imported" value={job.imported} testId="count-imported" />
                  <Count label="Updated" value={job.updated} />
                  <Count label="Skipped" value={job.skipped} />
                </>
              )}
            </div>
            {job.failure && <div className="banner" role="alert">⚠ {job.failure}</div>}
            {result && (
              <div className="banner" role="status" data-testid="import-result">
                ✓ Imported {result.imported}, updated {result.updated}, skipped {result.skipped} of {result.total} rows. <Link href="/students">View students →</Link>
              </div>
            )}
          </section>

          {job.status === "PREVIEW" && unknownEntries.length > 0 && (
            <section className="glass-strong card" aria-labelledby="map-h" data-testid="mapping-step">
              <h2 id="map-h" style={{ fontSize: "1.05rem", fontWeight: 600 }}>Map unknown values</h2>
              <p className="hint" style={{ fontSize: "0.88rem", margin: "0.3rem 0 1rem" }}>
                These values don&apos;t match anything in Masters. Choose the right value, or reject (those rows stay as errors). To add a brand-new value, add it in Masters first, then re-check.
              </p>
              <div style={{ display: "grid", gap: "1rem" }}>
                {unknownEntries.map(([header, vals]) => (
                  <div key={header}>
                    <div className="label" style={{ marginBottom: "0.4rem" }}>
                      {header.replace("_", " ")} <Link className="hint" href={`/masters/${MASTER_ROUTE[header]}`} target="_blank">open Masters ↗</Link>
                    </div>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      {vals!.map((v) => (
                        <div key={v.key} style={{ display: "grid", gridTemplateColumns: "minmax(8rem, 1fr) auto minmax(12rem, 1.4fr)", gap: "0.75rem", alignItems: "center" }}>
                          <span className="chip tone-deep" style={{ justifySelf: "start" }}>&ldquo;{v.value}&rdquo;</span>
                          <span aria-hidden="true">→</span>
                          <select
                            className="select"
                            aria-label={`Map ${header} "${v.value}"`}
                            value={mapping[header]?.[v.key] ?? ""}
                            onChange={(e) => setMapping((m) => ({ ...m, [header]: { ...(m[header] ?? {}), [v.key]: e.target.value } }))}
                          >
                            <option value="">Choose…</option>
                            {options[MASTER_FOR[header]!].filter((o) => o.isActive).map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                            <option value="__reject">Reject (leave as error)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={applyMapping} disabled={!!busy || !Object.values(mapping).some((m) => Object.values(m).some(Boolean))}>
                Apply mapping & re-check
              </button>
            </section>
          )}

          <section className="glass-strong" style={{ padding: "0.75rem" }} aria-label="Rows">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", padding: "0.25rem 0.25rem 0.75rem" }}>
              <div className="tabs" role="tablist" aria-label="Filter rows">
                {([["", "All"], ["VALID", "Valid"], ["DUPLICATE_DB", "Already exist"], ["DUPLICATE_FILE", "Duplicate in file"], ["ERROR", "Errors"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} style={{ background: "none", cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
              {job.status === "PREVIEW" && job.duplicates > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="hint">Existing students:</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide("skip", "all")}>Skip all</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide("update", "all")}>Update all</button>
                </div>
              )}
            </div>
            <div className="table-wrap" style={{ maxHeight: "60vh" }}>
              <table className="dtable" data-testid="preview-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Result</th>
                    {SHOW_COLS.map((c) => (
                      <th key={c}>{c.replace(/_/g, " ")}</th>
                    ))}
                    <th>Problems</th>
                  </tr>
                </thead>
                <tbody>
                  {detail?.rows.map((r) => (
                    <tr key={r.rowNo} data-status={r.status}>
                      <td className="mono">{r.rowNo}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className={`chip ${r.status === "VALID" ? "tone-primary" : r.status === "ERROR" ? "tone-deep" : "tone-accent"}`}>{STATUS_LABEL[r.status]}</span>
                        {r.status === "DUPLICATE_DB" && job.status === "PREVIEW" && (
                          <select className="select" aria-label={`Decision for row ${r.rowNo}`} style={{ minHeight: "1.9rem", padding: "0.1rem 0.4rem", marginTop: "0.3rem", fontSize: "0.8rem" }} value={r.decision ?? "skip"} onChange={(e) => decide(e.target.value as "skip" | "update", [r.rowNo])}>
                            <option value="skip">Skip</option>
                            <option value="update">Update existing</option>
                          </select>
                        )}
                      </td>
                      {SHOW_COLS.map((c) => (
                        <td key={c} style={r.errors[c] ? { background: "var(--danger-wash)", fontWeight: 600 } : undefined} title={r.errors[c]}>
                          {r.raw[c] || <span className="hint">—</span>}
                        </td>
                      ))}
                      <td style={{ minWidth: "16rem", fontSize: "0.82rem" }}>
                        {Object.entries(r.errors).map(([k, v]) => (
                          <div key={k}>
                            {k !== "_row" && <strong>{k.replace(/_/g, " ")}: </strong>}
                            {v}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail && detail.filtered > detail.pageSize && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", padding: "0.75rem 0.25rem 0" }}>
                <span className="hint" style={{ alignSelf: "center" }}>Page {detail.page} of {Math.ceil(detail.filtered / detail.pageSize)}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={page >= Math.ceil(detail.filtered / detail.pageSize)} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </section>

          {job.status === "PREVIEW" && (
            <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", position: "sticky", bottom: "1rem", zIndex: 5, background: "var(--surface)", borderRadius: "var(--r-2xl)", boxShadow: "var(--shadow-pop)" }}>
              <span>
                <strong>{job.valid.toLocaleString("en-IN")}</strong> new students will be imported, plus any existing students you marked &ldquo;Update&rdquo;. Rows with errors are skipped and listed in the error report.
              </span>
              <button type="button" className="btn btn-primary" onClick={runImport} disabled={!!busy || job.valid + job.duplicates === 0} data-testid="confirm-import">
                Import now
              </button>
            </div>
          )}
        </>
      )}

      {!jobId && recent.length > 0 && (
        <section className="glass card" aria-labelledby="recent-h">
          <h2 id="recent-h" style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>Your recent uploads</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
            {recent.map((u) => (
              <li key={u.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.9rem" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setJobId(u.id); router.replace(`/students/upload?job=${u.id}`); }}>
                  {u.fileName}
                </button>
                <span className="hint">
                  {u.status === "PREVIEW" ? "waiting for review" : u.status.toLowerCase()} · {u.imported}/{u.total} · {new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Count({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <div style={{ padding: "0.75rem 1rem", background: "var(--glass-strong)", borderRadius: "var(--r-xl)" }}>
      <div className="hint">{label}</div>
      <div className="stat-num" style={{ fontSize: "1.6rem" }} data-testid={testId}>{value.toLocaleString("en-IN")}</div>
    </div>
  );
}
