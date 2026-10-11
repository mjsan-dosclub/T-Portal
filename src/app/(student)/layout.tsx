import Image from "next/image";
import Link from "next/link";
import { ToastProvider } from "@/components/toast";

// Phase 2 student area (PH2-1). Uses only the student session cookie.
export default function StudentLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "1rem 1rem 4rem", display: "grid", gap: "1.25rem" }}>
        <header className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.75rem 1.25rem", borderRadius: "var(--r-pill)" }}>
          <Link href="/student" style={{ display: "flex", alignItems: "center", gap: "0.65rem", textDecoration: "none" }}>
            <Image src="/brand/logo.png" alt="" width={36} height={36} />
            <span>
              <span className="display" style={{ fontWeight: 700, color: "var(--dos-deep)", display: "block" }}>DOS Club</span>
              <span className="hint">Student portal</span>
            </span>
          </Link>
          <Link href="/how-it-works" className="btn btn-ghost btn-sm">How it works</Link>
        </header>
        <main id="main">{children}</main>
      </div>
    </ToastProvider>
  );
}
