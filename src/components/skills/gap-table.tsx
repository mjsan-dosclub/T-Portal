"use client";

import { useState } from "react";
import { api } from "@/components/api";
import { useToast } from "@/components/toast";
import type { Profile } from "@/server/profile";
import { LevelBar, ReadinessChip } from "./level-bar";

const LEVELS = [0, 1, 2, 3, 4, 5, 6];
const levelName = (n: number) => (n === 0 ? "L0 · not yet" : `L${n}`);

/**
 * "You vs. role" gap view (PRF-1/PRF-2). mode "student" edits self-ratings, "admin" edits verified levels,
 * "view" is read-only. Verified level wins over self-rating.
 */
export function GapTable({ profile, mode, saveUrl, onSaved }: { profile: Profile; mode: "student" | "admin" | "view"; saveUrl?: string; onSaved?: () => void }) {
  const toast = useToast();
  const { gap } = profile;
  const init = Object.fromEntries(gap.rows.map((r) => [r.code, mode === "admin" ? (profile.ratings[r.code]?.verified ?? null) : (profile.ratings[r.code]?.self ?? 0)])) as Record<string, number | null>;
  const [edits, setEdits] = useState<Record<string, number | null>>(init);
  const [busy, setBusy] = useState(false);
  const dirty = Object.keys(edits).some((k) => edits[k] !== init[k]);

  async function save() {
    setBusy(true);
    const ratings = Object.entries(edits)
      .filter(([k, v]) => v !== init[k])
      .map(([code, v]) => (mode === "admin" ? { code, verifiedLevel: v } : { code, level: v ?? 0 }));
    const r = await api(saveUrl!, { method: "PUT", body: { ratings } });
    setBusy(false);
    toast({ message: r.ok ? (mode === "admin" ? "Verified levels saved" : "Your levels are saved") : r.error });
    if (r.ok) onSaved?.();
  }

  if (!profile.targetRole) return <p className="hint">Choose a target role to see which skills it needs.</p>;

  return (
    <div style={{ display: "grid", gap: "0.9rem" }} data-testid="gap-table">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <ReadinessChip readiness={gap.readiness} />
        <span className="hint" data-testid="gap-summary">
          {gap.met} of {gap.total} skills at the required level{gap.totalGapLevels ? ` · ${gap.totalGapLevels} level(s) to go` : ""}
        </span>
      </div>
      <div className="table-wrap">
        <table className="dtable">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Role needs</th>
              <th>{mode === "admin" ? "Student says" : "You say"}</th>
              <th>Verified</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {gap.rows.map((r) => {
              const self = profile.ratings[r.code]?.self ?? 0;
              const verified = profile.ratings[r.code]?.verified ?? null;
              return (
                <tr key={r.code} data-testid="gap-row">
                  <td style={{ minWidth: "14rem" }}>
                    <code className="mono chip tone-deep">{r.code}</code> {r.name}
                  </td>
                  <td className="mono">L{r.required}</td>
                  <td>
                    {mode === "student" ? (
                      <select className="select" style={{ minHeight: "2rem", padding: "0.15rem 0.5rem", width: "9rem" }} aria-label={`Your level for ${r.name}`} value={edits[r.code] ?? 0} onChange={(e) => setEdits({ ...edits, [r.code]: Number(e.target.value) })}>
                        {LEVELS.map((l) => (<option key={l} value={l}>{levelName(l)}</option>))}
                      </select>
                    ) : (
                      <span className="mono">{levelName(self)}</span>
                    )}
                  </td>
                  <td>
                    {mode === "admin" ? (
                      <select className="select" style={{ minHeight: "2rem", padding: "0.15rem 0.5rem", width: "9rem" }} aria-label={`Verified level for ${r.name}`} value={edits[r.code] ?? ""} onChange={(e) => setEdits({ ...edits, [r.code]: e.target.value === "" ? null : Number(e.target.value) })}>
                        <option value="">Not verified</option>
                        {LEVELS.map((l) => (<option key={l} value={l}>{levelName(l)}</option>))}
                      </select>
                    ) : verified === null ? (
                      <span className="hint">—</span>
                    ) : (
                      <span className="chip tone-primary mono">✓ L{verified}</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <LevelBar current={r.current} required={r.required} />{" "}
                    {r.met ? <span className="chip chip-dot tone-primary">Met</span> : <span className="chip tone-muted">{r.gap} to go</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mode !== "view" && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save} data-testid="save-levels">
            {busy ? "Saving…" : mode === "admin" ? "Save verified levels" : "Save my levels"}
          </button>
        </div>
      )}
      <p className="hint">Levels: L0 not yet · L1 Foundation · L2 Practitioner · L3 Senior Practitioner · L4 Lead/Expert · L5 Principal · L6 Distinguished. A verified level (set by DOS Club) counts over a self-rating.</p>
    </div>
  );
}
