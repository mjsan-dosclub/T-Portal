import { categoriesWithTree } from "@/server/ontology/queries";
import { requirePageAdmin } from "@/server/page-auth";

export const metadata = { title: "Ontology categories" };

export default async function CategoriesPage() {
  await requirePageAdmin();
  const cats = await categoriesWithTree();
  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="categories">
      {cats.map((c) => (
        <details key={c.id} className="glass card" style={{ padding: "1rem 1.25rem" }} data-testid="category">
          <summary style={{ cursor: "pointer", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", listStyle: "none" }}>
            <span className="chip tone-accent mono">{c.id}</span>
            <span className="display" style={{ fontWeight: 600, fontSize: "1.05rem" }}>{c.name}</span>
            <span className="hint" style={{ marginLeft: "auto" }}>
              <span data-testid="subcategory-count">{c.subcategories.length}</span> subcategories · {c.subcategories.reduce((n, s) => n + s.skills.length, 0)} skills · {c._count.roles} roles
            </span>
          </summary>
          <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
            {c.subcategories.map((sc) => (
              <section key={sc.id} className="glass-strong" style={{ padding: "1rem", borderRadius: "var(--r-xl)" }}>
                <h3 style={{ fontSize: "0.98rem", fontWeight: 600, marginBottom: "0.6rem" }}>
                  <span className="mono hint">{sc.code}</span> {sc.name}
                </h3>
                <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))", gap: "0.6rem", listStyle: "none", padding: 0 }}>
                  {sc.skills.map((sk) => (
                    <li key={sk.code} style={{ padding: "0.6rem 0.75rem", background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--hairline)" }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                        <code className="mono chip tone-deep">{sk.code}</code>
                        <strong style={{ fontSize: "0.9rem" }}>{sk.name}</strong>
                      </div>
                      <p className="hint" style={{ marginTop: "0.3rem" }}>{sk.description}</p>
                      <p className="hint" style={{ marginTop: "0.2rem" }}>Used by {sk._count.roleSkills} role(s)</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
