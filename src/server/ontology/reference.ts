import { readFileSync } from "node:fs";
import vm from "node:vm";

// Parses reference/Skills_Ontology_Dashboard_1.html: the ONLY source of ontology data (CLAUDE.md §1).
// Same extraction as scripts/guard/verify-ontology.mjs.

export type RefSkill = { Category: string; Subcategory: string; "Skill Code": string; "Skill Name": string; "Overall Description": string; Source: string };
export type RefRole = { role: string; category: string; track: string; levelMin: number; levelMax: number; skills: { code: string; name: string; level: string }[] };
export type RefRoadmapStep = { level: string; levelNum: number; whatYouDo: string; tools: string; next: string };
export type RefData = {
  skills: RefSkill[];
  roles: RefRole[];
  roadmap: Record<string, RefRoadmapStep[]>;
  levels: { n: number; name: string; desc: string }[];
  workshops: { n: number; t: string; r: string }[];
};

function grab(html: string, name: string): unknown {
  const at = html.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`const ${name} not found in reference HTML`);
  const start = html.indexOf("=", at) + 1;
  let depth = 0;
  let started = false;
  let quote: string | null = null;
  let i = start;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "{" || c === "[") {
      depth++;
      started = true;
    } else if (c === "}" || c === "]") {
      depth--;
      if (started && depth === 0) {
        i++;
        break;
      }
    }
  }
  return vm.runInNewContext(`(${html.slice(start, i)})`, Object.create(null), { timeout: 1000 });
}

export const REFERENCE_PATH = "reference/Skills_Ontology_Dashboard_1.html";

export function loadReference(path = REFERENCE_PATH): RefData {
  const html = readFileSync(path, "utf8");
  const DATA = grab(html, "DATA") as { skills: RefSkill[]; roles: RefRole[]; roadmap: Record<string, RefRoadmapStep[]> };
  return {
    skills: DATA.skills,
    roles: DATA.roles,
    roadmap: DATA.roadmap,
    levels: grab(html, "LEVELS") as RefData["levels"],
    workshops: grab(html, "WORKSHOPS") as RefData["workshops"],
  };
}

/** "1. Strategy, Architecture & Innovation" → { id: 1, name: "Strategy, Architecture & Innovation" } */
export function splitNumbered(s: string): { code: string; name: string } {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\.?\s+(.*)$/);
  if (!m) throw new Error(`Unnumbered ontology label: ${s}`);
  return { code: m[1]!, name: m[2]!.trim() };
}

export function levelNum(l: string): number {
  const m = /^L(\d)$/.exec(l.trim());
  if (!m) throw new Error(`Bad level ${l}`);
  return Number(m[1]);
}
