-- Default privileges: new objects in public are server-only (security review 17 Oct 2026; findings in groups 1-16).
-- NOT APPLIED to production by the branch that wrote it; the main session applies it under the owner's grant.
--
-- Why: pg_default_acl still gave anon and authenticated ALL on every new table, USAGE/SELECT/UPDATE on every new
-- sequence and EXECUTE on every new function created in public by postgres (and by supabase_admin). The 16 Oct
-- least-privilege migration (20261016170000) revoked the grants on the objects that existed then, so each later
-- migration had to remember its own REVOKE; a forgotten one (a new SECURITY DEFINER RPC, a table with RLS off, a
-- function re-created with DROP + CREATE) reopened it to the public anon key at once.
--
-- What it does:
--  1. For role postgres (owner of every migration-made object) in schema public: revoke the default ALL on tables, ALL on
--     sequences and EXECUTE on functions from PUBLIC, anon and authenticated. service_role keeps its defaults, so
--     supabaseAdmin() keeps working on new objects.
--  2. Functions also get PUBLIC's EXECUTE from the built-in GLOBAL default (not a pg_default_acl row), and a per-schema
--     REVOKE cannot remove a global grant (Postgres docs, ALTER DEFAULT PRIVILEGES). So EXECUTE ... FROM PUBLIC is also
--     revoked globally for role postgres. This touches functions postgres creates in any schema: a function meant for
--     the browser roles (for example an RLS helper) then needs an explicit GRANT EXECUTE in its migration.
--  3. The same for role supabase_admin, only when the running role may act for it. On hosted Supabase postgres is not
--     a member of supabase_admin (checked on staging 17 Oct 2026), so this step is skipped with a NOTICE there; those
--     defaults cover platform-made objects only, and each migration keeps its explicit REVOKE as before.
--  4. Leftover sequence grants: every sequence in public loses all privileges for PUBLIC, anon and authenticated (the
--     16 Oct sweep covered tables and functions only). service_role and the owner keep theirs. Nothing in the browser
--     uses a sequence: the browser roles hold no INSERT grant on any public table.
--
-- Tables that should be readable from the browser (like chapters and units) need an explicit GRANT SELECT in their own
-- migration from now on. Idempotent. Undo: supabase/undo/20261017210000_default_privileges_server_only.undo.sql.

-- 1. postgres, schema public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 2. postgres, the built-in global EXECUTE for PUBLIC.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 3. supabase_admin, when allowed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin')
     AND pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
  ELSE
    RAISE NOTICE 'default privileges of supabase_admin left unchanged: % may not act for supabase_admin', current_user;
  END IF;
END $$;

-- 4. Leftover sequence grants.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', r.seq);
  END LOOP;
END $$;
