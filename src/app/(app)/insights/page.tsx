import Link from "next/link";
import { db } from "@/lib/db";
import { READINESS_LABEL } from "@/lib/gap";
import { insights, readyList } from "@/server/insights";
import { canExport, requirePageAdmin } from "@/server/page-auth";
import { EmptyState } from "@/components/states";
import { PageHeader } from "../page-header";
import { ExportReady } from "./export-ready";

export const metadata = { title: "Insights" };

const UUID = /^[0-9a-f-]{36}$/i;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
// Sequential single-hue ramp (tokens --seq-1..5); labels always use ink text (≥ 5.45:1 on every step).
const heatBg = (share: number) => `var(--seq-${Math.min(5, 1 + Math.floor(share * 5))})`;

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 4.5rem", gap: "0.6rem", alignItems: "center" }} title={label}>
      <div className="meter" aria-hidden="true" style={{ height: "0.7rem" }}>
        <span style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: "var(--bar-fill)" }} />
      </div>
      <span className="mono" style={{ textAlign: "right", fontSize: "0.85rem" }}>{label}</span>
    </div>
  );
}

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const admin = await requirePageAdmin();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && UUID.test(sp[k] as string) ? (sp[k] as string) : undefined);
  const f = { batchId: str("batch"), institutionId: str("institution") };
  const roleId = str("role");
  const level = sp.level === "ready" || sp.level === "nearly" ? sp.level : undefined;
  const [data, ready, batches, institutions] = await Promise.all([
    insights(f),
    readyList({ ...f, roleId, level }),
    db.batch.findMany({ orderBy: [{ year: "desc" }, { batchCode: "asc" }], select: { id: true, batchCode: true } }),
    db.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const a = data.adoption;
  const topGaps = data.skillGaps.slice(0, 12);
  const maxNotMet = Math.max(1, ...topGaps.map((g) => g.notMet));
  const maxRole = Math.max(1, ...data.roles.map((r) => r.students));

  return (
    <>
      <PageHeader title="Insights" subtitle="Skill gaps, readiness and attendance across your students. Counts update as students fill in profiles and you mark attendance." />

      <form className="glass card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end", padding: "1rem 1.25rem" }} aria-label="Filters">
        <div className="field" style={{ flex: "1 1 12rem" }}>
          <label className="label" htmlFor="in-batch">Batch</label>
          <select id="in-batch" name="batch" className="select" defaultValue={f.batchId ?? ""}>
            <option value="">All batches</option>
            {batches.map((b) => (<option key={b.id} value={b.id}>{b.batchCode}</option>))}
          </select>
        </div>
        <div className="field" style={{ flex: "2 1 16rem" }}>
          <label className="label" htmlFor="in-inst">Institution</label>
          <select id="in-inst" name="institution" className="select" defaultValue={f.institutionId ?? ""}>
            <option value="">All institutions</option>
            {institutions.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Apply</button>
        {(f.batchId || f.institutionId) && <Link className="btn btn-ghost" href="/insights">Clear</Link>}
      </form>

      {a.total === 0 ? (
        <EmptyState title="No students match these filters" />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "1rem" }} data-testid="adoption">
            {([
              ["Students", a.total, null],
              ["Signed up to portal", a.activated, pct(a.activated, a.total)],
              ["Chose a target role", a.withRole, pct(a.withRole, a.total)],
              ["Rated their skills", a.selfRated, pct(a.selfRated, a.total)],
              ["Have verified skills", a.verified, pct(a.verified, a.total)],
              ["Added a project", a.withProject, pct(a.withProject, a.total)],
            ] as [string, number, number | null][]).map(([label, n, p]) => (
              <section key={label} className="glass card" style={{ padding: "1rem 1.1rem" }}>
                <div className="hint">{label}</div>
                <div className="stat-num" style={{ fontSize: "1.8rem" }}>{n.toLocaleString("en-IN")}</div>
                {p !== null && (<><div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={`${label}: ${p}%`}><span style={{ width: `${p}%` }} /></div><div className="hint" style={{ marginTop: "0.25rem" }}>{p}% of students</div></>)}
              </section>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))", gap: "1.25rem", alignItems: "start" }}>
            <section className="glass card" aria-labelledby="rd-h">
              <h2 id="rd-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.8rem" }}>Readiness for target role</h2>
              <div style={{ display: "grid", gap: "0.6rem" }} data-testid="readiness-breakdown">
                {(["ready", "nearly", "developing", "no-role"] as const).map((k) => (
                  <div key={k}>
                    <div className="hint" style={{ marginBottom: "0.2rem" }}>{READINESS_LABEL[k]}</div>
                    <Bar value={data.readiness[k]} max={a.total} label={`${data.readiness[k]} · ${pct(data.readiness[k], a.total)}%`} />
                  </div>
                ))}
              </div>
              <p className="hint" style={{ marginTop: "0.75rem" }}>Ready = every required skill met · Nearly = at least 80% met. Verified levels count over self-ratings.</p>
            </section>

            <section className="glass card" aria-labelledby="sg-h">
              <h2 id="sg-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>Biggest skill gaps (training needs)</h2>
              <p className="hint" style={{ margin: "0.25rem 0 0.8rem" }}>Students whose target role needs the skill but who aren&apos;t at the required level yet.</p>
              {topGaps.length === 0 ? <p className="hint">No target roles chosen yet.</p> : (
                <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.55rem" }} data-testid="skill-gaps">
                  {topGaps.map((g) => (
                    <li key={g.code}>
                      <div style={{ fontSize: "0.86rem", marginBottom: "0.15rem" }}><code className="mono">{g.code}</code> {g.name}</div>
                      <Bar value={g.notMet} max={maxNotMet} label={`${g.notMet} of ${g.needed}`} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className="glass-strong card" aria-labelledby="hm-h">
            <h2 id="hm-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>Skill readiness by area and batch</h2>
            <p className="hint" style={{ margin: "0.25rem 0 0.8rem" }}>Share of required skill levels already met, for students with a target role. Darker = more ready. Cells show % and how many skill requirements were counted.</p>
            {data.heatmap.categories.length === 0 ? <p className="hint">No target roles chosen yet.</p> : (
              <div className="table-wrap">
                <table className="dtable heat" data-testid="heatmap" style={{ background: "var(--surface)" }}>
                  <thead>
                    <tr><th scope="col">Skill area</th>{data.heatmap.batches.map((b) => (<th key={b.id} scope="col" style={{ textAlign: "center" }}>{b.code}</th>))}</tr>
                  </thead>
                  <tbody>
                    {data.heatmap.categories.map((c) => (
                      <tr key={c.id}>
                        <th scope="row" style={{ position: "static", background: "transparent", fontWeight: 500 }}>{c.name}</th>
                        {data.heatmap.batches.map((b) => {
                          const cell = data.heatmap.cells[`${c.id}|${b.id}`];
                          return cell ? (
                            <td key={b.id} className="cell" style={{ background: heatBg(cell.share) }} title={`${c.name} · ${b.code}: ${Math.round(cell.share * 100)}% met (${cell.met} of ${cell.n})`}>
                              <strong>{Math.round(cell.share * 100)}%</strong>
                              <div className="hint" style={{ color: "var(--text)" }}>n={cell.n}</div>
                            </td>
                          ) : (
                            <td key={b.id} className="cell hint">—</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.75rem" }} aria-hidden="true">
              <span className="hint">0%</span>
              {[1, 2, 3, 4, 5].map((n) => (<span key={n} style={{ width: "2rem", height: "0.7rem", borderRadius: "3px", background: `var(--seq-${n})`, border: "1px solid var(--hairline)" }} />))}
              <span className="hint">100% met</span>
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))", gap: "1.25rem", alignItems: "start" }}>
            <section className="glass card" aria-labelledby="tr-h">
              <h2 id="tr-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.8rem" }}>Most chosen target roles</h2>
              {data.roles.length === 0 ? <p className="hint">No target roles chosen yet.</p> : (
                <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.55rem" }} data-testid="top-roles">
                  {data.roles.slice(0, 10).map((r) => (
                    <li key={r.id}>
                      <div style={{ fontSize: "0.86rem", marginBottom: "0.15rem", display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                        <Link href={`/insights?${new URLSearchParams({ ...(f.batchId ? { batch: f.batchId } : {}), ...(f.institutionId ? { institution: f.institutionId } : {}), role: r.id })}#ready`}>{r.name}</Link>
                        <span className="hint">{r.ready} ready · {r.nearly} nearly</span>
                      </div>
                      <Bar value={r.students} max={maxRole} label={`${r.students}`} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="glass card" aria-labelledby="ab-h">
              <h2 id="ab-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.8rem" }}>Attendance by batch</h2>
              {data.attendance.byBatch.every((b) => b.held === 0) ? <p className="hint">No workshop sessions marked yet. Use <Link href="/attendance">Attendance</Link>.</p> : (
                <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.55rem" }} data-testid="attendance-by-batch">
                  {data.attendance.byBatch.map((b) => (
                    <li key={b.id}>
                      <div style={{ fontSize: "0.86rem", marginBottom: "0.15rem", display: "flex", justifyContent: "space-between" }}><span>{b.code}</span><span className="hint">{b.held} of 27 days held · {b.students} students</span></div>
                      <Bar value={b.pct ?? 0} max={100} label={b.pct === null ? "—" : `${b.pct}%`} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="glass card" aria-labelledby="aw-h">
            <h2 id="aw-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.8rem" }}>Attendance by workshop day (present)</h2>
            <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))", gap: "0.45rem 1.5rem" }}>
              {data.attendance.byWorkshop.map((w) => {
                const max = Math.max(1, ...data.attendance.byWorkshop.map((x) => x.present));
                return (
                  <li key={w.n}>
                    <div style={{ fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={w.title}><span className="mono hint">Day {w.n}</span> {w.title}</div>
                    <Bar value={w.present} max={max} label={w.sessions ? `${w.present}` : "not held"} />
                  </li>
                );
              })}
            </ol>
          </section>

          <section id="ready" className="glass-strong card" aria-labelledby="rl-h" style={{ scrollMarginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h2 id="rl-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>Ready &amp; nearly ready for their role</h2>
                <p className="hint">{ready.length} student(s){roleId ? " for the selected role" : ""}. Use this for placement shortlists.</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {roleId && <Link className="btn btn-ghost" href={`/insights?${new URLSearchParams({ ...(f.batchId ? { batch: f.batchId } : {}), ...(f.institutionId ? { institution: f.institutionId } : {}) })}#ready`}>All roles</Link>}
                {canExport(admin) && ready.length > 0 && <ExportReady filter={{ ...f, roleId, level }} />}
              </div>
            </div>
            {ready.length === 0 ? (
              <p className="hint" style={{ marginTop: "0.75rem" }}>No students are ready or nearly ready yet. This fills in as students rate their skills and you verify them.</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: "0.75rem", maxHeight: "50vh" }}>
                <table className="dtable" data-testid="ready-list">
                  <thead><tr><th>Student</th><th>Code</th><th>Batch</th><th>Target role</th><th>Readiness</th><th>Skills met</th><th>Verified</th></tr></thead>
                  <tbody>
                    {ready.slice(0, 200).map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}><Link href={`/students/${r.id}/profile`}>{r.fullName}</Link></td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.studentCode}</td>
                        <td>{r.batch}</td>
                        <td>{r.role}</td>
                        <td><span className={`chip ${r.readiness === "ready" ? "tone-primary" : "tone-accent"}`}>{r.readiness === "ready" ? "✓ Ready" : "◐ Nearly"}</span></td>
                        <td className="mono">{r.met}/{r.total}</td>
                        <td className="mono">{r.verified}/{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
