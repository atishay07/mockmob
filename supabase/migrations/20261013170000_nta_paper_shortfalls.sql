-- NTA paper engine (data/nta_engine.js): what the question bank could not supply when a student
-- started NTA mode, for the content team. One row per paper served as "closest" or refused.
-- No student identifiers are stored. Service-role access only.
-- Also a partial index for the engine's single pool query (live, undeleted, scored rows of one subject).
-- Not applied to any remote database by this change; the runtime logs the same record until it is.
create table if not exists public.nta_paper_shortfalls (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  subject text not null,
  variant text not null,
  status text not null check (status in ('closest', 'refused')),
  reason text,
  built integer not null,
  min_score numeric(4, 2) not null,
  eligible_pool integer not null,
  detail jsonb not null
);
create index if not exists nta_paper_shortfalls_subject_created_idx on public.nta_paper_shortfalls (subject, created_at desc);
alter table public.nta_paper_shortfalls enable row level security;
revoke all on public.nta_paper_shortfalls from public, anon, authenticated;
grant all on public.nta_paper_shortfalls to service_role;

create index if not exists questions_nta_pool_idx on public.questions (subject)
  where status = 'live' and is_deleted = false and (evidence is not null or quality_score > 0);
