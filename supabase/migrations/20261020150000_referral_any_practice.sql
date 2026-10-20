-- Referral reward threshold: one finished practice of ANY length (owner D182, 20 Oct 2026, 5:45 pm IST; it replaces the
-- "at least 5 answers" floor of 20261020130000_referrals.sql, owner D165 otherwise unchanged).
-- NOT applied on production by this branch. Apply with the Supabase MCP only under the standing migration grant, after the
-- dry run below. Undo: supabase/undo/20261020150000_referral_any_practice.undo.sql (puts the 5-answer floor back).
--
-- What changes: ONE function, public.mm_referral_qualify(text, integer, text). The floor on the answers a finished practice
-- must hold goes from 5 to 1. Every call site is unchanged: mm_referral_on_attempt (AFTER INSERT on attempts: practice sets of
-- any length, the daily set, a full mock, a Mob paper, the app, the server deadline finaliser) and mm_referral_on_mob_run
-- (a finished Mob game) already pass the answers they counted, and they only look at a friend whose referral is still
-- 'joined'.
-- The floor is 1 answer, not 0, on purpose: a practice with no answer in it (an empty submit, an abandoned set, a run where
-- every question was skipped) still never pays, so the abuse floor is a real answer, not a click. A 1-question episode check
-- with an answer now counts, which is the owner's rule.
--
-- What does NOT change (all inside the untouched functions and constraints): once per friend (referrals.referee_id unique;
-- qualify moves joined -> qualified once, under the users row locks), atomic (qualify and grant run in the one trigger
-- statement, a failure is caught and logged and never fails the practice), idempotent (credit_transactions reference unique
-- 'referral:<id>:friend' / ':inviter'), self-referral refused (check and attach), new accounts only (created after the click,
-- within 3 days, no attempt or finished Mob game yet), the device and network holds, the monthly cap of 10, the kill switch
-- (grants_paused), RLS and privileges.
--
-- No data is touched: no row is rewritten and nothing is paid retroactively. A friend who is still 'joined' and had only a 1 to
-- 4 answer practice before this runs qualifies on their NEXT finished practice, not on the old one.
--
-- Dry run (staging, one transaction that ends in ROLLBACK): apply 20261020130000_referrals.sql, then this file, then
--   new account + attach, 0 answers   -> select public.mm_referral_qualify('B', 0, 't0')  = qualified false, too_few_answers
--   1 finished answer                 -> insert into attempts (...correct 1, wrong 0...)  = granted, +100 each, 2 ledger rows
--   a replay                          -> select public.mm_referral_qualify('B', 9, 'again') = qualified false, already
--   a second friend with the same inviter's device -> still held 'same_device'; the inviter themself -> still 'self'
-- Pre-check (SELECT only, production): select prosrc like '%< 5 then%' from pg_proc where proname = 'mm_referral_qualify';
--   expected true before, false after; select state, count(*) from public.referrals group by 1; (unchanged by this file).

create or replace function public.mm_referral_qualify(p_user_id text, p_answered integer, p_ref text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.referrals%rowtype;
  v_id uuid;
begin
  -- One finished practice of any length: it only has to hold an answer (an empty submit never counts).
  if coalesce(p_answered, 0) < 1 then return jsonb_build_object('ok', true, 'qualified', false, 'reason', 'too_few_answers'); end if;
  select * into r from public.referrals where referee_id = p_user_id;
  if not found then return jsonb_build_object('ok', true, 'qualified', false, 'reason', 'no_referral'); end if;
  if r.state <> 'joined' then return jsonb_build_object('ok', true, 'qualified', false, 'reason', 'already', 'state', r.state); end if;
  perform 1 from public.users where id in (r.referrer_id, r.referee_id) order by id for update;
  update public.referrals set state = 'qualified', qualified_at = now(), qualifying_ref = left(p_ref, 160)
   where id = r.id and state = 'joined'
  returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', true, 'qualified', false, 'reason', 'already'); end if;
  return public.mm_referral_grant(v_id) || jsonb_build_object('qualified', true);
end;
$function$;

-- create or replace keeps the owner and the grants; they are said again so this file stands on its own.
revoke all on function public.mm_referral_qualify(text, integer, text) from public, anon, authenticated;
grant execute on function public.mm_referral_qualify(text, integer, text) to service_role;
