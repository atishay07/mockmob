-- MockMob app: explicit service-role grants for the usage-data objects.
-- 20261012120000_usage_consent_and_events.sql revokes browser roles but relies on Supabase's default
-- privileges for service_role. This states the grant so the server keeps access on any project,
-- whatever its default privileges. Additive and idempotent; a no-op where defaults already granted it.
grant all on public.usage_consent, public.usage_events to service_role;
grant execute on function public.insert_usage_events(text, jsonb) to service_role;
grant execute on function public.purge_usage_events(int) to service_role;
