-- ============================================================
-- MockMob migration 0012 — units table + accountancy mapping
-- ============================================================
-- Adds a units layer between subjects and chapters.
-- Only accountancy is wired in this migration; other subjects
-- follow in subsequent migrations as their syllabi are updated.
--
-- Backward compatibility:
--   chapters.unit_id is nullable — chapters without a unit still
--   appear in the flat fallback so no existing query breaks.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. units table
-- ------------------------------------------------------------
create table if not exists public.units (
  id          text primary key,
  subject_id  text not null,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (subject_id, name)
);

create index if not exists units_subject_idx on public.units (subject_id, sort_order);

alter table public.units enable row level security;

drop policy if exists units_read on public.units;
create policy units_read
  on public.units
  for select
  to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- 2. Add unit_id FK column to chapters
-- ------------------------------------------------------------
alter table public.chapters
  add column if not exists unit_id text references public.units(id);

create index if not exists chapters_unit_idx on public.chapters (unit_id);

-- ------------------------------------------------------------
-- 3. Insert accountancy units (CUET 2026)
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('accountancy__u1',  'accountancy', 'Accounting for Partnership',         0),
  ('accountancy__u2',  'accountancy', 'Reconstitution of Partnership Firm', 1),
  ('accountancy__u3',  'accountancy', 'Dissolution of Partnership Firm',    2),
  ('accountancy__u4',  'accountancy', 'Company Accounts',                   3),
  ('accountancy__u5',  'accountancy', 'Analysis of Financial Statements',   4),
  ('accountancy__u5b', 'accountancy', 'Computerised Accounting System',     5)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 4. Insert new accountancy chapters that were missing from 0004
-- ------------------------------------------------------------
insert into public.chapters (id, subject_id, name, sort_order) values
  ('accountancy__profit_loss_appropriation',      'accountancy', 'Profit & Loss Appropriation Account',  1),
  ('accountancy__goodwill_valuation',             'accountancy', 'Goodwill Valuation',                   4),
  ('accountancy__dissolution_of_partnership_firm','accountancy', 'Dissolution of Partnership Firm',      5),
  ('accountancy__comparative_common_size',        'accountancy', 'Comparative & Common Size Statements', 8),
  ('accountancy__accounting_ratios',              'accountancy', 'Accounting Ratios',                    9),
  ('accountancy__computerised_accounting_system', 'accountancy', 'Computerised Accounting System',       11)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 5. Map all accountancy chapters to their units
-- ------------------------------------------------------------

-- Unit I — Accounting for Partnership
update public.chapters set unit_id = 'accountancy__u1'
where subject_id = 'accountancy' and name in (
  'Partnership Fundamentals',
  'Profit & Loss Appropriation Account'
);

-- Unit II — Reconstitution of Partnership Firm
update public.chapters set unit_id = 'accountancy__u2'
where subject_id = 'accountancy' and name in (
  'Change in Profit Sharing Ratio',
  'Goodwill Valuation',
  'Admission of Partner',
  'Retirement & Death of Partner'
);

-- Unit III — Dissolution of Partnership Firm
update public.chapters set unit_id = 'accountancy__u3'
where subject_id = 'accountancy' and name in (
  'Dissolution of Partnership',
  'Dissolution of Partnership Firm'
);

-- Unit IV — Company Accounts
update public.chapters set unit_id = 'accountancy__u4'
where subject_id = 'accountancy' and name in (
  'Share Capital',
  'Debentures'
);

-- Unit V — Analysis of Financial Statements
update public.chapters set unit_id = 'accountancy__u5'
where subject_id = 'accountancy' and name in (
  'Financial Statements of Company',
  'Comparative & Common Size Statements',
  'Accounting Ratios',
  'Analysis of Financial Statements',
  'Cash Flow Statement'
);

-- Unit V (optional) — Computerised Accounting System
update public.chapters set unit_id = 'accountancy__u5b'
where subject_id = 'accountancy' and name in (
  'Computerised Accounting System',
  'Computerized Accounting System'
);

-- ------------------------------------------------------------
-- 6. Fix spelling in questions table (122 rows)
--    "Computerized" → "Computerised" to match chapters table
-- ------------------------------------------------------------
update public.questions
  set chapter = 'Computerised Accounting System'
where subject = 'accountancy'
  and chapter = 'Computerized Accounting System';

commit;
