"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";

/** Shared one-field form for password+email, TOTP and recovery code steps. */
export function CodeForm({ endpoint, kind }: { endpoint: string; kind: "totp" | "recovery" }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ next: string }>(endpoint, { body: { code } });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.status === 401 && r.error.includes("expired")) setTimeout(() => router.push("/login"), 1500);
      return;
    }
    router.replace(r.data.next);
    router.refresh();
  }
  const id = kind === "totp" ? "totp-code" : "recovery-code";
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "1rem" }}>
      <Field id={id} label={kind === "totp" ? "6-digit code from Google Authenticator" : "Recovery code"} required error={error ?? undefined}>
        <input
          id={id}
          className="input mono"
          style={{ fontSize: "1.25rem", letterSpacing: kind === "totp" ? "0.4em" : "0.1em", textAlign: "center" }}
          inputMode={kind === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          maxLength={kind === "totp" ? 6 : 11}
          pattern={kind === "totp" ? "\\d{6}" : undefined}
          placeholder={kind === "totp" ? "000000" : "XXXXX-XXXXX"}
          value={code}
          onChange={(e) => setCode(kind === "totp" ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase())}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus
          required
        />
      </Field>
      <button className="btn btn-primary" type="submit" disabled={busy || (kind === "totp" ? code.length !== 6 : code.length < 10)}>
        {busy ? "Checking…" : "Verify"}
      </button>
    </form>
  );
}
