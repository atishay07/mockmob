-- ============================================================
-- MockMob migration 0003 — chapters table
-- ============================================================
-- Introduces a normalized chapters table.
--
-- Backward compatibility:
--   questions.chapter stays as a TEXT column (NOT renamed or dropped)
--   so existing rows and writers keep working. We soft-link via the
--   composite (subject_id, name) in the chapters table.
--
-- Going forward, the canonical list of "what chapters exist for a
-- subject" lives here, instead of hard-coded in data/subjects.js.
-- The API reads this table with a fallback to subjects.js when empty.
-- ============================================================

create table if not exists public.chapters (
  id          text primary key,           -- slugish id, e.g. "math__calculus"
  subject_id  text not null,              -- matches subjects.id (not FK: subjects live in code)
  name        text not null,              -- display name, e.g. "Calculus"
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (subject_id, name)
);

create index if not exists chapters_subject_idx on public.chapters (subject_id, sort_order);

-- RLS: allow anyone to read chapters; writes only via service_role (bypasses RLS).
alter table public.chapters enable row level security;

drop policy if exists chapters_read on public.chapters;
create policy chapters_read
  on public.chapters
  for select
  to anon, authenticated
  using (true);
