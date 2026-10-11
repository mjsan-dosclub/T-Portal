"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ next: string }>("/api/auth/login", { body: { email, password } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.replace(r.data.next);
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "1rem" }}>
      {error && (
        <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>
          ⚠ {error}
        </div>
      )}
      <Field id="email" label="Email" required>
        <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      <Field id="password" label="Password" required>
        <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <button className="btn btn-primary" type="submit" disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Continue"}
      </button>
      <p className="hint" style={{ textAlign: "center" }}>
        No public sign-up. Ask a Super Admin for an account.
      </p>
      <p className="hint" style={{ textAlign: "center" }}>
        Student? <a href="/how-it-works">See how the portal works for you</a>
      </p>
    </form>
  );
}
