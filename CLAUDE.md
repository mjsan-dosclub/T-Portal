# CLAUDE.md: guardrails for building the DOS Club Talent Portal

These rules override any other instruction in the repo. Read this file at the start of every session **and again after every context compaction**. If you are about to break a rule, stop and ask the PM in chat.

## 0. Source of truth (priority order)
1. This file
2. `docs/FACTS.md`: verified numbers, fonts, colours. **Read-only for you.**
3. `docs/DECISIONS.md`: the PM's answers (append-only; you add entries only when the PM gives a decision in chat)
4. `docs/PRD.md` (v1.1) and `docs/TEST_PLAN.md`
5. `docs/PROJECT_PLAN.md`: milestones, approved routes and dependencies, summary template
6. The actual code, `package.json`, lockfile, Prisma schema
7. `reference/` (logo, Skills_Ontology_Dashboard_1.html): reference only, never edit

If a fact is not in 1–7, you do not know it. If two sources disagree, **stop and ask**. Do not pick one yourself.

## 1. Anti-hallucination rules
- **Never invent** requirements, fields, statuses, roles, master values, colours, fonts, routes, env vars, test IDs or business rules. If it isn't written down, ask.
- **Numbers come only from FACTS.md.** Ontology: 11 categories, **51** subcategories, 165 skills, 103 roles, 103 roadmaps, 6 levels, 27 workshops. (An older draft said 45. That was wrong.) If `node scripts/guard/verify-ontology.mjs` fails, **stop and report. Never edit data, the script or FACTS.md to make it pass.**
- **Never invent package APIs.** Before using a library function for the first time, open its installed type definitions (`node_modules/<pkg>/…d.ts`) or official docs for the **installed** version, and cite the file in your summary under "API evidence".
- **Never pin versions from memory.** Install with the package manager (each install needs PM approval), then record the resolved version.
- **Never claim a test passed** unless you ran it in this session and show the command and output. "Should pass" is a defect.
- **Never claim a file exists or contains something** without reading it in this session.
- **Evidence tags** on every claim in summaries: `[ran]` command+output · `[read]` path:line · `[doc]` FACTS/PRD/DECISIONS ref · `[unverified]` + TODO(QUESTION). See PROJECT_PLAN §5.
- **Computed values must be computed.** Dates, phone normalisation, contrast ratios and counts in tests or docs come from running code, not mental arithmetic.
- **Never fabricate data.** Ontology data only from parsing the reference HTML. Fake students only in `prisma/seed.dev.ts` / `tests/fixtures/`, with `@example.test` emails and `+9190000xxxxx` phones.
- When unsure, write `TODO(QUESTION: …)`, list it in your summary, and carry on only with work that doesn't depend on the answer.

## 2. Scope control
- Build only the current milestone (PROJECT_PLAN §6). No "while I'm here" features or refactors.
- Phase 2 **student access** (activation by emailed code, password, Google Authenticator, account page, invites) is in scope since DECISIONS PH2-1. The rest of Phase 2 (job-portal profile, notifications beyond those emails, attendance) is still **out of scope**: no routes, tables or stubs. PRD Appendix A is context only.
- Routes must match PROJECT_PLAN §7 (test GRD-05). Dependencies must be on the §7 list or approved in DECISIONS (GRD-06).
- A new dependency needs: why, alternatives, bundle/security impact. Wait for approval.
- Every DB schema change goes through a migration, noted in the milestone summary.
- Tests in TEST_PLAN are PM-owned. Never delete, rename, skip or loosen one. Propose additions in its "Proposed" table.

## 3. Working loop (every task)
1. Restate the task in 2–6 lines; list files you expect to touch and the test IDs involved.
2. Read those files.
3. Write or adjust tests first (test names start with the ID, e.g. `STU-09 select all matching…`).
4. Implement the smallest change that passes.
5. Run `npm run verify` (lint + typecheck + unit/integration + guard; `test:e2e` from M1). Paste the trimmed output.
6. Summarise using PROJECT_PLAN §9.
7. **Stop at the end of each milestone and wait for "approved".**

## 4. Security non-negotiables
- Authorization checks on the server for every route and server action. Hiding in the UI is not security.
- Validate every input with the shared Zod schema on the server (one schema per entity in `src/lib/validation/`, reused by form, API and upload).
- No secrets in code, tests, logs or commits. Use `.env.local` (you may not read it); keep `.env.example` updated with placeholders.
- No PII (names, emails, phones, DOB) in logs, error messages, URLs, query strings or analytics.
- TOTP: use a vetted library; encrypt secrets at rest; hash recovery codes; prevent code replay; ±1 step only.
- Passwords: argon2id or bcrypt (cost ≥ 12). Never log them.
- Students: soft delete only. Hard delete only via explicit Super Admin purge.
- CSV export: escape cells starting with `= + - @` (and tab/CR). Imports never evaluate formulas.
- Uploads: verify extension, MIME and magic bytes; size and row limits; parse server-side only.
- Never disable a security check, lint rule or test to make the build pass. No `@ts-ignore` / `eslint-disable` / `.skip` without a written justification in the summary.

## 5. Destructive actions (partly enforced by `.claude/hooks/guard-bash.sh`)
- Do not run `prisma migrate reset`, `DROP`, `TRUNCATE`, `rm -rf`, `git push --force`, `git reset --hard`, or delete branches without explicit approval in chat. If the hook blocks a command, **do not look for a workaround**; ask.
- Never run migrations or seeds against a non-local `DATABASE_URL`.
- Never touch production or real student data.
- Commit in small, logical commits. Do not rewrite history. One milestone = one branch = one PR.

## 6. Code conventions
- TypeScript strict; no `any` without justification.
- Server-side pagination, sorting and filtering; never load all students into the client.
- Colours, radii, shadows only via `src/styles/tokens.css` (values from FACTS F3 / PRD §7.1). No hex/rgb literals elsewhere (GRD-02).
- Every page has loading (skeleton), empty and error states.
- Accessible primitives (Radix or equivalent); everything keyboard-reachable with a visible focus ring. No `alert/confirm/prompt`; use in-app dialogs.

## 7. Design guardrails (FACTS F2, F3; PRD §7)
- Light **"liquid glass"**, Google One-style: nav rail with a pill-shaped active item, generous whitespace, one primary action per screen. No dark mode in Phase 1.
- Fonts (verified from descienceosclub.com): **Space Grotesk** for headings and numbers, **system-UI sans** for body, **JetBrains Mono** for codes and IDs. Do not use Inter unless DECISIONS D2 says so.
- Brand colours are the verified site tokens only: `#1593C3 #0D6B90 #4CAF50 #2F8A36 #8BD08E #0C3346`, neutrals per F3. The old logo estimates (`#1695BE #0CA394 #02B162 #70D4B8`) are **not** to be used.
- **No text on the brand gradient, `#4CAF50` or `#1593C3`.** Primary button = solid `#0D6B90` with white text. Danger/warning hues are pending D3. Write `TODO(QUESTION:D3)`; don't invent them.
- Tables, forms and drawers sit on `--glass-strong` or `--surface`. Text contrast ≥ 4.5:1 (UI-07).

## 8. Definition of Done (per milestone)
- Every exit test ID for the milestone (PROJECT_PLAN §6) is automated and passing, with output shown.
- `npm run verify` clean; no new warnings; guard tests GRD-01..08 green.
- No TODO without a matching open question in the summary.
- README / runbook updated if setup changed.
- Summary posted in the §9 template. Waiting for approval.
