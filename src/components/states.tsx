import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="glass-strong card" style={{ textAlign: "center", padding: "3rem 1.5rem" }} data-testid="empty-state">
      <div aria-hidden="true" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        ◌
      </div>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>{title}</h2>
      {body && <p className="hint" style={{ fontSize: "0.92rem", margin: "0.4rem auto 1rem", maxWidth: "32rem" }}>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-strong card" role="alert" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }} data-testid="error-state">
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600 }}>⚠ Something went wrong</h2>
      <p className="hint" style={{ fontSize: "0.92rem", margin: "0.4rem 0 1rem" }}>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-strong card" aria-busy="true" aria-label="Loading" data-testid="skeleton">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "1rem", marginBottom: "0.9rem" }}>
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="skeleton" style={{ height: "0.9rem" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatusChip({ name, color }: { name: string; color?: string | null }) {
  const tone = color === "primary" ? "tone-primary" : color === "accent" ? "tone-accent" : color === "deep" ? "tone-deep" : "tone-muted";
  return <span className={`chip chip-dot ${tone}`}>{name}</span>;
}
