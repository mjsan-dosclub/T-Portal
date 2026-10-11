"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/components/api";

export function StudentNav({ name }: { name: string }) {
  const p = usePathname();
  const router = useRouter();
  return (
    <nav className="tabs glass" style={{ padding: "0.4rem", borderRadius: "var(--r-pill)", alignItems: "center" }} aria-label="Student">
      <Link href="/student" className="tab" aria-current={p === "/student" ? "page" : undefined}>My record</Link>
      <Link href="/student/profile" className="tab" aria-current={p === "/student/profile" ? "page" : undefined}>My profile</Link>
      <Link href="/student/account" className="tab" aria-current={p === "/student/account" ? "page" : undefined}>Account</Link>
      <span className="hint" style={{ marginLeft: "auto", padding: "0 0.5rem" }}>{name}</span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          await api("/api/student/auth/logout", { body: {} });
          router.replace("/student/login");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
