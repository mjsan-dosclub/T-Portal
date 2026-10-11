import type { WeekCell } from "@/lib/internship";

// Weekly report states (INT-2). Identity is never colour-alone: each cell carries a symbol and an aria-label.
export const WEEK_STATE: Record<WeekCell["state"], { label: string; symbol: string; tone: string }> = {
  accepted: { label: "Accepted", symbol: "✓", tone: "tone-primary" },
  submitted: { label: "Submitted · awaiting review", symbol: "●", tone: "tone-accent" },
  revision: { label: "Needs revision", symbol: "↺", tone: "tone-deep" },
  missing: { label: "Missing", symbol: "✕", tone: "tone-muted" },
  upcoming: { label: "Not due yet", symbol: "·", tone: "tone-muted" },
};

export function WeekChip({ cell, onClick, testId }: { cell: WeekCell; onClick?: () => void; testId?: string }) {
  const s = WEEK_STATE[cell.state];
  const label = `Week ${cell.weekNo}: ${s.label}${cell.late ? " (late)" : ""}${cell.due ? `, due ${cell.due}` : ""}`;
  const style = { minWidth: "3.1rem", justifyContent: "center", borderStyle: cell.state === "upcoming" ? "dashed" : undefined, borderColor: cell.state === "upcoming" ? "var(--stroke)" : undefined } as const;
  const body = (
    <>
      <span aria-hidden="true">{s.symbol}</span> W{cell.weekNo}
      {cell.late && <span aria-hidden="true" title="late">*</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={`chip ${s.tone}`} style={{ ...style, cursor: "pointer" }} aria-label={label} title={label} onClick={onClick} data-testid={testId} data-state={cell.state}>
      {body}
    </button>
  ) : (
    <span className={`chip ${s.tone}`} style={style} aria-label={label} title={label} data-testid={testId} data-state={cell.state}>
      {body}
    </span>
  );
}

export function WeekLegend() {
  return (
    <p className="hint" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {Object.entries(WEEK_STATE).map(([k, s]) => (
        <span key={k}><span aria-hidden="true">{s.symbol}</span> {s.label}</span>
      ))}
      <span>* submitted after the due date</span>
    </p>
  );
}

export function AttendanceMeter({ pct, attended, elapsed, weeks }: { pct: number | null; attended: number; elapsed: number; weeks: number }) {
  return (
    <div style={{ display: "grid", gap: "0.3rem", minWidth: "10rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <span className="hint">Internship attendance</span>
        <strong data-testid="int-attendance">{pct === null ? "—" : `${pct}%`}</strong>
      </div>
      <div className="meter" aria-hidden="true"><span style={{ width: `${pct ?? 0}%` }} /></div>
      <span className="hint">{attended} report(s) counted · {elapsed} of {weeks} week(s) due so far</span>
    </div>
  );
}
