-- Undo of supabase/migrations/20261101150000_learn_runs.sql. SAVED ONLY, never applied by an agent; run only with the
-- owner's grant. Drops the two functions and the two Learn tables with every row in them (runs and their item log).
-- What the runs recorded elsewhere stays where it belongs: user_question_progress and key_card_reviews keep their rows,
-- learning_question_exposure keeps its rows, and question_interactions keeps its 'learn' rows as history.
-- learning_allowances rows of kind 'learn_session' are left (inert without the code); delete them only on the owner's word.
-- Tested by data/tests/learn_db.test.mjs (PGlite): no learn_* object is left and a new 'learn' interaction is refused.
drop function if exists public.learn_record_event(text, text, text, jsonb, jsonb, jsonb, jsonb, text, jsonb);
drop function if exists public.learn_start_run(jsonb, text[]);
-- The A6 draft's signatures, in case a draft was ever applied by hand somewhere.
drop function if exists public.learn_record_event(text, text, text, jsonb, jsonb, jsonb, jsonb, text);
drop function if exists public.learn_start_run(jsonb, text, text, int, text[]);
drop table if exists public.learn_run_events;
drop table if exists public.learn_runs;
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.question_interactions'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%flow_context%'
  loop
    execute format('alter table public.question_interactions drop constraint %I', c.conname);
  end loop;
end
$$;
-- The four old values again. NOT VALID keeps the 'learn' rows already written while refusing new ones. For a fully validated
-- check instead, first run: update public.question_interactions set flow_context = 'explore' where flow_context = 'learn';
-- then add the constraint without NOT VALID.
alter table public.question_interactions add constraint chk_qi_flow_context
  check (flow_context is null or flow_context in ('mock', 'review', 'explore', 'shadow')) not valid;
