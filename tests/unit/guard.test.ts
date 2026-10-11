import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardrail tests (TEST_PLAN §0): they stop hallucinated or unapproved values reaching the code.
const ROOT = process.cwd();

function walk(dir: string, filter: (f: string) => boolean = () => true): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === "node_modules" || f === "generated" || f.startsWith(".next")) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(ROOT, p);

describe("Guardrails", () => {
  it("GRD-01 ontology reference verifies against FACTS (11/51/165/103/103/6/27, sha256)", () => {
    const out = execSync("node scripts/guard/verify-ontology.mjs", { cwd: ROOT, encoding: "utf8" });
    expect(out).toMatch(/PASS/);
  });

  it("GRD-02 no colour literals (hex / rgb) outside src/styles/tokens.css", () => {
    const files = walk(path.join(ROOT, "src"), (f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(path.join("styles", "tokens.css")));
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(line.replace(/&#\d+;/g, "")) || /\brgba?\(/.test(line)) hits.push(`${rel(f)}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("GRD-03 every hex in tokens.css is a verified site token from FACTS.md", () => {
    const tokens = readFileSync(path.join(ROOT, "src/styles/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const facts = readFileSync(path.join(ROOT, "docs/FACTS.md"), "utf8").toUpperCase();
    const hexes = [...new Set(tokens.match(/#[0-9a-fA-F]{6,8}\b/g) ?? [])];
    expect(hexes.length).toBeGreaterThan(5);
    const unknown = hexes.filter((h) => !facts.includes(h.toUpperCase()));
    expect(unknown).toEqual([]);
  });

  it("GRD-04 every test ID used in tests exists in TEST_PLAN, and every automated ID has a test", () => {
    const plan = readFileSync(path.join(ROOT, "docs/TEST_PLAN.md"), "utf8");
    const rows = [...plan.matchAll(/^\| ([A-Z]{2,4}-\d{2}) \|.*\| (U|I|E|M) \|\s*$/gm)].map((m) => ({ id: m[1]!, level: m[2]! }));
    const planned = new Set(rows.map((r) => r.id));
    const testFiles = [...walk(path.join(ROOT, "tests"), (f) => f.endsWith(".test.ts")), ...walk(path.join(ROOT, "e2e"), (f) => f.endsWith(".spec.ts"))];
    const used = new Set<string>();
    for (const f of testFiles) for (const m of readFileSync(f, "utf8").matchAll(/(?:it|test)\(\s*["'`]((?:[A-Z]{2,4}-\d{2})(?:[ ,/]+[A-Z]{2,4}-\d{2})*)/g)) for (const id of m[1]!.match(/[A-Z]{2,4}-\d{2}/g)!) used.add(id);
    const orphans = [...used].filter((id) => !planned.has(id));
    expect(orphans, "test IDs not in TEST_PLAN").toEqual([]);
    const missing = rows.filter((r) => r.level !== "M" && !used.has(r.id)).map((r) => r.id);
    expect(missing, "automated test IDs without a test").toEqual([]);
  });

  it("GRD-05 routes match the approved inventory; no Phase 2 routes", () => {
    const app = path.join(ROOT, "src/app");
    const pages = walk(app, (f) => /[/\\]page\.tsx$/.test(f)).map((f) =>
      "/" + path.dirname(rel(f)).replace(/^src[/\\]app[/\\]?/, "").split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join("/"),
    ).map((r) => (r === "/." || r === "/" ? "/" : r.replace(/\/$/, "")));
    const approved = new Set([
      "/login", "/login/totp", "/login/recovery", "/enrol-2fa", "/", "/students", "/students/new", "/students/[id]/edit", "/students/upload",
      "/recycle-bin", "/masters", "/masters/[type]", "/ontology", "/ontology/categories", "/ontology/roles", "/ontology/levels", "/ontology/program",
      "/audit", "/admin/users", "/account",
      // ROUTE-2 (DECISIONS): ontology maintenance + guides
      "/ontology/manage", "/help", "/how-it-works",
      // PH2-1/PH2-5 (DECISIONS): student portal access
      "/student", "/student/login", "/student/activate", "/student/forgot", "/student/totp", "/student/recovery", "/student/enrol", "/student/account", "/student/change-password",
    ]);
    expect(pages.filter((p) => !approved.has(p))).toEqual([]);
    const all = walk(app).map(rel).join("\n");
    expect(all).not.toMatch(/[/\\](profile|signup|sign-up|register)[/\\]/i); // Phase 2 profile still out of scope
  });

  it("GRD-06 dependencies are on the approved list", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const allow = JSON.parse(readFileSync(path.join(ROOT, "scripts/guard/allowed-deps.json"), "utf8")) as { planned: string[]; added: Record<string, string> };
    const ok = new Set([...allow.planned, ...Object.keys(allow.added)]);
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => !ok.has(d))).toEqual([]);
  });

  it("GRD-07 basic secret scan of tracked files finds nothing; secret files are git-ignored", () => {
    const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
    const patterns = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /(APP_ENCRYPTION_KEY|RECOVERY_PEPPER|PASSWORD|SECRET)\s*=\s*["']?[A-Za-z0-9+/=_-]{16,}/, /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@(?!127\.0\.0\.1|localhost)/];
    const hits: string[] = [];
    for (const f of tracked) {
      if (/\.(png|ico|jpg|woff2?)$/.test(f) || f === "package-lock.json" || f.startsWith("reference/")) continue;
      const text = readFileSync(path.join(ROOT, f), "utf8");
      for (const p of patterns) if (p.test(text)) hits.push(`${f}: ${p}`);
    }
    expect(hits).toEqual([]);
    for (const f of [".env", ".env.local", ".dev-admin.local", ".pgdata/PG_VERSION"]) {
      expect(execSync(`git check-ignore -q ${f} && echo ignored || echo tracked`, { cwd: ROOT, encoding: "utf8" }).trim(), f).toBe("ignored");
    }
  });

  it("GRD-08 no ts-ignore / eslint-disable / skipped or focused tests", () => {
    const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "tests")), ...walk(path.join(ROOT, "e2e"))].filter((f) => /\.(tsx?|mts)$/.test(f) && !f.endsWith("guard.test.ts"));
    const bad = /@ts-ignore|@ts-nocheck|eslint-disable|\b(it|test|describe)\.(skip|only)\(|test\.fixme\(/;
    expect(files.filter((f) => bad.test(readFileSync(f, "utf8"))).map(rel)).toEqual([]);
  });
});
