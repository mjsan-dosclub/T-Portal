"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { api } from "@/components/api";

type Item = { href: string; label: string; icon: keyof typeof Icon; match?: (p: string) => boolean };

export function Nav({ role, name }: { role: "SUPER_ADMIN" | "ADMIN" | "VIEWER"; name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const editor = role !== "VIEWER";
  const primary: Item[] = [
    { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
    { href: "/students", label: "Students", icon: "students", match: (p) => p === "/students" || (p.startsWith("/students/") && !p.startsWith("/students/upload")) },
    ...(editor ? [{ href: "/students/upload", label: "Upload", icon: "upload" as const, match: (p: string) => p.startsWith("/students/upload") }] : []),
    { href: "/masters/institutions", label: "Masters", icon: "masters", match: (p) => p.startsWith("/masters") },
    { href: "/ontology", label: "Skills Ontology", icon: "ontology", match: (p) => p.startsWith("/ontology") },
  ];
  const admin: Item[] =
    role === "SUPER_ADMIN"
      ? [
          { href: "/recycle-bin", label: "Recycle Bin", icon: "bin" },
          { href: "/audit", label: "Audit log", icon: "audit" },
          { href: "/admin/users", label: "Admin users", icon: "admins" },
        ]
      : [];
  const isActive = (i: Item) => (i.match ? i.match(pathname) : pathname.startsWith(i.href));
  const link = (i: Item) => (
    <Link key={i.href} href={i.href} className="rail-link" aria-current={isActive(i) ? "page" : undefined}>
      {Icon[i.icon]()}
      <span>{i.label}</span>
    </Link>
  );
  async function logout() {
    await api("/api/auth/logout", { body: {} });
    router.replace("/login");
    router.refresh();
  }
  return (
    <>
      <nav className="rail glass" aria-label="Main">
        <Link href="/" style={{ display: "flex", gap: "0.7rem", alignItems: "center", padding: "0.25rem 0.75rem 1.25rem", textDecoration: "none" }}>
          <Image src="/brand/logo.png" alt="" width={40} height={40} />
          <span>
            <span className="display" style={{ display: "block", fontWeight: 700, color: "var(--dos-deep)" }}>DOS Club</span>
            <span className="hint">Talent Portal</span>
          </span>
        </Link>
        {primary.map(link)}
        {admin.length > 0 && <div className="rail-sep" role="separator" />}
        {admin.map(link)}
        <div style={{ flex: 1 }} />
        <div className="rail-sep" role="separator" />
        {link({ href: "/account", label: "Account", icon: "account" })}
        <button type="button" className="rail-link" onClick={logout} style={{ background: "none", border: 0, cursor: "pointer", width: "100%", textAlign: "left" }}>
          {Icon.logout()}
          <span>Sign out</span>
        </button>
        <p className="hint" style={{ padding: "0.5rem 1rem 0" }}>
          {name} · {role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : "Viewer"}
        </p>
      </nav>
      <nav className="mobile-nav glass" aria-label="Main (compact)">
        {[...primary, ...admin, { href: "/account", label: "Account", icon: "account" as const }].map(link)}
      </nav>
    </>
  );
}
