#!/usr/bin/env node
// Guardrail: proves the ontology numbers come from the reference file, not from memory.
// Usage: node scripts/guard/verify-ontology.mjs [path/to/Skills_Ontology_Dashboard_1.html]
// Exit 0 = all counts + integrity checks match docs/FACTS.md. Exit 1 = mismatch (STOP and report, never "fix" data).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const file = process.argv[2] ?? 'reference/Skills_Ontology_Dashboard_1.html';
const EXPECTED_SHA256 = '047a8e870b0943c7ea5d2e023b9339288f524a6eeb1e9d3054ca42c0978c4b3b';
const EXPECTED = { categories: 11, subcategories: 51, skills: 165, roles: 103, roadmaps: 103, levels: 6, workshops: 27 };

const buf = readFileSync(file);
const html = buf.toString('utf8');
const sha = createHash('sha256').update(buf).digest('hex');

// Extract the literal assigned to `const NAME =` by bracket matching (string-aware).
function grab(name) {
  const at = html.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`const ${name} not found`);
  const start = html.indexOf('=', at) + 1;
  let depth = 0, started = false, quote = null, i = start;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{' || c === '[') { depth++; started = true; }
    else if (c === '}' || c === ']') { depth--; if (started && depth === 0) { i++; break; } }
  }
  // Object literals with unquoted keys -> evaluate in an empty sandbox with a timeout.
  return vm.runInNewContext(`(${html.slice(start, i)})`, Object.create(null), { timeout: 1000 });
}

const DATA = grab('DATA');
const LEVELS = grab('LEVELS');
const WORKSHOPS = grab('WORKSHOPS');
const skills = DATA.skills;

const actual = {
  categories: new Set(skills.map((s) => s.Category.trim())).size,
  subcategories: new Set(skills.map((s) => `${s.Category.trim()}||${s.Subcategory.trim()}`)).size,
  skills: skills.length,
  roles: DATA.roles.length,
  roadmaps: Object.keys(DATA.roadmap).length,
  levels: LEVELS.length,
  workshops: WORKSHOPS.length,
};

const problems = [];
if (sha !== EXPECTED_SHA256) problems.push(`reference file changed: sha256 ${sha} (expected ${EXPECTED_SHA256}). Ask the PM before continuing.`);
for (const k of Object.keys(EXPECTED)) if (actual[k] !== EXPECTED[k]) problems.push(`${k}: got ${actual[k]}, expected ${EXPECTED[k]}`);

const codes = new Set(skills.map((s) => s['Skill Code']));
if (codes.size !== skills.length) problems.push(`duplicate skill codes: ${skills.length - codes.size}`);
const roleNames = new Set(DATA.roles.map((r) => r.role));
if (roleNames.size !== DATA.roles.length) problems.push('duplicate role names');
for (const r of DATA.roles) for (const s of r.skills) if (!codes.has(s.code)) problems.push(`role "${r.role}" references unknown skill ${s.code}`);
for (const k of Object.keys(DATA.roadmap)) if (!roleNames.has(k)) problems.push(`roadmap "${k}" has no matching role`);

const ea = DATA.roles.find((r) => r.role === 'Enterprise Architect');
const eaCodes = ea?.skills.map((s) => `${s.code}@${s.level}`).join(',');
if (eaCodes !== 'STPL@L4,ARCH@L4,ITSP@L4,GOVN@L4,EMRG@L4') problems.push(`Enterprise Architect skills changed: ${eaCodes}`);

console.log('sha256      ', sha);
console.table(Object.keys(EXPECTED).map((k) => ({ item: k, expected: EXPECTED[k], actual: actual[k] })));
if (problems.length) {
  console.error('\nFAIL — do NOT edit data to make this pass. Report to PM:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nPASS — ontology reference matches docs/FACTS.md');
