import { listLevels } from "@/server/ontology/queries";
import { requirePageAdmin } from "@/server/page-auth";

export const metadata = { title: "Proficiency levels" };

export default async function LevelsPage() {
  await requirePageAdmin();
  const levels = await listLevels();
  return (
    <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.85rem" }} data-testid="levels">
      {levels.map((l) => (
        <li key={l.n} className="glass card" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1.25rem", alignItems: "center" }}>
          <div className="brand-ring" aria-hidden="true">
            <div style={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center" }} className="display">
              <strong style={{ fontSize: "1.2rem", color: "var(--dos-deep)" }}>L{l.n}</strong>
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 600 }}><span className="sr-only">Level {l.n}: </span>{l.name}</h2>
            <p style={{ fontSize: "0.92rem", marginTop: "0.25rem" }}>{l.description}</p>
            <div className="meter" style={{ marginTop: "0.6rem", maxWidth: "24rem" }} aria-hidden="true"><span style={{ width: `${(l.n / levels.length) * 100}%` }} /></div>
          </div>
        </li>
      ))}
    </ol>
  );
}
