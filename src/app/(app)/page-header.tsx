import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", padding: "0.75rem 0.5rem 0" }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="hint" style={{ fontSize: "0.95rem", marginTop: "0.25rem" }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}
