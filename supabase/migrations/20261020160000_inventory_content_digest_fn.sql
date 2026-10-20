-- A digest of everything the daily inventory count reads from `questions` (egress item F1 follow-up, 20 Oct 2026). NOT applied anywhere by
-- this branch. Companion to data/inventory_fingerprint.js, which calls this function when it exists and behaves exactly as before when it
-- does not (PostgREST PGRST202, Postgres 42883, or any other error: the full count), so deploying the code first, or never applying this
-- file, is safe.
--
-- Why: the daily count (33 MB a run) is skipped when no question row moved, and "moved" was read from questions.updated_at. But every
-- student vote or interaction runs `update questions set upvotes, downvotes, score` (apply_question_vote, data/question_votes.js), and
-- the trigger trg_questions_updated_at bumps updated_at on ANY update, so on a day with a vote the skip never happened. The count does
-- not read the vote counters: of the 22 columns it reads, the only vote-derived one is `score`, and only through the floor
-- `Number(row.score ?? 0) >= -2` (data/practice_library.js). This function returns one md5 text over exactly those 22 columns of exactly
-- the rows the count reads (not deleted, and live or verified-and-active), with `score` replaced by that boolean, so a vote changes the
-- digest only when it moves a question across the floor. Equal digest means equal counted input; the code compares it with the digest
-- stored beside the previous full count, and only when updated_at says something was touched.
--
-- Cost: it runs inside Postgres (a scan of the visible rows, a second or two once a day at most) and ships 32 bytes.
-- The column list must stay equal to INVENTORY_COLUMNS in data/inventory_count.js (data/tests/inventory_fingerprint.test.mjs checks it).
--
-- Security: security invoker, execute granted to service_role only (it reads signed evidence records).
-- Rollback: supabase/undo/20261020160000_inventory_content_digest_fn.undo.sql (drops the function; the code falls back to the full count).

create or replace function public.inventory_content_digest()
 returns text
 language sql
 stable
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
  select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id), ''))
  from (
    select
      q.id, q.subject, q.chapter, q.concept, q.concept_id, q.question, q.body, q.options, q.correct_index, q.correct_answer,
      q.explanation, q.passage_text, q.family_id, q.question_type, q.status, q.verification_state, q.exploration_state,
      (coalesce(q.score, 0) >= -2) as score_ok,
      q.is_deleted, q.legacy_screening, q.evidence, q.provenance
    from public.questions q
    where q.is_deleted = false
      and (q.status = 'live' or (q.verification_state = 'verified' and q.exploration_state = 'active'))
  ) t;
$function$;

revoke all on function public.inventory_content_digest() from public, anon, authenticated;
grant execute on function public.inventory_content_digest() to service_role;
