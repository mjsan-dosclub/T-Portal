# DOS Club Talent Portal (Phase 1)

Admin portal for Descience Open Source Club. It provides the student master with bulk upload, a datatable with bulk status/delete and a Recycle Bin, master tables, the Skills Ontology (read-only), Google Authenticator (TOTP) sign-in, RBAC, and an append-only audit log. The UI is a light "liquid glass", Google One-style theme using the verified DOS Club site tokens.

Requirements and process: [`docs/PRD.md`](docs/PRD.md) · [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) · [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) · [`docs/FACTS.md`](docs/FACTS.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · guardrails for AI work: [`CLAUDE.md`](CLAUDE.md)

## Stack (resolved versions)

Next.js 16.4 (App Router, Turbopack) · React 19.3 · TypeScript (strict) · PostgreSQL 18 · Prisma 7.10 (`@prisma/adapter-pg`) · Zod 4 · otplib 13 (TOTP) · @node-rs/argon2 (argon2id) · SheetJS 0.20.3 + Papa Parse · Radix Dialog · Tailwind v4 · Vitest 5 · Playwright 1.64 + axe.

## Run it locally

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then fill APP_ENCRYPTION_KEY and RECOVERY_PEPPER (commands are in the file)
npm run db:start                 # local Postgres on 127.0.0.1:54329 (keep this terminal open)
npx prisma migrate deploy        # create tables (in a second terminal)
npm run db:seed                  # statuses, degrees, and the ontology (11/51/165/103/103/6/27)
npm run db:seed:dev -- 300       # optional: 300 FAKE students (@example.test) for trying things out
npm run admin:create -- --email you@yourdomain.in --name "Your Name"   # prints a one-time password once
npm run dev                      # http://localhost:3000
```

Sign in, scan the QR code with **Google Authenticator**, enter the 6-digit code, and save the 10 recovery codes. Other admins are invited from **Admin users** (no public sign-up).

> No Docker or system Postgres is needed. `npm run db:start` uses the `embedded-postgres` package with data in `./.pgdata` (git-ignored). In production, point `DATABASE_URL` at a managed Postgres in the Mumbai region (D14).

## Quality gate

```bash
npm run verify       # lint + typecheck + ontology guard + unit/integration tests (needs `npm run db:start`)
```

```bash
npm run verify:all   # + production build + Playwright E2E (Chromium: `npx playwright install chromium`)
```

Tests run against a disposable `dos_test` database that is rebuilt from migrations on every run. The test setup refuses to touch any database that isn't local and named `*_test`. Test names start with their TEST_PLAN ID, and guard test GRD-04 fails if a planned automated test is missing.

## Roles

| Role | Can do |
|---|---|
| Super Admin | Everything, plus Recycle Bin restore/purge, audit log, admin users, 2FA resets |
| Admin | Students (add/edit/upload/bulk status/soft delete/undo/export) and masters |
| Viewer | Read-only; CSV export only if a Super Admin enables it for that viewer |

Every API route re-checks the session, second factor, role and request origin on the server (`src/server/http.ts`).

## Runbook

| Situation | What to do |
|---|---|
| Admin lost their phone | They sign in with a recovery code, then regenerate codes under **Account**. With no codes left: a Super Admin uses **Admin users → Reset 2FA** (logged), and they re-enrol at next sign-in. |
| Last Super Admin locked out | On the server: `npm run admin:create -- --email … --name … --role SUPER_ADMIN` creates a new one (audited as `admin.create_cli`). |
| Account locked (5 wrong attempts) | Wait 15 minutes, or a Super Admin uses **Reset password**, which also clears that admin's lock. |
| Student deleted by mistake | Within 10 s: **Undo** in the toast. Later: Super Admin → **Recycle Bin → Restore**. Purge is only possible 30 days after deletion (D6). |
| Upload went wrong | Each upload is a job. Open **Upload → Your recent uploads** to resume a preview or download its error report. A failed import keeps completed batches; the failing batch is rolled back. |
| Rotate `APP_ENCRYPTION_KEY` | TOTP secrets are encrypted with it. Rotating requires every admin to re-enrol (reset 2FA for all). Plan a window. |
| Backups | Use the managed Postgres provider's daily backups (PRD §6). `audit_logs` is append-only at the DB level (trigger). |

## Known limitations (Phase 1)

- Danger/warning colours are pending **D3**. Destructive UI uses the deep navy token with an explicit ⚠ text label for now.
- CSV exports prefix cells starting with `+ - = @` with `'` (CSV-injection protection, P10), so phone numbers export as `'+91…`.
- An XLSX phone cell that already holds a rounded number (typed as `9.18E+11`) can't be recovered. CSV text in that form is rejected; format the column as Text.
- `npm audit` reports advisories only in the Prisma CLI toolchain (not shipped). See [`docs/SECURITY_EXCEPTIONS.md`](docs/SECURITY_EXCEPTIONS.md).
- Phase 2 (student login and job-portal-style profile) is intentionally not built. See PRD Appendix A.
