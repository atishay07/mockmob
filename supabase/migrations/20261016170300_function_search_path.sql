-- Pin search_path on the public functions the security advisor flags as mutable (health audit 16 Oct 2026, finding 5c).
--
-- A function without a fixed search_path resolves unqualified names through the caller's path. All sixteen are SECURITY
-- INVOKER and now server-only, so there is no live exploit; this closes the advisor warning and the future one.
--
-- Each body was read on production: every table is either schema-qualified (public.) or an unqualified public table, and
-- everything else is pg_catalog (now(), lower(), btrim(), count()), which is always searched first. `public, pg_temp`
-- is the value the repo already uses (account_deletion_run). link_creator_role exists on staging only; it is guarded.
--
-- Explicit list, not a rule, so the undo can reset exactly what this changed (all of them had no search_path before).
-- Idempotent. Undo: supabase/undo/20261016170300_function_search_path.undo.sql.

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
    'public.grant_attempt_answer_credits(text, text, jsonb)',
    'public.grant_contribution_credits(text, text, text)',
    'public.grant_daily_login_credits(text)',
    'public.link_creator_role()',
    'public.link_user_to_creator()',
    'public.moderate_question_with_credit(text, text)',
    'public.recover_stale_moderation_jobs(integer)',
    'public.save_sample_import(text, text, text, text, jsonb, integer, integer)',
    'public.set_updated_at()',
    'public.spend_credits(text, text, text)',
    'public.sync_question_scores_metadata()'
  ]
  LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
    END IF;
  END LOOP;
END $$;
