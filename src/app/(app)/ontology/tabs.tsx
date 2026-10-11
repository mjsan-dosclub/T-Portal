"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/ontology", "Overview"],
  ["/ontology/categories", "Categories"],
  ["/ontology/roles", "Role Explorer"],
  ["/ontology/levels", "Proficiency Levels"],
  ["/ontology/program", "27-Day Program"],
] as const;

export function OntologyTabs() {
  const p = usePathname();
  return (
    <nav className="tabs glass" style={{ padding: "0.4rem", borderRadius: "var(--r-pill)" }} aria-label="Ontology views">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className="tab" aria-current={p === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
