-- Server-only functions, second pass (production health audit 16 Oct 2026, finding 5b, staging drift).
--
-- 20261016170000 closes the ten public functions that production exposed to anon and authenticated.
-- The staging project (onwkqxmjqjrhfbjjdydu) carries two more that are still executable by the browser roles:
--   * public.mm_ai_consume_credits(...)  SECURITY DEFINER, spends AI credits for the user id it is given.
--   * public.link_creator_role()          trigger function on public.users.
-- Neither is defined by a file in supabase/migrations (created by hand), so the first migration never named them.
-- On production the same checks show them already closed, so this migration is a no-op there.
--
-- Callers: mm_ai_consume_credits is only called as supabaseAdmin().rpc(...) from
-- src/services/credits/aiCreditWallet.js (service_role). link_creator_role fires as a trigger and needs no EXECUTE.
-- No policy, default, view, index or constraint depends on either (checked with pg_depend on both projects).
--
-- Idempotent. Undo: supabase/undo/20261016170200_server_only_functions_drift.undo.sql (only meaningful on a
-- database where this migration actually changed something, i.e. staging).

DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.mm_ai_consume_credits(text, integer, text, text, text, integer, timestamptz, timestamptz, jsonb)',
    'public.link_creator_role()'
  ]
  LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    END IF;
  END LOOP;
END $$;
