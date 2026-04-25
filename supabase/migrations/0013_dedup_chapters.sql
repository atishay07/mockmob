-- ============================================================
-- MockMob migration 0013 — deduplicate accountancy chapters
--                        + unique constraint (subject, name)
-- ============================================================
-- Fixes three classes of problems that accumulated in the
-- questions table:
--
--   1. Near-duplicate chapter names (same concept, different wording)
--   2. All-caps / malformed names inserted by bulk-upload tools
--   3. Orphan chapter rows in the chapters table
--
-- After this migration runs, a case-insensitive unique index on
-- (subject_id, LOWER(name)) prevents any new duplicates from
-- entering the chapters table.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Normalize rogue chapter names in the questions table
-- ------------------------------------------------------------

-- "Dissolution of Partnership" → canonical (added properly in 0012)
update public.questions
  set chapter = 'Dissolution of Partnership Firm'
where subject = 'accountancy'
  and chapter = 'Dissolution of Partnership';

-- "SHARE CAPITAL" (uppercase bulk-upload artefact)
update public.questions
  set chapter = 'Share Capital'
where subject = 'accountancy'
  and chapter = 'SHARE CAPITAL';

-- "Partnership" (truncated / informal)
update public.questions
  set chapter = 'Partnership Fundamentals'
where subject = 'accountancy'
  and chapter = 'Partnership';

-- "Accounting for Partnership Firms - Fundamentals" (NCERT wording)
update public.questions
  set chapter = 'Partnership Fundamentals'
where subject = 'accountancy'
  and chapter = 'Accounting for Partnership Firms - Fundamentals';

-- ------------------------------------------------------------
-- 2. Remove the orphaned / superseded chapter rows
-- ------------------------------------------------------------

-- "Dissolution of Partnership" was replaced by "Dissolution of
-- Partnership Firm" (canonical CUET name) in migration 0012.
-- All questions pointing at it have been remapped above.
delete from public.chapters
where id = 'accountancy__dissolution_of_partnership';

-- ------------------------------------------------------------
-- 3. Add case-insensitive unique constraint on chapters
-- ------------------------------------------------------------
-- Prevents future near-duplicate insertions even if case differs.
-- Must run AFTER dedup, otherwise the index creation will fail on
-- any still-present duplicates.

create unique index if not exists chapters_subject_name_uniq
  on public.chapters (subject_id, lower(name));

commit;
