-- DEP-1: lock the public schema down for Supabase.
-- Supabase exposes `public` through its Data API (PostgREST) to the `anon` and `authenticated` roles.
-- This app only talks to Postgres from the server as the table owner, so:
--   1. Row Level Security is enabled on every table with NO policies → the Data API sees nothing.
--      (Table owners bypass RLS, so the app is unaffected.)
--   2. The API roles lose all privileges, now and for tables created by later migrations.
-- On plain Postgres (local dev, CI) the Supabase roles don't exist and step 2 is skipped.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- Future tables: every new migration must `ENABLE ROW LEVEL SECURITY` on tables it creates.
-- SEC-14 (tests/integration/security.test.ts) fails if any public table has RLS off.
