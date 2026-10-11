"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";

export function StudentLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await api<{ next: string }>("/api/student/auth/login", { body: { email, password } });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.replace(r.data.next);
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "1rem" }}>
      {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
      <Field id="sl-email" label="Email" required>
        <input id="sl-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field id="sl-pw" label="Password" required>
        <input id="sl-pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary" type="submit" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Continue"}</button>
      <p className="hint" style={{ textAlign: "center" }}>
        <Link href="/student/forgot">Forgot password?</Link> · First time here? <Link href="/student/activate">Set up your account</Link>
      </p>
    </form>
  );
}
