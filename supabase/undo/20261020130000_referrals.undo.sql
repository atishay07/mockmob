-- Undo for supabase/migrations/20261020130000_referrals.sql. NOT a migration: it lives outside supabase/migrations on purpose,
-- so the Supabase CLI never applies it by itself.
-- Order: switch REFERRALS_ENABLED off first and redeploy (the web and the app then stop showing, capturing and claiming
-- invites; GET /api/referrals answers live:false), then run this.
-- What it does: drops the two triggers and every mm_referral_* function, so nothing new is attributed or paid; puts the
-- users.credit_balance default back to 100 (new accounts start with 150 again: 100 kept plus the month's free 50).
-- What it keeps: every credit already paid. The 100s live in users.credit_balance with credit_transactions rows
-- (action 'referral'); D165 "never take credits away", so they stay. The three tables are dropped only while no referral
-- was ever paid; once one was, they are the only record of why those credits exist, so they are kept (a NOTICE says so),
-- with no function left to write to them. A later re-apply of the migration picks them up again (create if not exists).

drop trigger if exists mm_referral_after_attempt on public.attempts;
do $$
begin
  if to_regclass('public.mob_game_runs') is not null then
    execute 'drop trigger if exists mm_referral_after_mob_run on public.mob_game_runs';
  end if;
end;
$$;

drop function if exists public.mm_referral_status(text, text);
drop function if exists public.mm_referral_grant_due(integer);
drop function if exists public.mm_referral_on_mob_run();
drop function if exists public.mm_referral_on_attempt();
drop function if exists public.mm_referral_qualify(text, integer, text);
drop function if exists public.mm_referral_grant(uuid, boolean);
drop function if exists public.mm_referral_credit(text, integer, text);
drop function if exists public.mm_referral_attach(text, text, text, timestamp with time zone, text, text);
drop function if exists public.mm_referral_code_for(text, text);
drop function if exists public.mm_referral_month_start(timestamp with time zone);
drop function if exists public.mm_referral_normalise_code(text);

alter table public.users alter column credit_balance set default 100;

do $$
begin
  if to_regclass('public.referrals') is null then
    drop table if exists public.referral_codes;
    drop table if exists public.referral_program;
    return;
  end if;
  if exists (select 1 from public.referrals where referee_granted or referrer_granted) then
    raise notice 'referrals holds paid rows: referrals, referral_codes and referral_program are kept as the record of those credits. Export them before dropping by hand.';
  else
    drop table public.referrals;
    drop table if exists public.referral_codes;
    drop table if exists public.referral_program;
  end if;
end;
$$;
