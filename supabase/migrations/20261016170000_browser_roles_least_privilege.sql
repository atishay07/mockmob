-- Defence in depth for the database (security review 16 Oct 2026, finding 11).
--
-- Why: the public anon key is in the browser bundle, so PostgREST will answer the anon and authenticated roles.
-- Row Level Security already stops them (68 public tables have RLS on and no policy), but 23 of those tables still
-- carried the default Supabase grants (every privilege for anon and authenticated). One disabled RLS or one permissive
-- policy added by mistake would then expose users, attempts, the credit wallets, mentor messages, and so on.
-- This migration removes the grants, so a mistake in RLS is no longer enough.
--
-- Nothing in the website or the apps uses these roles on a table or function:
--   * website browser code (src/lib/supabase-browser.js, src/components/AuthProvider.jsx, src/app/auth/callback)
--     only calls supabase.auth.*, never .from(), .rpc() or .storage;
--   * src/proxy.js and the scripts under scripts/ use the anon key for auth.verifyOtp / session cookies only;
--   * the Flutter app (mockmob-phone/flutter_app/lib/core/auth) only uses Supabase.instance.client.auth;
--   * every table and RPC read or write in the website goes through supabaseAdmin() (service_role), which is not touched.
--
-- What it does:
--  1. Tables with RLS on and NO policy: revoke all from anon and authenticated (it was already denied by RLS; now it is denied by grants too).
--     Done by rule, not by list, so staging (a few tables fewer) and production both come out the same.
--  2. Tables with a deliberate browser read policy (chapters, units: the public syllabus tree): keep SELECT for anon and
--     authenticated, remove every other privilege (the default grants also allowed INSERT, UPDATE, DELETE, TRUNCATE).
--     payments keeps its own-rows SELECT for authenticated (policy "Users can read their own payments", SELECT only, nothing uses it today). questions was closed by 20261016140000.
--  3. The ten public functions that anon and authenticated could execute through the PUBLIC default: revoke execute from
--     PUBLIC, anon and authenticated, grant to service_role (which the website uses) so every server path keeps working.
--     Trigger functions (enforce_admin_role, link_user_to_creator, set_updated_at, sync_question_scores_metadata) need no
--     execute privilege to fire. Undo: supabase/undo/20261016170000_browser_roles_least_privilege.undo.sql.
--
-- Idempotent: safe to run twice.

DO $$
DECLARE
  r record;
BEGIN
  -- 1. RLS on, no policy at all: nothing is meant for the browser roles.
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated', r.rel);
  END LOOP;

  -- 2. Deliberate public read (the syllabus tree): SELECT only.
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname IN ('chapters', 'units')
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %s FROM anon, authenticated', r.rel);
  END LOOP;
END $$;

-- 3. Functions. Written with explicit signatures (not a loop) so the list is reviewable.
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.apply_question_vote(text, text, question_vote_type)',
    'public.apply_question_vote(uuid, uuid, text)',
    'public.claim_moderation_job(text)',
    'public.count_distinct_mock_sessions(text, timestamptz)',
    'public.create_pending_payout(text, text)',
    'public.enforce_admin_role()',
    'public.link_user_to_creator()',
    'public.recover_stale_moderation_jobs(integer)',
    'public.set_updated_at()',
    'public.sync_question_scores_metadata()'
  ]
  LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    END IF;
  END LOOP;
END $$;
