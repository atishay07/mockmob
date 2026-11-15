-- NOT APPLIED. Saved 16 Nov 2026 for the free first Full mock's release race (tmp/1115-prod/durable-sessions-ready.md, "Still to
-- fix before LEARNING_SESSIONS_ENABLED=true"); apply only with the owner's or the CTO's word.
-- Undo: supabase/undo/20261116120000_release_unstarted_allowance.undo.sql.
--
-- Why: a durable start takes its free row in learning_allowances BEFORE start_learning_session (src/lib/server/practiceSessions.js),
-- so a start whose session then fails gives the row back (src/lib/server/firstFullMock.js releaseFirstFullMock). That release read
-- recovery_sessions and then deleted the row, outside the start's lock. On a double tap (two starts, the same generation key, so
-- the same session id) start A's session start could fail while start B's held the users row lock and had not committed: A saw no
-- session, deleted the row, B committed a free session, and the student could later start a second free first Full mock.
--
-- What: one function that gives the row back atomically. It takes the users row lock first, the same lock and the same order as
-- start_learning_session and start_recovery_session (both begin with `select ... from public.users where id = ... for update`),
-- so it queues behind a start that holds it and the two cannot deadlock. Then, with a fresh snapshot (a volatile plpgsql
-- function in READ COMMITTED, PostgREST's level, reads each statement anew), it deletes the row only while no recovery_sessions
-- row has that id. Returns true when it gave the row back. Generic over the allowance kind on purpose: it is the release for any
-- allowance a start takes outside its session's transaction (today only the free first Full mock).
--
-- Nothing requires this: until it is applied, releaseFirstFullMock gets PGRST202 / 42883 and does the read-then-delete it did
-- before (the window stays open there). Only the durable path calls it (LEARNING_SESSIONS_ENABLED=true; off on production).
-- Tested by data/tests/allowance_release_race_1116.test.mjs (PGlite, the real start_learning_session and routes).

create or replace function public.release_unstarted_allowance(
  p_user_id text,
  p_kind text,
  p_period text,
  p_session_id text
) returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(p_user_id, '') = '' or coalesce(p_kind, '') = '' or coalesce(p_period, '') = '' or coalesce(p_session_id, '') = '' then
    return false;
  end if;
  perform 1 from public.users where id = p_user_id for update;
  if not found then
    return false;
  end if;
  -- Read after the lock: a start that held it has committed its session by now, and this sees it.
  if exists (select 1 from public.recovery_sessions where id = p_session_id) then
    return false;
  end if;
  delete from public.learning_allowances
   where user_id = p_user_id and kind = p_kind and period = p_period and reference = p_session_id;
  return found;
end;
$$;

revoke all on function public.release_unstarted_allowance(text, text, text, text) from public, anon, authenticated;
grant execute on function public.release_unstarted_allowance(text, text, text, text) to service_role;
