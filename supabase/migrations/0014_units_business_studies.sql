-- ============================================================
-- MockMob migration 0014 — units layer for Business Studies
-- CUET 2026 syllabus (subject code 305)
-- ============================================================
-- CUET structure: 12 numbered units (I–XII)
-- DB mapping: 3 logical groups (units) → 12 chapters
--
-- Units:
--   u1 Principles and Functions of Management  (CUET I–VIII)
--   u2 Business Finance and Markets            (CUET IX–X)
--   u3 Marketing and Consumer Protection       (CUET XI–XII)
--
-- Renames:
--   "Financial Management"  → "Business Finance"   (CUET Unit IX)
--   "Marketing Management"  → "Marketing"           (CUET Unit XI)
--
-- Invalid (no CUET 2026 equivalent — kept, no unit_id):
--   "Entrepreneurship Development"
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('business_studies__u1', 'business_studies', 'Principles and Functions of Management', 0),
  ('business_studies__u2', 'business_studies', 'Business Finance and Markets',            1),
  ('business_studies__u3', 'business_studies', 'Marketing and Consumer Protection',       2)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Rename chapters to CUET-canonical names
-- ------------------------------------------------------------

-- "Financial Management" is the NCERT name; CUET Unit IX is "Business Finance"
update public.chapters
  set name = 'Business Finance'
where id = 'business_studies__financial_management';

update public.questions
  set chapter = 'Business Finance'
where subject = 'business_studies'
  and chapter = 'Financial Management';

-- "Marketing Management" is the NCERT name; CUET Unit XI is "Marketing"
update public.chapters
  set name = 'Marketing'
where id = 'business_studies__marketing_management';

update public.questions
  set chapter = 'Marketing'
where subject = 'business_studies'
  and chapter = 'Marketing Management';

-- ------------------------------------------------------------
-- 3. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Principles and Functions of Management (CUET I–VIII)
update public.chapters
  set unit_id = 'business_studies__u1'
where subject_id = 'business_studies'
  and name in (
    'Nature & Significance of Management',
    'Principles of Management',
    'Business Environment',
    'Planning',
    'Organising',
    'Staffing',
    'Directing',
    'Controlling'
  );

-- Unit 2 — Business Finance and Markets (CUET IX–X)
update public.chapters
  set unit_id = 'business_studies__u2'
where subject_id = 'business_studies'
  and name in (
    'Business Finance',
    'Financial Markets'
  );

-- Unit 3 — Marketing and Consumer Protection (CUET XI–XII)
update public.chapters
  set unit_id = 'business_studies__u3'
where subject_id = 'business_studies'
  and name in (
    'Marketing',
    'Consumer Protection'
  );

-- "Entrepreneurship Development" intentionally left without unit_id
-- (not present in CUET 2026 Business Studies syllabus)

commit;
