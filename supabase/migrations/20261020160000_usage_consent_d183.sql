-- Usage data rule D183 (owner, 20 Oct 2026, 5:45 pm): usage data is on for people who say they are 18 or older and for
-- people who choose "Rather not say" (age_band 'unknown' with an answer); it is off only for a student who says they are
-- under 18 (age_band 'minor'). Anyone can switch it off, and switching it off deletes what was collected.
-- NOT applied on staging or production by this branch. Undo: supabase/undo/20261020160000_usage_consent_d183.undo.sql.
--
-- What this file does:
--   1. usage_consent: the table check "usage_consent_adult_only" (analytics_allowed only when age_band = 'adult') is
--      replaced by "usage_consent_minor_off" (analytics_allowed is never true when age_band = 'minor'). Without this the
--      database refuses the row PUT /api/me/consent now writes for "Rather not say" with usage data on. No existing row
--      is touched; every row that satisfied the old check also satisfies the new one.
--   2. insert_usage_events: the consent-gated insert collects for 'adult' and 'unknown' (never 'minor'), still under the
--      FOR SHARE lock on the consent row, so a concurrent withdrawal still waits for the insert and then deletes its rows.
-- Idempotent: safe to run twice. Order: apply this before (or together with) deploying the route that accepts
-- ageBand 'unknown' with analyticsAllowed true; until then the old route refuses it with a 400, which is safe.

alter table public.usage_consent drop constraint if exists usage_consent_adult_only;
alter table public.usage_consent drop constraint if exists usage_consent_minor_off;
alter table public.usage_consent add constraint usage_consent_minor_off check (not analytics_allowed or age_band <> 'minor');

create or replace function public.insert_usage_events(p_user_id text, p_rows jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int := 0;
begin
  perform 1 from public.usage_consent
    where user_id = p_user_id and analytics_allowed and age_band in ('adult','unknown') and withdrawn_at is null
    for share;
  if not found then return 0; end if;
  insert into public.usage_events (event_id, user_id, name, platform, app_version, occurred_at, props)
  select r.event_id, p_user_id, r.name, r.platform, r.app_version, r.occurred_at, coalesce(r.props, '{}'::jsonb)
  from jsonb_to_recordset(p_rows) as r(event_id text, name text, platform text, app_version text, occurred_at timestamptz, props jsonb)
  on conflict (event_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.insert_usage_events(text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_usage_events(text, jsonb) to service_role;
