// Six-step level meter: filled to the current level, outlined up to the required level. Text carries the meaning too.
export function LevelBar({ current, required, label }: { current: number; required?: number; label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <span aria-hidden="true" style={{ display: "inline-grid", gridTemplateColumns: "repeat(6, 0.9rem)", gap: "2px" }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            style={{
              height: "0.55rem",
              borderRadius: "2px",
              background: n <= current ? "var(--bar-fill)" : "var(--bar-track)",
              outline: required && n <= required && n > current ? "1.5px solid var(--dos-accent)" : undefined,
              outlineOffset: "-1.5px",
            }}
          />
        ))}
      </span>
      <span className="mono hint" style={{ minWidth: "5.5rem" }}>{label ?? (required ? `L${current} of L${required}` : `L${current}`)}</span>
    </span>
  );
}

export function ReadinessChip({ readiness }: { readiness: "ready" | "nearly" | "developing" | "no-role" }) {
  const map = {
    ready: ["tone-primary", "✓ Ready for role"],
    nearly: ["tone-accent", "◐ Nearly ready"],
    developing: ["tone-muted", "○ Developing"],
    "no-role": ["tone-muted", "No target role"],
  } as const;
  const [tone, text] = map[readiness];
  return <span className={`chip ${tone}`} data-testid="readiness">{text}</span>;
}

export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
