-- ============================================================
-- MockMob migration 0016 — units layer for English
-- CUET 2026 syllabus (subject code 101)
-- ============================================================
-- CUET structure: 2 sections
--   1. Reading Comprehension (Factual / Narrative / Literary passages)
--   2. Verbal Ability (rearranging, matching, word choice, synonyms)
--
-- DB mapping:
--   u1 Reading Comprehension → chapters that test passage comprehension
--   u2 Verbal Ability         → chapters that test language skills
--
-- No renames needed — existing chapter names are kept.
--
-- Invalid (no CUET 2026 equivalent — kept, unit_id left null):
--   "Note Making"   (writing skill, not tested in CUET 101)
--   "Composition"   (writing skill, not tested in CUET 101)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('english__u1', 'english', 'Reading Comprehension', 0),
  ('english__u2', 'english', 'Verbal Ability',        1)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Reading Comprehension
-- Includes all passage-based comprehension and literary texts
update public.chapters
  set unit_id = 'english__u1'
where subject_id = 'english'
  and name in (
    'Reading Comprehension',
    'Literature — Prose',
    'Literature — Poetry'
  );

-- Unit 2 — Verbal Ability
-- Includes language mechanics and vocabulary skills
update public.chapters
  set unit_id = 'english__u2'
where subject_id = 'english'
  and name in (
    'Grammar & Usage',
    'Vocabulary',
    'Figures of Speech'
  );

-- "Note Making" and "Composition" left without unit_id
-- (writing/production skills not assessed in CUET English 101)

commit;
