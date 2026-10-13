"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Shared type-to-search picker (UX-2, UX-3): ARIA 1.2 combobox + listbox. Arrows, Enter, Escape and
 * Backspace (removes the last chip) work from the keyboard. Selected items show as removable chips.
 * `search` ranks the options; `renderOption` draws one result row.
 */
export type PickerItem = { key: string; label: string };

export function SearchPicker<T extends PickerItem>({
  id, label, options, selected, onChange, search, renderOption, max = 10, single = false, hint, error, placeholder, emptyHeading, noMatch,
}: {
  id: string; label: string; options: T[]; selected: string[]; onChange: (keys: string[]) => void;
  search: (options: T[], query: string, exclude: string[]) => T[]; renderOption: (o: T) => ReactNode;
  max?: number; single?: boolean; hint?: string; error?: string; placeholder: string; emptyHeading?: string; noMatch: (q: string) => ReactNode;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const full = !single && selected.length >= max;
  const results = useMemo(() => search(options, q, single ? [] : selected), [search, options, q, selected, single]);
  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const activeIdx = Math.min(active, Math.max(0, results.length - 1));

  function pick(key: string) {
    onChange(single ? [key] : [...selected, key]);
    setQ("");
    setActive(0);
    if (single) setOpen(false);
    inputRef.current?.focus();
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && results[activeIdx]) { e.preventDefault(); pick(results[activeIdx].key); }
    else if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "Backspace" && !q && !single && selected.length) onChange(selected.slice(0, -1));
  }

  return (
    <div className="field skill-picker">
      <label className="label" htmlFor={id}>{label}</label>
      {selected.length > 0 && (
        <ul className="sp-chips" aria-label={`Selected: ${label}`}>
          {selected.map((k) => (
            <li key={k}>
              <button type="button" className="chip tone-accent sp-chip" onClick={() => onChange(selected.filter((x) => x !== k))} aria-label={`Remove ${byKey.get(k)?.label ?? k}`}>
                {byKey.get(k)?.label ?? k} <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sp-box">
        <input
          ref={inputRef}
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open && !full}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[activeIdx] ? `${listId}-${results[activeIdx].key}` : undefined}
          aria-describedby={`${id}-hint`}
          aria-invalid={!!error}
          autoComplete="off"
          disabled={full}
          placeholder={full ? `Up to ${max} added` : placeholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
        />
        {open && !full && (
          <ul id={listId} role="listbox" className="sp-list" aria-label={`${label} suggestions`}>
            {!q && emptyHeading && <li className="sp-head" role="presentation">{emptyHeading}</li>}
            {results.length === 0 ? (
              <li className="sp-empty" role="presentation">{noMatch(q)}</li>
            ) : (
              results.map((r, i) => (
                <li
                  key={r.key}
                  id={`${listId}-${r.key}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  className="sp-opt"
                  onMouseDown={(e) => { e.preventDefault(); pick(r.key); }}
                  onMouseEnter={() => setActive(i)}
                >
                  {renderOption(r)}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {hint && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}
