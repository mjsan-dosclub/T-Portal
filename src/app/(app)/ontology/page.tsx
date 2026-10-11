import { ontologyStats } from "@/server/ontology/queries";
import { requirePageAdmin } from "@/server/page-auth";

export const metadata = { title: "Skills Ontology" };

export default async function OntologyOverview() {
  await requirePageAdmin();
  const s = await ontologyStats();
  const flow = [
    ["Category", s.categories, "Broad ICT domains"],
    ["Subcategory", s.subcategories, "Focus areas within a domain"],
    ["Skill", s.skills, "Coded, described capabilities"],
    ["Role", s.roles, "Job roles needing skills at a level"],
    ["Level", s.levels, "L1 Foundation → L6 Distinguished"],
  ] as const;
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="glass card" aria-labelledby="flow-h">
        <h2 id="flow-h" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>How the framework fits together</h2>
        <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem", listStyle: "none", padding: 0, alignItems: "stretch" }} data-testid="ontology-flow">
          {flow.map(([name, n, desc], i) => (
            <li key={name} className="flow-node" style={{ position: "relative" }}>
              <div className="stat-num" data-testid={`ont-count-${name.toLowerCase()}`}>{n}</div>
              <div className="display" style={{ fontWeight: 600 }}>{name}{n === 1 ? "" : "s"}</div>
              <div className="hint" style={{ marginTop: "0.25rem" }}>{desc}</div>
              {i < flow.length - 1 && <span aria-hidden="true" style={{ position: "absolute", right: "-0.65rem", top: "40%", color: "var(--dos-accent)", fontWeight: 700 }}>→</span>}
            </li>
          ))}
        </ol>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))", gap: "1.25rem" }}>
        <section className="glass card">
          <div className="hint">Role → skill requirements</div>
          <div className="stat-num">{s.roleSkillLinks}</div>
          <div className="hint">skill-at-level links across {s.roles} roles</div>
        </section>
        <section className="glass card">
          <div className="hint">Growth roadmaps</div>
          <div className="stat-num">{s.roles}</div>
          <div className="hint">one per role, step by step through the levels</div>
        </section>
        <section className="glass card">
          <div className="hint">Runway · CodeZap 3.0</div>
          <div className="stat-num">{s.workshops}</div>
          <div className="hint">workshops mapped to roles and levels</div>
        </section>
      </div>
    </div>
  );
}
