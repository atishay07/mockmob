-- ============================================================
-- MockMob migration 0022 — units layer for Psychology
-- CUET 2026 syllabus (subject code 318)
-- ============================================================
-- CUET structure: 7 units (Class XII NCERT chapters 1–8,
--   excluding "Psychology & Life" ch.9 and "Developing
--   Psychological Skills" ch.10)
--
--   Unit 1  Variations in Psychological Attributes
--   Unit 2  Self and Personality
--   Unit 3  Meeting Life Challenges
--   Unit 4  Psychological Disorders
--   Unit 5  Therapeutic Approaches
--   Unit 6  Attitude and Social Cognition
--   Unit 7  Social Influence and Group Processes
--
-- Gap analysis: 1-to-1 match with existing chapters.
-- No renames required.
-- INVALID (2): "Psychology & Life", "Developing Psychological Skills"
--              (ch.9–10 not assessed in CUET 2026)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('psychology__u1', 'psychology', 'Variations in Psychological Attributes',  0),
  ('psychology__u2', 'psychology', 'Self and Personality',                    1),
  ('psychology__u3', 'psychology', 'Meeting Life Challenges',                 2),
  ('psychology__u4', 'psychology', 'Psychological Disorders',                 3),
  ('psychology__u5', 'psychology', 'Therapeutic Approaches',                  4),
  ('psychology__u6', 'psychology', 'Attitude and Social Cognition',           5),
  ('psychology__u7', 'psychology', 'Social Influence and Group Processes',    6)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. No renames required
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 3. Map chapters to units (1:1)
-- ------------------------------------------------------------

update public.chapters set unit_id = 'psychology__u1'
where subject_id = 'psychology'
  and name = 'Variations in Psychological Attributes';

update public.chapters set unit_id = 'psychology__u2'
where subject_id = 'psychology'
  and name = 'Self and Personality';

update public.chapters set unit_id = 'psychology__u3'
where subject_id = 'psychology'
  and name = 'Meeting Life Challenges';

update public.chapters set unit_id = 'psychology__u4'
where subject_id = 'psychology'
  and name = 'Psychological Disorders';

update public.chapters set unit_id = 'psychology__u5'
where subject_id = 'psychology'
  and name = 'Therapeutic Approaches';

update public.chapters set unit_id = 'psychology__u6'
where subject_id = 'psychology'
  and name = 'Attitude and Social Cognition';

update public.chapters set unit_id = 'psychology__u7'
where subject_id = 'psychology'
  and name = 'Social Influence and Group Processes';

-- Intentionally left without unit_id (not in CUET 2026 Psychology):
--   Psychology & Life
--   Developing Psychological Skills

commit;
