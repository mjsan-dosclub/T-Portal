"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, downloadPost } from "@/components/api";
import { Drawer, Modal } from "@/components/modal";
import { Select } from "@/components/select";
import { EmptyState, ErrorState, SkeletonRows, StatusChip } from "@/components/states";
import { useToast } from "@/components/toast";
import type { MasterOptions } from "@/server/masters";
import type { StudentDetail, StudentRow } from "@/server/students";

type Query = {
  page: number;
  pageSize: 25 | 50 | 100;
  sort: string;
  dir: "asc" | "desc";
  q: string;
  institutionId: string;
  departmentId: string;
  degreeId: string;
  batchId: string;
  colourTeamId: string;
  statusId: string;
  graduationYear: string;
};

const COLUMNS: { key: keyof StudentRow; label: string; sort?: string; always?: boolean }[] = [
  { key: "studentCode", label: "Code", sort: "studentCode", always: true },
  { key: "fullName", label: "Name", sort: "fullName", always: true },
  { key: "email", label: "Email", sort: "email" },
  { key: "phone", label: "Phone", sort: "phone" },
  { key: "institution", label: "Institution", sort: "institution" },
  { key: "department", label: "Department", sort: "department" },
  { key: "degree", label: "Degree", sort: "degree" },
  { key: "batch", label: "Batch", sort: "batch" },
  { key: "graduationYear", label: "Grad. year", sort: "graduationYear" },
  { key: "status", label: "Status", sort: "status" },
  { key: "colourTeam", label: "Team", sort: "colourTeam" },
];

const EMPTY_QUERY: Query = { page: 1, pageSize: 25, sort: "createdAt", dir: "desc", q: "", institutionId: "", departmentId: "", degreeId: "", batchId: "", colourTeamId: "", statusId: "", graduationYear: "" };
const STORAGE_KEY = "dos.students.query";

function toApi(q: Query, deleted: boolean) {
  const arr = (v: string) => (v ? [v] : undefined);
  return {
    page: q.page,
    pageSize: q.pageSize,
    sort: q.sort,
    dir: q.dir,
    q: q.q.trim() || undefined,
    institutionId: arr(q.institutionId),
    departmentId: arr(q.departmentId),
    degreeId: arr(q.degreeId),
    batchId: arr(q.batchId),
    colourTeamId: arr(q.colourTeamId),
    statusId: arr(q.statusId),
    graduationYear: q.graduationYear ? [Number(q.graduationYear)] : undefined,
    deleted,
  };
}
function filterOnly(q: Query, deleted: boolean) {
  const a = toApi(q, deleted);
  return { q: a.q, institutionId: a.institutionId, departmentId: a.departmentId, degreeId: a.degreeId, batchId: a.batchId, colourTeamId: a.colourTeamId, statusId: a.statusId, graduationYear: a.graduationYear, deleted };
}

type Props = {
  options: MasterOptions;
  role: "SUPER_ADMIN" | "ADMIN" | "VIEWER";
  canExport: boolean;
  initialHidden: string[];
  initialPageSize?: number;
  mode?: "live" | "recycle";
  invitationText?: string;
};

export function StudentsTable({ options, role, canExport, initialHidden, initialPageSize, mode = "live", invitationText }: Props) {
  const toast = useToast();
  const recycle = mode === "recycle";
  const editor = role !== "VIEWER" && !recycle;
  const selectable = editor || (recycle && role === "SUPER_ADMIN");
  // Filters persist in sessionStorage, never the URL (STU-19). This component is client-only (see students-table-client.tsx).
  const [query, setQuery] = useState<Query>(() => {
    const base = { ...EMPTY_QUERY, pageSize: (initialPageSize as Query["pageSize"]) ?? 25 };
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY + mode);
      return saved ? { ...base, ...(JSON.parse(saved) as Partial<Query>) } : base;
    } catch {
      return base;
    }
  });
  const [searchText, setSearchText] = useState(query.q);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: { rows: StudentRow[]; total: number }; error?: string } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  // Selection belongs to one result set; when the query changes it no longer applies (P12).
  const [sel, setSel] = useState<{ key: string; ids: Set<string>; all: boolean }>({ key: "", ids: new Set(), all: false });
  const [preview, setPreview] = useState<{ id: string; data?: StudentDetail; error?: string } | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<null | { ids?: string[] }>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const previewReturnFocus = useRef<HTMLElement | null>(null);

  const queryKey = JSON.stringify(toApi(query, recycle));
  const fetchKey = `${queryKey}#${reloadToken}`;
  const load = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY + mode, JSON.stringify(query));
    } catch {
      /* storage unavailable: filters just won't persist */
    }
  }, [query, mode]);

  // Debounced search: resets to page 1.
  useEffect(() => {
    const t = setTimeout(() => setQuery((q) => (q.q === searchText ? q : { ...q, q: searchText, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    let live = true;
    api<{ rows: StudentRow[]; total: number }>("/api/students/query", { body: JSON.parse(queryKey) }).then((r) => {
      if (!live) return;
      setResult(r.ok ? { key: fetchKey, data: r.data } : { key: fetchKey, error: r.error });
    });
    return () => {
      live = false;
    };
  }, [queryKey, fetchKey]);

  const loading = result?.key !== fetchKey;
  const data = result?.data ?? null;
  const error = !loading ? (result?.error ?? null) : null;
  const selected = useMemo(() => (sel.key === queryKey ? sel.ids : new Set<string>()), [sel, queryKey]);
  const allMatching = sel.key === queryKey && sel.all;
  const setSelected = (fn: (s: Set<string>) => Set<string>) => setSel((cur) => ({ key: queryKey, ids: fn(cur.key === queryKey ? cur.ids : new Set()), all: false }));
  const setAllMatching = (all: boolean) => setSel((cur) => ({ key: queryKey, ids: cur.key === queryKey ? cur.ids : new Set(), all }));
  const clearSelection = () => setSel({ key: "", ids: new Set(), all: false });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageIds = rows.map((r) => r.id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectionCount = allMatching ? total : selected.size;
  const selection = useMemo(
    () => (allMatching ? { mode: "filter" as const, filter: filterOnly(query, recycle), expectedCount: total } : { mode: "ids" as const, ids: [...selected] }),
    [allMatching, query, recycle, total, selected],
  );
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  const visibleCols = COLUMNS.filter((c) => c.always || !hidden.has(c.key));

  function setFilter<K extends keyof Query>(k: K, v: Query[K]) {
    setQuery((q) => ({ ...q, [k]: v, page: k === "page" ? (v as number) : 1 }));
  }
  function toggleSort(sort: string) {
    setQuery((q) => ({ ...q, sort, dir: q.sort === sort && q.dir === "asc" ? "desc" : "asc", page: 1 }));
  }
  function togglePage() {
    setSelected((s) => {
      const n = new Set(s);
      if (pageAllSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }
  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  async function saveHidden(next: Set<string>) {
    setHidden(next);
    await api("/api/me/table-prefs", { method: "PUT", body: { hiddenColumns: [...next], pageSize: query.pageSize } });
  }
  async function openPreview(id: string, el: HTMLElement) {
    previewReturnFocus.current = el;
    setPreview({ id });
    const r = await api<StudentDetail>(`/api/students/${id}`);
    setPreview(r.ok ? { id, data: r.data } : { id, error: r.error });
  }

  async function undo(ids: string[], deletedAt: string) {
    const r = await api<{ restored: number }>("/api/students/bulk/undo", { body: { ids, deletedAt } });
    toast({ message: r.ok ? `Restored ${r.data.restored} student(s)` : r.error });
    void load();
  }

  const anyFilter = !!(query.q || query.institutionId || query.departmentId || query.degreeId || query.batchId || query.colourTeamId || query.statusId || query.graduationYear);
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => y - 5 + i);
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1rem" }}>
      {/* Filters */}
      <section className="glass card" style={{ padding: "1rem 1.25rem", display: "grid", gap: "0.85rem" }} aria-label="Search and filters">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <label htmlFor="student-search" className="sr-only">Search students</label>
          <input id="student-search" className="input" style={{ flex: "1 1 18rem", borderRadius: "var(--r-pill)" }} placeholder="Search name, email, phone or student code" value={searchText} onChange={(e) => setSearchText(e.target.value)} autoComplete="off" />
          <div style={{ position: "relative" }}>
            <button type="button" className="btn btn-secondary" aria-expanded={colsOpen} aria-controls="col-menu" onClick={() => setColsOpen((o) => !o)}>
              Columns
            </button>
            {colsOpen && (
              <fieldset id="col-menu" className="glass-strong" style={{ position: "absolute", right: 0, top: "calc(100% + 0.4rem)", zIndex: 30, padding: "0.75rem 1rem", minWidth: "13rem", display: "grid", gap: "0.45rem", border: 0 }}>
                <legend className="label" style={{ paddingTop: "0.5rem" }}>Show columns</legend>
                {COLUMNS.filter((c) => !c.always).map((c) => (
                  <label key={c.key} style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.88rem" }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={!hidden.has(c.key)}
                      onChange={() => {
                        const n = new Set(hidden);
                        if (n.has(c.key)) n.delete(c.key);
                        else n.add(c.key);
                        void saveHidden(n);
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </fieldset>
            )}
          </div>
          {editor && invitationText && (
            <button type="button" className="btn btn-secondary" onClick={() => setMessageOpen(true)}>
              Invitation message
            </button>
          )}
          {canExport && !recycle && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!total}
              onClick={async () => {
                const err = await downloadPost("/api/students/export", { filter: filterOnly(query, false) }, "students.csv");
                toast({ message: err ?? `Exported ${total} students` });
              }}
            >
              Export {anyFilter ? "filtered" : "all"}
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10.5rem, 1fr))", gap: "0.6rem" }}>
          <FilterSelect id="f-inst" label="Institution" value={query.institutionId} onChange={(v) => setFilter("institutionId", v)} options={options.institutions} />
          <FilterSelect id="f-dept" label="Department" value={query.departmentId} onChange={(v) => setFilter("departmentId", v)} options={options.departments} />
          <FilterSelect id="f-deg" label="Degree" value={query.degreeId} onChange={(v) => setFilter("degreeId", v)} options={options.degrees} />
          <FilterSelect id="f-batch" label="Batch" value={query.batchId} onChange={(v) => setFilter("batchId", v)} options={options.batches} />
          <FilterSelect id="f-team" label="Team" value={query.colourTeamId} onChange={(v) => setFilter("colourTeamId", v)} options={options.colourTeams} />
          <FilterSelect id="f-status" label="Status" value={query.statusId} onChange={(v) => setFilter("statusId", v)} options={options.statuses} />
          <FilterSelect id="f-year" label="Grad. year" value={query.graduationYear} onChange={(v) => setFilter("graduationYear", v)} options={years.map((y) => ({ id: String(y), label: String(y), isActive: true }))} growing={false} />
        </div>
        {anyFilter && (
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchText("");
                setQuery((q) => ({ ...EMPTY_QUERY, pageSize: q.pageSize, sort: q.sort, dir: q.dir }));
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* Select-all banner (P12) */}
      {selectable && pageAllSelected && total > rows.length && (
        <div className="banner banner-row" role="status" data-testid="select-all-banner">
          {allMatching ? (
            <>
              <span>
                All <strong>{total.toLocaleString("en-IN")}</strong> students matching this filter are selected.
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection}>
                Clear selection
              </button>
            </>
          ) : (
            <>
              <span>
                All <strong>{rows.length}</strong> students on this page are selected.
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllMatching(true)}>
                Select all {total.toLocaleString("en-IN")} matching
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data && loading ? (
        <SkeletonRows rows={8} cols={7} />
      ) : total === 0 ? (
        <EmptyState
          title={recycle ? "Recycle Bin is empty" : anyFilter ? "No students match these filters" : "No students yet"}
          body={recycle ? "Deleted students appear here and can be restored." : anyFilter ? "Try removing a filter or searching for something else." : "Add students one by one or upload a spreadsheet."}
          action={
            !recycle && editor && !anyFilter ? (
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                <Link className="btn btn-primary" href="/students/new">Add student</Link>
                <Link className="btn btn-secondary" href="/students/upload">Upload file</Link>
              </div>
            ) : undefined
          }
        />
      ) : (
        <section className="glass-strong" style={{ padding: "0.5rem" }} aria-label="Students" aria-busy={loading}>
          <div className="table-wrap" style={{ maxHeight: "68vh" }}>
            <table className="dtable" data-testid="students-table">
              <thead>
                <tr>
                  {selectable && (
                    <th style={{ width: "2.5rem" }}>
                      <input type="checkbox" className="checkbox" aria-label="Select all on this page" checked={pageAllSelected} onChange={togglePage} data-testid="select-page" />
                    </th>
                  )}
                  {visibleCols.map((c) => (
                    <th key={c.key} aria-sort={query.sort === c.sort ? (query.dir === "asc" ? "ascending" : "descending") : "none"}>
                      {c.sort ? (
                        <button type="button" className="sort-btn" onClick={() => toggleSort(c.sort!)}>
                          {c.label}
                          <span aria-hidden="true" style={{ opacity: query.sort === c.sort ? 1 : 0.3 }}>{query.sort === c.sort && query.dir === "desc" ? "▼" : "▲"}</span>
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                  {recycle && <th>Deleted</th>}
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} aria-selected={allMatching || selected.has(r.id)} data-testid="student-row">
                    {selectable && (
                      <td>
                        <input type="checkbox" className="checkbox" aria-label={`Select ${r.fullName}`} checked={allMatching || selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                      </td>
                    )}
                    {visibleCols.map((c) => (
                      <td key={c.key} className={c.key === "studentCode" || c.key === "phone" ? "mono" : undefined} style={c.key === "fullName" ? { fontWeight: 600, minWidth: "9rem" } : c.key === "studentCode" || c.key === "phone" || c.key === "graduationYear" ? { whiteSpace: "nowrap" } : undefined}>
                        {c.key === "status" ? <StatusChip name={r.status} color={r.statusColor} /> : (r[c.key] as string | number | null) ?? <span className="hint">—</span>}
                      </td>
                    ))}
                    {recycle && <td className="hint">{r.deletedAt ? new Date(r.deletedAt).toLocaleDateString("en-IN") : ""}</td>}
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => openPreview(r.id, e.currentTarget)} aria-label={`Preview ${r.fullName}`}>
                        Preview
                      </button>
                      {editor && (
                        <>
                          <Link className="btn btn-ghost btn-sm" href={`/students/${r.id}/edit`} aria-label={`Edit ${r.fullName}`}>
                            Edit
                          </Link>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteOpen({ ids: [r.id] })} aria-label={`Delete ${r.fullName}`}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", padding: "0.75rem 0.5rem 0.25rem" }}>
            <div className="hint" data-testid="result-count" aria-live="polite">
              {total.toLocaleString("en-IN")} student{total === 1 ? "" : "s"} · page {query.page} of {pages}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <label htmlFor="page-size" className="hint">Rows</label>
              <select
                id="page-size"
                className="select"
                style={{ width: "5.5rem", minHeight: "2.2rem" }}
                value={query.pageSize}
                onChange={(e) => {
                  const ps = Number(e.target.value) as Query["pageSize"];
                  setQuery((q) => ({ ...q, pageSize: ps, page: 1 }));
                  void api("/api/me/table-prefs", { method: "PUT", body: { hiddenColumns: [...hidden], pageSize: ps } });
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button type="button" className="btn btn-secondary btn-sm" disabled={query.page <= 1} onClick={() => setFilter("page", query.page - 1)}>
                Previous
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={query.page >= pages} onClick={() => setFilter("page", query.page + 1)}>
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bulk bar */}
      {selectable && selectionCount > 0 && (
        <div className="bulkbar" role="region" aria-label="Bulk actions" data-testid="bulk-bar">
          <strong style={{ marginRight: "0.5rem" }}>{selectionCount.toLocaleString("en-IN")} selected</strong>
          {recycle ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const r = await api<{ restored: number }>("/api/students/restore", { body: { selection } });
                  toast({ message: r.ok ? `Restored ${r.data.restored} student(s)` : r.error });
                  void load();
                }}
              >
                Restore
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPurgeOpen(true)}>
                Purge permanently…
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatusOpen(true)}>
                Update status
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteOpen({})}>
                Delete
              </button>

              {canExport && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    const err = await downloadPost("/api/students/export", { selection }, "students.csv");
                    toast({ message: err ?? `Exported ${selectionCount} students` });
                  }}
                >
                  Export selected
                </button>
              )}
            </>
          )}
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--surface)" }} onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}

      {/* Preview drawer (STU-13): read-only; editing needs an explicit Edit click */}
      <Drawer
        open={!!preview}
        returnFocusTo={previewReturnFocus}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
        title={preview?.data ? preview.data.fullName : "Student"}
      >
        {preview?.error ? (
          <ErrorState message={preview.error} />
        ) : !preview?.data ? (
          <div className="skeleton" style={{ height: "12rem" }} />
        ) : (
          <StudentPreview s={preview.data} canEditIt={editor} role={role} />
        )}
      </Drawer>

      {statusOpen && <StatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        count={selectionCount}
        statuses={options.statuses.filter((s) => s.isActive)}
        onConfirm={async (statusId, reason) => {
          const r = await api<{ updated: number; skipped: number }>("/api/students/bulk/status", { body: { selection, statusId, reason: reason || undefined } });
          if (!r.ok) return r.error;
          toast({ message: `Updated status for ${r.data.updated} student(s)${r.data.skipped ? ` · ${r.data.skipped} skipped` : ""}` });
          setStatusOpen(false);
          clearSelection();
          void load();
          return null;
        }}
      />}

      {!!deleteOpen && <DeleteDialog
        open={!!deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(null)}
        count={deleteOpen?.ids ? deleteOpen.ids.length : selectionCount}
        onConfirm={async (confirmText) => {
          const sel = deleteOpen?.ids ? { mode: "ids" as const, ids: deleteOpen.ids } : selection;
          const r = await api<{ deleted: number; undo: { ids: string[]; deletedAt: string } }>("/api/students/bulk/delete", { body: { selection: sel, confirmText } });
          if (!r.ok) return r.error;
          setDeleteOpen(null);
          clearSelection();
          toast({ message: `Deleted ${r.data.deleted} student(s)`, action: { label: "Undo", onClick: () => undo(r.data.undo.ids, r.data.undo.deletedAt) }, durationMs: 10_000 });
          void load();
          return null;
        }}
      />}

      {messageOpen && invitationText && (
        <Modal open onOpenChange={(o) => !o && setMessageOpen(false)} title="Invitation message" description="Paste this into WhatsApp groups or announcements. It contains no personal data.">
          <textarea className="textarea mono" readOnly value={invitationText} style={{ minHeight: "14rem", fontSize: "0.85rem" }} aria-label="Invitation message" data-testid="invitation-text" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-primary" onClick={async () => { await navigator.clipboard?.writeText(invitationText); toast({ message: "Copied" }); }}>Copy message</button>
          </div>
        </Modal>
      )}

      {purgeOpen && <PurgeDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        count={selectionCount}
        onConfirm={async (confirmText) => {
          const r = await api<{ purged: number; notYetEligible: number }>("/api/students/purge", { body: { selection, confirmText } });
          if (!r.ok) return r.error;
          setPurgeOpen(false);
          toast({ message: `Purged ${r.data.purged}. ${r.data.notYetEligible ? `${r.data.notYetEligible} not yet eligible (deleted < 30 days ago).` : ""}` });
          void load();
          return null;
        }}
      />}
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, options, growing = true }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string; isActive: boolean }[]; growing?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id} className="hint" style={{ fontWeight: 600 }}>{label}</label>
      <Select id={id} growing={growing} value={value} onChange={onChange} placeholder="All" style={{ minHeight: "2.3rem", padding: "0.3rem 2.2rem 0.3rem 0.6rem" }} options={options.map((o) => ({ value: o.id, label: o.label + (o.isActive ? "" : " (inactive)") }))} />
    </div>
  );
}

const GENDER: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other", PREFER_NOT_TO_SAY: "Prefer not to say" };

export function StudentPreview({ s, canEditIt, role }: { s: StudentDetail; canEditIt: boolean; role?: string }) {
  const dash = <span className="hint">—</span>;
  const rows: [string, React.ReactNode][] = [
    ["Student code", <span className="mono" key="c">{s.studentCode}</span>],
    ["Status", <StatusChip key="s" name={s.status} color={s.statusColor} />],
    ["Email", s.email],
    ["Phone", <span className="mono" key="p">{s.phone}</span>],
    ["Gender", s.gender ? GENDER[s.gender] : dash],
    ["Date of birth", s.dateOfBirth ?? dash],
    ["Institution", s.institution],
    ["Degree", s.degree],
    ["Department", s.department],
    ["Year of study", s.yearOfStudy ?? dash],
    ["Graduation year", s.graduationYear],
    ["DOS Club batch", s.batch],
    ["Colour team", s.colourTeam ?? dash],
    ["Target role", s.targetRole ?? dash],
    ["City / State", [s.city, s.state].filter(Boolean).join(", ") || dash],
    ["LinkedIn", s.linkedinUrl ? <a key="l" href={s.linkedinUrl} target="_blank" rel="noopener noreferrer">{s.linkedinUrl}</a> : dash],
    ["GitHub", s.githubUrl ? <a key="g" href={s.githubUrl} target="_blank" rel="noopener noreferrer">{s.githubUrl}</a> : dash],
    ...(s.notes !== null ? ([["Notes", s.notes || dash]] as [string, React.ReactNode][]) : []),
    ["Created", new Date(s.createdAt).toLocaleString("en-IN")],
    ["Last updated", new Date(s.updatedAt).toLocaleString("en-IN")],
  ];
  return (
    <div style={{ display: "grid", gap: "1.25rem" }} data-testid="student-preview">
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <PortalAccess studentId={s.id} canResetAccess={role === "SUPER_ADMIN"} canResetPassword={canEditIt} />
      {!s.deletedAt && (
        <Link className="btn btn-secondary" href={`/students/${s.id}/profile`}>
          Skills, projects &amp; attendance
        </Link>
      )}
      {canEditIt && !s.deletedAt && (
        <Link className="btn btn-primary" href={`/students/${s.id}/edit`}>
          Edit student
        </Link>
      )}
    </div>
  );
}

function StatusDialog({ open, onOpenChange, count, statuses, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; statuses: { id: string; label: string }[]; onConfirm: (statusId: string, reason: string) => Promise<string | null> }) {
  const [statusId, setStatusId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const name = statuses.find((s) => s.id === statusId)?.label;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Update status" description={`Change the status of ${count.toLocaleString("en-IN")} selected student(s).`}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div className="field">
          <label className="label req" htmlFor="bulk-status">New status</label>
          <Select id="bulk-status" growing required value={statusId} onChange={setStatusId} placeholder="Choose…" options={statuses.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
        <div className="field">
          <label className="label" htmlFor="bulk-reason">Reason (optional, saved in the audit log)</label>
          <textarea id="bulk-reason" className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {statusId && (
          <div className="banner" data-testid="status-preview">
            {count.toLocaleString("en-IN")} student(s) will be set to <strong>{name}</strong>.
          </div>
        )}
        {err && <div className="field-error" role="alert">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!statusId || busy}
            onClick={async () => {
              setBusy(true);
              setErr(await onConfirm(statusId, reason));
              setBusy(false);
            }}
          >
            {busy ? "Updating…" : `Update ${count.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteDialog({ open, onOpenChange, count, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; onConfirm: (confirmText?: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const needsType = count > 10; // FR-STU-DEL / STU-11
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Delete ${count.toLocaleString("en-IN")} student${count === 1 ? "" : "s"}?`} description="They move to the Recycle Bin. You can undo for 10 seconds; after that a Super Admin can restore them.">
      <div style={{ display: "grid", gap: "1rem" }}>
        {needsType && (
          <div className="field">
            <label className="label" htmlFor="type-delete">Type DELETE to confirm</label>
            <input id="type-delete" className="input mono" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          </div>
        )}
        {err && <div className="field-error" role="alert">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
          <button
            type="button"
            className="btn btn-danger"
            data-testid="confirm-delete"
            disabled={busy || (needsType && text !== "DELETE")}
            onClick={async () => {
              setBusy(true);
              setErr(await onConfirm(needsType ? text : undefined));
              setBusy(false);
            }}
          >
            {busy ? "Deleting…" : `Delete ${count.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PurgeDialog({ open, onOpenChange, count, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; onConfirm: (confirmText: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Permanently delete?" description={`This cannot be undone. Only records deleted at least 30 days ago are purged (${count} selected).`}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div className="field">
          <label className="label" htmlFor="type-purge">Type PURGE to confirm</label>
          <input id="type-purge" className="input mono" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        </div>
        {err && <div className="field-error" role="alert">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={text !== "PURGE"} onClick={async () => setErr(await onConfirm(text))}>
            Purge permanently
          </button>
        </div>
      </div>
    </Modal>
  );
}

type Portal =
  | { activated: false }
  | { activated: true; activatedAt: string; totpEnabled: boolean; lastLoginAt: string | null; pendingOneTimePassword: boolean; oneTimeExpiresAt: string | null };

/** Phase 2: student portal status. Admins can issue a one-time password (PH2-7); Super Admin can reset access entirely. */
function PortalAccess({ studentId, canResetAccess, canResetPassword }: { studentId: string; canResetAccess: boolean; canResetPassword: boolean }) {
  const toast = useToast();
  const [p, setP] = useState<Portal | null>(null);
  const [confirm, setConfirm] = useState<null | "password" | "access">(null);
  const [otp, setOtp] = useState<{ oneTimePassword: string; expiresAt: string } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    api<Portal>(`/api/students/${studentId}/portal`).then((r) => live && r.ok && setP(r.data));
    return () => {
      live = false;
    };
  }, [studentId, reload]);
  if (!p) return null;
  return (
    <div className="banner" data-testid="portal-status" style={{ display: "grid", gap: "0.6rem" }}>
      <div>
        <strong>Student portal: </strong>
        {p.activated ? (
          <>
            activated {new Date(p.activatedAt).toLocaleDateString("en-IN")}
            {p.totpEnabled ? " · authenticator on" : " · authenticator not set up yet"}
            {p.lastLoginAt ? ` · last sign-in ${new Date(p.lastLoginAt).toLocaleDateString("en-IN")}` : ""}
            {p.pendingOneTimePassword && p.oneTimeExpiresAt ? ` · one-time password waiting (expires ${new Date(p.oneTimeExpiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })})` : ""}
          </>
        ) : (
          "not activated yet. The student can do first-time access with their registered email and mobile."
        )}
      </div>
      {otp && (
        <div style={{ display: "grid", gap: "0.4rem" }} data-testid="student-otp">
          <span>Share this one-time password with the student privately (shown once, valid 72 hours):</span>
          <code className="mono" style={{ padding: "0.5rem 0.75rem", background: "var(--surface)", borderRadius: "var(--r-md)", fontSize: "1.05rem" }}>{otp.oneTimePassword}</code>
          <span className="hint">They sign in with it, enter their authenticator code, and must then choose a new password.</span>
        </div>
      )}
      {p.activated && !otp && (canResetPassword || canResetAccess) && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {confirm === "password" ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                const r = await api<{ oneTimePassword: string; expiresAt: string }>(`/api/students/${studentId}/portal/password`, { body: {} });
                setConfirm(null);
                if (!r.ok) return toast({ message: r.error });
                setOtp(r.data);
                setReload((n) => n + 1);
              }}
            >
              Confirm: issue one-time password
            </button>
          ) : confirm === "access" ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={async () => {
                const r = await api(`/api/students/${studentId}/portal`, { method: "DELETE", body: { reason: "Reset from preview" } });
                toast({ message: r.ok ? "Portal access reset. The student can do first-time access again." : r.error });
                setConfirm(null);
                setReload((n) => n + 1);
              }}
            >
              Confirm: remove portal account
            </button>
          ) : (
            <>
              {canResetPassword && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm("password")}>
                  Reset password
                </button>
              )}
              {canResetAccess && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm("access")} title="Use when the student lost their phone and recovery codes">
                  Reset portal access
                </button>
              )}
            </>
          )}
          {confirm && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
