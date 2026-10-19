-- Mob v3, chains (MOB-BUILD-SPEC-V3 section 2.3; D133 "the two-streak humane system"). Additive and idempotent;
-- service role only. The chains are computed, not stored, by pure functions (src/lib/chain/chain.mjs,
-- src/lib/mob/mobChain.mjs) from daily answered counts, pauses and the clock, so they are deterministic, testable and
-- repairable. These tables keep only what must never drop and what the student set:
--   chain_prefs     "Hide my chain" and a best run that only rises (chain_best_bump)
--   chain_pauses    exam pause days, set ahead (at most 14 a season, 1 Aug to 31 Jul)
--   mob_chain_best  a Mob's best weekly run, which only rises
-- Also the facts the unlock checks read (mob_unlock_facts): counts only, for the student's own Folds.
-- Applied to staging only by this change. Undo: supabase/undo/20261020100200_mob_v3_chains.undo.sql

create table if not exists public.chain_prefs (
  user_id text primary key references public.users(id) on delete cascade,
  hidden boolean not null default false,
  best_days integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.chain_pauses (
  user_id text not null references public.users(id) on delete cascade,
  day date not null,
  set_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists public.mob_chain_best (
  mob_id uuid primary key references public.mobs(id) on delete cascade,
  best_weeks integer not null default 0
);

-- Answered questions per IST day from p_from: attempts (total - unattempted), Mob game answers that are not skips, and
-- answered Fix it together questions. Skips never count. [{ day, answered }]
create or replace function public.chain_daily(p_user_id text, p_from date)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare a jsonb := '[]'::jsonb; from_at timestamptz := (p_from::timestamp at time zone 'Asia/Kolkata');
begin
  if to_regclass('public.attempts') is not null then
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('day', d, 'answered', n)), '[]'::jsonb) from (
        select (completed_at at time zone 'Asia/Kolkata')::date d, sum(greatest(0, coalesce(total, 0) - coalesce(unattempted, 0)))::int n
        from public.attempts where user_id = $1 and completed_at >= $2 group by 1) t$q$
      into a using p_user_id, from_at;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('day', day, 'answered', n) order by day) from (
    select day, sum(n)::int n from (
      select (e->>'day')::date as day, (e->>'answered')::int as n from jsonb_array_elements(a) e
      union all
      select (answered_at at time zone 'Asia/Kolkata')::date, count(*)::int from public.mob_game_answers
        where user_id = p_user_id and pick >= 0 and answered_at >= from_at group by 1
      union all
      select (answered_at at time zone 'Asia/Kolkata')::date, count(*)::int from public.mob_fix_checks
        where user_id = p_user_id and answered_at is not null and answered_at >= from_at group by 1
    ) u group by day) t), '[]'::jsonb);
end $$;

-- Fixes that held, per IST day: a right "Check it held" repair answer (the rows behind rhythm.js firstHoldAt) and a
-- right Mob Wednesday check. [{ day, n }]
create or replace function public.chain_fixes_held(p_user_id text)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare a jsonb := '[]'::jsonb;
begin
  if to_regclass('public.ai_credit_reservations') is not null then
    begin
      execute $q$select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n)), '[]'::jsonb) from (
          select ((receipt->'check'->>'answeredAt')::timestamptz at time zone 'Asia/Kolkata')::date d, count(*)::int n
          from public.ai_credit_reservations where user_id = $1 and state = 'committed' and action = 'score_recovery_repair'
            and receipt->'check'->>'right' = 'true' and receipt->'check'->>'answeredAt' is not null group by 1) t$q$
        into a using p_user_id;
    exception when others then a := '[]'::jsonb;
    end;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day) from (
    select day, sum(n)::int n from (
      select (e->>'day')::date as day, (e->>'n')::int as n from jsonb_array_elements(a) e
      union all
      select (answered_at at time zone 'Asia/Kolkata')::date, count(*)::int from public.mob_fix_checks
        where user_id = p_user_id and stage = 'check' and correct and answered_at is not null group by 1
    ) u group by day) t), '[]'::jsonb);
end $$;

-- Everything the chain needs in one read: daily counts, pause days, held fixes, prefs and the seen keys.
create or replace function public.chain_state(p_user_id text, p_from date)
returns jsonb language sql security invoker stable set search_path = public as $$
  select jsonb_build_object(
    'daily', public.chain_daily(p_user_id, p_from),
    'pauses', coalesce((select jsonb_agg(day order by day) from public.chain_pauses where user_id = p_user_id), '[]'::jsonb),
    'fixes', public.chain_fixes_held(p_user_id),
    'hidden', coalesce((select hidden from public.chain_prefs where user_id = p_user_id), false),
    'best_days', coalesce((select best_days from public.chain_prefs where user_id = p_user_id), 0),
    'seen', coalesce((select jsonb_agg(key) from public.mob_seen where user_id = p_user_id and (key like 'chain:%' or key like 'rest:%')), '[]'::jsonb))
$$;

-- Exam pause days: only days after today, at most 14 in a season (1 Aug to 31 Jul). ok | past | limit
create or replace function public.chain_pause_set(p_user_id text, p_days date[], p_today date)
returns text language plpgsql security invoker set search_path = public as $$
declare bad int;
begin
  if exists (select 1 from unnest(p_days) d where d <= p_today) then return 'past'; end if;
  perform pg_advisory_xact_lock(hashtext('chain_pause:' || p_user_id));
  select count(*) into bad from (
    select case when extract(month from d) >= 8 then extract(year from d) else extract(year from d) - 1 end season, count(*) n
    from (select day d from public.chain_pauses where user_id = p_user_id union select unnest(p_days)) all_days group by 1) s
  where n > 14;
  if bad > 0 then return 'limit'; end if;
  insert into public.chain_pauses (user_id, day) select p_user_id, d from unnest(p_days) d on conflict do nothing;
  return 'ok';
end $$;

-- Clear pause days: only future days. ok | past
create or replace function public.chain_pause_clear(p_user_id text, p_days date[], p_today date)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from unnest(p_days) d where d <= p_today) then return 'past'; end if;
  delete from public.chain_pauses where user_id = p_user_id and day = any (p_days);
  return 'ok';
end $$;

create or replace function public.chain_prefs_set(p_user_id text, p_hidden boolean)
returns text language plpgsql security invoker set search_path = public as $$
begin
  insert into public.chain_prefs (user_id, hidden) values (p_user_id, coalesce(p_hidden, false))
  on conflict (user_id) do update set hidden = coalesce(p_hidden, chain_prefs.hidden), updated_at = now();
  return 'ok';
end $$;

-- The best only rises. Returns the stored best after the bump.
create or replace function public.chain_best_bump(p_user_id text, p_days integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare b int;
begin
  insert into public.chain_prefs (user_id, best_days) values (p_user_id, greatest(0, coalesce(p_days, 0)))
  on conflict (user_id) do update set best_days = greatest(chain_prefs.best_days, excluded.best_days)
  returning best_days into b;
  return b;
end $$;

create or replace function public.mob_chain_best_bump(p_mob_id uuid, p_weeks integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare b int;
begin
  insert into public.mob_chain_best (mob_id, best_weeks) values (p_mob_id, greatest(0, coalesce(p_weeks, 0)))
  on conflict (mob_id) do update set best_weeks = greatest(mob_chain_best.best_weeks, excluded.best_weeks)
  returning best_weeks into b;
  return b;
end $$;

-- The facts the Fold rules read (MOB-BUILD-SPEC-V3 0.4), for one student. Counts only.
create or replace function public.mob_unlock_facts(p_user_id text)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare fm int := 0; bb boolean := false;
begin
  if to_regclass('public.attempts') is not null then
    execute $q$select count(*)::int from public.attempts where user_id = $1 and selection_meta->>'mode' in ('full', 'nta')$q$ into fm using p_user_id;
    execute $q$select exists (select 1 from public.attempts a where a.user_id = $1 and a.selection_meta->>'mode' in ('full', 'nta')
        and a.score > (select max(b.score) from public.attempts b where b.user_id = a.user_id and b.subject = a.subject
          and b.selection_meta->>'mode' in ('full', 'nta') and b.completed_at < a.completed_at))$q$ into bb using p_user_id;
  end if;
  return jsonb_build_object(
    'mobs', coalesce((select jsonb_agg(jsonb_build_object('mob_id', mm.mob_id, 'subject', mo.subject, 'name_key', mo.name_key,
        'quest_done', exists (select 1 from public.mob_weeks w where w.mob_id = mm.mob_id and w.done_at is not null and w.done_at >= mm.joined_at),
        'quests_done', (select count(*)::int from public.mob_weeks w where w.mob_id = mm.mob_id and w.done_at is not null),
        'traps_fixed', (select count(*)::int from public.mob_traps t where t.mob_id = mm.mob_id and t.fixed_at is not null),
        'best_weeks', coalesce((select best_weeks from public.mob_chain_best b where b.mob_id = mm.mob_id), 0)) order by mm.joined_at)
      from public.mob_members mm join public.mobs mo on mo.id = mm.mob_id where mm.user_id = p_user_id), '[]'::jsonb),
    'full_mocks', fm,
    'beat_best', bb,
    'clean_games', (select count(*)::int from public.mob_game_runs where user_id = p_user_id and finished_at is not null and wrong_n = 0 and right_n > 0),
    'fixes_held', (select coalesce(sum((e->>'n')::int), 0)::int from jsonb_array_elements(public.chain_fixes_held(p_user_id)) e),
    'chain_best', coalesce((select best_days from public.chain_prefs where user_id = p_user_id), 0),
    'unlocks', coalesce((select jsonb_agg(jsonb_build_object('fold', fold, 'finish', finish, 'mob_id', mob_id) order by earned_at) from public.fold_unlocks where user_id = p_user_id), '[]'::jsonb),
    'seat', (select jsonb_build_object('fold', fold, 'finish', finish) from public.mob_profiles where user_id = p_user_id),
    'seen', coalesce((select jsonb_agg(key) from public.mob_seen where user_id = p_user_id
      and (key like 'reveal:%' or key like 'quest_done:%' or key like 'stitch:%')), '[]'::jsonb));
end $$;

alter table public.chain_prefs enable row level security;
alter table public.chain_pauses enable row level security;
alter table public.mob_chain_best enable row level security;
revoke all on public.chain_prefs, public.chain_pauses, public.mob_chain_best from public, anon, authenticated;
grant all on public.chain_prefs, public.chain_pauses, public.mob_chain_best to service_role;
revoke all on function public.chain_daily(text, date), public.chain_fixes_held(text), public.chain_state(text, date),
  public.chain_pause_set(text, date[], date), public.chain_pause_clear(text, date[], date), public.chain_prefs_set(text, boolean),
  public.chain_best_bump(text, integer), public.mob_chain_best_bump(uuid, integer), public.mob_unlock_facts(text)
  from public, anon, authenticated;
grant execute on function public.chain_daily(text, date), public.chain_fixes_held(text), public.chain_state(text, date),
  public.chain_pause_set(text, date[], date), public.chain_pause_clear(text, date[], date), public.chain_prefs_set(text, boolean),
  public.chain_best_bump(text, integer), public.mob_chain_best_bump(uuid, integer), public.mob_unlock_facts(text)
  to service_role;
