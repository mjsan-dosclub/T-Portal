"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";

export function NewPasswordForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setErr("Passwords don't match");
    setBusy(true);
    setErr(null);
    const r = await api<{ next: string }>("/api/student/me/new-password", { body: { next: pw } });
    setBusy(false);
    if (!r.ok) return setErr(r.fields?.next ?? r.error);
    router.replace(r.data.next);
    router.refresh();
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "1rem" }}>
      {err && <div className="banner" role="alert" style={{ background: "var(--danger-wash)" }}>⚠ {err}</div>}
      <Field id="np-1" label="New password" required hint="At least 12 characters, different from the one-time password">
        <input id="np-1" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
      <Field id="np-2" label="Type it again" required>
        <input id="np-2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <button className="btn btn-primary" type="submit" disabled={busy || pw.length < 12 || !pw2}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
