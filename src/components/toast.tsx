"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void }; durationMs: number };
const Ctx = createContext<(t: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const push = useCallback((t: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { ...t, id, durationMs: t.durationMs ?? 5000 }]);
  }, []);
  const dismiss = (id: number) => setToasts((all) => all.filter((t) => t.id !== id));
  return (
    <Ctx value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [left, setLeft] = useState(Math.ceil(toast.durationMs / 1000));
  useEffect(() => {
    const end = Date.now() + toast.durationMs;
    const iv = setInterval(() => {
      const s = Math.ceil((end - Date.now()) / 1000);
      if (s <= 0) {
        clearInterval(iv);
        onDone();
      } else setLeft(s);
    }, 250);
    return () => clearInterval(iv);
  }, [toast.durationMs, onDone]);
  return (
    <div className="toast" data-testid="toast">
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDone();
          }}
        >
          {toast.action.label} ({left}s)
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onDone}>
        ✕
      </button>
    </div>
  );
}

export const useToast = () => useContext(Ctx);
