import Link from "next/link";
import { requirePageAdmin } from "@/server/page-auth";
import { queryAudit } from "@/server/reports";
import { EmptyState } from "@/components/states";
import { PageHeader } from "../page-header";

export const metadata = { title: "Audit log" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await requirePageAdmin(["SUPER_ADMIN"]);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 80) : undefined);
  // Filters are ids/dates/action names only: no PII in the URL.
  const f = { actorId: str("actor"), entity: str("entity"), action: str("action"), from: DATE.test(str("from") ?? "") ? str("from") : undefined, to: DATE.test(str("to") ?? "") ? str("to") : undefined, page: Number(str("page") ?? 1) || 1 };
  const r = await queryAudit(f);
  const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
  const qs = (page: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries({ actor: f.actorId, entity: f.entity, action: f.action, from: f.from, to: f.to }).filter(([, v]) => v) as [string, string][]), page: String(page) }).toString();
  return (
    <>
      <PageHeader title="Audit log" subtitle="Append-only record of every change: who, what, when, before and after." />
      <form className="glass card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "0.75rem", alignItems: "end", padding: "1rem 1.25rem" }}>
        <div className="field">
          <label className="label" htmlFor="a-actor">Actor</label>
          <select id="a-actor" name="actor" className="select" defaultValue={f.actorId ?? ""}>
            <option value="">Anyone</option>
            {r.actors.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="a-entity">Entity</label>
          <select id="a-entity" name="entity" className="select" defaultValue={f.entity ?? ""}>
            <option value="">All</option>
            {r.entities.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="a-action">Action starts with</label>
          <input id="a-action" name="action" className="input" defaultValue={f.action ?? ""} placeholder="e.g. student." />
        </div>
        <div className="field">
          <label className="label" htmlFor="a-from">From</label>
          <input id="a-from" name="from" type="date" className="input" defaultValue={f.from ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="a-to">To</label>
          <input id="a-to" name="to" type="date" className="input" defaultValue={f.to ?? ""} />
        </div>
        <button type="submit" className="btn btn-primary">Filter</button>
      </form>
      {r.rows.length === 0 ? (
        <EmptyState title="No audit entries match" />
      ) : (
        <div className="glass-strong" style={{ padding: "0.5rem" }}>
          <div className="table-wrap">
            <table className="dtable" data-testid="audit-table">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Change</th><th>Reason</th><th>IP</th></tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(row.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</td>
                    <td>{row.actor}</td>
                    <td className="mono">{row.action}</td>
                    <td><span className="mono">{row.entity}</span>{row.entityId && <div className="hint mono">{row.entityId.slice(0, 8)}</div>}</td>
                    <td style={{ minWidth: "18rem" }}>
                      {(row.before || row.after) ? (
                        <details>
                          <summary className="hint" style={{ cursor: "pointer" }}>before / after</summary>
                          <pre className="mono" style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", maxWidth: "32rem" }}>{JSON.stringify({ before: row.before, after: row.after }, null, 2)}</pre>
                        </details>
                      ) : (<span className="hint">—</span>)}
                    </td>
                    <td>{row.reason ?? <span className="hint">—</span>}</td>
                    <td className="mono hint">{row.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0.5rem 0.25rem", alignItems: "center" }}>
            <span className="hint">{r.total.toLocaleString("en-IN")} entries · page {r.page} of {pages}</span>
            <span style={{ display: "flex", gap: "0.5rem" }}>
              {r.page > 1 && <Link className="btn btn-secondary btn-sm" href={`/audit?${qs(r.page - 1)}`}>Previous</Link>}
              {r.page < pages && <Link className="btn btn-secondary btn-sm" href={`/audit?${qs(r.page + 1)}`}>Next</Link>}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
