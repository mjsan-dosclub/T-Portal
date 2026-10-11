import Link from "next/link";
import { canEdit, requirePageAdmin } from "@/server/page-auth";
import { dashboardStats } from "@/server/reports";
import { ontologyStats } from "@/server/ontology/queries";
import { StatusChip } from "@/components/states";
import { PageHeader } from "./page-header";

export const metadata = { title: "Home" };

function Breakdown({ title, rows, total, testId }: { title: string; rows: { label: string; count: number }[]; total: number; testId: string }) {
  return (
    <section className="glass card" aria-labelledby={`${testId}-h`} data-testid={testId}>
      <h2 id={`${testId}-h`} style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1rem" }}>{title}</h2>
      {rows.length === 0 ? (
        <p className="hint">No students yet.</p>
      ) : (
        <ul style={{ display: "grid", gap: "0.85rem", listStyle: "none", padding: 0 }}>
          {rows.slice(0, 6).map((r) => (
            <li key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                <span>{r.label}</span>
                <span className="mono" data-testid={`${testId}-count`}>{r.count.toLocaleString("en-IN")}</span>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${total ? Math.max(2, (r.count / total) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const admin = await requirePageAdmin();
  const [s, ont, sp] = await Promise.all([dashboardStats(), ontologyStats(), searchParams]);
  const activePct = s.total ? Math.round((s.active / s.total) * 100) : 0;
  return (
    <>
      <PageHeader
        title={`Welcome, ${admin.name.split(" ")[0]}`}
        subtitle="Your DOS Club student master at a glance."
        actions={canEdit(admin) ? <Link className="btn btn-primary" href="/students/new">Add student</Link> : undefined}
      />
      {sp.denied && (
        <div className="banner" role="alert">
          ⚠ You don&apos;t have access to that page.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", gap: "1.25rem" }}>
        <section className="glass card" data-testid="stat-total">
          <div className="hint">Total students</div>
          <div className="stat-num" data-testid="stat-total-value">{s.total.toLocaleString("en-IN")}</div>
          <Link href="/students" className="hint">Open student master →</Link>
        </section>
        <section className="glass card" data-testid="stat-active">
          <div className="hint">Active</div>
          <div className="stat-num" data-testid="stat-active-value">{s.active.toLocaleString("en-IN")}</div>
          <div className="meter" style={{ marginTop: "0.6rem" }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={activePct} aria-label="Share of active students">
            <span style={{ width: `${activePct}%` }} />
          </div>
          <div className="hint" style={{ marginTop: "0.35rem" }}>{activePct}% of all students</div>
        </section>
        <section className="glass card">
          <div className="hint">Skills Ontology</div>
          <div className="stat-num">{ont.roles}</div>
          <div className="hint">roles · {ont.skills} skills · {ont.workshops} workshops</div>
          <Link href="/ontology" className="hint">Explore →</Link>
        </section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.25rem" }}>
        <Breakdown title="By DOS Club batch" rows={s.byBatch} total={s.total} testId="by-batch" />
        <Breakdown title="By institution" rows={s.byInstitution} total={s.total} testId="by-institution" />
        <section className="glass card" aria-labelledby="status-h">
          <h2 id="status-h" style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "1rem" }}>By status</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {s.byStatus.map((b) => (
              <span key={b.label} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <StatusChip name={b.label} color={b.color} /> <span className="mono">{b.count.toLocaleString("en-IN")}</span>
              </span>
            ))}
            {s.byStatus.length === 0 && <p className="hint">No students yet.</p>}
          </div>
        </section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.25rem" }}>
        <section className="glass card" aria-labelledby="uploads-h">
          <h2 id="uploads-h" style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>Recent uploads</h2>
          {s.recentUploads.length === 0 ? (
            <p className="hint">No uploads yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
              {s.recentUploads.map((u) => (
                <li key={u.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.88rem" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.fileName}</span>
                  <span className="hint">{u.status.toLowerCase()} · {u.imported}/{u.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="glass card" aria-labelledby="activity-h">
          <h2 id="activity-h" style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>Recent activity</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
            {s.recentActivity.map((a) => (
              <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.88rem" }}>
                <span>
                  <strong>{a.actor}</strong> · <span className="mono">{a.action}</span>
                </span>
                <time className="hint" dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
