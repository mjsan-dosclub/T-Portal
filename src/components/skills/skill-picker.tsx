"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { searchSkills, shortDescription, type SkillOption } from "@/lib/skill-search";

/**
 * Type-to-search skill picker (UX-2). Students type everyday words ("python", "figma", "power bi");
 * results show the plain skill name, its area and a one-line description. Codes stay out of sight.
 * ARIA 1.2 combobox + listbox; arrows, Enter and Escape work from the keyboard.
 */
export function SkillPicker({
  id, label, catalog, selected, onChange, max = 10, hint, error, single = false,
}: {
  id: string; label: string; catalog: SkillOption[]; selected: string[]; onChange: (codes: string[]) => void;
  max?: number; hint?: string; error?: string; single?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const full = !single && selected.length >= max;
  const results = useMemo(() => searchSkills(catalog, q, single ? [] : selected, 30), [catalog, q, selected, single]);
  const byCode = useMemo(() => new Map(catalog.map((c) => [c.code, c])), [catalog]);
  const activeIdx = Math.min(active, Math.max(0, results.length - 1));

  function pick(code: string) {
    onChange(single ? [code] : [...selected, code]);
    setQ("");
    setActive(0);
    if (single) setOpen(false);
    inputRef.current?.focus();
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && results[activeIdx]) { e.preventDefault(); pick(results[activeIdx].code); }
    else if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "Backspace" && !q && !single && selected.length) onChange(selected.slice(0, -1));
  }

  return (
    <div className="field skill-picker">
      <label className="label" htmlFor={id}>{label}</label>
      {selected.length > 0 && (
        <ul className="sp-chips" aria-label={`Selected: ${label}`}>
          {selected.map((c) => (
            <li key={c}>
              <button type="button" className="chip tone-accent sp-chip" onClick={() => onChange(selected.filter((x) => x !== c))} aria-label={`Remove ${byCode.get(c)?.name ?? c}`}>
                {byCode.get(c)?.name ?? c} <span aria-hidden="true">✕</span>
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
          aria-activedescendant={open && results[activeIdx] ? `${listId}-${results[activeIdx].code}` : undefined}
          aria-describedby={`${id}-hint`}
          aria-invalid={!!error}
          autoComplete="off"
          disabled={full}
          placeholder={full ? `Up to ${max} skills added` : "Type a tool or topic, e.g. python, figma, power bi"}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
        />
        {open && !full && (
          <ul id={listId} role="listbox" className="sp-list" aria-label={`${label} suggestions`}>
            {!q && <li className="sp-head" role="presentation">Popular with freshers</li>}
            {results.length === 0 ? (
              <li className="sp-empty" role="presentation">No match for “{q}”. Try a broader word such as coding, data, design, cloud or testing.</li>
            ) : (
              results.map((r, i) => (
                <li
                  key={r.code}
                  id={`${listId}-${r.code}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  className="sp-opt"
                  onMouseDown={(e) => { e.preventDefault(); pick(r.code); }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="sp-name">{r.name}</span>
                  <span className="sp-meta">
                    {r.via ? <span className="sp-via">matches “{r.via}”</span> : null}
                    {r.category}
                  </span>
                  {r.description && <span className="sp-desc">{shortDescription(r.description)}</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <span className="hint" id={`${id}-hint`}>{hint ?? "Search with everyday words: tools, languages or topics you used."}</span>
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}
