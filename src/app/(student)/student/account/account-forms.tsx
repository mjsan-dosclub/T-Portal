"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { useToast } from "@/components/toast";

export function StudentAccountForms() {
  const toast = useToast();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setPwErr({ confirm: "Passwords don't match" });
    const r = await api("/api/student/me/password", { body: { current: pw.current, next: pw.next } });
    if (!r.ok) return setPwErr(r.fields ?? { current: r.error });
    setPw({ current: "", next: "", confirm: "" });
    setPwErr({});
    toast({ message: "Password changed" });
  }
  async function regen(e: FormEvent) {
    e.preventDefault();
    const r = await api<{ recoveryCodes: string[] }>("/api/student/me/recovery-codes", { body: { code } });
    if (!r.ok) return setCodeErr(r.error);
    setCodeErr(null);
    setCode("");
    setCodes(r.data.recoveryCodes);
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.25rem", alignItems: "start" }}>
      <form className="glass card" onSubmit={changePw} noValidate style={{ display: "grid", gap: "0.9rem" }} aria-labelledby="cp-h">
        <h2 id="cp-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>Change password</h2>
        <Field id="sp-current" label="Current password" required error={pwErr.current}>
          <input id="sp-current" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        </Field>
        <Field id="sp-next" label="New password" required error={pwErr.next} hint="At least 12 characters">
          <input id="sp-next" type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        </Field>
        <Field id="sp-confirm" label="Confirm new password" required error={pwErr.confirm}>
          <input id="sp-confirm" type="password" className="input" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={!pw.current || !pw.next}>Change password</button>
        <p className="hint">Forgot your current password? Sign out and use “Forgot password?”.</p>
      </form>
      <form className="glass card" onSubmit={regen} noValidate style={{ display: "grid", gap: "0.9rem" }} aria-labelledby="rc-h">
        <h2 id="rc-h" style={{ fontSize: "1.1rem", fontWeight: 600 }}>Recovery codes</h2>
        <p className="hint" style={{ fontSize: "0.9rem" }}>Get 10 new codes. Your old ones stop working. Confirm with your current Google Authenticator code.</p>
        {codes ? (
          <>
            <ol className="mono" data-testid="student-recovery-codes" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 1.5rem", padding: "1rem 1.25rem", background: "var(--bg-soft)", borderRadius: "var(--r-xl)", listStylePosition: "inside" }}>
              {codes.map((c) => (<li key={c}>{c}</li>))}
            </ol>
            <p className="hint">Shown once. Save them now.</p>
          </>
        ) : (
          <>
            <Field id="sr-code" label="Authenticator code" required error={codeErr ?? undefined}>
              <input id="sr-code" className="input mono" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <button type="submit" className="btn btn-secondary" disabled={code.length !== 6}>Generate new codes</button>
          </>
        )}
      </form>
    </div>
  );
}
