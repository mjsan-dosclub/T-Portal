# PROJECT_PLAN.md: DOS Club Talent Portal, Phase 1

**Project manager:** Bharathiraja · **Builder:** Claude Code (AI engineer) + human code reviewer
**Version:** 1.0 · 2026-10-11 · **Status:** Ready for kickoff once the blocking decisions in §10 are answered

This is the delivery plan. *What* to build is in `PRD.md`. *How we prove it works* is in `TEST_PLAN.md`. *Which facts are verified* is in `FACTS.md`. *Rules for Claude Code* are in `/CLAUDE.md`.

---

## 1. The pack and the reading order

```
dos-club-talent-portal/
├── CLAUDE.md                     ← guardrails, read first every session (Claude Code auto-loads it)
├── KICKOFF_PROMPT.md             ← paste as the first message to Claude Code
├── .claude/settings.json         ← enforced: blocks edits to reference/ and FACTS, asks before installs/push
├── .claude/hooks/guard-bash.sh   ← enforced: blocks rm -rf, migrate reset, force-push, non-local DB writes
├── scripts/guard/verify-ontology.mjs  ← proves ontology counts from the source file (GRD-01)
├── docs/
│   ├── PROJECT_PLAN.md   ← this file
│   ├── PRD.md            ← requirements v1.1
│   ├── TEST_PLAN.md      ← every test ID
│   ├── FACTS.md          ← verified numbers, fonts, colours (read-only for Claude)
│   └── DECISIONS.md      ← your answers, append-only
└── reference/            ← logo.png, Skills_Ontology_Dashboard_1.html (read-only)
```

**Precedence when documents disagree:** CLAUDE.md → FACTS.md → DECISIONS.md → PRD.md → TEST_PLAN.md → code → reference/. If two documents disagree, Claude Code stops and asks. It does not choose.

## 2. Product in one paragraph

A secure, light-themed ("liquid glass", Google One-style) admin portal for DOS Club. Admins sign in with password plus **Google Authenticator (TOTP)** and keep a clean **student master**. They add students manually or by bulk XLSX/CSV upload, then manage them in a server-side **datatable** with search, filters, preview drawer, edit, **bulk status update** and **bulk soft delete** with undo and a Recycle Bin. Lookup **master tables** (institutions, degrees, departments, DOS Club batches, colour teams, statuses) keep data consistent. The existing **Skills Ontology** dashboard is rebuilt as a read-only module on the database. Every change is audited. **Phase 2** (not now): students log in and build a Naukri/Indeed-style profile (PRD Appendix A).

### Scope fence

| In Phase 1 | Out (Phase 2 or later) |
|---|---|
| Admin login + TOTP + recovery codes; RBAC (Super Admin / Admin / Viewer) | Student login, student self-service |
| Student master: add, edit, preview, upload, bulk status, bulk soft delete, recycle bin, export | Resume, projects, experience, preferences, verification |
| Master tables with CRUD + CSV import | Email/SMS/WhatsApp notifications |
| Ontology: 5 read-only views | Workshop attendance tracking (unless D5 changes) |
| Audit log, simple dashboard counts | Analytics, payments, certificates, mobile apps, dark mode |

## 3. Roles and responsibilities (RACI)

| Activity | PM (you) | Claude Code | Code reviewer (human dev) | DOS Club ops (data owner) |
|---|---|---|---|---|
| Requirements, decisions D1–D14 | **A/R** | C (raises questions) | C | C |
| Facts registry (FACTS.md) | **A/R** | I (reads only) | C | I |
| Implementation, tests | A | **R** | C | – |
| Code review, security review, merge | A | I | **R** | – |
| Milestone acceptance | **A/R** | I | C | – |
| Real student data import (prod) | A | – (never) | C | **R** |
| UAT | **A** | I | C | **R** |

A = accountable, R = responsible, C = consulted, I = informed. **Claude Code never touches production or real student data.**

## 4. Pain points

### 4A. Business pain points: what the product solves

Full table in PRD §4; test coverage map in TEST_PLAN "Coverage". Summary:

| # | Pain | Solution in one line | Proven by |
|---|---|---|---|
| P1 | Duplicate students | Unique normalised email + phone; flagged in preview | UPL-03/04, STU-02 |
| P2 | "CSE" vs "Computer Sci" | Masters + aliases + mapping step | MST-04, UPL-07 |
| P3 | Messy Excel (9.18E+11, serial dates) | Server-side typed parsing | UPL-05/06/14/15 |
| P4 | Accidental bulk delete | Soft delete, typed DELETE, undo, recycle bin | STU-10/11/12 |
| P5 | Lost phone with authenticator | Recovery codes + Super Admin reset | AUTH-08/13 |
| P6 | Big files freeze the browser | Server-side batches, 10k / 5 MB limit | UPL-09/16 |
| P7 | No accountability | Append-only audit log | AUD-01..04 |
| P8 | PII exposure (DPDP Act 2023) | Least privilege, no PII in URLs/logs | SEC-03/05/08, STU-19 |
| P9 | Tamil names break | UTF-8 end to end, BOM handling | UPL-08, UI-06 |
| P10 | CSV formula injection | Escape on export, never evaluate on import | UPL-11, STU-14 |
| P11 | Slow table at 6,000+ | Server pagination + indexes | STU-15 |
| P12 | "Select all" ambiguity | Page vs. all-matching, explicit | STU-08/09 |
| P13 | Status changes without reason | Reason field → audit | STU-09 |
| P14 | Unclear upload errors | Per-cell reasons + error CSV | UPL-02/12 |
| P15 | Lost work mid-upload or mid-form | Persisted upload jobs, unsaved-changes guard | UPL-17, STU-24 |
| P16 | Ontology licence (SFIA 9) | Source tagged per skill; D11 sign-off | ONT-09 |

### 4B. Delivery pain points: what goes wrong when an AI builds the app

Each one has a countermeasure that is **enforced by a mechanism**, not only written as a request.

| # | Failure mode | Real example from this project | Countermeasure | Enforcement |
|---|---|---|---|---|
| H1 | **Invented facts and numbers** | Draft PRD v1.0 said **45** subcategories; the file has **51** | Numbers only from FACTS.md; source parsed by script | GRD-01 in CI; FACTS.md is edit-denied |
| H2 | **Unverified design claims** | v1.0 asked for white text on the gradient, which has 2.78:1 contrast and fails WCAG | Tokens only from FACTS F3; contrast computed, not assumed | GRD-02, GRD-03, UI-07 |
| H3 | **Font assumed, not checked** | v1.0 assumed Inter for body; the site uses the system-UI stack | Fonts verified from site CSS (F2) | Review checklist; D2 |
| H4 | **Invented library APIs / versions** | e.g. calling an otplib or Auth.js function that doesn't exist in the installed major version | Read the installed types in `node_modules` before use; cite the file | Typecheck in CI; reviewer checks the "API evidence" section of the summary |
| H5 | **"Tests pass" without running them** | Summary claims green, CI is red | Paste the command and output; CI is the judge | CI required on every PR; summary template §9 |
| H6 | **Weakening tests to go green** | `.skip`, loosened assertions, `@ts-ignore` | Tests are PM-owned; changes need approval | GRD-04, GRD-08; reviewer diffs `tests/` |
| H7 | **Scope creep** | Scaffolding a student login "for later" | Build only the current milestone | GRD-05 route inventory; GRD-06 dependency allowlist |
| H8 | **Silent data "fixes"** | Editing the seed until counts match | Mismatch means stop and report | verify-ontology exits 1 with "do NOT edit data" |
| H9 | **Destructive commands** | `prisma migrate reset` on the wrong DB | Blocked or approval required | `.claude/hooks/guard-bash.sh`, settings `ask` list |
| H10 | **Context loss after long sessions / compaction** | Forgets a decision, re-asks or contradicts it | CLAUDE.md re-read rule; decisions written to DECISIONS.md | CLAUDE.md §0; one milestone per session |
| H11 | **Security shortcuts** | Role check only in the UI; PII in logs | Server-side checks; log scrubbing | AUTH-16 role matrix, SEC-03 |
| H12 | **Big-bang changes** | 3,000-line PR nobody can review | Small commits; one milestone per PR | Reviewer rejects PRs > ~800 changed lines without a split plan |
| H13 | **Fake data leaking into real use** | Seed students mixed with real ones | Fakes only in `seed.dev.ts`/fixtures with `@example.test` | Prod seed contains only Super Admin + masters + ontology |
| H14 | **Plausible-but-wrong date/phone logic** | Excel serial 45123 written as 2023-07-17 (actual: 2023-07-16) | Every conversion example is unit-tested with computed values | UPL-05, UPL-06 |

## 5. Anti-hallucination system (how it fits together)

```
            ┌──────────── FACTS.md (PM-owned, read-only to Claude) ────────────┐
            │  counts · fonts · colours · contrast · sha256 of reference files │
            └───────────────┬───────────────────────────────┬─────────────────┘
                            │                               │
   verify-ontology.mjs (GRD-01)          token/hex tests (GRD-02/03), contrast test (UI-07)
                            │                               │
   CLAUDE.md rules ──► Claude Code works ──► milestone summary with EVIDENCE ──► CI gates ──► human review ──► PM approval
        ▲                    │                                                                             │
        │      hooks + permissions block destructive/out-of-scope actions                                  │
        └──────────────── DECISIONS.md ◄────────────── PM answers questions ◄──────────────────────────────┘
```

**The evidence rule.** Every claim in a milestone summary must carry one of these:
- `[ran]`: command + trimmed output from this session
- `[read]`: `path:line` of the file read
- `[doc]`: FACTS/PRD/DECISIONS reference (e.g. `FACTS F1.2`)
- `[unverified]`: stated as unknown, with a `TODO(QUESTION)`

A claim without a tag counts as a defect, even if it happens to be true.

**The "I don't know" protocol.** When information is missing, Claude Code writes `TODO(QUESTION: Dn or Qn)`, adds the question to its summary, and continues with work that doesn't depend on it. If everything depends on it, it stops.

## 6. Milestones

Size is relative effort (S < M < L). Use it for sequencing, not as dates. Each milestone = one branch + one PR + one summary + your approval.

| # | Milestone | Size | Must be decided first | Exit tests |
|---|---|---|---|---|
| M0 | Scaffold, CI, lint, typecheck, Vitest, Playwright, env template, guard tests | S | D7 | GRD-01..08 |
| M1 | Design tokens, app shell (nav rail, glass, top bar), login screen UI (static) | M | D2, D3 | UI-02..07, GRD-02/03 |
| M2 | Auth + TOTP + recovery + RBAC + audit log + admin user management | L | D1 | AUTH-01..16, AUD-01..04 |
| M3 | Master tables CRUD + CSV import | M | D4 | MST-01..10 |
| M4 | Student CRUD, datatable, preview, bulk status, bulk delete, recycle bin, export, dashboard | L | D6, D10, D12, D13 | STU-01..24, DSH-01..02 |
| M5 | Bulk upload wizard (template, parse, preview, mapping, import, error report) | L | D8, D9 | UPL-01..18 |
| M6 | Ontology seed + 5 views (+ optional target role, D5) | M | D5, D11 | ONT-01..09 |
| M7 | Hardening, security, performance, README + runbook, UAT | M | D14 | SEC-01..10, STU-15, UPL-16, UI-01..07 re-run, UAT §11 |

### Kick-off prompt for each milestone (paste into Claude Code after approving the previous one)

> `approved: start M{n}`. Re-read CLAUDE.md, FACTS.md, DECISIONS.md and PRD sections {list}. Restate the M{n} scope in ≤6 lines, list the files you will create/modify and the test IDs you will satisfy, and list any open questions. Then write the tests first, implement, run `npm run verify`, and stop with the summary template from PROJECT_PLAN §9. Don't start M{n+1}.

(`npm run verify` = `lint && typecheck && test && guard`, plus `test:e2e` from M1 onwards; created in M0.)

## 7. Approved inventories (GRD-05 / GRD-06 check against these)

### Screens / routes (Phase 1). Changes need a PM decision.

| Route | Who | Purpose |
|---|---|---|
| `/login`, `/login/totp`, `/login/recovery` | public | Sign-in steps |
| `/enrol-2fa` | signed-in, not enrolled | QR + manual key + verify + recovery codes |
| `/` | all roles | Dashboard home (counts, recent activity) |
| `/students` | all roles (Viewer read-only) | Datatable, filters, bulk bar, preview drawer |
| `/students/new`, `/students/[id]/edit` | Admin+ | Form |
| `/students/upload` | Admin+ | 4-step wizard |
| `/recycle-bin` | Super Admin | Restore / purge |
| `/masters/[type]` | Admin+ (Viewer read) | institutions, degrees, departments, batches, teams, statuses |
| `/ontology`, `/ontology/categories`, `/ontology/roles`, `/ontology/levels`, `/ontology/program` | all roles | 5 views |
| `/audit` | Super Admin | Audit log |
| `/admin/users` | Super Admin | Invite, deactivate, reset 2FA, change role |
| `/account` | all roles | Own password, own 2FA, regenerate recovery codes |
| `/api/**` | per route | Server endpoints backing the above only |

Nav rail order (Google One style): Home · Students · Upload · Masters · Ontology, then a divider, then Recycle Bin · Audit · Admin users (Super Admin only), with Account at the bottom.

### Dependencies (pending D7). Anything else needs a written request (why, alternatives, size, security).
next, react, react-dom, typescript, prisma, @prisma/client, zod, @tanstack/react-table, tailwindcss, @radix-ui/* primitives, otplib (or the TOTP from the chosen auth library), an argon2 or bcrypt package, xlsx (SheetJS), papaparse, vitest, @playwright/test, @axe-core/playwright, eslint + config, prettier. Install from the package manager and record the **resolved** versions; do not pin versions from memory.

## 8. Risk register

| ID | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | AI-generated code contains confident errors (H1–H14) | H | H | §4B and §5 mechanisms; human review of every PR | PM + reviewer |
| R2 | Real student PII handled without a lawful basis (DPDP) | M | H | D8 answered before M5; consent source recorded; least privilege | PM / DOS ops |
| R3 | SFIA licence restricts showing ontology content | M | M | D11 before M6 go-live; `source` column allows hiding SFIA rows | PM |
| R4 | Glass UI fails contrast and readability | M | M | Tables on `--glass-strong`; UI-07 automated contrast | Claude + reviewer |
| R5 | Existing membership system (D9) makes upload redundant | M | M | Answer D9 before M5; the upload stays useful for corrections | PM |
| R6 | Admin locked out (lost phone, no Super Admin available) | L | H | ≥2 Super Admins; runbook break-glass procedure (CLI reset, audited) | PM |
| R7 | Performance at 10k+ rows | L | M | Indexes, server pagination, STU-15 perf test | Claude |
| R8 | Excel edge cases in real files | H | M | Ask DOS ops for 3 anonymised real sample files before M5 | PM |
| R9 | Scope creep into Phase 2 | M | M | Scope fence §2; GRD-05 | PM |
| R10 | Single human reviewer bottleneck | M | M | Small PRs; review checklist §10 | PM |

## 9. Milestone summary template (Claude Code must use this)

```markdown
## M{n} summary: {title}
**Scope delivered:** …
**Out of scope / deferred:** …
**Files changed:** (grouped by area)
**Schema/migrations:** name + reversible? (y/n)
**New dependencies:** name@resolved-version, reason (link to approval in DECISIONS)
**Test IDs:** table: ID | status | evidence  (every row PASS/FAIL/BLOCKED, no blanks)
**Commands run:** [ran] npm run verify → (trimmed output: counts of passed/failed)
**API evidence:** library functions used for the first time + the type file they were checked against [read]
**Deviations from PRD/CLAUDE.md:** none / list with reason
**Suppressions:** any ts-ignore / eslint-disable / skip, with justification (expected: none)
**Open questions:** Q…, D…
**Screenshots:** (UI milestones) 1280, 1440, 768
Waiting for approval.
```

## 10. PM acceptance checklist (use it at every milestone)

- [ ] CI is green on the PR (check it yourself; don't rely on the summary)
- [ ] Every exit test ID for the milestone is in the summary table with evidence
- [ ] No test file was weakened (look at the `tests/` and `e2e/` diff for removed asserts, `.skip`, `.only`)
- [ ] No new dependency without an approval line in DECISIONS.md
- [ ] No new route outside §7
- [ ] No hex colours or fonts outside tokens (GRD-02/03 green)
- [ ] Screens: one primary action per screen, glass rules followed, readable text on tables
- [ ] Every open question is either answered (and logged in DECISIONS.md) or tracked
- [ ] `git log` shows small commits; no force-push
- [ ] Try the feature yourself for 10 minutes using the UAT steps below

### Decisions that block milestones

| Blocks | Decision | Default if you accept the recommendation |
|---|---|---|
| M0 | D7 stack/hosting | Next.js + Postgres + Prisma, Vercel + Neon/Supabase (Mumbai) |
| M1 | D2 font, D3 brand/status colours | Match the site; you supply danger/warning hues |
| M2 | D1 first factor | Email + password, then TOTP |
| M3 | D4 colour teams | Yes, optional field |
| M4 | D6 purge, D10 member ID, D12 export, D13 code year | 30 days manual purge; reuse an existing ID if any; Admin+ export; batch year |
| M5 | D8 consent source, D9 membership system | Must be answered; no default |
| M6 | D5 target role, D11 SFIA licence | Target role only; licence must be confirmed |
| M7 | D14 data residency | Mumbai region |

## 11. UAT script (PM + DOS ops, on staging with fake data)

1. Super Admin invites an Admin. The Admin sets a password, scans the QR in Google Authenticator, verifies, and saves the recovery codes.
2. The Admin logs out and in with TOTP; tries an old code (rejected); logs in once with a recovery code.
3. Masters: add the department "Artificial Intelligence & Data Science" with alias "AI&DS"; try adding "artificial intelligence & data science" (rejected).
4. Download the student template; fill 20 rows including a Tamil name, a duplicate email, "AI&DS", "Comp Sci", a phone written as `098765 43210`; upload. Check the preview flags, map "Comp Sci", import, and download the error CSV.
5. Datatable: filter by batch + department, sort by name, open the preview drawer, edit one student, check the audit entry.
6. Select all matching → change status to Alumni with a reason. Check the count.
7. Select 12 → delete (type DELETE) → undo → delete again → Super Admin restores one from the Recycle Bin.
8. Export the filtered list; open it in Excel; confirm no formulas execute.
9. Ontology: open Enterprise Architect (5 skills at L4, L4→L5 roadmap); search "agentic"; open the 27-Day Program.
10. Viewer account: can see but not change anything; the bulk bar is absent; a direct API call returns 403 (reviewer verifies).
11. Use keyboard only for steps 5–6. Check readability on a 768 px tablet.

Sign-off: PM ☐ · DOS ops ☐ · Reviewer ☐

## 12. Change control

1. Anyone can propose a change. Claude Code proposes via `TODO(QUESTION)` or the "Proposed" table in TEST_PLAN.
2. The PM decides and writes the decision to `DECISIONS.md` (date, ID, question, decision, by).
3. If the decision changes requirements, the PM updates PRD (bump version + changelog line), then FACTS/TEST_PLAN if affected.
4. Mid-milestone changes go to the next milestone unless they are blockers.

## 13. Bug report template

```
ID: BUG-###     Milestone: M#     Severity: S1 blocker | S2 major | S3 minor | S4 cosmetic
Test ID (if any):
Steps: 1… 2… 3…
Expected:                       Actual:
Evidence: screenshot / log excerpt (no real PII)
Environment: local | staging · browser · viewport
```
S1/S2 block milestone acceptance. Every fixed bug gets a regression test, added to TEST_PLAN "Proposed".
