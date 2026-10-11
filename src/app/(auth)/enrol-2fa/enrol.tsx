"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";

export function Enrol({ endpoint = "/api/auth/enrol", home = "/", restartHref = "/login" }: { endpoint?: string; home?: string; restartHref?: string }) {
  const router = useRouter();
  const [qr, setQr] = useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ qrDataUrl: string; manualKey: string }>(endpoint, { body: { action: "start" } }).then((r) => (r.ok ? setQr(r.data) : setLoadError(r.error)));
  }, [endpoint]);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ recoveryCodes: string[] }>(endpoint, { body: { action: "confirm", code } });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCodes(r.data.recoveryCodes);
  }

  if (loadError) return <div className="banner" role="alert">⚠ {loadError} <a href={restartHref}>Sign in again</a></div>;

  if (codes) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <div className="banner" role="status">✓ Google Authenticator is now active on your account.</div>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 600 }}>Save your recovery codes</h2>
        <p className="hint" style={{ fontSize: "0.9rem" }}>
          These are shown <strong>only once</strong>. Each code works once if you lose your phone. Store them in a password manager or print them.
        </p>
        <ol className="mono" data-testid="recovery-codes" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.5rem", padding: "1rem 1.25rem", background: "var(--bg-soft)", borderRadius: "var(--r-xl)", listStylePosition: "inside" }}>
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>
            Copy codes
          </button>
        </div>
        <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.9rem" }}>
          <input type="checkbox" className="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved my recovery codes
        </label>
        <button type="button" className="btn btn-primary" disabled={!saved} onClick={() => { router.replace(home); router.refresh(); }}>
          Continue to the portal
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <ol style={{ display: "grid", gap: "0.4rem", paddingLeft: "1.2rem", fontSize: "0.92rem" }}>
        <li>Install <strong>Google Authenticator</strong> on your phone.</li>
        <li>Tap <strong>+</strong> → <strong>Scan a QR code</strong> and scan the code below.</li>
        <li>Enter the 6-digit code it shows to finish.</li>
      </ol>
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 220, height: 220, background: "var(--surface)", borderRadius: "var(--r-xl)", display: "grid", placeItems: "center", border: "1px solid var(--stroke)" }}>
          {qr ? <Image src={qr.qrDataUrl} alt="QR code for Google Authenticator" width={210} height={210} unoptimized /> : <div className="skeleton" style={{ width: 200, height: 200 }} />}
        </div>
        <div style={{ flex: 1, minWidth: "12rem" }}>
          <div className="label">Can&apos;t scan? Enter this key</div>
          <code className="mono" data-testid="manual-key" style={{ display: "block", marginTop: "0.35rem", padding: "0.6rem 0.8rem", background: "var(--bg-soft)", borderRadius: "var(--r-lg)", wordBreak: "break-all" }}>
            {qr?.manualKey ?? "…"}
          </code>
          <p className="hint" style={{ marginTop: "0.35rem" }}>Type: Time-based · 6 digits</p>
        </div>
      </div>
      <form onSubmit={confirm} noValidate style={{ display: "grid", gap: "0.85rem" }}>
        <Field id="enrol-code" label="6-digit code" required error={error ?? undefined}>
          <input id="enrol-code" className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={!!error} style={{ letterSpacing: "0.4em", fontSize: "1.2rem", textAlign: "center" }} />
        </Field>
        <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6 || !qr}>
          {busy ? "Verifying…" : "Verify and turn on"}
        </button>
      </form>
    </div>
  );
}
