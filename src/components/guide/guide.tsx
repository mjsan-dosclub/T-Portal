import Image from "next/image";
import type { ReactNode } from "react";

// Building blocks for the how-it-works guides (HELP-1).

export function GuideSection({ id, title, kicker, children }: { id: string; title: string; kicker?: string; children: ReactNode }) {
  return (
    <section id={id} className="glass card" style={{ scrollMarginTop: "1rem", display: "grid", gap: "0.9rem" }} aria-labelledby={`${id}-h`}>
      {kicker && <div className="hint" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{kicker}</div>}
      <h2 id={`${id}-h`} style={{ fontSize: "1.35rem", fontWeight: 600 }}>{title}</h2>
      {children}
    </section>
  );
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.65rem", counterReset: "step" }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "grid", gridTemplateColumns: "2rem 1fr", gap: "0.75rem", alignItems: "start" }}>
          <span aria-hidden="true" className="display" style={{ width: "2rem", height: "2rem", borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--accent-wash)", color: "var(--dos-accent-dark)", fontWeight: 700 }}>
            {i + 1}
          </span>
          <div style={{ paddingTop: "0.25rem", lineHeight: 1.55 }}>{it}</div>
        </li>
      ))}
    </ol>
  );
}

export function Tip({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className="banner" style={{ display: "block", lineHeight: 1.55, background: tone === "warn" ? "var(--danger-wash)" : undefined }}>
      <strong>{tone === "warn" ? "⚠ Careful: " : "💡 Tip: "}</strong>
      {children}
    </div>
  );
}

export function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ borderRadius: "var(--r-xl)", overflow: "hidden", border: "1px solid var(--stroke)", boxShadow: "var(--shadow-glass)", background: "var(--surface)" }}>
        <Image src={src} alt={alt} width={1280} height={800} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      <figcaption className="hint" style={{ marginTop: "0.4rem" }}>{caption}</figcaption>
    </figure>
  );
}

export function Toc({ items }: { items: [string, string][] }) {
  return (
    <nav className="glass card" aria-label="On this page" style={{ padding: "1rem 1.25rem" }}>
      <div className="label" style={{ marginBottom: "0.5rem" }}>On this page</div>
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {items.map(([id, label]) => (
          <li key={id}>
            <a className="chip tone-accent" href={`#${id}`} style={{ textDecoration: "none" }}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <strong style={{ padding: "0.05rem 0.4rem", borderRadius: "var(--r-sm)", background: "var(--bg-2)", color: "var(--dos-deep)", whiteSpace: "nowrap" }}>{children}</strong>;
}
