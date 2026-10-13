"use client";

import { useCallback, useMemo } from "react";
import { SearchPicker } from "@/components/search-picker";
import { searchSkills, shortDescription, type SkillMatch, type SkillOption } from "@/lib/skill-search";

type Item = SkillMatch & { key: string; label: string };

/**
 * Type-to-search skill picker (UX-2). Students type everyday words ("python", "figma", "power bi");
 * results show the plain skill name, its area and a one-line description. Codes stay out of sight.
 */
export function SkillPicker({
  id, label, catalog, selected, onChange, max = 10, hint, error, single = false,
}: {
  id: string; label: string; catalog: SkillOption[]; selected: string[]; onChange: (codes: string[]) => void;
  max?: number; hint?: string; error?: string; single?: boolean;
}) {
  const options = useMemo<Item[]>(() => catalog.map((c) => ({ ...c, key: c.code, label: c.name })), [catalog]);
  const search = useCallback((opts: Item[], q: string, exclude: string[]) => searchSkills(opts, q, exclude, 30).map((s) => ({ ...s, key: s.code, label: s.name })), []);
  return (
    <SearchPicker
      id={id}
      label={label}
      options={options}
      selected={selected}
      onChange={onChange}
      search={search}
      max={max}
      single={single}
      error={error}
      hint={hint ?? "Search with everyday words: tools, languages or topics you used."}
      placeholder="Type a tool or topic, e.g. python, figma, power bi"
      emptyHeading="Popular with freshers"
      noMatch={(q) => <>No match for “{q}”. Try a broader word such as coding, data, design, cloud or testing.</>}
      renderOption={(r) => (
        <>
          <span className="sp-name">{r.name}</span>
          <span className="sp-meta">
            {r.via ? <span className="sp-via">matches “{r.via}”</span> : null}
            {r.category}
          </span>
          {r.description && <span className="sp-desc">{shortDescription(r.description)}</span>}
        </>
      )}
    />
  );
}
