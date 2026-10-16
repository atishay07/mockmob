-- Undo for 20261016170000_browser_roles_least_privilege.sql: put back the Supabase default grants the migration removed.
-- (Restores the privileges, not any policy: RLS keeps denying the rows either way.)
DO $$
DECLARE
  t text;
  sig text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_credit_ledger','ai_credit_wallets','ai_moderation_reviews','ai_usage_logs','attempts','credit_transactions',
    'generation_jobs','generation_stats','mentor_messages','mentor_sessions','moderation_jobs','passage_groups',
    'question_bookmarks','question_concepts','question_interactions','question_scores','question_votes',
    'rival_battle_answers','rival_battles','user_daily_login_credits','user_question_answer_credits',
    'user_question_progress','users','chapters','units'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;

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
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', sig);
    END IF;
  END LOOP;
END $$;
