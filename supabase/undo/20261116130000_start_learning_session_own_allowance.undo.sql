-- Undo of supabase/migrations/20261116130000_start_learning_session_own_allowance.sql. NOT APPLIED, and NOT a migration: it lives
-- outside supabase/migrations on purpose, so the Supabase CLI never applies it by itself. Run only with the owner's or the CTO's word.
-- Puts back start_learning_session exactly as 20261002120000_connected_learning.sql made it (body md5 4c0c17b2...), with the same
-- signature, security invoker, search_path '' and grants. Rows and sessions already written stay as they are. The server needs
-- no deploy: it works against either version (against the old one, a start of the same subject with another key that takes the
-- free row in the moment between can again leave a free session with no row; see the migration).
-- Guarded like the migration: it runs only while the live body is the migration's or the original; any other body raises.

do $undo$
declare
  live text;
begin
  select md5(replace(p.prosrc, chr(13), '')) into live from pg_catalog.pg_proc p
   where p.oid = to_regprocedure('public.start_learning_session(jsonb,text,text,text)');
  if live is null then
    raise exception 'public.start_learning_session(jsonb,text,text,text) is not there: nothing to undo';
  end if;
  if live not in ('62896e7e810a48535b4df6e43ea447e3', '4c0c17b29dcc4477badd27c9a44db2da') then
    raise exception 'public.start_learning_session is neither the migration''s version nor the original (body md5 %); compare it first', live;
  end if;
  execute $create$
create or replace function public.start_learning_session(p_row jsonb,p_credit_action text,p_quota_kind text,p_period text)
returns jsonb language plpgsql security invoker set search_path='' as $body$
declare s public.recovery_sessions%rowtype; result jsonb; q jsonb; used boolean=false;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into s from public.recovery_sessions where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(s); end if;
 if p_quota_kind is not null then
   used=exists(select 1 from public.learning_allowances where user_id=p_row->>'user_id' and kind=p_quota_kind and period=p_period);
   if not used then insert into public.learning_allowances values(p_row->>'user_id',p_quota_kind,p_period,p_row->>'id',now()); end if;
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
$undo$;
