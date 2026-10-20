-- Lean attempt reads (egress items A1, A3, A4, A5; 20 Oct 2026). NOT applied anywhere by this branch.
-- Companion to data/attempt_reads.js (slim: 'plan' and slim: 'history'). The code calls this function when it exists and reads
-- the table itself when it does not (PostgREST PGRST202 or Postgres 42883 only, then again after five minutes), so deploying the
-- code first, or never applying this file, is safe: the same answer, heavier read. Any other error (57014 above all) is NOT
-- answered with the heavy read.
--
-- Why: an attempt row is mostly `questions_snapshot` (each question carries its whole bank row, 35 KB of it on a server-scored
-- paper), and about ten routes read every attempt of a student on every Today, result, Rule book or Mobi message. This returns
-- the same twelve columns as the table with
--   questions_snapshot  every element kept, in the same order and count, reduced to the keys below. A key is kept exactly as it
--                       is in the row (present stays present, null stays null, absent stays absent), so a consumer cannot tell
--                       a reduced element from the full one by anything it reads;
--   selection_meta      reduced to the keys below, the same way.
--   details             kept whole (small).
-- Profiles:
--   'plan'     (learningRecord: the plan, tonight, milestones, weak concepts and chapters)
--              question: id, subject, chapter, conceptId.   meta: mode, sessionId, scoringVersion, durationMinutes, tonight,
--              mobPaper, contentEvidence, learningPurpose.
--   'review'   (Review's mistakes, the repair record, the credits history: the question's place and chapter and its stem)
--              question: id, chapter, question, body (a body equal to the stem is not shipped twice).   meta: mobPaper.
--              `p_ids`, when given, limits the read to those attempts, so the function reduces only the papers asked for.
--   'history'  (the result page's history, the Rule book, playbook, traps, Mobi's record, repairs)
--              question: id, subject, internalSubject, chapter, difficulty, conceptId, familyId, options, question, body,
--              correctIndex, correctAnswer, verificationEvidence reduced to {content_hash}.   meta: the 'plan' keys + recovery.
--              These rows carry answer keys: they feed pure builders and must never be put in a response body.
-- Rows are ordered like attempts_list_summary (completed_at desc, id). An unknown profile raises.
-- The signature has an optional third argument (p_ids): callers that omit it get exactly the two-argument behaviour.
--
-- Security: security invoker, execute granted to service_role only. The routes pass the signed-in user's id; the function must
-- never be callable by anon or authenticated, or p_user_id would read another student's attempts.
--
-- Rollback: supabase/undo/20261020150000_attempts_lean_fn.undo.sql (drops the function; the code falls back to the table).

create or replace function public.attempts_lean(p_user_id text, p_profile text, p_ids text[] default null)
 returns table (
   id text,
   user_id text,
   subject text,
   score integer,
   correct integer,
   wrong integer,
   unattempted integer,
   total integer,
   details jsonb,
   questions_snapshot jsonb,
   completed_at timestamp with time zone,
   selection_meta jsonb
 )
 language plpgsql
 stable
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
declare
  q_keys text[];
  m_keys text[];
begin
  if p_profile = 'plan' then
    q_keys := array['id','subject','chapter','conceptId'];
    m_keys := array['mode','sessionId','scoringVersion','durationMinutes','tonight','mobPaper','contentEvidence','learningPurpose'];
  elsif p_profile = 'history' then
    q_keys := array['id','subject','internalSubject','chapter','difficulty','conceptId','familyId','options','question','body','correctIndex','correctAnswer','verificationEvidence'];
    m_keys := array['mode','sessionId','scoringVersion','durationMinutes','tonight','mobPaper','contentEvidence','learningPurpose','recovery'];
  elsif p_profile = 'review' then
    q_keys := array['id','chapter','question','body'];
    m_keys := array['mobPaper'];
  else
    raise exception 'attempts_lean: unknown profile %', p_profile using errcode = '22023';
  end if;

  return query
  select
    a.id, a.user_id, a.subject, a.score, a.correct, a.wrong, a.unattempted, a.total, a.details,
    case when jsonb_typeof(a.questions_snapshot) = 'array' then
      coalesce((
        select jsonb_agg(
          case when jsonb_typeof(q.value) = 'object' then
            coalesce((
              select jsonb_object_agg(
                e.key,
                case
                  when e.key = 'verificationEvidence' and jsonb_typeof(e.value) = 'object'
                    then case when e.value ? 'content_hash' then jsonb_build_object('content_hash', e.value -> 'content_hash') else '{}'::jsonb end
                  else e.value
                end)
              from jsonb_each(q.value) as e(key, value)
              where e.key = any (q_keys)
                and not (e.key = 'body' and jsonb_typeof(e.value) = 'string' and e.value is not distinct from q.value -> 'question')
            ), '{}'::jsonb)
          else q.value end
          order by q.ord)
        from jsonb_array_elements(a.questions_snapshot) with ordinality as q(value, ord)
      ), '[]'::jsonb)
    else '[]'::jsonb end as questions_snapshot,
    a.completed_at,
    case when jsonb_typeof(a.selection_meta) = 'object' then
      coalesce((select jsonb_object_agg(m.key, m.value) from jsonb_each(a.selection_meta) as m(key, value) where m.key = any (m_keys)), '{}'::jsonb)
    else '{}'::jsonb end as selection_meta
  from public.attempts a
  where a.user_id = p_user_id and (p_ids is null or a.id = any (p_ids))
  order by a.completed_at desc, a.id;
end;
$function$;

revoke all on function public.attempts_lean(text, text, text[]) from public, anon, authenticated;
grant execute on function public.attempts_lean(text, text, text[]) to service_role;
