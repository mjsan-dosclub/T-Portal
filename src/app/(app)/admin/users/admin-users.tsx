"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";

type Admin = { id: string; email: string; name: string; role: "SUPER_ADMIN" | "ADMIN" | "VIEWER"; isActive: boolean; totpEnabled: boolean; canExport: boolean; lastLoginAt: string | null };
const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", VIEWER: "Viewer" } as const;

export function AdminUsers({ admins, meId }: { admins: Admin[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [invite, setInvite] = useState(false);
  const [secret, setSecret] = useState<null | { title: string; password: string }>(null);
  const [reset2fa, setReset2fa] = useState<Admin | null>(null);

  async function patch(a: Admin, body: Record<string, unknown>) {
    const r = await api(`/api/admins/${a.id}`, { method: "PATCH", body });
    toast({ message: r.ok ? "Saved" : r.error });
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-primary" onClick={() => setInvite(true)}>Invite admin</button>
      </div>
      <div className="glass-strong" style={{ padding: "0.5rem" }}>
        <div className="table-wrap">
          <table className="dtable" data-testid="admins-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>2FA</th><th>Export</th><th>Last sign-in</th><th>State</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}{a.id === meId && <span className="hint"> (you)</span>}</td>
                  <td>{a.email}</td>
                  <td>
                    <label className="sr-only" htmlFor={`role-${a.id}`}>Role for {a.name}</label>
                    <select id={`role-${a.id}`} className="select" style={{ minHeight: "2rem", padding: "0.2rem 2rem 0.2rem 0.5rem", backgroundPosition: "right 0.5rem center" }} value={a.role} disabled={a.id === meId} onChange={(e) => patch(a, { role: e.target.value })}>
                      {Object.entries(ROLE_LABEL).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
                    </select>
                  </td>
                  <td>{a.totpEnabled ? <span className="chip chip-dot tone-primary">On</span> : <span className="chip tone-muted">Not enrolled</span>}</td>
                  <td>
                    {a.role === "VIEWER" ? (
                      <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                        <input type="checkbox" className="checkbox" checked={a.canExport} onChange={(e) => patch(a, { canExport: e.target.checked })} />
                        <span className="hint">allowed</span>
                      </label>
                    ) : (<span className="hint">by role</span>)}
                  </td>
                  <td className="hint">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never"}</td>
                  <td>{a.isActive ? <span className="chip chip-dot tone-primary">Active</span> : <span className="chip tone-muted">Deactivated</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {a.id !== meId && (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReset2fa(a)} disabled={!a.totpEnabled}>Reset 2FA</button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            const r = await api<{ oneTimePassword: string }>(`/api/admins/${a.id}/reset-password`, { body: {} });
                            if (r.ok) setSecret({ title: `New one-time password for ${a.name}`, password: r.data.oneTimePassword });
                            else toast({ message: r.error });
                          }}
                        >
                          Reset password
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(a, { isActive: !a.isActive })}>{a.isActive ? "Deactivate" : "Reactivate"}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <InviteDialog open={invite} onOpenChange={setInvite} onCreated={(pw, name) => { setInvite(false); setSecret({ title: `Account created for ${name}`, password: pw }); router.refresh(); }} />
      <Modal open={!!secret} onOpenChange={(o) => !o && setSecret(null)} title={secret?.title ?? ""} description="Share this one-time password with them privately. It is shown only once. They'll set up Google Authenticator on first sign-in.">
        <code className="mono" data-testid="one-time-password" style={{ display: "block", padding: "0.85rem 1rem", background: "var(--bg-soft)", borderRadius: "var(--r-lg)", fontSize: "1.1rem", wordBreak: "break-all" }}>{secret?.password}</code>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button type="button" className="btn btn-primary" onClick={() => setSecret(null)}>Done</button>
        </div>
      </Modal>
      <Reset2faDialog admin={reset2fa} onClose={() => setReset2fa(null)} onDone={() => { toast({ message: "2FA reset. They must enrol again at next sign-in." }); router.refresh(); }} />
    </>
  );
}

function InviteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (pw: string, name: string) => void }) {
  const [v, setV] = useState({ name: "", email: "", role: "ADMIN", canExport: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await api<{ oneTimePassword: string }>("/api/admins", { body: v });
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return setErr(r.error);
    }
    setV({ name: "", email: "", role: "ADMIN", canExport: false });
    onCreated(r.data.oneTimePassword, v.name);
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Invite admin" description="Creates the account and gives you a one-time password to share.">
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "0.9rem" }}>
        {err && <div className="banner" role="alert">⚠ {err}</div>}
        <Field id="inv-name" label="Name" required error={errors.name}>
          <input id="inv-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field id="inv-email" label="Email" required error={errors.email}>
          <input id="inv-email" className="input" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field id="inv-role" label="Role" required>
          <select id="inv-role" className="select" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            <option value="ADMIN">Admin: manage students & masters</option>
            <option value="VIEWER">Viewer: read-only</option>
            <option value="SUPER_ADMIN">Super Admin: everything</option>
          </select>
        </Field>
        {v.role === "VIEWER" && (
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" className="checkbox" checked={v.canExport} onChange={(e) => setV({ ...v, canExport: e.target.checked })} /> Allow CSV export
          </label>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create account</button>
        </div>
      </form>
    </Modal>
  );
}

function Reset2faDialog({ admin, onClose, onDone }: { admin: Admin | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal open={!!admin} onOpenChange={(o) => !o && onClose()} title={`Reset 2FA for ${admin?.name ?? ""}?`} description="Their authenticator and recovery codes stop working and they are signed out. They'll scan a new QR code at next sign-in. This is logged.">
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <div className="field">
          <label className="label" htmlFor="r2fa-reason">Reason (saved in audit log)</label>
          <input id="r2fa-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Lost phone, verified by call" />
        </div>
        {err && <div className="field-error" role="alert">{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              const r = await api(`/api/admins/${admin!.id}/reset-2fa`, { body: { reason } });
              if (!r.ok) return setErr(r.error);
              setReason("");
              onClose();
              onDone();
            }}
          >
            Reset 2FA
          </button>
        </div>
      </div>
    </Modal>
  );
}
