"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/** Accessible modal (focus trap, Esc, return focus) via Radix. */
export function Modal({ open, onOpenChange, title, description, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" style={wide ? { width: "min(52rem, calc(100vw - 2rem))" } : undefined} aria-describedby={description ? undefined : undefined}>
          <Dialog.Title className="display" style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.35rem" }}>
            {title}
          </Dialog.Title>
          {description ? <Dialog.Description className="hint" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Side drawer (preview, STU-13). */
export function Drawer({ open, onOpenChange, title, children, returnFocusTo }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; returnFocusTo?: { current: HTMLElement | null } }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="drawer"
          onCloseAutoFocus={(e) => {
            // Opened from a row button, not a Dialog.Trigger, so tell Radix where focus goes back (STU-13).
            if (returnFocusTo?.current) {
              e.preventDefault();
              returnFocusTo.current.focus();
            }
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <Dialog.Title className="display" style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              {title}
            </Dialog.Title>
            <Dialog.Close className="btn btn-ghost btn-icon" aria-label="Close">
              ✕
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Student details, read-only</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
