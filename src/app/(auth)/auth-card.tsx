import Image from "next/image";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <section className="glass card" style={{ width: wide ? "min(40rem, 100%)" : "min(26rem, 100%)", padding: "2.25rem" }} aria-labelledby="auth-title">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <Image src="/brand/logo.png" alt="DOS Club" width={44} height={44} priority />
          <div>
            <div className="display" style={{ fontWeight: 700, fontSize: "1.05rem" }}>DOS Club</div>
            <div className="hint">Talent Portal · Admin</div>
          </div>
        </div>
        <h1 id="auth-title" style={{ fontSize: "1.6rem", fontWeight: 600 }}>{title}</h1>
        {subtitle && <p className="hint" style={{ fontSize: "0.92rem", margin: "0.35rem 0 1.25rem" }}>{subtitle}</p>}
        {children}
      </section>
    </main>
  );
}
