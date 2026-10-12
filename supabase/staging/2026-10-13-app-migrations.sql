-- MockMob app migrations for the STAGING project only (onwkqxmjqjrhfbjjdydu).
-- Generated from supabase/migrations, 7 files from 20261012120000, each verified to apply in order
-- on a local Postgres (PGlite) after all earlier migrations. Additive only. Do not run on production.

-- ===== 20261012120000_usage_consent_and_events.sql =====
-- Optional first-party usage data. Adults only, opt-in, withdrawable. Service role only.
create table if not exists public.usage_consent (
  user_id text primary key references public.users(id) on delete cascade,
  age_band text not null default 'unknown' check (age_band in ('adult','minor','unknown')),
  analytics_allowed boolean not null default false,
  policy_version text not null,
  decided_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint usage_consent_adult_only check (not analytics_allowed or age_band = 'adult')
);
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  platform text not null check (platform in ('android','web')),
  app_version text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  props jsonb not null default '{}'::jsonb check (octet_length(props::text) <= 1024)
);
create index if not exists usage_events_user_occurred_idx on public.usage_events (user_id, occurred_at);
create index if not exists usage_events_received_idx on public.usage_events (received_at);

create or replace function public.purge_usage_events(retention_days int default 180)
returns bigint language plpgsql security invoker set search_path = public as $$
declare n bigint;
begin
  delete from public.usage_events where received_at < now() - make_interval(days => retention_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- Consent-gated insert in one transaction. The FOR SHARE lock on the consent row makes a concurrent
-- withdrawal (upsert + delete) wait for this insert, so its delete always sees and removes these rows.
create or replace function public.insert_usage_events(p_user_id text, p_rows jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int := 0;
begin
  perform 1 from public.usage_consent
    where user_id = p_user_id and analytics_allowed and age_band = 'adult' and withdrawn_at is null
    for share;
  if not found then return 0; end if;
  insert into public.usage_events (event_id, user_id, name, platform, app_version, occurred_at, props)
  select r.event_id, p_user_id, r.name, r.platform, r.app_version, r.occurred_at, coalesce(r.props, '{}'::jsonb)
  from jsonb_to_recordset(p_rows) as r(event_id text, name text, platform text, app_version text, occurred_at timestamptz, props jsonb)
  on conflict (event_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.usage_consent enable row level security;
alter table public.usage_events enable row level security;
revoke all on public.usage_consent, public.usage_events from anon, authenticated;
revoke all on function public.purge_usage_events(int) from public, anon, authenticated;
revoke all on function public.insert_usage_events(text, jsonb) from public, anon, authenticated;


-- ===== 20261012121000_app_preferences_and_rhythm.sql =====
-- MockMob app: notification preferences, push devices, weekly goal and account deletion requests.
-- Additive and idempotent. Service-role only: RLS is enabled with no anon/authenticated policies.
-- users.id is text in this schema, so user_id columns are text.

create table if not exists public.notification_prefs (
  user_id text primary key references public.users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  quiet_start time not null default '23:00',
  quiet_end time not null default '07:00',
  channels jsonb not null default '{"check_due":true,"weekly_plan":true,"study_window":false,"result_ready":true}'::jsonb,
  study_window jsonb,
  weekly_cap smallint not null default 5 check (weekly_cap between 0 and 14),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_devices (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android')),
  token text not null unique,
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists push_devices_user_idx on public.push_devices (user_id) where revoked_at is null;

create table if not exists public.study_goals (
  user_id text primary key references public.users(id) on delete cascade,
  days_per_week smallint not null default 4 check (days_per_week between 1 and 7),
  timezone text not null default 'Asia/Kolkata',
  paused_until date,
  updated_at timestamptz not null default now()
);

-- Operator-processed: a script must read pending rows, delete the account and study records,
-- then mark the row completed. Nothing hard-deletes in the request route.
create table if not exists public.account_deletion_requests (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  source text not null default 'android' check (source in ('android','web')),
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  completed_at timestamptz
);
create unique index if not exists account_deletion_one_pending_idx on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.notification_prefs enable row level security;
alter table public.push_devices enable row level security;
alter table public.study_goals enable row level security;
alter table public.account_deletion_requests enable row level security;

revoke all on public.notification_prefs, public.push_devices, public.study_goals, public.account_deletion_requests from public, anon, authenticated;
grant all on public.notification_prefs, public.push_devices, public.study_goals, public.account_deletion_requests to service_role;
grant usage, select on sequence public.push_devices_id_seq, public.account_deletion_requests_id_seq to service_role;


-- ===== 20261013090000_study_goal_history.sql =====
-- MockMob app: goal history so past weeks keep the goal they were held to.
-- Additive and idempotent. Service-role only: RLS enabled with no anon/authenticated policies.
-- A row says: from effective_week (a Monday) onward the goal is days_per_week, until a later row.
-- Goals saved before this table existed are backfilled with a 2000-01-03 baseline ("always").

create table if not exists public.study_goal_history (
  user_id text not null references public.users(id) on delete cascade,
  effective_week date not null check (extract(isodow from effective_week) = 1),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  created_at timestamptz not null default now(),
  primary key (user_id, effective_week)
);

alter table public.study_goal_history enable row level security;
revoke all on public.study_goal_history from public, anon, authenticated;
grant all on public.study_goal_history to service_role;

insert into public.study_goal_history (user_id, effective_week, days_per_week)
select user_id, date '2000-01-03', days_per_week from public.study_goals
on conflict (user_id, effective_week) do nothing;


-- ===== 20261013093000_sample_imports.sql =====
-- MockMob app: guest sample import (five landing questions answered before sign-in).
-- Additive and idempotent. Service-role only: RLS enabled with no anon/authenticated policies.
-- Deliberately NOT linked to attempts, sessions, credits, rhythm or mocks: it is a plain record.
-- users.id is text in this schema.

create table if not exists public.sample_imports (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(id) on delete cascade,
  import_key text not null unique check (import_key ~ '^[A-Za-z0-9_-]{12,100}$'),
  sample_version text not null check (char_length(sample_version) between 1 and 40),
  subject text not null check (char_length(subject) between 1 and 60),
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  correct smallint not null check (correct >= 0),
  total smallint not null check (total > 0 and correct <= total),
  created_at timestamptz not null default now()
);
-- One import per user per sample version, whatever import key the phone generated.
create unique index if not exists sample_imports_user_version_idx on public.sample_imports (user_id, sample_version);

alter table public.sample_imports enable row level security;
revoke all on public.sample_imports from public, anon, authenticated;
grant all on public.sample_imports to service_role;
grant usage, select on sequence public.sample_imports_id_seq to service_role;

-- Atomic, idempotent save. Returns the stored row and whether this call created it.
-- Raises 'import_key_taken' when the key already belongs to another user.
create or replace function public.save_sample_import(
  p_user_id text, p_import_key text, p_sample_version text, p_subject text,
  p_answers jsonb, p_correct int, p_total int
) returns table (created boolean, correct smallint, total smallint, created_at timestamptz)
language plpgsql
as $$
declare
  r public.sample_imports%rowtype;
begin
  select * into r from public.sample_imports s where s.import_key = p_import_key;
  if found then
    if r.user_id <> p_user_id then raise exception 'import_key_taken'; end if;
    return query select false, r.correct, r.total, r.created_at;
    return;
  end if;
  insert into public.sample_imports (user_id, import_key, sample_version, subject, answers, correct, total)
  values (p_user_id, p_import_key, p_sample_version, p_subject, p_answers, p_correct, p_total)
  on conflict do nothing
  returning * into r;
  if found then
    return query select true, r.correct, r.total, r.created_at;
    return;
  end if;
  -- Lost a race, or the user already has this sample version under another key: return that row.
  select * into r from public.sample_imports s where s.user_id = p_user_id and s.sample_version = p_sample_version;
  if not found then
    select * into r from public.sample_imports s where s.import_key = p_import_key;
    if r.user_id <> p_user_id then raise exception 'import_key_taken'; end if;
  end if;
  return query select false, r.correct, r.total, r.created_at;
end;
$$;
revoke all on function public.save_sample_import(text, text, text, text, jsonb, int, int) from public, anon, authenticated;
grant execute on function public.save_sample_import(text, text, text, text, jsonb, int, int) to service_role;


-- ===== 20261013094000_session_finaliser.sql =====
-- B11: finalise a durable session after its deadline plus the 2 minute upload grace.
-- Service-role only. Called with a result scored by the server from acknowledged events.
-- Idempotent: an already submitted session is returned unchanged, and the attempt id equals
-- the session id, so a concurrent submit can never create a second attempt or progress row.
create or replace function public.finalise_expired_recovery_session(p_id text, p_result jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; d jsonb; q jsonb;
begin
 select * into s from public.recovery_sessions where id=p_id for update;
 if not found then raise exception 'session not found'; end if;
 if s.state='submitted' then return jsonb_build_object('id',s.id,'finalised',false); end if;
 if now()<=s.expires_at+interval '2 minutes' then raise exception 'session not expired'; end if;
 if p_result->>'expected_event_count' is null or (p_result->>'expected_event_count')::int<>jsonb_array_length(s.events) then raise exception 'event conflict'; end if;
 if exists(select 1 from public.attempts where id=s.id) then
   update public.recovery_sessions set state='submitted' where id=s.id;
   return jsonb_build_object('id',s.id,'finalised',false);
 end if;
 insert into public.attempts(id,user_id,subject,score,correct,wrong,unattempted,total,details,questions_snapshot,selection_meta)
 values(s.id,s.user_id,s.subject,(p_result->>'score')::int,(p_result->>'correct')::int,
 (p_result->>'wrong')::int,(p_result->>'unattempted')::int,(p_result->>'total')::int,
 p_result->'details',s.questions,p_result->'selectionMeta');
 for d in select value from jsonb_array_elements(p_result->'details') loop
   select value into q from jsonb_array_elements(s.questions) where value->>'id'=d->>'qid';
   insert into public.user_question_progress(user_id,question_id,subject,chapter,seen_count,attempt_count,correct_count,skip_count,last_selected_key,last_correct,last_seen_at,last_attempted_at,updated_at)
   values(s.user_id,d->>'qid',s.subject,q->>'chapter',1,
     case when d->>'givenIndex' is null then 0 else 1 end,
     case when (d->>'isCorrect')::boolean is true then 1 else 0 end,
     case when d->>'givenIndex' is null then 1 else 0 end,
     substr('ABCD',coalesce((d->>'givenIndex')::int, -1)+1,1),(d->>'isCorrect')::boolean,now(),now(),now())
   on conflict(user_id,question_id) do update set
     seen_count=public.user_question_progress.seen_count+1,
     attempt_count=public.user_question_progress.attempt_count+excluded.attempt_count,
     correct_count=public.user_question_progress.correct_count+excluded.correct_count,
     skip_count=public.user_question_progress.skip_count+excluded.skip_count,
     last_selected_key=excluded.last_selected_key,last_correct=excluded.last_correct,last_seen_at=now(),last_attempted_at=now(),updated_at=now();
   if (d->>'isCorrect')::boolean is not true then
     insert into public.recovery_review_queue(user_id,question_id,attempt_id,due_at)
     values(s.user_id,d->>'qid',s.id,now()+interval '1 day') on conflict do nothing;
   end if;
 end loop;
 update public.recovery_sessions set state='submitted' where id=s.id;
 return jsonb_build_object('id',s.id,'finalised',true);
end $$;
revoke all on function public.finalise_expired_recovery_session(text,jsonb) from public,anon,authenticated;
grant execute on function public.finalise_expired_recovery_session(text,jsonb) to service_role;

-- Poison-pill guard: count a failed finalisation; at p_max failures close the session without an attempt
-- (state submitted, selection_meta.finalisedBy='unscorable') so it cannot starve newer sessions in the queue.
create or replace function public.quarantine_recovery_session(p_id text, p_reason text, p_max int)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; n int;
begin
 select * into s from public.recovery_sessions where id=p_id for update;
 if not found or s.state<>'active' then return jsonb_build_object('id',p_id,'failures',0,'closed',false); end if;
 if now()<=s.expires_at+interval '2 minutes' then raise exception 'session not expired'; end if;
 n:=coalesce((s.selection_meta->>'finaliseFailures')::int,0)+1;
 if n>=greatest(coalesce(p_max,1),1) then
   update public.recovery_sessions set state='submitted',
     selection_meta=coalesce(selection_meta,'{}'::jsonb)||jsonb_build_object('finaliseFailures',n,'finalisedBy','unscorable','finaliseFailure',left(coalesce(p_reason,''),60))
     where id=s.id;
   return jsonb_build_object('id',s.id,'failures',n,'closed',true);
 end if;
 update public.recovery_sessions set selection_meta=coalesce(selection_meta,'{}'::jsonb)||jsonb_build_object('finaliseFailures',n,'finaliseFailure',left(coalesce(p_reason,''),60)) where id=s.id;
 return jsonb_build_object('id',s.id,'failures',n,'closed',false);
end $$;
revoke all on function public.quarantine_recovery_session(text,text,int) from public,anon,authenticated;
grant execute on function public.quarantine_recovery_session(text,text,int) to service_role;


-- ===== 20261013095000_session_check_log.sql =====
-- B13: per-answer practice check log. A checked answer is final.
-- session_id is a recovery_sessions id or a sealed-ticket practice id (ticket sessions have no row),
-- so it is deliberately not a foreign key. Service-role access only. Not applied to any remote database.
create table if not exists public.session_check_log (
  session_id text not null check (length(session_id) between 1 and 100),
  qid text not null check (length(qid) between 1 and 100),
  user_id text not null references public.users(id) on delete cascade,
  answer smallint not null check (answer between 0 and 9),
  checked_at timestamptz not null default now(),
  primary key (session_id, qid)
);
create index if not exists session_check_log_user_idx on public.session_check_log (user_id, checked_at desc);
alter table public.session_check_log enable row level security;
revoke all on public.session_check_log from public, anon, authenticated;
grant all on public.session_check_log to service_role;


-- ===== 20261013120000_deletion_processor.sql =====
-- MockMob: account deletion processor (Google Play requires deletion requests to be fulfilled).
-- NOT APPLIED to any remote database. Save, review and run on staging first.
-- Additive and idempotent. Service-role only.
--
-- One function does the whole per-user job in a single transaction (a plpgsql function body is
-- atomic, so any error rolls every earlier step back). The step list is data, built and owned by
-- src/lib/server/accountDeletion.js, so the plan the operator reviews in dry run and the rows
-- changed on apply come from the same code path.
--
-- Step shape: {table, action: delete|anonymise|keep, match: [{column} | {column, parent_table,
--   parent_key, parent_user}], set: [{column, value}]}
--   match with parent_*: the row belongs to the user through a parent row (attempt_id -> attempts).
--   set values: 'null' (null if nullable, else the column default), 'default', 'now',
--   'tombstone_email', 'tombstone_username', 'tombstone_id', {literal: text}, {json: text},
--   {scrub_json: [keys]} (keep only those keys of a jsonb column).
-- Tables or columns that do not exist are reported as absent and skipped (older databases).
-- Safety net: any other public table with a user_id column that still holds rows for the user
-- makes the apply raise 'unclassified_user_data', so new tables fail closed until classified.

alter table public.users add column if not exists deleted_at timestamptz;

create or replace function public.account_deletion_run(
  p_request_id bigint,
  p_user_id text,
  p_steps jsonb,
  p_apply boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_req public.account_deletion_requests%rowtype;
  v_step jsonb;
  v_item jsonb;
  v_tbl text;
  v_action text;
  v_where text[];
  v_cond text;
  v_sets text[];
  v_skipped text[];
  v_col text;
  v_val jsonb;
  v_dtype text;
  v_nullable text;
  v_default text;
  v_present boolean;
  v_rows bigint;
  v_results jsonb := '[]'::jsonb;
  v_known text[] := array['account_deletion_requests'];
  v_unclassified jsonb := '[]'::jsonb;
  v_t record;
  v_n bigint;
  v_lhs text;
begin
  if p_user_id is null or length(p_user_id) = 0 then raise exception 'user_id_required'; end if;
  if jsonb_typeof(p_steps) is distinct from 'array' then raise exception 'steps_must_be_array'; end if;

  if p_apply then
    select * into v_req from public.account_deletion_requests where id = p_request_id and user_id = p_user_id for update;
  else
    select * into v_req from public.account_deletion_requests where id = p_request_id and user_id = p_user_id;
  end if;
  if not found then raise exception 'deletion_request_not_found'; end if;
  if v_req.status <> 'pending' then raise exception 'deletion_request_not_pending'; end if;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_known := v_known || (v_step->>'table');
  end loop;

  -- Fail closed: user rows in a table nobody classified.
  for v_t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
       and c.table_name <> all (v_known)
     order by c.table_name
  loop
    execute format('select count(*) from public.%I where user_id::text = $1', v_t.table_name) into v_n using p_user_id;
    if v_n > 0 then
      v_unclassified := v_unclassified || jsonb_build_object('table', v_t.table_name, 'rows', v_n);
    end if;
  end loop;
  if p_apply and jsonb_array_length(v_unclassified) > 0 then
    raise exception 'unclassified_user_data: %', (select string_agg(e->>'table', ',') from jsonb_array_elements(v_unclassified) e);
  end if;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_tbl := v_step->>'table';
    v_action := v_step->>'action';
    if v_action not in ('delete', 'anonymise', 'keep') then raise exception 'bad_action: %', v_action; end if;
    v_present := to_regclass(format('public.%I', v_tbl)) is not null;
    v_where := '{}';
    v_skipped := '{}';
    v_rows := 0;

    if v_present then
      for v_item in select * from jsonb_array_elements(v_step->'match') loop
        v_col := v_item->>'column';
        if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tbl and column_name = v_col) then
          continue;
        end if;
        select data_type into v_dtype from information_schema.columns where table_schema = 'public' and table_name = v_tbl and column_name = v_col;
        v_lhs := case when v_dtype = 'text' then format('%I', v_col) else format('%I::text', v_col) end;
        if v_item ? 'parent_table' then
          if to_regclass(format('public.%I', v_item->>'parent_table')) is null then continue; end if;
          if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_item->>'parent_table' and column_name = v_item->>'parent_user') then continue; end if;
          v_where := v_where || format('%s in (select %I::text from public.%I where %I::text = $1)',
            v_lhs, v_item->>'parent_key', v_item->>'parent_table', v_item->>'parent_user');
        else
          v_where := v_where || format('%s = $1', v_lhs);
        end if;
      end loop;
      if coalesce(array_length(v_where, 1), 0) = 0 then v_present := false; end if;
    end if;

    if v_present then
      v_cond := array_to_string(v_where, ' or ');
      execute format('select count(*) from public.%I where %s', v_tbl, v_cond) into v_rows using p_user_id;

      if p_apply and v_rows > 0 and v_action = 'delete' then
        execute format('delete from public.%I where %s', v_tbl, v_cond) using p_user_id;
      elsif v_action = 'anonymise' and (v_rows > 0 or not p_apply) then
        v_sets := '{}';
        for v_item in select * from jsonb_array_elements(coalesce(v_step->'set', '[]'::jsonb)) loop
          v_col := v_item->>'column';
          v_val := v_item->'value';
          select data_type, is_nullable, column_default into v_dtype, v_nullable, v_default
            from information_schema.columns where table_schema = 'public' and table_name = v_tbl and column_name = v_col;
          if not found then continue; end if;
          if v_val = '"null"'::jsonb then
            if v_nullable = 'YES' then v_sets := v_sets || format('%I = null', v_col);
            elsif v_default is not null then v_sets := v_sets || format('%I = default', v_col);
            else v_skipped := v_skipped || v_col; end if;
          elsif v_val = '"default"'::jsonb then
            if v_nullable = 'YES' or v_default is not null then v_sets := v_sets || format('%I = default', v_col);
            else v_skipped := v_skipped || v_col; end if;
          elsif v_val = '"now"'::jsonb then v_sets := v_sets || format('%I = now()', v_col);
          elsif v_val = '"tombstone_email"'::jsonb then v_sets := v_sets || format('%I = %L || md5($1) || %L', v_col, 'deleted+', '@deleted.invalid');
          elsif v_val = '"tombstone_username"'::jsonb then v_sets := v_sets || format('%I = %L || left(md5($1), 12)', v_col, 'deleted_');
          elsif v_val = '"tombstone_id"'::jsonb then v_sets := v_sets || format('%I = %L || md5($1)', v_col, 'deleted:');
          elsif jsonb_typeof(v_val) = 'object' and v_val ? 'literal' then v_sets := v_sets || format('%I = %L', v_col, v_val->>'literal');
          elsif jsonb_typeof(v_val) = 'object' and v_val ? 'json' then v_sets := v_sets || format('%I = %L::jsonb', v_col, v_val->>'json');
          elsif jsonb_typeof(v_val) = 'object' and v_val ? 'scrub_json' then
            if v_dtype <> 'jsonb' then v_skipped := v_skipped || v_col;
            else
              v_sets := v_sets || format(
                '%1$I = (select coalesce(jsonb_object_agg(k, v), %3$L::jsonb) from jsonb_each(coalesce(%1$I, %3$L::jsonb)) as t(k, v) where k = any(%2$L::text[]))',
                v_col, (select array_agg(x) from jsonb_array_elements_text(v_val->'scrub_json') x), '{}');
            end if;
          else raise exception 'bad_set_value for %.%', v_tbl, v_col;
          end if;
        end loop;
        if p_apply and coalesce(array_length(v_sets, 1), 0) > 0 then
          execute format('update public.%I set %s where %s', v_tbl, array_to_string(v_sets, ', '), v_cond) using p_user_id;
        end if;
      end if;
    end if;

    v_results := v_results || jsonb_build_object(
      'table', v_tbl, 'action', v_action, 'rows', v_rows, 'present', v_present,
      'skippedColumns', to_jsonb(v_skipped));
  end loop;

  if p_apply then
    update public.account_deletion_requests set status = 'completed', completed_at = now() where id = p_request_id;
  end if;

  return jsonb_build_object('requestId', p_request_id, 'userId', p_user_id, 'applied', p_apply,
    'steps', v_results, 'unclassified', v_unclassified);
end $$;

revoke all on function public.account_deletion_run(bigint, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.account_deletion_run(bigint, text, jsonb, boolean) to service_role;
