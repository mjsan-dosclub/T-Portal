import Image from "next/image";
import Link from "next/link";

// Public pages (no sign-in, no personal data). HELP-1.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div style={{ maxWidth: "62rem", margin: "0 auto", padding: "1rem 1rem 4rem", display: "grid", gap: "1.25rem" }}>
      <header className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.75rem 1.25rem", borderRadius: "var(--r-pill)" }}>
        <Link href="/how-it-works" style={{ display: "flex", alignItems: "center", gap: "0.65rem", textDecoration: "none" }}>
          <Image src="/brand/logo.png" alt="" width={36} height={36} />
          <span className="display" style={{ fontWeight: 700, color: "var(--dos-deep)" }}>DOS Club Talent Portal</span>
        </Link>
        <Link href="/login" className="btn btn-secondary btn-sm">Admin sign in</Link>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
