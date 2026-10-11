"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";

/** PH2-5/6: first access. Email + registered mobile → create password → (next page) Google Authenticator. */
export function ActivateForm() {
  const router = useRouter();
  const [v, setV] = useState({ email: "", phone: "", password: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (v.password !== v.confirm) return setFields({ confirm: "Passwords don't match" });
    setBusy(true);
    setErr(null);
    setFields({});
    const r = await api<{ next: string }>("/api/student/auth/activate", { body: { email: v.email, phone: v.phone, password: v.password } });
    setBusy(false);
    if (!r.ok) {
      setFields(r.fields ?? {});
      return setErr(r.error);
    }
    router.replace(r.data.next);
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "1rem" }}>
      <ol style={{ display: "flex", gap: "0.4rem", listStyle: "none", padding: 0, flexWrap: "wrap" }} aria-label="Steps">
        <li className="chip tone-accent" aria-current="step">1. Your details &amp; password</li>
        <li className="chip tone-muted">2. Google Authenticator</li>
      </ol>
      {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
      <Field id="ac-email" label="Email you registered with DOS Club" required>
        <input id="ac-email" className="input" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoFocus />
      </Field>
      <Field id="ac-phone" label="Mobile number you registered with DOS Club" required hint="e.g. 98765 43210. This checks it's really you.">
        <input id="ac-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <Field id="ac-pw" label="Create a password" required error={fields.password} hint="At least 12 characters. A short sentence works well.">
        <input id="ac-pw" className="input" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      </Field>
      <Field id="ac-pw2" label="Type the password again" required error={fields.confirm}>
        <input id="ac-pw2" className="input" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
      </Field>
      <button className="btn btn-primary" type="submit" disabled={busy || !v.email.includes("@") || v.phone.replace(/\D/g, "").length < 10 || v.password.length < 12 || !v.confirm}>
        {busy ? "Checking…" : "Create password & continue"}
      </button>
      <p className="hint" style={{ textAlign: "center" }}>
        Already activated? <Link href="/student/login">Sign in</Link>
      </p>
    </form>
  );
}
