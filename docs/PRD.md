# DOS Club Talent Portal — Product Requirements Document (Phase 1)

**Owner:** Bharathiraja (Product / PM)
**Builder:** Claude Code (AI engineer) + human reviewer
**Status:** Draft v1.1 (2026-10-11). Awaiting sign-off on the Open Decisions in Section 12.
**Companion docs:** `docs/PROJECT_PLAN.md` (delivery plan) · `docs/TEST_PLAN.md` (all test cases) · `docs/FACTS.md` (verified facts) · `docs/DECISIONS.md` (decision log)
**Source materials:** `reference/logo.png`, `reference/Skills_Ontology_Dashboard_1.html`, https://descienceosclub.com

> **v1.1 changes from v1.0:** (a) the ontology has **51 subcategories, not 45**, verified by script (FACTS F1.2); (b) the website font is now verified: Space Grotesk + system-UI sans + JetBrains Mono (F2); (c) colour tokens now come from the live site CSS instead of logo estimates, and white text on the gradient is banned because it fails WCAG (F3); (d) test cases moved to `docs/TEST_PLAN.md` and expanded; (e) new decisions D11–D14; (f) Phase 2 profile fields added as Appendix A (context only).

> Claude Code: read `CLAUDE.md` (guardrails) before this file. If anything here conflicts with `CLAUDE.md`, `CLAUDE.md` wins. If anything here is ambiguous, STOP and ask — do not guess.

---

## 1. Problem Statement

Descience Open Source Club (DOS Club) has 6000+ student members across partner institutions. Member data (personal info, degree, department, DOS Club batch) lives in scattered spreadsheets. There is no single, secure place to:

- maintain a clean master list of students,
- bulk-correct, bulk-archive or bulk-change status of records,
- map students to the **India ICT Skills Ontology** (the framework in `Skills_Ontology_Dashboard_1.html`) and the **27-workshop "Runway — CodeZap 3.0"** track.

## 2. Goals & Non-Goals

### Phase 1 Goals (this build)
1. Secure admin login with **Google Authenticator (TOTP) as mandatory second factor**.
2. **Master tables** (lookup data: institutions, degrees, departments, batches, colour teams, statuses) managed from the UI, with CSV import. *Note: in the PM brief, "master table" also means the **student master**, the main student register (§5.3).*
3. **Student module**: bulk upload (CSV/XLSX), manual add, datatable with search/filter/sort, bulk delete, bulk status update, preview drawer, edit.
4. **Skills Ontology module**: the existing dashboard re-implemented as a read-only, light-theme module backed by the database (seeded from the HTML file's JSON).
5. Audit log of every create/update/delete.

### Phase 1 Non-Goals (do NOT build)
- Student self-login / self-service profile (Phase 2).
- Job-portal-style profile (resume, experience, preferred locations, CTC, etc.) — Phase 2.
- Email/SMS/WhatsApp notifications.
- Payments, certificates, analytics beyond simple counts.
- Mobile apps.

### Phase 2 (for context only — design DB so it is not blocked)
Students log in and complete a Naukri/Indeed-style profile: resume upload, skills with self-rated level (L1–L6 from the ontology), projects, internships, certifications, education history, links (GitHub, LinkedIn, portfolio), preferred roles (from the 103 ontology roles), location preferences, availability. Admin verifies profiles.

## 3. Users & Roles (RBAC)

| Role | Can do |
|---|---|
| **Super Admin** | Everything, incl. managing admin users, restoring deleted records, viewing audit log, resetting another admin's 2FA |
| **Admin / Coordinator** | Manage students and master tables; bulk actions; cannot manage admins or hard-delete |
| **Viewer** | Read-only access to students and ontology; can export if permission granted |
| *Student (Phase 2)* | Own profile only |

Every server action must check role on the **server**. Hiding a button is not authorization.

## 4. Pain Points This Product Must Solve

| # | Pain point | Required solution |
|---|---|---|
| P1 | Duplicate students from repeated uploads | Unique keys on normalized email and normalized phone; upload preview flags duplicates (in-file and vs. DB) with choice: skip / update existing / import as new is NOT allowed |
| P2 | Inconsistent text ("CSE", "Computer Sci", "C.S.E") | Degree, department, institution, batch are **foreign keys to master tables**, never free text. Upload maps unknown values via a mapping step or rejects the row |
| P3 | Messy Excel data (dates as serial numbers, phone as `9.18E+11`, leading/trailing spaces, merged cells) | Server-side parse with explicit type coercion; phone stored as E.164 string; dates validated; row-level error report downloadable as CSV |
| P4 | Accidental bulk delete | **Soft delete only** (`deleted_at`), confirmation dialog showing count + typing "DELETE", 10-second undo toast, Recycle Bin restorable by Super Admin |
| P5 | Lost phone with Google Authenticator | 10 one-time **recovery codes** shown at enrolment; Super Admin can reset another admin's 2FA (logged) |
| P6 | Large uploads freezing the browser | Parse and validate on the server in batches; progress indicator; hard limit 10,000 rows / 5 MB per file in Phase 1 |
| P7 | No accountability | Audit log: who, what, when, before/after values, IP |
| P8 | Personal data exposure | India **DPDP Act 2023** awareness: least-privilege access, no PII in URLs or logs, export restricted by permission, encryption at rest via DB provider, HTTPS only |
| P9 | Unicode names (Tamil, etc.) breaking | UTF-8 end-to-end; XLSX + CSV with BOM handling; tests with Tamil names |
| P10 | CSV export opened in Excel executing formulas | Escape cells beginning with `= + - @` on export (CSV injection) |
| P11 | Slow table at 6000+ rows | **Server-side** pagination, sort and filter; indexed columns |
| P12 | "Select all" ambiguity | Distinguish "select all on this page" vs "select all N matching filter" explicitly in UI |
| P13 | Status changes with no reason | Bulk status change accepts an optional reason, stored in the audit log |
| P14 | Admin cannot tell why a row failed | Every rejected row/cell carries a human-readable reason; the error report is downloadable as CSV with original row numbers |
| P15 | Losing work in a long form or upload | Upload jobs are persisted server-side (`upload_jobs`), so the admin can leave and resume at the preview step; the form warns on unsaved changes |
| P16 | Ontology ownership | The ontology is DOS Club's own framework for Indian job-market requirements (D11). The source `Source` tags are stored but not displayed. |

## 5. Functional Requirements

### 5.1 Authentication (FR-AUTH)
- FR-AUTH-1: Admin signs in with email + password (or Google OAuth — **see Open Decision D1**).
- FR-AUTH-2: First login forces TOTP enrolment: show QR code + manual key, user verifies a 6-digit code before enrolment completes.
- FR-AUTH-3: Every subsequent login requires a valid TOTP code (30-sec window, ±1 step tolerance).
- FR-AUTH-4: 10 single-use recovery codes, shown once, stored hashed.
- FR-AUTH-5: Rate-limit: 5 failed attempts → 15-minute lockout per account + IP.
- FR-AUTH-6: Session timeout 8 hours absolute, 30 minutes idle. Secure, HttpOnly, SameSite cookies.
- FR-AUTH-7: No public sign-up. Admins are invited by Super Admin.
- FR-AUTH-8: First Super Admin is created via a seed script / CLI, never via an open endpoint.

### 5.2 Master Tables (FR-MASTER)
Managed via a "Masters" section with simple CRUD + CSV import for each:

| Master | Fields | Notes |
|---|---|---|
| Institutions | name, short_code, city, state, is_partner | Website lists 9 academic partners |
| Degrees | name (B.E., B.Tech, B.Sc, BCA, MCA, MBA…), level (UG/PG/Diploma) | |
| Departments | name, short_code, aliases[] | aliases power upload auto-mapping ("CSE", "Computer Science") |
| DOS Club Batches | batch_code (e.g. 2026-B1), year, start_date, end_date | "Batch year" in your brief |
| Colour Teams | name, hex_color | Red, Green, Blue, Purple, Pink, White, Black, Orange, Silver, Yellow (from website — **confirm D4**) |
| Student Statuses | name, color, is_active_state | Default: Active, Inactive, Alumni, Suspended, Dropped |

Rules: a master value **in use cannot be deleted**, only deactivated. Names unique case-insensitively (after trim and whitespace collapse).

**Master CSV import (FR-MASTER-IMP):** the same validate → preview → confirm flow as the student upload, without a mapping step. Limit 1,000 rows per file. Duplicate names (case-insensitive) are flagged, never auto-merged. Each master has a downloadable template.

### 5.3 Student Module (FR-STU)

**Student fields (Phase 1)**

| Field | Type | Required | Validation |
|---|---|---|---|
| student_code | string | auto | `DOS-{YYYY}-{00001}`, immutable |
| full_name | string | yes | 2–100 chars, Unicode letters, spaces, `.` `'` |
| email | string | yes | valid email, stored lowercase, unique |
| phone | string | yes | Indian mobile → E.164 `+91XXXXXXXXXX`, unique |
| gender | enum | no | Male / Female / Other / Prefer not to say |
| date_of_birth | date | no | age 15–40 |
| institution_id | FK | yes | must exist & be active |
| degree_id | FK | yes | |
| department_id | FK | yes | |
| year_of_study | int | no | 1–5 |
| graduation_year | int | yes | current year −5 to +6 |
| batch_id | FK | yes | DOS Club batch |
| colour_team_id | FK | no | |
| status_id | FK | yes | default Active |
| city, state | string | no | |
| linkedin_url, github_url | url | no | must match domain |
| notes | text | no | admin-only |
| created_at/by, updated_at/by, deleted_at/by | system | | |

**Datatable (FR-STU-TBL)**
- Server-side pagination (25/50/100), sort on every column, global search (name/email/phone/code), column filters (institution, department, degree, batch, team, status, graduation year).
- Column show/hide, persisted per admin.
- Row checkbox + header checkbox with "Select all N matching" banner.
- Bulk actions bar appears when ≥1 selected: **Update status**, **Delete** (soft), **Export selected**, *(optional)* Assign batch/team.
- Row actions: Preview (side drawer), Edit (full page or modal), Delete.
- Empty, loading (skeleton) and error states for every view.

**Bulk upload (FR-STU-UPL)** — a 4-step wizard:
1. Download template (XLSX + CSV) with exact headers and an example row.
2. Upload file → server parses.
3. **Preview & validate**: table showing each row as ✅ valid / ⚠️ duplicate / ❌ error with reason per cell. Unknown master values → mapping UI ("'Comp Sci' → Computer Science & Engineering") or reject.
4. Confirm → import valid rows in a single transaction per batch; show summary (imported / updated / skipped / failed) + downloadable error report.

**Manual add / edit (FR-STU-FORM)**
- Same validation as upload (one shared schema — single source of truth).
- Dropdowns load from active master values only.
- Duplicate check on email/phone before save with link to existing record.
- Optimistic concurrency: if record changed by another admin since opened, block save and show diff.

**Bulk delete (FR-STU-DEL)** — soft delete, confirm modal with count, type "DELETE" for >10 records, undo toast 10 s, Recycle Bin (Super Admin restore / permanent purge after 30 days — **D6**).

**Bulk status update (FR-STU-STS)** — choose status + optional reason → preview count → confirm → audit entry per student.

### 5.4 Skills Ontology Module (FR-ONT)
> **Update 2026-10-11 (DECISIONS ONT-EDIT):** the ontology is no longer read-only. See §5.4.1.

Re-create the five views from `Skills_Ontology_Dashboard_1.html` in the new light theme, data-driven from DB:
- Overview (Category → Subcategory → Skill → Role → Level flow diagram + stats)
- Categories (11) with drill-down into **51** subcategories and their skills
- Role Explorer (103 roles: search, filter by category, required skills with levels, growth path from `roadmap`)
- Proficiency Levels (L1 Foundation → L6 Distinguished)
- 27-Day Program (27 workshops mapped to roles)

Seed script extracts the `DATA`, `LEVELS`, `WORKSHOPS` constants from the HTML file. **Counts after seed must equal: 11 categories, 51 subcategories, 165 skills, 103 roles, 103 roadmaps, 6 levels, 27 workshops** (FACTS F1). `scripts/guard/verify-ontology.mjs` checks the source file and test ONT-01 checks the database. Roles have no source ID, so generate a surrogate key and keep `name` unique (F1.13). Store each skill's `source` value as-is, but don't display it (D11).

Phase 1 link to students: optional `target_role_id` on student (**D5**). Workshop attendance tracking is Phase 2 unless confirmed.

### 5.4.1 Ontology maintenance (FR-ONT-EDIT)
- Super Admin and Admin can: add/edit **skills** (code `^[A-Z][A-Z0-9]{2,5}$`, unique and immutable after creation; name; description; subcategory), add/rename **subcategories** under the 11 categories, add/edit **roles** (name, category, track IC/Mgmt/Exec, level range L1–L6) and set each role's **required skills with a level**.
- **Retire** instead of delete: a retired skill/role is hidden from explorers and pickers but kept with a reason and date. Retiring a skill that active roles still need is blocked unless the admin chooses "also remove it from those roles". Retired items can be restored.
- **Delete** is allowed only for a skill never linked to any role (e.g. a typo just added).
- Every change writes an audit entry (`ontology.*`). The manage page shows recent ontology changes.
- The seed only inserts missing reference data; it never overwrites admin edits.
- Viewer: read-only.

### 5.4.2 How-it-works guides (HELP-1)
- `/how-it-works` (public): guide for students. It covers what DOS Club stores, the student code, statuses, how to request corrections, how to use the skills framework (levels, roles, 27-day program) and what Phase 2 adds. No personal data on this page.
- `/help` (signed in): guide for admins, role-aware (Super Admin / Admin / Viewer), with step-by-step tasks.

### 5.5 Audit Log (FR-AUD)
Table: actor, action, entity, entity_id, before (JSON), after (JSON), reason, ip, user_agent, timestamp. Super Admin view with filters. Append-only; no UI delete.

### 5.6 Dashboard Home
Counts: total students, active, by batch, by institution, recent uploads, recent activity. Keep it simple.

## 6. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Student list p95 < 800 ms at 10k rows; 5,000-row upload validates < 30 s |
| Security | OWASP Top 10 addressed; all input validated server-side; parameterised queries via ORM; CSRF protection; secrets only in env vars |
| Accessibility | WCAG 2.1 AA: keyboard navigation, focus rings, 4.5:1 text contrast **even on glass surfaces** |
| Responsive | Desktop first (≥1280), usable on tablet (≥768); phone read-only acceptable |
| Browser | Latest Chrome, Edge, Safari, Firefox |
| Privacy | No PII in URLs, logs, error messages or analytics |
| Reliability | Daily DB backup (provider-managed); migrations reversible |

## 7. Design System: "Liquid Light" (Google One-inspired)

All values come from `docs/FACTS.md` F2/F3 (verified from the live descienceosclub.com CSS). **Do not add colours, fonts or radii that are not listed here.**

### 7.1 Tokens (`src/styles/tokens.css` is the only place hex values may appear)
```
/* Brand (site tokens) */
--dos-accent:        #1593C3   /* blue: icons, focus ring, borders, charts. NOT for body text */
--dos-accent-dark:   #0D6B90   /* text-safe blue: primary button fill, links */
--dos-primary:       #4CAF50   /* green: decoration, success chips with dark text, charts */
--dos-primary-dark:  #2F8A36   /* green for large/bold text only (4.37:1 on white) */
--dos-primary-soft:  #8BD08E   /* blobs, highlights, decoration only */
--dos-deep:          #0C3346   /* nav rail text/icons, headings on glass */
--brand-gradient:    linear-gradient(135deg, #1593C3 0%, #4CAF50 100%);   /* decorative only */

/* Neutrals (site tokens) */
--bg:            #F4F7F9   /* --color-ink */
--bg-soft:       #EAEFF3
--bg-2:          #DFE7ED
--surface:       #FFFFFF
--text:          #10222B
--text-muted:    #5B6F79
--hairline:      #10222B1F
--stroke:        #0C33461F

/* Glass (derived from --surface; alpha only, no new hue) */
--glass:         rgb(255 255 255 / 0.62)
--glass-strong:  rgb(255 255 255 / 0.86)
--glass-border:  rgb(255 255 255 / 0.70)
--shadow-glass:  0 8px 32px rgb(12 51 70 / 0.08)   /* from --dos-deep */

/* Status: PENDING D3. Until decided, use --dos-accent-dark (info) and --dos-primary-dark (success);
   danger/warning hues are NOT verified. Claude Code must write TODO(QUESTION:D3) and not invent them. */

/* Radius (site scale) */
--r-sm: .375rem  --r-md: .5rem  --r-lg: .75rem  --r-xl: 1rem  --r-2xl: 1.5rem  --r-pill: 999px
```

### 7.2 "Liquid glass" rules
- Page: `--bg` with 2–3 large blurred blobs (`--dos-accent`, `--dos-primary-soft`) at 12–18 % opacity, drifting slowly. `prefers-reduced-motion` → static.
- Cards, nav rail, top bar: `background: var(--glass); backdrop-filter: blur(20px) saturate(160%); border: 1px solid var(--glass-border); box-shadow: var(--shadow-glass);` radius `--r-2xl` (24 px).
- **Text-heavy surfaces (datatables, forms, drawers, modals) use `--glass-strong` or `--surface`.** Body text never sits on low-opacity glass.
- Fallback: if `@supports not (backdrop-filter: blur(1px))`, use `--surface` + `1px solid var(--stroke)`.
- **Primary button:** solid `--dos-accent-dark` fill with white text (5.96:1). The brand gradient may appear only as a 2 px top highlight or outer glow, **never behind text**.
- Secondary button: `--surface` or glass background, `--dos-accent-dark` text, `--stroke` border. Destructive: pending D3.
- Focus ring: 2 px `--dos-accent` plus a 2 px white offset (≥3:1 against neighbours).
- Google One feel: left nav rail with a pill-shaped active item (`--bg-2` fill, `--dos-deep` text), generous whitespace, large friendly headings, **one primary action per screen**, rounded storage-meter-style bars for stats (gradient fill allowed because it carries no text; show the value as a text label next to it).
- Radii: cards 24 px (`--r-2xl`), inputs/buttons 16 px (`--r-xl`), chips `--r-pill`.
- Light theme only in Phase 1. No dark mode.

### 7.3 Typography (verified, FACTS F2)
- Display / headings / big numbers: **Space Grotesk** 500/600/700 via `next/font/google`.
- Body / UI: **system-UI stack** `ui-sans-serif, system-ui, sans-serif` (same as the website). If the PM prefers Inter for consistent rendering, record it in D2 first.
- Codes / IDs (`DOS-2026-00001`, skill codes): **JetBrains Mono**.
- Tamil and other Indic scripts: the system stack covers them. Test UPL-08 / UI-06 verify rendering.

## 8. Suggested Architecture (confirm in D7)
- **Next.js (App Router) + TypeScript (strict)** — full-stack, one repo.
- **PostgreSQL** + **Prisma** ORM + migrations.
- Auth: **Auth.js (NextAuth)** credentials/Google provider + **otplib** for TOTP, or **Supabase Auth** which ships TOTP MFA natively. Do not hand-roll crypto.
- Validation: **Zod** schemas shared by forms, API and upload.
- Table: **TanStack Table** (headless) with server-side data.
- UI: Tailwind CSS + Radix UI primitives (accessible) themed with the tokens above.
- File parsing: **SheetJS (xlsx)** + **Papa Parse**, server-side.
- Testing: **Vitest** (unit), **Playwright** (E2E), seeded test DB.
- Hosting: Vercel + managed Postgres (Neon/Supabase), or a VPS. Region: India (Mumbai) for data residency.

## 9. Data Model (summary)
```
admin_users(id, email, name, role, password_hash, totp_secret_enc, totp_enabled,
            recovery_codes_hashed[], failed_attempts, locked_until, last_login_at, is_active)
institutions, degrees, departments(+aliases), batches, colour_teams, student_statuses
students(... fields in 5.3 ..., version INT for optimistic locking)
upload_jobs(id, file_name, uploaded_by, total, valid, duplicates, errors, status, created_at)
upload_rows(job_id, row_no, raw JSON, normalized JSON, status, errors JSON)
audit_logs(...)
ontology_categories, ontology_subcategories, ontology_skills, ontology_roles,
ontology_role_skills(role_id, skill_id, level), ontology_roadmap_steps,
ontology_levels, ontology_workshops
```
Phase-2-ready: `students.user_id` nullable FK (future student login); no Phase 2 tables yet.

## 10. Test Cases

All test cases (IDs, steps, expected results, automation level, milestone) are in **`docs/TEST_PLAN.md`**. That file is the single source for test IDs. Test IDs from v1.0 are kept unchanged. ONT-01 now expects **51** subcategories.

## 11. Milestones & Acceptance

| # | Milestone | Done when |
|---|---|---|
| M0 | Project scaffold, CI, lint, typecheck, test runner, env template | `npm run lint && npm run typecheck && npm test` green in CI |
| M1 | Design system + app shell (nav rail, glass cards, login screen) | UI-02..UI-07, GRD-01..03 pass; screenshot review approved |
| M2 | Auth + TOTP + RBAC + audit log | AUTH-01..16, AUD-01..04 pass |
| M3 | Master tables | MST-01..10 pass |
| M4 | Student CRUD + datatable + bulk status/delete + recycle bin + dashboard | STU-01..24, DSH-01..02 pass |
| M5 | Bulk upload wizard | UPL-01..18 pass |
| M6 | Ontology module + seed | ONT-01..09 pass |
| M7 | Hardening, security tests, perf test, docs | SEC-01..10, STU-15, UPL-16 pass; README + runbook done; UAT sign-off |

**Rule:** Claude Code completes one milestone, shows test output and a summary, and **waits for human approval** before starting the next.

## 12. Open Decisions (need your answer before / during build)

| ID | Question | Recommendation |
|---|---|---|
| D1 | "Google Authenticator" = TOTP 2FA app. Should the *first* factor be email+password or "Sign in with Google"? | Email+password + TOTP (works for admins without Google Workspace) |
| D2 | Font: **verified** that the site uses Space Grotesk + system-UI sans + JetBrains Mono (F2). Match the site exactly, or use Inter for body text? | Match the site |
| D3 | Site tokens are verified (F3). Is there an official brand guide? Which hues should danger/warning use? | Use F3 tokens; PM to supply danger/warning hues |
| D4 | Track Colour Teams in Phase 1? | Yes, optional field |
| D5 | Link students to ontology target role / workshops in Phase 1? | Target role only; attendance in Phase 2 |
| D6 | Permanent purge of soft-deleted records after 30 days, or never? | 30 days, Super Admin manual purge |
| D7 | Tech stack & hosting confirmation, budget | Section 8 |
| D8 | Who is the data fiduciary / consent source for existing student PII (DPDP Act)? | Confirm students consented at membership signup |
| D9 | Is there an existing membership system (membership.descienceosclub.com) to sync with instead of uploading? | Investigate; could replace manual upload |
| D10 | Unique ID: is there an existing DOS member ID to reuse? | Reuse if it exists |
| D11 | ~~SFIA licence~~ **Decided 2026-10-11:** DOS Club's own framework; no licence needed; source tags hidden in UI | — |
| D12 | Who may export student data: Super Admin only, or Admin too? Is Viewer export a per-user permission? | Super Admin + Admin; Viewer only with an explicit flag |
| D13 | Student code format `DOS-{YYYY}-{00001}`: is YYYY the joining year, the batch year or the creation year? | Batch year |
| D14 | Hosting region / data residency (DPDP): Mumbai region required? | Yes (ap-south-1 or equivalent) |

---

## Appendix B: Phase 2, first slice: student access (BUILT, DECISIONS PH2-1, PH2-5..7)

No email service is available, so no codes are emailed.

1. DOS Club shares a ready-made **WhatsApp/announcement message** (Students → *Invitation message*) with the first-access link.
2. **First access** (`/student/activate`): the student enters the email **and mobile number on record**, then creates a password (≥ 12 characters). Both must match a student in the master who has no account yet. The error never says which part didn't match, and attempts are rate-limited (PH2-6).
3. The student then **sets up Google Authenticator** and saves 10 recovery codes. Nothing else works until this is done.
4. Sign-in: email + password + authenticator code.
5. **Forgot password:** only an admin can reset it. Admin or Super Admin opens the student preview → *Reset password* → a **one-time password** (shown once, valid 72 h) to share privately. The student signs in with it, enters the authenticator code, and must **create a new password** before anything else (PH2-7).
6. **Lost phone and recovery codes:** Super Admin → *Reset portal access*; the student repeats first access.
7. **Account page:** change password, regenerate recovery codes, sign out. **My record:** their details (read-only) and target role.
8. Student sessions use a separate cookie and table from admins. Every step is audited.

**Known risk (PH2-6):** someone who knows both a member's email and mobile number could claim the account first. Detection: the real student is told "couldn't activate" and an admin resets portal access. Adding email verification later removes this risk.

## Appendix A: Phase 2 student profile (context only, DO NOT BUILD)

So the Phase 1 schema does not block Phase 2, keep `students.user_id` nullable and do not create the tables below yet. Fields modelled on common job-portal profiles (Naukri/Indeed style):

| Group | Fields |
|---|---|
| Account | student login (email OTP or Google), consent record (DPDP), profile completeness % |
| Headline | resume headline, profile summary, current status (studying / job seeking / employed) |
| Education | multiple entries: qualification, institution, specialisation, start/end, score type + score |
| Skills | ontology skill (FK) + self-rated level L1–L6 + years used; admin-verified flag |
| Projects | title, description, tech used (ontology skills), repo/demo URL, dates |
| Internships / experience | organisation, role, dates, description, stipend (optional) |
| Certifications | name, issuer, issue/expiry date, credential URL / upload |
| Links | GitHub, LinkedIn, portfolio, LeetCode/HackerRank |
| Resume | PDF upload (≤2 MB, virus-scanned), parsed text (optional) |
| Preferences | preferred roles (FK to 103 ontology roles), locations, work mode, notice/availability date, expected stipend/CTC |
| Languages | language, proficiency (read/write/speak) |
| Workshops | CodeZap 3.0 attendance per workshop (27), completion |
| Verification | admin verification status, verified by/at, remarks |

