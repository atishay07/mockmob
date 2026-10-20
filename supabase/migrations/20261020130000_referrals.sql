-- Referral credits and the 50-credit welcome (owner D165, 20 Oct 2026; docs/brain/OWNER-FEEDBACK-2026-10-19.md K5 and his
-- answers): new accounts get 50 welcome credits only (this month's free 50, no one-time 100); a referral gives BOTH the inviter
-- and the friend +100 credits once the friend signs up AND finishes one practice; the Mob invite link is also the referral
-- link; existing accounts keep what they have.
-- NOT applied on production by this branch. Staging dry run (rolled back) is recorded in docs/brain/STATUS.md.
-- Undo: supabase/undo/20261020130000_referrals.undo.sql (switch REFERRALS_ENABLED off first).
--
-- What this file does:
--   1. users.credit_balance DEFAULT 100 -> 0. Only the default changes: no existing row is touched (D165 "keep what they
--      have"). A new account then holds this month's 50 free credits (mm_wallet_take, allowance 50) and nothing else.
--      data/db.js ensureUser no longer writes 100 itself, so the database default is the one switch.
--   2. referral_program: one row, the reward (100), the monthly cap per inviter (10) and grants_paused, a kill switch that
--      holds new grants without a deploy (qualified rows wait; mm_referral_grant_due pays them when it is lifted).
--   3. referral_codes: one 7-character code per student (Crockford base 32, so it never collides with a Mob invite code of
--      6 or 8 characters) and the last 5 hashed devices the inviter used, for the same-device check.
--   4. referrals: the attribution. One row per friend (unique referee_id: one inviter per new account), never the inviter
--      themself (check). source: 'link' (/r/<code> or ?ref=), 'code' (typed at signup) or 'mob_invite' (the Mob invite link,
--      whose creator is the inviter). Hashed device and network only (the server hashes them with a secret; no raw IP).
--      state: joined -> qualified -> granted, or held (an abuse signal; never paid automatically).
--   5. mm_referral_attach: attributes a NEW account only. Refused: an unknown code, the inviter's own account, an account
--      already attributed (a replay with the same inviter answers idempotent), an account created before the link was
--      opened (10 minutes' grace for clocks) or more than 3 days before the attach, and an account that has already
--      finished a practice.
--   6. Qualification: AFTER INSERT on attempts (every finished practice set, daily set, full mock and Mob paper on the web
--      and in the app, including the server deadline finaliser) and AFTER UPDATE OF finished_at on mob_game_runs (a finished
--      Mob game). The friend must have answered at least 5 questions in it (so a 1-question episode check or an empty
--      submit never counts). A referral failure never fails the practice: the trigger catches and logs it.
--   7. mm_referral_grant: idempotent. Locks the two users rows (id order, users first as everywhere), then the referral.
--      +100 each into users.credit_balance with a credit_transactions row whose reference is unique
--      ('referral:<id>:friend' / 'referral:<id>:inviter'), the same idempotency as spend_credits and
--      grant_contribution_credits. NOT ai_credit_wallets.bonus_credits (mm_ai_grant_bonus_credits): bonus credits count as
--      BOUGHT credits and lift the per-student AI cap in reserve_runtime_ai (20261018210000); a reward must not, exactly
--      like the old signup grant, which also lived in users.credit_balance.
--      Anti-abuse, before paying: the friend's device is one the inviter used (or the inviter's own signup device) -> held
--      'same_device'; the device already earned a friend reward on another account -> held 'device_reused'; 3 friends of
--      this inviter already paid this IST month from the same network -> held 'same_network'. The cap: an inviter is paid
--      for at most 10 friends per IST month; past it the friend still gets their 100 and the inviter's is marked capped.
--   8. mm_referral_status: counts only (joined, practised, rewarded, not counted, earned), never a name, an email or an id
--      of another student (the audience is 16 and 17 years old).
-- Everything is RLS on with no policy, revoked from anon and authenticated, and executable by service_role only.

-- ---- 1. the welcome: 50 free credits a month, no one-time 100 for NEW accounts ------------------------------------------
alter table public.users alter column credit_balance set default 0;

-- ---- 2-4. tables ----------------------------------------------------------------------------------------------------------
create table if not exists public.referral_program (
  id smallint primary key default 1 check (id = 1),
  reward integer not null default 100 check (reward between 1 and 1000),
  monthly_cap integer not null default 10 check (monthly_cap between 0 and 1000),
  grants_paused boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.referral_program (id) values (1) on conflict (id) do nothing;

create table if not exists public.referral_codes (
  user_id text primary key references public.users(id) on delete cascade,
  code text not null unique check (code ~ '^[0-9A-HJKMNP-TV-Z]{7}$'),
  device_hashes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id text not null references public.users(id) on delete cascade,
  referee_id text not null references public.users(id) on delete cascade,
  source text not null check (source in ('link', 'code', 'mob_invite')),
  code text not null check (char_length(code) between 6 and 8),
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  device_hash text check (device_hash is null or char_length(device_hash) between 8 and 128),
  ip_hash text check (ip_hash is null or char_length(ip_hash) between 8 and 128),
  state text not null default 'joined' check (state in ('joined', 'qualified', 'granted', 'held')),
  held_reason text check (held_reason is null or held_reason in ('same_device', 'device_reused', 'same_network')),
  qualified_at timestamptz,
  qualifying_ref text check (qualifying_ref is null or char_length(qualifying_ref) <= 160),
  referee_granted boolean not null default false,
  referrer_granted boolean not null default false,
  referrer_capped boolean not null default false,
  granted_at timestamptz,
  constraint referrals_one_inviter unique (referee_id),
  constraint referrals_not_self check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, granted_at desc);
create index if not exists referrals_device_idx on public.referrals (device_hash) where device_hash is not null;

alter table public.referral_program enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.referral_program, public.referral_codes, public.referrals from public, anon, authenticated;
grant select, insert, update, delete on public.referral_program, public.referral_codes, public.referrals to service_role;

comment on table public.referrals is 'Friend referrals (owner D165, 20 Oct 2026). One row per new account. Server-only; counts are shown, never names.';

-- ---- helpers ------------------------------------------------------------------------------------------------------------
-- A code as typed or pasted: upper case, spaces and dashes out, Crockford O -> 0 and I, L -> 1 (src/lib/mob/model.mjs
-- normalizeCode does the same). Null unless it is a referral code (7) or a Mob invite code (6 or 8).
create or replace function public.mm_referral_normalise_code(p_code text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case when c ~ '^([0-9A-HJKMNP-TV-Z]{6}|[0-9A-HJKMNP-TV-Z]{7}|[0-9A-HJKMNP-TV-Z]{8})$' then c else null end
    from (select translate(upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g')), 'OIL', '011') as c) x
$function$;

-- The IST calendar month this instant is in (the same expression as mm_wallet_window and mm_ai_grant_bonus_credits).
create or replace function public.mm_referral_month_start(p_at timestamp with time zone)
 returns timestamp with time zone
 language sql
 stable
 set search_path to ''
as $function$
  select date_trunc('month', timezone('Asia/Kolkata', p_at)) at time zone 'Asia/Kolkata'
$function$;

-- One student's code, made on first use. p_device_hash (optional) is remembered (the last 5) for the same-device check.
create or replace function public.mm_referral_code_for(p_user_id text, p_device_hash text default null)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_row public.referral_codes%rowtype;
  v_code text;
  v_try integer := 0;
  v_devices text[];
begin
  if coalesce(p_user_id, '') = '' then return null; end if;
  select * into v_row from public.referral_codes where user_id = p_user_id;
  if not found then
    if not exists (select 1 from public.users where id = p_user_id and deleted_at is null) then return null; end if;
    loop
      v_try := v_try + 1;
      v_code := '';
      for i in 1..7 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::integer, 1);
      end loop;
      begin
        insert into public.referral_codes (user_id, code) values (p_user_id, v_code) returning * into v_row;
        exit;
      exception when unique_violation then
        -- Another request made this student's code at the same moment, or the random code is taken: read or retry.
        select * into v_row from public.referral_codes where user_id = p_user_id;
        if found then exit; end if;
        if v_try >= 8 then raise exception 'referral code space busy'; end if;
      end;
    end loop;
  end if;
  if p_device_hash is not null and char_length(p_device_hash) between 8 and 128 and not (p_device_hash = any (v_row.device_hashes)) then
    v_devices := v_row.device_hashes || p_device_hash;
    if array_length(v_devices, 1) > 5 then v_devices := v_devices[array_length(v_devices, 1) - 4 : array_length(v_devices, 1)]; end if;
    update public.referral_codes set device_hashes = v_devices where user_id = p_user_id;
  end if;
  return v_row.code;
end;
$function$;

-- ---- 5. attribution -----------------------------------------------------------------------------------------------------
create or replace function public.mm_referral_attach(p_referee_id text, p_code text, p_source text default 'link',
  p_clicked_at timestamp with time zone default null, p_device_hash text default null, p_ip_hash text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text := public.mm_referral_normalise_code(p_code);
  v_referrer text;
  v_source text;
  v_existing public.referrals%rowtype;
  v_created timestamp with time zone;
  v_auth_created timestamp with time zone;
  v_click timestamp with time zone;
  v_practised boolean := false;
begin
  if coalesce(p_referee_id, '') = '' then return jsonb_build_object('ok', false, 'error', 'missing_user'); end if;
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;

  if char_length(v_code) = 7 then
    select c.user_id into v_referrer from public.referral_codes c where c.code = v_code;
    v_source := case when p_source = 'code' then 'code' else 'link' end;
  else
    -- A Mob invite code: its creator is the inviter (D165, "one link does both"). A revoked invite does not count.
    if to_regclass('public.mob_invites') is not null then
      execute 'select created_by from public.mob_invites where code = $1 and revoked_at is null' into v_referrer using v_code;
    end if;
    v_source := 'mob_invite';
  end if;
  if v_referrer is null then return jsonb_build_object('ok', false, 'error', 'unknown_code'); end if;
  if v_referrer = p_referee_id then return jsonb_build_object('ok', false, 'error', 'self'); end if;

  -- Lock order everywhere: users rows (in id order) before any referral row.
  perform 1 from public.users where id in (v_referrer, p_referee_id) order by id for update;
  select u.created_at into v_created from public.users u where u.id = p_referee_id and u.deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'user_not_found'); end if;
  if not exists (select 1 from public.users where id = v_referrer and deleted_at is null) then
    return jsonb_build_object('ok', false, 'error', 'unknown_code');
  end if;

  select * into v_existing from public.referrals where referee_id = p_referee_id;
  if found then
    if v_existing.referrer_id = v_referrer then
      return jsonb_build_object('ok', true, 'idempotent', true, 'state', v_existing.state, 'source', v_existing.source);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_referred');
  end if;
  -- A pair never refers each other both ways.
  if exists (select 1 from public.referrals where referrer_id = p_referee_id and referee_id = v_referrer) then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;

  -- Only an account created after the link was opened, and recently. The earlier of the two creation times counts (the
  -- public row is made on the first signed-in request, the auth user at sign-up).
  if to_regclass('auth.users') is not null then
    execute 'select created_at from auth.users where id::text = $1' into v_auth_created using p_referee_id;
  end if;
  v_created := least(v_created, coalesce(v_auth_created, v_created));
  v_click := least(coalesce(p_clicked_at, now()), now());
  if v_created is null or v_created < v_click - interval '10 minutes' or v_created < now() - interval '3 days' then
    return jsonb_build_object('ok', false, 'error', 'existing_account');
  end if;
  -- And one that has not finished a practice yet: the reward is for the first one.
  if exists (select 1 from public.attempts where user_id = p_referee_id) then v_practised := true; end if;
  if not v_practised and to_regclass('public.mob_game_runs') is not null then
    execute 'select exists (select 1 from public.mob_game_runs where user_id = $1 and finished_at is not null)' into v_practised using p_referee_id;
  end if;
  if v_practised then return jsonb_build_object('ok', false, 'error', 'existing_account'); end if;

  begin
    insert into public.referrals (referrer_id, referee_id, source, code, clicked_at, device_hash, ip_hash)
    values (v_referrer, p_referee_id, v_source, v_code, p_clicked_at,
            case when char_length(p_device_hash) between 8 and 128 then p_device_hash end,
            case when char_length(p_ip_hash) between 8 and 128 then p_ip_hash end);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_referred');
  end;
  return jsonb_build_object('ok', true, 'idempotent', false, 'state', 'joined', 'source', v_source);
end;
$function$;

-- ---- 7. one reward, idempotent by its unique ledger reference ------------------------------------------------------------
create or replace function public.mm_referral_credit(p_user_id text, p_amount integer, p_reference text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_existing public.credit_transactions%rowtype;
begin
  if coalesce(p_user_id, '') = '' or p_amount is null or p_amount <= 0 or coalesce(p_reference, '') = '' then
    raise exception 'valid referral credit parameters are required';
  end if;
  select * into v_existing from public.credit_transactions where reference = p_reference for update;
  if found then
    if v_existing.user_id = p_user_id and v_existing.action = 'referral' and v_existing.credit_delta = p_amount then
      return false; -- already paid: a replay pays nothing
    end if;
    raise exception 'credit reference already used for a different transaction';
  end if;
  update public.users set credit_balance = credit_balance + p_amount where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  insert into public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  values (p_user_id, p_amount, 'earn', p_reference, 'referral', p_amount);
  raise log 'credit_change user_id=% action=referral credit_delta=%', p_user_id, p_amount;
  return true;
end;
$function$;

create or replace function public.mm_referral_grant(p_referral_id uuid, p_override boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.referrals%rowtype;
  prog public.referral_program%rowtype;
  v_month timestamp with time zone := public.mm_referral_month_start(now());
  v_paid_this_month integer;
  v_hold text;
  v_inviter boolean := false;
  v_capped boolean := false;
begin
  select * into r from public.referrals where id = p_referral_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform 1 from public.users where id in (r.referrer_id, r.referee_id) order by id for update;
  select * into r from public.referrals where id = p_referral_id for update;

  if r.state = 'granted' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', 'granted', 'inviterPaid', r.referrer_granted, 'friendPaid', r.referee_granted);
  end if;
  if r.state = 'joined' then return jsonb_build_object('ok', false, 'error', 'not_qualified', 'state', 'joined'); end if;
  if r.state = 'held' and not p_override then
    return jsonb_build_object('ok', true, 'state', 'held', 'reason', r.held_reason);
  end if;

  select * into prog from public.referral_program where id = 1;
  if not found then prog.reward := 100; prog.monthly_cap := 10; prog.grants_paused := false; end if;
  if prog.grants_paused then
    -- Held by the kill switch: it stays qualified, and mm_referral_grant_due pays it once grants resume.
    return jsonb_build_object('ok', true, 'state', 'qualified', 'paused', true);
  end if;

  if not p_override then
    if r.device_hash is not null and (
         exists (select 1 from public.referral_codes c where c.user_id = r.referrer_id and r.device_hash = any (c.device_hashes))
      or exists (select 1 from public.referrals y where y.referee_id = r.referrer_id and y.device_hash = r.device_hash)) then
      v_hold := 'same_device';
    elsif r.device_hash is not null and exists (
         select 1 from public.referrals x where x.device_hash = r.device_hash and x.id <> r.id and x.referee_granted) then
      v_hold := 'device_reused';
    elsif r.ip_hash is not null and (
         select count(*) from public.referrals x
          where x.referrer_id = r.referrer_id and x.ip_hash = r.ip_hash and x.id <> r.id and x.referee_granted
            and x.granted_at >= v_month) >= 3 then
      v_hold := 'same_network';
    end if;
    if v_hold is not null then
      update public.referrals set state = 'held', held_reason = v_hold where id = r.id;
      return jsonb_build_object('ok', true, 'state', 'held', 'reason', v_hold);
    end if;
  end if;

  -- The friend's 100.
  perform public.mm_referral_credit(r.referee_id, prog.reward, 'referral:' || r.id::text || ':friend');
  -- The inviter's 100, at most monthly_cap friends per IST month (counted under the inviter's users row lock).
  select count(*) into v_paid_this_month from public.referrals x
   where x.referrer_id = r.referrer_id and x.referrer_granted and x.granted_at >= v_month;
  if v_paid_this_month < prog.monthly_cap then
    perform public.mm_referral_credit(r.referrer_id, prog.reward, 'referral:' || r.id::text || ':inviter');
    v_inviter := true;
  else
    v_capped := true;
  end if;

  update public.referrals
     set state = 'granted', held_reason = null, referee_granted = true, referrer_granted = v_inviter, referrer_capped = v_capped, granted_at = now()
   where id = r.id;
  return jsonb_build_object('ok', true, 'idempotent', false, 'state', 'granted', 'reward', prog.reward,
    'friendPaid', true, 'inviterPaid', v_inviter, 'inviterCapped', v_capped);
end;
$function$;

-- ---- 6. qualification: the friend's first finished practice (at least 5 answers) ------------------------------------------
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

create or replace function public.mm_referral_on_attempt()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_answered integer;
begin
  if new.user_id is null then return null; end if;
  -- The usual path: no open referral for this student, one index lookup and out.
  if not exists (select 1 from public.referrals where referee_id = new.user_id and state = 'joined') then return null; end if;
  begin
    if new.correct is null and new.wrong is null then
      select count(*) into v_answered
        from jsonb_array_elements(case when jsonb_typeof(new.details) = 'array' then new.details else '[]'::jsonb end) d
       where d ->> 'givenIndex' is not null;
    else
      v_answered := coalesce(new.correct, 0) + coalesce(new.wrong, 0);
    end if;
    perform public.mm_referral_qualify(new.user_id, v_answered, 'attempt:' || new.id::text);
  exception when others then
    -- Never fail a saved practice over a reward; the next finished practice qualifies instead.
    raise warning 'mm_referral_on_attempt: % %', sqlstate, sqlerrm;
  end;
  return null;
end;
$function$;

create or replace function public.mm_referral_on_mob_run()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.user_id is null or new.finished_at is null or old.finished_at is not null then return null; end if;
  if not exists (select 1 from public.referrals where referee_id = new.user_id and state = 'joined') then return null; end if;
  begin
    perform public.mm_referral_qualify(new.user_id, coalesce(new.right_n, 0) + coalesce(new.wrong_n, 0), 'mob_run:' || new.game_id::text);
  exception when others then
    raise warning 'mm_referral_on_mob_run: % %', sqlstate, sqlerrm;
  end;
  return null;
end;
$function$;

drop trigger if exists mm_referral_after_attempt on public.attempts;
create trigger mm_referral_after_attempt after insert on public.attempts
  for each row execute function public.mm_referral_on_attempt();

do $$
begin
  if to_regclass('public.mob_game_runs') is not null then
    execute 'drop trigger if exists mm_referral_after_mob_run on public.mob_game_runs';
    execute 'create trigger mm_referral_after_mob_run after update of finished_at on public.mob_game_runs
               for each row when (old.finished_at is null and new.finished_at is not null)
               execute function public.mm_referral_on_mob_run()';
  end if;
end;
$$;

-- Pays qualified rows that waited while grants_paused was on. Idempotent; returns how many were paid.
create or replace function public.mm_referral_grant_due(p_limit integer default 200)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_out jsonb;
  v_paid integer := 0;
  v_seen integer := 0;
begin
  if exists (select 1 from public.referral_program where id = 1 and grants_paused) then
    return jsonb_build_object('ok', true, 'paused', true, 'paid', 0);
  end if;
  for v_id in select id from public.referrals where state = 'qualified' order by qualified_at limit greatest(1, least(coalesce(p_limit, 200), 1000)) loop
    v_seen := v_seen + 1;
    v_out := public.mm_referral_grant(v_id);
    if v_out ->> 'state' = 'granted' and coalesce((v_out ->> 'idempotent')::boolean, false) = false then v_paid := v_paid + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'seen', v_seen, 'paid', v_paid);
end;
$function$;

-- ---- 8. what a student may read: counts only ------------------------------------------------------------------------------
create or replace function public.mm_referral_status(p_user_id text, p_device_hash text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  prog public.referral_program%rowtype;
  v_code text;
  v_month timestamp with time zone := public.mm_referral_month_start(now());
  v_joined integer; v_practised integer; v_rewarded integer; v_not_counted integer; v_month_paid integer;
  v_earned integer;
  v_mine public.referrals%rowtype;
begin
  if coalesce(p_user_id, '') = '' then return jsonb_build_object('ok', false, 'error', 'missing_user'); end if;
  v_code := public.mm_referral_code_for(p_user_id, p_device_hash);
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'user_not_found'); end if;
  select * into prog from public.referral_program where id = 1;
  if not found then prog.reward := 100; prog.monthly_cap := 10; prog.grants_paused := false; end if;

  select count(*),
         count(*) filter (where qualified_at is not null),
         count(*) filter (where referrer_granted),
         count(*) filter (where state = 'held' or (state = 'granted' and not referrer_granted)),
         count(*) filter (where referrer_granted and granted_at >= v_month)
    into v_joined, v_practised, v_rewarded, v_not_counted, v_month_paid
    from public.referrals where referrer_id = p_user_id;
  select coalesce(sum(credit_delta), 0) into v_earned from public.credit_transactions
   where user_id = p_user_id and action = 'referral' and reference like 'referral:%:inviter';
  select * into v_mine from public.referrals where referee_id = p_user_id;

  return jsonb_build_object(
    'ok', true, 'code', v_code, 'reward', prog.reward, 'monthlyCap', prog.monthly_cap, 'paused', prog.grants_paused,
    'joined', v_joined, 'practised', v_practised, 'rewarded', v_rewarded, 'notCounted', v_not_counted,
    'earned', v_earned, 'rewardedThisMonth', v_month_paid, 'capReached', v_month_paid >= prog.monthly_cap,
    'invited', case when v_mine.id is null then null else jsonb_build_object(
      'state', v_mine.state, 'rewarded', v_mine.referee_granted, 'source', v_mine.source) end
  );
end;
$function$;

-- ---- privileges: server-only, like every credit function ------------------------------------------------------------------
revoke all on function public.mm_referral_normalise_code(text) from public, anon, authenticated;
revoke all on function public.mm_referral_month_start(timestamp with time zone) from public, anon, authenticated;
revoke all on function public.mm_referral_code_for(text, text) from public, anon, authenticated;
revoke all on function public.mm_referral_attach(text, text, text, timestamp with time zone, text, text) from public, anon, authenticated;
revoke all on function public.mm_referral_credit(text, integer, text) from public, anon, authenticated;
revoke all on function public.mm_referral_grant(uuid, boolean) from public, anon, authenticated;
revoke all on function public.mm_referral_qualify(text, integer, text) from public, anon, authenticated;
revoke all on function public.mm_referral_on_attempt() from public, anon, authenticated;
revoke all on function public.mm_referral_on_mob_run() from public, anon, authenticated;
revoke all on function public.mm_referral_grant_due(integer) from public, anon, authenticated;
revoke all on function public.mm_referral_status(text, text) from public, anon, authenticated;
grant execute on function public.mm_referral_normalise_code(text) to service_role;
grant execute on function public.mm_referral_month_start(timestamp with time zone) to service_role;
grant execute on function public.mm_referral_code_for(text, text) to service_role;
grant execute on function public.mm_referral_attach(text, text, text, timestamp with time zone, text, text) to service_role;
grant execute on function public.mm_referral_credit(text, integer, text) to service_role;
grant execute on function public.mm_referral_grant(uuid, boolean) to service_role;
grant execute on function public.mm_referral_qualify(text, integer, text) to service_role;
grant execute on function public.mm_referral_grant_due(integer) to service_role;
grant execute on function public.mm_referral_status(text, text) to service_role;
