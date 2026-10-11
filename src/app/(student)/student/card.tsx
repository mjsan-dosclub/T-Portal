import type { ReactNode } from "react";

export function StudentCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass card" style={{ maxWidth: "30rem", margin: "1.5rem auto 0", padding: "2rem" }} aria-labelledby="st-title">
      <h1 id="st-title" style={{ fontSize: "1.55rem", fontWeight: 600 }}>{title}</h1>
      {subtitle && <p className="hint" style={{ fontSize: "0.92rem", margin: "0.35rem 0 1.25rem", lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </section>
  );
}
