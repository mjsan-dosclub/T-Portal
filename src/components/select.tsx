"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

// UX-4: one dropdown for the whole admin side.
// Rule: more than SEARCH_THRESHOLD options, or a list that grows with use (`growing`: masters, roles, admins…)
// → compact searchable dropdown (like Bootstrap's searchable select). Short fixed lists stay native <select>.
export const SEARCH_THRESHOLD = 15;

export type SelectOption = { value: string; label: string };

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Label of the empty choice (e.g. "Choose…", "All batches"). Omit when a value is always required. */
  placeholder?: string;
  /** The list grows as people use the app (master data, roles, admins). Searchable even while short. */
  growing?: boolean;
  /** Form field name: renders a hidden input so plain GET/POST forms keep working. */
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

export function Select(p: Props) {
  const searchable = p.growing || p.options.length > SEARCH_THRESHOLD;
  if (!searchable) {
    return (
      <select id={p.id} name={p.name} className="select" value={p.value} onChange={(e) => p.onChange(e.target.value)} disabled={p.disabled} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} aria-label={p.ariaLabel} style={p.style}>
        {p.placeholder !== undefined && <option value="">{p.placeholder}</option>}
        {p.options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    );
  }
  return <SearchSelect {...p} />;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function SearchSelect({ id, value, onChange, options, placeholder, name, disabled, invalid, describedBy, ariaLabel, style }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const all = useMemo(() => (placeholder !== undefined ? [{ value: "", label: placeholder }, ...options] : options), [options, placeholder]);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return all;
    const words = n.split(/\s+/);
    return all.filter((o) => o.value !== "" && words.every((w) => norm(o.label).includes(w)));
  }, [all, q]);
  const current = all.find((o) => o.value === value);
  const activeIdx = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function openList(initial = "") {
    if (disabled) return;
    setQ(initial);
    setActive(Math.max(0, all.findIndex((o) => o.value === value)));
    setOpen(true); // the search box takes focus as it mounts (autoFocus)
  }
  function choose(v: string) {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  }
  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    // While open, keys that reach the button (before the search box has focus) act as if typed into the search.
    if (open && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) { onSearchKey(e as unknown as KeyboardEvent<HTMLInputElement>); return; }
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Typing on the closed dropdown starts a search; keys that arrive before the search box has focus still count.
      e.preventDefault();
      if (open) { setQ((x) => x + e.key); setActive(0); } else openList(e.key);
    }
  }
  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[activeIdx]) choose(shown[activeIdx].value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  }
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIdx}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx, listId]);

  return (
    <div className="ss" ref={rootRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={btnRef}
        id={id}
        type="button"
        className="select ss-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={[`${id}-value`, describedBy].filter(Boolean).join(" ")}
        data-invalid={invalid || undefined}
        data-value={value}
        disabled={disabled}
        style={style}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKey}
      >
        <span id={`${id}-value`} className={current && current.value !== "" ? "ss-value" : "ss-value ss-placeholder"}>{current?.label ?? placeholder ?? "Choose…"}</span>
      </button>
      {open && (
        <div className="ss-panel">
          <input
            ref={searchRef}
            autoFocus
            className="ss-search"
            type="search"
            role="combobox"
            aria-label="Search options"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[activeIdx] ? `${listId}-${activeIdx}` : undefined}
            autoComplete="off"
            placeholder="Search…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onSearchKey}
          />
          <ul id={listId} role="listbox" className="ss-list" aria-label={ariaLabel ?? "Options"}>
            {shown.length === 0 && <li className="ss-empty" role="presentation">No matches</li>}
            {shown.map((o, i) => (
              <li
                key={o.value || "__empty"}
                id={`${listId}-${i}`}
                role="option"
                data-value={o.value}
                aria-selected={o.value === value}
                data-active={i === activeIdx || undefined}
                className={o.value === "" ? "ss-opt ss-placeholder" : "ss-opt"}
                onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                onMouseEnter={() => setActive(i)}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Uncontrolled version for plain server-rendered forms (filters that submit with GET): keeps its own value. */
export function FormSelect({ defaultValue = "", ...p }: Omit<Props, "value" | "onChange"> & { name: string; defaultValue?: string }) {
  const [v, setV] = useState(defaultValue);
  return <Select {...p} value={v} onChange={setV} />;
}
