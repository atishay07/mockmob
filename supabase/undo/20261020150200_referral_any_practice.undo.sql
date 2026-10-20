-- Undo for supabase/migrations/20261020150200_referral_any_practice.sql. NOT a migration: it lives outside supabase/migrations
-- on purpose, so the Supabase CLI never applies it by itself.
-- What it does: puts the "at least 5 answers" floor back on public.mm_referral_qualify (the 20261020130000 body, verbatim).
-- What it keeps: every credit already paid and every referrals row (a friend paid under the one-practice rule stays paid; "never
-- take credits away", D165). Run this BEFORE supabase/undo/20261020130000_referrals.undo.sql when undoing both: that file drops
-- the function, and this one would otherwise re-create it. If only the first migration was undone, do not run this file.

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
  if coalesce(p_answered, 0) < 5 then return jsonb_build_object('ok', true, 'qualified', false, 'reason', 'too_few_answers'); end if;
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

revoke all on function public.mm_referral_qualify(text, integer, text) from public, anon, authenticated;
grant execute on function public.mm_referral_qualify(text, integer, text) to service_role;
