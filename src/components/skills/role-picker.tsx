"use client";

import { useCallback, useMemo } from "react";
import { SearchPicker } from "@/components/search-picker";
import { isEntryRole, searchRoles, type RoleMatch, type RoleOption } from "@/lib/role-search";

type Item = RoleMatch & { key: string; label: string };

/**
 * Type-to-search role picker (UX-3): preferred roles (up to 3) and the Career plan target role.
 * Freshers type everyday job words ("developer", "tester", "designer"); entry-level roles are marked and come first.
 */
export function RolePicker({
  id, label, roles, selected, onChange, max = 3, single = false, hint, error,
}: {
  id: string; label: string; roles: RoleOption[]; selected: string[]; onChange: (ids: string[]) => void;
  max?: number; single?: boolean; hint?: string; error?: string;
}) {
  const options = useMemo<Item[]>(() => roles.map((r) => ({ ...r, key: r.id, label: r.name })), [roles]);
  const search = useCallback((opts: Item[], q: string, exclude: string[]) => searchRoles(opts, q, exclude, 30).map((r) => ({ ...r, key: r.id, label: r.name })), []);
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
      hint={hint ?? "Search with job words, e.g. developer, tester, designer, data, cloud, security, marketing."}
      placeholder="Type a job, e.g. developer, data analyst, cloud"
      emptyHeading="Good starting roles for freshers"
      noMatch={(q) => <>No role matches “{q}”. Try a broader word such as developer, data, design, cloud, security, sales or HR.</>}
      renderOption={(r) => (
        <>
          <span className="sp-name">{r.name}</span>
          <span className="sp-meta">
            {r.via ? <span className="sp-via">matches “{r.via}”</span> : null}
            {r.category}
            <span>· {isEntryRole(r) ? "Entry-level friendly" : r.levelMin >= 5 ? "Senior leadership role" : "Needs some experience"}</span>
          </span>
        </>
      )}
    />
  );
}
