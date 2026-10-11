import type { ReactNode } from "react";

export function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id} className={`label ${required ? "req" : ""}`}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
