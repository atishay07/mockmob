-- Undo for 20261016170300_function_search_path.sql: the listed functions go back to no fixed search_path.
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
      EXECUTE format('ALTER FUNCTION %s RESET search_path', sig);
    END IF;
  END LOOP;
END $$;
