-- Undo for supabase/migrations/20261020160000_usage_consent_d183.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Order: deploy the website and the app with the adult-only rule first (or switch usage data collection off), then run this.
-- What it does: puts the adult-only rule back. Anyone whose age band is not 'adult' and who had usage data on is switched
-- off first (analytics_allowed false, withdrawn_at now) and their collected events are deleted, the same as a withdrawal
-- does, because the old rule never allowed collecting for them. Then the table check "usage_consent_adult_only" returns
-- (analytics_allowed only when age_band = 'adult'), "usage_consent_minor_off" is dropped, and insert_usage_events collects
-- for 'adult' only again.
-- What it keeps: every adult's choice and every adult's collected events.
-- It runs as one transaction (begin and commit below), so it either does all of it or none of it: a runner that sends the
-- statements one at a time cannot leave the table with no consent check. The table lock comes first, so no consent row
-- can be written between the clean-up and the new check; a write waits and then meets the adult-only rule.

begin;

lock table public.usage_consent in share row exclusive mode;

update public.usage_consent
   set analytics_allowed = false, withdrawn_at = coalesce(withdrawn_at, now()), updated_at = now()
 where analytics_allowed and age_band <> 'adult';

delete from public.usage_events e
 using public.usage_consent c
 where c.user_id = e.user_id and c.age_band <> 'adult';

alter table public.usage_consent drop constraint if exists usage_consent_minor_off;
alter table public.usage_consent drop constraint if exists usage_consent_adult_only;
alter table public.usage_consent add constraint usage_consent_adult_only check (not analytics_allowed or age_band = 'adult');

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

revoke all on function public.insert_usage_events(text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_usage_events(text, jsonb) to service_role;

commit;
