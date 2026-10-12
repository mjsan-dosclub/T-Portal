# Going live: GitHub → Supabase → Vercel

Decision DEP-1. Everything runs in Mumbai (Supabase `ap-south-1`, Vercel `bom1`) so student data stays in India and pages are fast.

```
GitHub (private repo) ──push──▶ Vercel (builds + hosts the app, bom1)
                                   │  DATABASE_URL (transaction pooler, TLS verified)
                                   ▼
                          Supabase Postgres (ap-south-1)
Your laptop ──DIRECT_URL──▶ migrations, seed, first admin
```

Do the steps in order. Total time: about 30–45 minutes.

---

## 1. GitHub: private repository

1. On github.com → **New repository**. Name: `dos-club-talent-portal`. Visibility: **Private**. Don't add a README, .gitignore or licence (the project has them).
2. Copy the repo URL (e.g. `https://github.com/<you>/dos-club-talent-portal.git`).
3. Push the code (Claude can do this when you share the URL):
   ```bash
   git remote add origin https://github.com/<you>/dos-club-talent-portal.git
   git push -u origin main
   ```
4. The **CI** workflow (`.github/workflows/ci.yml`) runs lint, typecheck, guards, all tests, build and E2E on every push. Check the **Actions** tab is green.

What is *not* pushed (git-ignored): `.env`, `.env.production.local`, `.dev-admin.local`, `.pgdata/`, test sign-in state.

## 2. Supabase: database

1. supabase.com → **New project**.
   - Name: `dos-club-talent-portal`
   - **Region: South Asia (Mumbai)**
   - Database password: generate a strong one and **save it in your password manager**.
2. When it's ready, press **Connect** (top of the dashboard) and copy two URIs, replacing `[YOUR-PASSWORD]`:
   - **Transaction pooler** (port **6543**) → this is `DATABASE_URL`.
   - **Session pooler** (port **5432**) → this is `DIRECT_URL` (migrations only).
   Add `?sslmode=require` to the end of both.
3. **Project Settings → Database → SSL Configuration**: turn on **Enforce SSL**, and **Download certificate** (`prod-ca-2021.crt`). Convert it for the env var:
   ```bash
   base64 -i ~/Downloads/prod-ca-2021.crt | tr -d '\n'
   ```
4. Optional, recommended: **Project Settings → Data API** → turn the Data API **off**. The app never uses it. (It's already locked: every table has Row Level Security on with no policies, and the `anon`/`authenticated` roles have no privileges. Migration `supabase_lockdown`, test SEC-11.)

## 3. From your laptop: create tables, seed, first admin

1. In the project folder:
   ```bash
   cp .env.production.example .env.production.local
   ```
2. Fill in `.env.production.local`:
   - `DATABASE_URL`, `DIRECT_URL` from step 2.2
   - `DATABASE_CA_CERT` = the base64 text from step 2.3
   - `APP_ENCRYPTION_KEY`, `RECOVERY_PEPPER`: **new** values, run this twice:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
     Save both in your password manager. **If `APP_ENCRYPTION_KEY` is lost, every authenticator setup stops working.**
   - `APP_ORIGIN`: leave as is for now (set in step 4).
3. Run, in order:
   ```bash
   npm run prod:migrate
   npm run prod:seed
   npm run prod:admin -- --email you@descienceosclub.com --name "Your Name"
   ```
   The last command prints a **one-time password once**. Keep it for step 5.

   Never run `db:seed:dev` against production; it creates fake students.

## 4. Vercel: host the app

1. vercel.com → **Add New → Project** → import the GitHub repo. Framework: **Next.js** (auto-detected). Leave build settings as default.
2. **Environment Variables** (tick **Production** only, so preview builds can't touch live data):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | transaction pooler URI (port 6543) |
   | `DATABASE_CA_CERT` | base64 certificate |
   | `APP_ENCRYPTION_KEY` | same as `.env.production.local` |
   | `RECOVERY_PEPPER` | same as `.env.production.local` |
   | `APP_ORIGIN` | `https://<project>.vercel.app` (or your custom domain) |

   `DIRECT_URL` is **not** needed on Vercel.
3. **Deploy.** When it's done, open the URL. If the real URL differs from what you put in `APP_ORIGIN`, fix the variable and **Redeploy** (sign-in and every form save are refused when the origin doesn't match).
4. Optional custom domain, e.g. `talent.descienceosclub.com`: **Settings → Domains → Add**, create the DNS record Vercel shows, then set `APP_ORIGIN` to `https://talent.descienceosclub.com` and redeploy.

## 5. Smoke test (10 minutes)

- [ ] `/how-it-works` loads.
- [ ] Admin sign-in with the one-time password → scan the QR in Google Authenticator → save the 10 recovery codes → you're asked to set a new password.
- [ ] Masters: add your institutions, departments and batches (or upload them with the students).
- [ ] Add **one** test student with your own email/mobile, open `/student/activate` on your phone, activate, sign in.
- [ ] Create a test internship, assign that student, upload a small PDF as week 1, accept it.
- [ ] Supabase **Table Editor**: every table shows **RLS enabled**.
- [ ] Delete the test student and the test program (or set the program to Cancelled).

Then upload the real student list (Students → Upload, max 4 MB / 10,000 rows per file) and share the invitation message.

## 6. After go-live

- **Deploys:** every push to `main` deploys automatically. **If a change adds a migration, run `npm run prod:migrate` before pushing** (migrations only add things, so the old code keeps working meanwhile).
- **Rollback:** Vercel → Deployments → previous one → **Promote to Production**. Database migrations aren't rolled back.
- **Backups:** Supabase Pro takes daily backups. On the free plan there are none. Take one yourself weekly:
  ```bash
  pg_dump "$DIRECT_URL" -Fc -f dos-backup-$(date +%F).dump
  ```
- **Upload limits:** 4 MB per file (Vercel refuses request bodies over 4.5 MB). Bigger files would need direct uploads to Supabase Storage: a later change if students need it.

## 7. Plans and costs to decide

- **Supabase free:** 500 MB database and the project **pauses after a week without activity**. Resumes and weekly reports are stored inside the database, so 100 reports of 4 MB already fill it. **Supabase Pro** (8 GB, daily backups, no pausing) is the realistic choice once students start uploading.
- **Vercel Hobby** is for personal, non-commercial use. If DOS Club runs this as an organisation or charges for programs, use **Vercel Pro**. Check the current terms on vercel.com/pricing.
