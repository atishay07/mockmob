-- The question ids of a student's newest attempts, without the snapshots (egress items A9, F13, F14; 20 Oct 2026). NOT applied anywhere by
-- this branch. Companion to data/attempt_question_ids.js, which calls this function when it exists and reads the table itself when it
-- does not (PostgREST PGRST202 or Postgres 42883 only, then again after five minutes), so deploying the code first, or never applying
-- this file, is safe: the same answer, heavier read.
--
-- Why: three reads decide which questions a student has seen, so that a practice, full-mock or NTA start does not repeat one: the recency
-- lookup (the newest 3 to 8 papers of the subject, on every practice start), the seen set and the previous NTA papers of an NTA start
-- (the newest 40 each). Each needs only the ids of the questions of those papers, but read the whole attempt row (a snapshot is 32 KB
-- on average, up to 380 KB). This returns, per attempt, the ids of its snapshot's questions in order and their family ids, and nothing
-- else. An element without an id (or an empty one) is left out, exactly as the callers' `if (q && q.id)` left it out. Same filter as the
-- callers: this user, the subject when given, selection_meta->>'mode' when given; newest first (completed_at desc, then id so a tie is not
-- arbitrary), the first p_limit.
--
-- Security: security invoker, execute granted to service_role only. The routes pass the signed-in user's id; the function must never be
-- callable by anon or authenticated, or p_user_id would read another student's history.
--
-- Rollback: supabase/undo/20261020150100_attempt_question_ids_fn.undo.sql (drops the function; the code falls back to the table).

create or replace function public.attempt_question_ids(p_user_id text, p_subject text default null, p_mode text default null, p_limit integer default null)
 returns table (
   attempt_id text,
   question_ids text[],
   family_ids text[]
 )
 language sql
 stable
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
  select
    a.id as attempt_id,
    coalesce(array(
      select q.value ->> 'id'
      from jsonb_array_elements(case when jsonb_typeof(a.questions_snapshot) = 'array' then a.questions_snapshot else '[]'::jsonb end) with ordinality as q(value, ord)
      where jsonb_typeof(q.value) = 'object' and coalesce(q.value ->> 'id', '') <> ''
      order by q.ord), '{}'::text[]) as question_ids,
    coalesce(array(
      select q.value ->> 'familyId'
      from jsonb_array_elements(case when jsonb_typeof(a.questions_snapshot) = 'array' then a.questions_snapshot else '[]'::jsonb end) with ordinality as q(value, ord)
      where jsonb_typeof(q.value) = 'object' and coalesce(q.value ->> 'familyId', '') <> ''
      order by q.ord), '{}'::text[]) as family_ids
  from public.attempts a
  where a.user_id = p_user_id
    and (p_subject is null or a.subject = p_subject)
    and (p_mode is null or a.selection_meta ->> 'mode' = p_mode)
  order by a.completed_at desc, a.id
  limit p_limit;
$function$;

revoke all on function public.attempt_question_ids(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.attempt_question_ids(text, text, text, integer) to service_role;
