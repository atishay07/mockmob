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
