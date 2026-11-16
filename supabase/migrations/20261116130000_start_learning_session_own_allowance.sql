-- NOT APPLIED. Saved 16 Nov 2026 for the free first Full mock's release race, the review's open case 1 (tmp/1116-race/CTO-NOTE.md);
-- apply only with the owner's or the CTO's word, after 20261116120000_release_unstarted_allowance.sql.
-- Undo: supabase/undo/20261116130000_start_learning_session_own_allowance.undo.sql.
--
-- Why: a free durable start takes its row in learning_allowances (the subject's free first Full mock, period 'ever') before
-- start_learning_session, outside the users row lock. The server now also names that row in the call (p_quota_kind, p_credit_action
-- null), so the session and its row are made in one transaction under the lock: a row a failed twin gave back a moment before is
-- taken again with the session (this already works with the old function). What the old function cannot do: when a start of the
-- same subject with another key took the row in that moment, it found the row "used" and, with nothing to charge, made a free
-- session with no row, a second free first Full mock.
--
-- What changes, the allowance step only (signature, security invoker, search_path '', grants and everything else unchanged):
--   * no row: inserted for this session (on conflict do nothing, then read again: a start outside this lock may take it at once)
--   * a row this very session holds (taken before the call): this start's own, so the start is free, as when it was inserted
--   * a row another session holds: charged p_credit_action as before; with no action to charge (the caller says this start is free
--     only through this allowance) it raises 'allowance taken' and writes nothing. The server answers FIRST_FULL_MOCK_TAKEN.
-- Every other caller passes a credit action with its quota (daily_practice, baseline, full_sample), and no row of theirs can
-- name a session that does not exist yet (one id per request_key; sessions are deleted only with the account), so for them
-- nothing changes.
--
-- Guard: the replacement runs only while the live function is the one this was written against (the body in
-- 20261002120000_connected_learning.sql, or this one again); any other body raises and nothing changes, in one statement, so a
-- runner that keeps going after an error cannot replace it either. Nothing requires this migration: the server works the same
-- against the old function. Tested by data/tests/allowance_release_race_1116.test.mjs (PGlite, the real routes).

do $migration$
declare
  live text;
begin
  select md5(replace(p.prosrc, chr(13), '')) into live from pg_catalog.pg_proc p
   where p.oid = to_regprocedure('public.start_learning_session(jsonb,text,text,text)');
  if live is null then
    raise exception 'public.start_learning_session(jsonb,text,text,text) is not there: apply 20261002120000_connected_learning.sql first';
  end if;
  -- 4c0c17b2...: the body in 20261002120000_connected_learning.sql. 62896e7e...: this migration's body (a second apply).
  if live not in ('4c0c17b29dcc4477badd27c9a44db2da', '62896e7e810a48535b4df6e43ea447e3') then
    raise exception 'public.start_learning_session is not the version this migration replaces (body md5 %); compare it with 20261002120000_connected_learning.sql first', live;
  end if;
  execute $create$
create or replace function public.start_learning_session(p_row jsonb,p_credit_action text,p_quota_kind text,p_period text)
returns jsonb language plpgsql security invoker set search_path='' as $body$
declare s public.recovery_sessions%rowtype; result jsonb; q jsonb; used boolean=false; held text;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into s from public.recovery_sessions where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(s); end if;
 if p_quota_kind is not null then
   select reference into held from public.learning_allowances where user_id=p_row->>'user_id' and kind=p_quota_kind and period=p_period;
   if not found then
     insert into public.learning_allowances values(p_row->>'user_id',p_quota_kind,p_period,p_row->>'id',now()) on conflict (user_id,kind,period) do nothing;
     select reference into held from public.learning_allowances where user_id=p_row->>'user_id' and kind=p_quota_kind and period=p_period;
   end if;
   used=held is distinct from p_row->>'id';
   if used and p_credit_action is null then raise exception 'allowance taken'; end if;
 end if;
 result=public.start_recovery_session(p_row,case when p_quota_kind is not null and not used then null else p_credit_action end);
 for q in select value from jsonb_array_elements(p_row->'questions') loop
   insert into public.learning_question_exposure values(p_row->>'user_id',q->>'id',p_row->>'id',now()) on conflict do nothing;
   if q->>'familyId' is not null then insert into public.learning_family_exposure values(p_row->>'user_id',q->>'familyId',p_row->>'id',now()) on conflict do nothing; end if;
 end loop;
 return result;
end $body$
$create$;
  execute 'revoke all on function public.start_learning_session(jsonb,text,text,text) from public, anon, authenticated';
  execute 'grant execute on function public.start_learning_session(jsonb,text,text,text) to service_role';
end
$migration$;
