# TEST_PLAN.md: DOS Club Talent Portal, Phase 1

**Single source of test IDs.** A test ID in code (`it('STU-09 …')` / `test('STU-09 …')`) must exist here. Claude Code may **not** add, rename, weaken or delete a test case without PM approval; to propose one, add it under "Proposed" at the bottom.

**Levels:** U = unit (Vitest) · I = integration (Vitest + real test Postgres) · E = end-to-end (Playwright) · M = manual (PM/reviewer, with screenshot evidence)
**Pain points:** P-numbers refer to PRD §4.
**Rule:** a test counts as passing only when its output from the current session is pasted into the milestone summary.

---

## 0. Guardrail tests (GRD): they stop hallucinated values reaching the code. Milestone M0/M1, run in CI on every push.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| GRD-01 | `node scripts/guard/verify-ontology.mjs` | PASS. Counts 11/51/165/103/103/6/27, sha256 matches FACTS F1 | U |
| GRD-02 | Grep `src/**` (excluding `src/styles/tokens.css`) for `#[0-9a-fA-F]{3,8}\b` and `rgb(` literals | 0 matches. Colours only via tokens | U |
| GRD-03 | Every hex in `tokens.css` is listed in FACTS F3 (or approved in DECISIONS) | Test parses both files; no unknown hex | U |
| GRD-04 | Every test ID used in `tests/**` and `e2e/**` exists in this file, and every non-M ID for completed milestones has a test | Script reports 0 orphans, 0 missing | U |
| GRD-05 | Route inventory: list all `app/**/page.tsx` and `app/api/**/route.ts` | Matches the approved route list in PROJECT_PLAN §7; no Phase 2 routes (`/student/*`, `/profile`, `/signup`, `/register`) | U |
| GRD-06 | `package.json` dependencies vs. the approved list in DECISIONS | No unapproved packages | U |
| GRD-07 | Secret scan (gitleaks or equivalent) on the repo | 0 findings | U |
| GRD-08 | `grep -rn "@ts-ignore\|eslint-disable\|\.skip(\|\.only(\|test.fixme"` in src/tests | 0, or each one listed with a justification in the milestone summary | U |

## 1. Authentication & RBAC (AUTH). M2. Pain points P5, P8.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| AUTH-01 | Valid email+password, first login | Redirect to TOTP enrolment; dashboard not reachable | E |
| AUTH-02 | Enrolment with wrong 6-digit code | Error; enrolment not saved | I |
| AUTH-03 | Enrolment with correct code | 10 recovery codes shown once; 2FA active; codes stored hashed (DB check) | I |
| AUTH-04 | Login with valid TOTP | Access granted; session cookie `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict` | E |
| AUTH-05 | TOTP older than ±1 step | Rejected | U |
| AUTH-06 | Same TOTP code used twice within its window | Second use rejected (replay protection) | I |
| AUTH-07 | 5 wrong attempts | Account locked 15 min (per account + IP); audit entry; lock message reveals no account existence | I |
| AUTH-08 | Login with recovery code | Works once; same code fails the second time | I |
| AUTH-09 | Open `/students` without a session | Redirect to login | E |
| AUTH-10 | Password OK, TOTP step skipped by calling the API directly | 401 on every protected route | I |
| AUTH-11 | Viewer calls bulk-delete API directly | 403 | I |
| AUTH-12 | Idle 30 min / absolute 8 h | Session expires; next request goes to login | I |
| AUTH-13 | Super Admin resets another admin's 2FA | Target must re-enrol; audit entry | I |
| AUTH-14 | `/signup`, `/register` or similar public route | 404 | E |
| AUTH-15 | Unknown email vs. known email + wrong password | Identical error message and similar response time (no user enumeration) | I |
| AUTH-16 | Role matrix: every mutating API × {Super Admin, Admin, Viewer, no session} | Matches PRD §3; generated table test | I |

## 2. Audit log (AUD). M2 onwards. Pain point P7.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| AUD-01 | Any create/update/delete on student or master | One audit row: actor, action, entity, id, before, after, ip, user_agent, timestamp | I |
| AUD-02 | Attempt to update/delete an audit row via API or ORM helper | No such endpoint; DB role/trigger prevents it | I |
| AUD-03 | Audit `before/after` for a student | PII fields present only in the audit table, never in application logs | I |
| AUD-04 | Admin/Viewer opens the audit log | 403; Super Admin sees it with filters (actor, entity, date) | E |

## 3. Master tables (MST). M3. Pain point P2.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| MST-01 | Add department "Computer Science" when "computer science" exists | Rejected (case-insensitive unique) | I |
| MST-02 | Delete a department used by students | Blocked; deactivate offered | I |
| MST-03 | Deactivated value | Hidden from new-student dropdowns; still shown on existing records | E |
| MST-04 | Department alias "CSE" | Upload auto-maps "CSE" to that department | I |
| MST-05 | "  Computer   Science " | Stored trimmed with whitespace collapsed; still detected as a duplicate | U |
| MST-06 | Same alias on two departments | Rejected | I |
| MST-07 | Master CSV import, 20 valid rows + 2 duplicates | Preview flags 2; confirm imports 20 | I |
| MST-08 | Master CSV with 1,001 rows | Rejected with limit message | I |
| MST-09 | Batch with end_date before start_date | Rejected | U |
| MST-10 | Viewer tries to create or edit a master | 403 | I |

## 4. Students: CRUD, datatable, bulk actions (STU). M4. Pain points P1, P4, P11, P12, P13.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| STU-01 | Manual add valid student | Saved; code `DOS-YYYY-NNNNN` generated (YYYY per D13) | I |
| STU-02 | Manual add with duplicate email or phone | Blocked, with link to the existing record | E |
| STU-03 | Edit and save | Updated; audit shows before/after | I |
| STU-04 | Two admins edit the same student; second saves | Second save blocked with a conflict message and a diff | I |
| STU-05 | Search by partial phone (`98765`) | Matches | I |
| STU-06 | Filter batch + department + status combined | Correct server-side count | I |
| STU-07 | Sort by name across pages | Global sort, not per page; Tamil names sort with a stable collation | I |
| STU-08 | Select all on page (25) → bulk status | Exactly 25 updated | E |
| STU-09 | "Select all 812 matching" → bulk status | Exactly 812 updated; reason stored; selection uses the filter applied on the server, not client IDs | I |
| STU-10 | Bulk delete 50 | Soft-deleted, hidden from the list; undo within 10 s restores all 50 | E |
| STU-11 | Bulk delete >10 without typing DELETE | Confirm disabled | E |
| STU-12 | Super Admin restores from Recycle Bin | Record back in the list; audit entry | I |
| STU-13 | Preview drawer | Shows all fields read-only; editing needs an Edit click; Esc closes; focus returns to the row | E |
| STU-14 | Export filtered list | Only permitted columns (D12); cells starting with `= + - @` escaped | I |
| STU-15 | 10,000 students | List API p95 < 800 ms (k6 or autocannon, 100 requests) | I |
| STU-16 | Edit `student_code` via API | Rejected (immutable) | I |
| STU-17 | Page size 25 / 50 / 100 | Correct rows and total; page resets to 1 when a filter changes | E |
| STU-18 | Column show/hide | Persists per admin across logout/login | E |
| STU-19 | Filters and sort reflected in state | Back/forward restores them; **no PII in the URL** (search text not put in the query string; use an opaque id or session state) | E |
| STU-20 | Bulk status where selection includes deleted records (race) | Deleted records skipped; summary shows the counts | I |
| STU-21 | Form: graduation_year outside current−5…+6, DOB age outside 15–40, bad LinkedIn domain | Field-level errors; same messages as upload (shared Zod) | U |
| STU-22 | Dropdowns on the form | Only active master values are listed | E |
| STU-23 | Empty, loading and error states | List with 0 results shows an empty state with a CTA; API 500 shows an error state with retry; skeleton shows while loading | E |
| STU-24 | Unsaved-changes guard on the edit form | Navigating away prompts in-app (no `window.confirm`) | E |

## 5. Bulk upload wizard (UPL). M5. Pain points P1, P2, P3, P6, P9, P10, P14, P15.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| UPL-01 | Template file with 3 valid rows | 3 imported | E |
| UPL-02 | Wrong or missing header | Rejected before preview, listing the expected headers | I |
| UPL-03 | Same email twice in one file | Both flagged duplicate-in-file | I |
| UPL-04 | Email already in DB | Flagged; choice skip / update | I |
| UPL-05 | Phone `9.18E+11`, `09876543210`, `+91 98765-43210` | Valid ones normalised to `+919876543210`; scientific notation that lost digits → row error (ambiguous) | U |
| UPL-06 | Excel serial date `38426` in DOB (and serial `45123`) | `38426` → 2005-03-15, accepted. `45123` → 2023-07-16, parsed correctly but the row is rejected by the age 15–40 rule | U |
| UPL-07 | Unknown department "Comp Sci" | Mapping step shown; unmapped → row error | E |
| UPL-08 | Tamil name "அருண் குமார்" (CSV UTF-8 with BOM, CSV without BOM, XLSX) | Stored and displayed correctly in all three | I |
| UPL-09 | 10,001 rows | Rejected with limit message | I |
| UPL-10 | `.exe` renamed `.xlsx` | Rejected (MIME + magic-byte check) | I |
| UPL-11 | Cell `=HYPERLINK(...)` | Stored as plain text, never evaluated | I |
| UPL-12 | Mixed file: 90 valid, 10 errors | 90 imported; error CSV lists 10 with row numbers and reasons | I |
| UPL-13 | DB failure mid-import | Batch rolled back; no partial batch; job marked failed | I |
| UPL-14 | Leading/trailing spaces, uppercase email | Trimmed, lowercased | U |
| UPL-15 | Empty rows at the end of the sheet | Ignored; not counted as errors | U |
| UPL-16 | 5,000-row file | Validation < 30 s; progress shown; UI responsive | I |
| UPL-17 | Leave the wizard at the preview step and come back | Job resumes at preview (P15) | E |
| UPL-18 | XLSX with multiple sheets / merged cells | First sheet only (or sheet picker); merged cells produce a clear row error | I |

## 6. Ontology (ONT). M6.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| ONT-01 | Run seed | DB counts exactly 11 / **51** / 165 / 103 / 103 / 6 / 27 | I |
| ONT-02 | Re-run seed | Idempotent; no duplicates | I |
| ONT-03 | Role "Enterprise Architect" | Shows 5 skills (STPL, ARCH, ITSP, GOVN, EMRG at L4) and the L4→L5 roadmap | E |
| ONT-04 | Role search "agentic" | Returns exactly "Agentic AI Engineer" (F1.10) | E |
| ONT-05 | Every role skill code exists in the skills table | FK integrity passes | I |
| ONT-06 | Category drill-down | Each of the 11 categories shows its subcategories; the sum across categories = 51 | E |
| ONT-07 | 27-Day Program view | 27 workshops in order n=1..27, titles from the source | E |
| ONT-08 | Ontology write access (updated by ONT-EDIT) | Viewer gets 403 on every ontology mutation; every mutating ontology handler uses the Admin/Super Admin guard | I |
| ONT-09 | Source field (D11) | `source` stored for all 165 skills; no source/licence text rendered on ontology pages | E |

| ONT-10 | Add skill with new code + subcategory | Created; appears in category tree; audit `ontology.skill_create` | I |
| ONT-11 | Add skill with duplicate or malformed code (`ARCH`, `ab`, `TOO-LONG1`) | Rejected 409 / 400 | I |
| ONT-12 | Retire a skill used by active roles | Blocked with the list of roles; with "remove from roles" it retires and unlinks; retired skill hidden from explorer and pickers; restore brings it back | I |
| ONT-13 | Re-run the seed after admin edits | Edits and added skills are kept; nothing duplicated | I |
| ONT-14 | Edit a role's required skills | Replaced set saved; retired/unknown codes and levels outside 1–6 rejected | I |
| ONT-15 | Delete a skill | Allowed only when never linked to a role; otherwise 409 suggesting retire | I |
| ONT-16 | Retire a role | Hidden from Role Explorer and the student target-role picker; students already linked keep it | I |
| ONT-17 | Admin manages the ontology in the UI | Add skill → it appears in Categories; retire → disappears; change log shows both | E |

## 6b. Guides (HELP). HELP-1.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| HELP-01 | Open `/how-it-works` without signing in | Student guide renders; no personal data; links to sign-in for admins | E |
| HELP-02 | Open `/help` as Admin and as Viewer | Role-aware admin guide; Viewer sees read-only tasks only | E |

## 6c. Student access, Phase 2 (STA). PH2-5..7 (no email service).

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| STA-01 | First access with registered email + mobile + password | Account created; pre-MFA session; student APIs 401 until Google Authenticator is set up; 10 recovery codes | I |
| STA-02 | First access with unknown email, wrong mobile, a deleted student, or an already-activated student | Identical error for all; no account created | I |
| STA-03 | Repeated first-access attempts | Rate-limited (per email 5/hour, per IP 10/15 min) → 429 | I |
| STA-04 | First access with a password under 12 characters | Rejected; no account | I |
| STA-05 | Sign-in: password + TOTP; replayed TOTP; 5 wrong passwords | Works; replay rejected; locked 15 min | I |
| STA-06 | Admin resets a student's password | One-time password shown once; student sessions end; sign-in with it + TOTP → must create a new password (other student APIs 403 until then; can't reuse the one-time password) | I |
| STA-07 | One-time password older than 72 h | Sign-in rejected with "expired, ask your coordinator" | I |
| STA-08 | Change password on the Account page | Needs the current password; ≥ 12 characters; audited | I |
| STA-09 | Student session vs admin APIs, and admin session vs student APIs | Student session gets 401 on admin APIs; admin session gets 401 on student APIs | I |
| STA-10 | Who can reset | Admin and Super Admin can issue one-time passwords; Viewer can't (403). Only Super Admin can remove the portal account; the student can then do first access again | I |
| STA-11 | WhatsApp invitation message | Contains the first-access link and the how-it-works link; no personal data | I |
| STA-12 | Browser journey: first access → authenticator → My record → change password → admin resets password → sign in with one-time password + TOTP → forced new password | Works end to end | E |

## 6d. Profile & skills (PRF). PRF-1, PRF-2.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| PRF-01 | Gap maths | Verified level wins over self; missing = L0; ready = all met; nearly = ≥ 80 %; developing otherwise | U |
| PRF-02 | Student sets target role | Active roles only; retired/unknown rejected; audited | I |
| PRF-03 | Student self-ratings | 0–6 saved; level 7, unknown or retired skill rejected; verified level untouched | I |
| PRF-04 | Admin verifies levels | Verified level saved and wins in the gap; can be cleared; Viewer 403; student session can't call it (401) | I |
| PRF-05 | Projects | Add/edit/delete own; max 10; another student's project → 404; links must be http(s); skills must be active | I |
| PRF-06 | Links | LinkedIn/GitHub must be on their domain; portfolio any https link; blank clears | I |
| PRF-07 | Completeness % (updated by PRF-3) | 12 sections with weights summing to 100; partial credit per rules in `src/lib/completeness.ts`; empty profile = 0 %, full = 100 % | U |
| PRF-08 | Browser: student chooses role, rates skills, adds a project; admin verifies; student sees ✓ verified | Works end to end | E |
| PRF-09 | Personal details | Gender/DOB/city/state/hometown/languages saved; implausible DOB rejected; name/email/mobile not editable by the student | I |
| PRF-10 | Education | Class 10 / 12 / UG entries; score above the grading maximum rejected; end year before start rejected; Pass/Fail needs no score | I |
| PRF-11 | Internships, certifications, accomplishments | Saved with dates; end before start / expiry before issue rejected; links must be http(s); skills must be active | I |
| PRF-12 | Technical skills/tools | Duplicate tool name (case-insensitive) → 409; per-section limits enforced; another student's item → 404 | I |
| PRF-13 | Career preferences | ≤ 3 active roles, ≤ 5 locations, job types, work modes, CTC (LPA), available-from, relocate | I |
| PRF-14 | Resume | PDF only (file signature), ≤ 2 MB; replace and remove; student can download own; admin download audited; downloads are attachments | I |
| PRF-15 | Completeness moves with each section | Each section's score and the overall % rise as sections are filled; admin view and insights show the same % | I |
| PRF-16 | Browser: student fills personal, education, certification and preferences; section % chips and overall % update; admin sees the full profile | Works end to end | E |

| PRF-17 | Key skills section = technical skills/tools only | 0 → 0 %, 1–2 → 30 %, 3–4 → 60 %, 5+ → 100 %; target role and gap no longer affect completeness (CP-1) | U |
| CP-01 | Browser: Career plan page | Student picks a target role and rates gap skills on /student/career-plan; the profile page has no target-role picker | E |

## 6g. International internships (INT). INT-1..3.

| ID | Scenario | Expected | Level |
|---|---|---|---|
| INT-01 | Create program | Code INT-YYYY-NNN; company, title, description (20+), country, work mode, resources ≥ 1, duration days/weeks (≤ 2 years) validated; Ongoing needs a start date; Viewer can read but not create/edit (403); audited | I |
| INT-02 | Assign within seat limit | Can't assign more students than resources; re-assigning is idempotent; withdraw frees a seat; resources can't drop below assigned; cancelled/completed programs can't take students; Viewer 403; audited | I |
| INT-03 | Student visibility | Student sees only own assigned programs that aren't Draft/Cancelled; withdrawn programs disappear; another student's assignment → 404; no session → 401 | I |
| INT-04 | Weekly report file types | PDF, Word, Excel, PowerPoint, CSV, TXT, RTF, OpenDocument accepted only when content matches the extension; .zip, a zip or xlsx renamed to .docx, an executable renamed to .pdf/.txt, empty and > 4 MB rejected; future weeks and weeks beyond the program rejected; resubmission replaces; late flag set after the due date | I |
| INT-05 | Review & attendance | Needs revision requires a note and stops counting as attendance; resubmission clears the review; accepted reports are locked (409); Viewer can't review; list shows % reports in and pending reviews | I |
| INT-06 | Downloads | Student downloads only own reports (others → 404); admin/viewer downloads are audited; always attachment + sandbox CSP + nosniff | I |
| INT-07 | Week maths | Weeks = ceil(days ÷ 7); due = start + 7 × week; end date | U |
| INT-08 | Attendance % | (submitted + accepted) ÷ weeks due (early submissions count); revision/missing don't; no start date → no % | U |
| INT-09 | Browser: admin creates a program, assigns a student; student uploads a weekly report; admin accepts it | Works end to end; attendance shows 100 % | E |
| INT-10 | Partner-college privilege (INT-4) | Assign picker lists partner-college students first and flags them; *Partner colleges only* returns just them; program roster flags them; non-partner students can still be assigned | I |

## 6e. Attendance (ATT). ATT-1.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| ATT-01 | Save a sheet | Only that batch's students; null clears a mark; session date stored; one audit entry per changed student | I |
| ATT-02 | Viewer | Can read sheets/overview; save → 403 | I |
| ATT-03 | Student attendance % | Present ÷ (held days − excused) | I |
| ATT-04 | Browser: mark all present, mark one absent, save; overview shows counts; student home shows attended / held | Works end to end | E |

## 6f. Insights (INS). INS-1.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| INS-01 | Adoption counts | Match SQL; deleted students excluded; batch filter applies | I |
| INS-02 | Readiness + ready list | Ready / nearly / developing / no role classified correctly; list holds only ready + nearly; role filter works | I |
| INS-03 | Skill gaps + heatmap | Skills ranked by students not meeting the requirement; heatmap share = met ÷ counted pairs | I |
| INS-04 | Attendance by batch | % = present ÷ (held × students − excused) | I |
| INS-05 | Ready-list export | Needs export permission (Viewer without flag 403); CSV-injection safe; audited | I |
| INS-06 | Browser: insights page with a batch filter; axe clean | Renders all sections | E |
| INS-07 | Profile completeness in insights | Average and per-section % match the students' own profile %; completeness bands add up to the cohort | I |

## 7. Dashboard (DSH). M4.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| DSH-01 | Seeded fixture of known counts | Totals by status, batch and institution match a SQL count | I |
| DSH-02 | Viewer opens the dashboard | Sees counts; no PII rows | E |

## 8. UI, UX & accessibility (UI). M1, re-run at M7.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| UI-01 | Keyboard only: login → bulk status update | Fully possible; visible focus throughout | E |
| UI-02 | axe on every page | 0 serious/critical violations | E |
| UI-03 | `prefers-reduced-motion` | Background blobs static | E |
| UI-04 | Browser without `backdrop-filter` (forced via `@supports` override) | Solid fallback, readable | E |
| UI-05 | Visual review vs. tokens at 1280 / 1440 / 768 px | Matches spec; screenshots attached | M |
| UI-06 | Tamil text in table, drawer and form | No tofu boxes or clipping | M |
| UI-07 | Text contrast on glass cards over the brightest blob position | ≥ 4.5:1 for body, ≥ 3:1 for large text/UI (computed in test) | E |
| UX-01 | Safari (WebKit): form fields | Dropdowns, text, date, number and file fields share height, padding and border with Chrome; month fields are month + year dropdowns (desktop Safari has no month picker) | E |
| UX-02 | Browser: skill picker | Student types "python" in *Skills used*, sees "Programming/software development" with "matches python", picks it, sees the name (not a code) as a chip; works from the keyboard | E |
| UX-03 | Skill search: everyday words | Tool and topic words (python, figma, power bi, ethical hacking) find the right framework skills and say which word matched | U |
| UX-04 | Skill search: ranking | Name matches rank above keyword-only matches; already-chosen skills are excluded; empty search shows popular fresher skills | U |
| UX-05 | Keyword map grounded | Every code in the keyword map and starter list is an active ontology skill | I |
| UX-06 | Role search: job words | "tester" finds QA / SDET Engineer, "designer" UX Designer, "developer" Software and Mobile Engineer (says which word matched); entry-level roles rank above leadership; empty search shows entry-level roles only | U |
| UX-07 | Role word map grounded | Every role name in the job-word map is an active ontology role | I |
| UX-08 | Browser: role picker | Career preferences: student searches "tester", sees "Entry-level friendly", picks it, adds a second role with Enter; Career plan target role uses the same search | E |

## 9. Security & privacy (SEC). M7, plus continuously.

| ID | Scenario | Expected | Lvl |
|---|---|---|---|
| SEC-01 | XSS payload `<script>` / `"><img onerror>` in name | Rendered as text everywhere (table, drawer, export, audit view) | E |
| SEC-02 | SQL-like input in search | No error, no injection | I |
| SEC-03 | PII in server logs (run the E2E suite, then grep the logs for fixture emails/phones/names) | None | I |
| SEC-04 | Secret scan | None | U |
| SEC-05 | IDOR: fetch `/api/students/{id}` of a deleted record as Viewer | 404/403 | I |
| SEC-06 | CSRF: mutating request without a valid token/origin | Rejected | I |
| SEC-07 | Security headers | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'` present | I |
| SEC-08 | Error responses | No stack traces, SQL or PII in production error bodies | I |
| SEC-09 | Rate limit on login and upload endpoints | Enforced; returns 429 | I |
| SEC-10 | `npm audit --omit=dev` | 0 high/critical (or each one documented with a mitigation) | U |
| SEC-11 | Supabase Data API lockdown (DEP-1) | Every `public` table has Row Level Security enabled with no policies, so the anon/authenticated API roles can read nothing; new migrations must enable it too | I |
| SEC-12 | Database TLS (DEP-1) | With `DATABASE_CA_CERT` the server certificate is verified (`rejectUnauthorized`), PEM or base64 accepted, `sslmode` in the URL can't weaken it; pool stays small on Vercel | U |

---

## Coverage: pain point → tests

| Pain point | Tests |
|---|---|
| P1 duplicates | UPL-03, UPL-04, STU-02 |
| P2 inconsistent text | MST-01, MST-04, MST-05, UPL-07 |
| P3 messy Excel | UPL-05, UPL-06, UPL-14, UPL-15, UPL-18 |
| P4 accidental bulk delete | STU-10, STU-11, STU-12 |
| P5 lost authenticator | AUTH-08, AUTH-13 |
| P6 big uploads | UPL-09, UPL-16 |
| P7 accountability | AUD-01..04, STU-03 |
| P8 PII exposure | AUTH-16, SEC-03, SEC-05, SEC-08, STU-19 |
| P9 Unicode | UPL-08, UI-06, STU-07 |
| P10 CSV injection | UPL-11, STU-14 |
| P11 slow table | STU-15, STU-06, STU-07 |
| P12 select-all ambiguity | STU-08, STU-09 |
| P13 status reason | STU-09 |
| P14 unclear errors | UPL-02, UPL-12 |
| P15 lost work | UPL-17, STU-24 |
| P16 ontology ownership | ONT-09 |

## Test data rules
- Fixtures live in `tests/fixtures/`. All fake people use `@example.test` emails and `+9190000xxxxx` phones. Never use real member data in tests.
- Ontology tests read only `reference/Skills_Ontology_Dashboard_1.html`. No hand-typed ontology data.
- The integration DB is a disposable local/CI Postgres. Tests never point at a shared DB.

## Proposed (Claude Code adds here; PM approves)
| ID | Scenario | Expected | Why |
|---|---|---|---|
