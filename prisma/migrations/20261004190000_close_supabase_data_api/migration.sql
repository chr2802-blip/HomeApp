-- Closes the app's tables to Supabase's Data API (PostgREST).
--
-- Production's Postgres is a Supabase project, and Supabase serves every table in the
-- `public` schema over HTTPS to the `anon` and `authenticated` roles, guarded by nothing
-- but row-level security. Prisma creates its tables with RLS off, and Supabase's default
-- privileges grant both roles everything on them. The project's publishable key is
-- handed to every signed-in phone by `/api/realtime/token`, and the token beside it is an
-- `authenticated` JWT — so without this, either one was enough to read or rewrite any
-- table: every household's rows, every account's password hash, `User.role` included.
--
-- This app never talks to its tables through the Data API: Prisma connects as the
-- tables' owner, which RLS does not apply to (nothing here says FORCE). So two locks,
-- either sufficient on its own:
--   1. RLS on, with no policy at all — `anon` and `authenticated` see no rows.
--   2. Their grants revoked, now and for tables created later by this role.
--
-- Safe everywhere: on a laptop's Postgres or the test databases there are no such roles,
-- and enabling RLS changes nothing for the owner. `tests/integration/rls.test.ts` fails
-- if a later migration adds a table without turning RLS on for it.
DO $$
DECLARE
  t record;
  exempt boolean;
BEGIN
  -- RLS binds everybody who neither owns a table nor has BYPASSRLS. If the role running
  -- migrations is neither, the app (which connects as the same role) would lose its own
  -- tables, so refuse loudly rather than take production down.
  SELECT rolbypassrls OR rolsuper INTO exempt FROM pg_roles WHERE rolname = current_user;

  FOR t IN
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    IF t.owner <> current_user AND NOT exempt THEN
      RAISE EXCEPTION 'Not enabling RLS on %: it is owned by %, and % would lose access to it.',
        t.relname, t.owner, current_user;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  END IF;
END
$$;
