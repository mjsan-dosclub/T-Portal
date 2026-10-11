import { listWorkshops } from "@/server/ontology/queries";
import { requirePageAdmin } from "@/server/page-auth";

export const metadata = { title: "27-Day Program" };

export default async function ProgramPage() {
  await requirePageAdmin();
  const ws = await listWorkshops();
  return (
    <section className="glass card" aria-labelledby="prog-h">
      <h2 id="prog-h" style={{ fontSize: "1.15rem", fontWeight: 600 }}>Runway · CodeZap 3.0</h2>
      <p className="hint" style={{ margin: "0.25rem 0 1rem" }}>{ws.length} workshops, each mapped to a target role and level.</p>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))", gap: "0.75rem" }} data-testid="workshops">
        {ws.map((w) => (
          <li key={w.n} style={{ padding: "0.85rem 1rem", background: "var(--glass-strong)", borderRadius: "var(--r-xl)", border: "1px solid var(--hairline)" }} data-testid="workshop">
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <span className="chip tone-accent mono">Day {w.n}</span>
            </div>
            <div style={{ fontWeight: 600, marginTop: "0.4rem" }}>{w.title}</div>
            <div className="hint" style={{ marginTop: "0.2rem" }}>{w.roleText}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
