// Base seed, safe for any environment: default statuses (PRD §5.2), degrees listed in PRD §5.2, ontology (PRD §5.4).
// No people, no institutions, no fake data.
import { nameKey } from "../src/lib/normalize";
import { seedOntology } from "../src/server/ontology/seed";
import { scriptClient } from "./client-for-scripts";

const STATUSES: { name: string; color: string; isActiveState: boolean; isDefault?: boolean }[] = [
  { name: "Active", color: "primary", isActiveState: true, isDefault: true },
  { name: "Inactive", color: "muted", isActiveState: false },
  { name: "Alumni", color: "accent", isActiveState: false },
  { name: "Suspended", color: "deep", isActiveState: false },
  { name: "Dropped", color: "muted", isActiveState: false },
];
const DEGREES: { name: string; level: "UG" | "PG" }[] = [
  { name: "B.E.", level: "UG" },
  { name: "B.Tech", level: "UG" },
  { name: "B.Sc", level: "UG" },
  { name: "BCA", level: "UG" },
  { name: "MCA", level: "PG" },
  { name: "MBA", level: "PG" },
];

export async function seedBase(db: ReturnType<typeof scriptClient>) {
  for (const s of STATUSES) {
    await db.studentStatus.upsert({ where: { nameKey: nameKey(s.name) }, create: { ...s, nameKey: nameKey(s.name), isDefault: !!s.isDefault }, update: {} });
  }
  for (const d of DEGREES) {
    await db.degree.upsert({ where: { nameKey: nameKey(d.name) }, create: { ...d, nameKey: nameKey(d.name) }, update: {} });
  }
  return seedOntology(db);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const db = scriptClient();
  seedBase(db)
    .then((counts) => console.log("Base seed done. Ontology counts:", counts))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
