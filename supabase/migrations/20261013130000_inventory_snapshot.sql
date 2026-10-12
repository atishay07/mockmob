-- Public practice-inventory aggregates (counts per subject, no questions, keys or personal data),
-- computed in the background so quotes and the homepage counters read one row instead of
-- re-checking every question on each server cold start. Service-role access only.
-- Not applied to any remote database by this change.
create table if not exists public.public_inventory_snapshot (
  id text primary key default 'current' check (id = 'current'),
  value jsonb not null,
  computed_at timestamptz not null default now()
);
alter table public.public_inventory_snapshot enable row level security;
revoke all on public.public_inventory_snapshot from public, anon, authenticated;
grant all on public.public_inventory_snapshot to service_role;
