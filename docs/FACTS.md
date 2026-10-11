# FACTS.md — Verified facts registry

> **Read-only for Claude Code** (enforced in `.claude/settings.json`). Only the PM edits this file.
> A number, colour, font, count, name or rule that is **not** in this file, `docs/PRD.md` or `docs/DECISIONS.md` is **unknown**. Unknown means: ask, do not guess.
> Every fact records *how* it was verified, so it can be checked again.

Verified on **2026-10-11**.

## F1 — Ontology reference data

Source: `reference/Skills_Ontology_Dashboard_1.html` (sha256 `047a8e870b0943c7ea5d2e023b9339288f524a6eeb1e9d3054ca42c0978c4b3b`).
Method: `node scripts/guard/verify-ontology.mjs`, which parses the `DATA`, `LEVELS` and `WORKSHOPS` constants.

| ID | Fact | Value |
|---|---|---|
| F1.1 | Categories (distinct `Category`) | **11** |
| F1.2 | Subcategories (distinct `Category`+`Subcategory`) | **51** ⚠️ *Draft PRD v1.0 said 45. That was wrong; v1.1 corrects it.* |
| F1.3 | Skills (`DATA.skills`), unique `Skill Code` | **165** |
| F1.4 | Roles (`DATA.roles`), unique role names | **103** |
| F1.5 | Roadmaps (`DATA.roadmap` keys, each matches a role) | **103** |
| F1.6 | Proficiency levels (`LEVELS`) L1 Foundation, L2 Practitioner, L3 Senior Practitioner, L4 Lead / Expert, L5 Principal, L6 Distinguished | **6** |
| F1.7 | Workshops (`WORKSHOPS`) | **27** |
| F1.8 | Every role skill code exists in the skills list | true (0 missing) |
| F1.9 | "Enterprise Architect" skills | STPL, ARCH, ITSP, GOVN, EMRG, all L4; track `IC`; levelMin 4, levelMax 5 |
| F1.10 | Roles matching search "agentic" (case-insensitive, role name) | exactly 1: "Agentic AI Engineer" |
| F1.11 | Skill `Source` values | `SFIA 9`, `New (AI gap-fill)` |
| F1.12 | Shapes | skill `{Category, Subcategory, Skill Code, Skill Name, Overall Description, Source}`; role `{role, category, track, levelMin, levelMax, skills[{code,name,level}]}`; roadmap step `{level, levelNum, whatYouDo, tools, next}`; level `{n,name,desc}`; workshop `{n, t (title), r (role · level text)}` |
| F1.13 | Roles have **no numeric ID** in the source | They are keyed by name. The DB must generate IDs and keep `name` unique. |

## F2 — Website typography (descienceosclub.com)

Method: read the production stylesheet `/_next/static/chunks/09j5exdg_hnnp.css` and its CSS custom properties.

| ID | Token on site | Value |
|---|---|---|
| F2.1 | `--font-display` | **Space Grotesk** (headings, display), weights 400/500/600/700 |
| F2.2 | `--font-mono` | **JetBrains Mono** |
| F2.3 | `--font-sans` (body) | **system UI stack**: `ui-sans-serif, system-ui, sans-serif`. The site does **not** load Inter. |

The old dashboard HTML uses Space Grotesk + Inter. The portal follows the **website** (F2.1–F2.3) unless the PM decides otherwise (D2).

## F3 — Website colour tokens (light theme, verified)

| ID | Site token | Hex | White text on it | On page bg #F4F7F9 |
|---|---|---|---|---|
| F3.1 | `--color-accent` (blue) | `#1593C3` | 3.50 ✗ text | 3.26 (UI/icons only) |
| F3.2 | `--color-accent-dark` | `#0D6B90` | **5.96 ✓** | **5.54 ✓** |
| F3.3 | `--color-primary` (green) | `#4CAF50` | 2.78 ✗ | 2.58 ✗ |
| F3.4 | `--color-primary-dark` | `#2F8A36` | 4.37 (large/bold text only) | 4.06 (large only) |
| F3.5 | `--color-primary-soft` | `#8BD08E` | ✗ decorative only | ✗ |
| F3.6 | `--color-deep` | `#0C3346` | 13.31 ✓ | 12.37 ✓ |
| F3.7 | `--color-fg` (text) | `#10222B` | — | 15.18 ✓ |
| F3.8 | `--color-muted` | `#5B6F79` | — | 4.89 ✓ |
| F3.9 | `--color-ink` (page bg) | `#F4F7F9` | | |
| F3.10 | `--color-ink-soft` / `--color-ink-2` | `#EAEFF3` / `#DFE7ED` | | |
| F3.11 | `--color-line` / `--color-stroke` | `#10222B1F` / `#0C33461F` | | |
| F3.12 | `--color-surface` | `#FFFFFF` | | |
| F3.13 | Site radii | md .375rem · lg .5rem · xl .75rem · 2xl 1rem · 3xl 1.5rem | | |

Contrast values come from the WCAG 2.1 relative-luminance formula and were computed in this session.

**Consequence:** white text on the brand gradient or on `#4CAF50` / `#1593C3` **fails WCAG AA**. Draft PRD v1.0 §7.2 asked for a "gradient fill with white text" primary button, which is non-compliant. v1.1 fixes this.

## F4 — Logo

`reference/logo.png` (sha256 `d85dfe5d…4d25`): circular blue → teal → green gradient, white "DOS" wordmark and "CLUB", mint dots top-right. The logo-sampled hexes in PRD v1.0 (`#1695BE #0CA394 #02B162 #70D4B8`) were **eyeballed estimates and never verified**. Use the F3 site tokens instead.

## F5 — Brief from the PM (verbatim intent)

- Light "liquid glass" theme, Google One-style platform feel.
- Admin authentication with Google Authenticator (TOTP).
- Master table: upload students (bulk) and add students manually.
- Student module datatable: bulk delete, bulk status update, preview, update student information.
- Students are DOS Club members. Known data: personal info, degree, department, DOS Club batch (batch year). Entry level.
- Phase 2: students log in and complete a job-portal-style profile (Naukri / Indeed).
