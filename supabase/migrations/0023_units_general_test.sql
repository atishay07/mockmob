-- ============================================================
-- MockMob migration 0023 — units layer for General Test
-- CUET 2026 syllabus (subject code 501)
-- ============================================================
-- CUET structure: 5 sections
--   1. General Knowledge and Current Affairs
--   2. General Mental Ability
--   3. Numerical Ability
--   4. Quantitative Reasoning (Basic Mathematical Concepts up to Class VIII)
--   5. Logical and Analytical Reasoning
--
-- Gap analysis vs existing chapters:
--   MATCH  (4): General Knowledge & Current Affairs,
--               General Mental Ability,
--               Numerical Ability,
--               Logical & Analytical Reasoning
--   RENAME (0): none required
--   NEW    (1): "General Science and Environment Literacy"
--               (often tested alongside GK in CUET GT; absent from seed)
--   INVALID(0): all existing chapters map to CUET sections
--
-- Note: "Quantitative Reasoning" is mapped to unit 4 if present;
--       existing "Numerical Ability" already covers basic maths —
--       kept as separate unit per CUET structure.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('general_test__u1', 'general_test', 'General Knowledge and Current Affairs', 0),
  ('general_test__u2', 'general_test', 'General Mental Ability',                1),
  ('general_test__u3', 'general_test', 'Numerical Ability',                     2),
  ('general_test__u4', 'general_test', 'Quantitative Reasoning',                3),
  ('general_test__u5', 'general_test', 'Logical and Analytical Reasoning',      4)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Insert missing chapter
-- ------------------------------------------------------------
insert into public.chapters (id, subject_id, name, sort_order) values
  ('general_test__general_science_environment', 'general_test', 'General Science and Environment Literacy', 4)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 3. No renames required
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — General Knowledge and Current Affairs
update public.chapters set unit_id = 'general_test__u1'
where subject_id = 'general_test'
  and name in (
    'General Knowledge & Current Affairs',
    'General Science and Environment Literacy'
  );

-- Unit 2 — General Mental Ability
update public.chapters set unit_id = 'general_test__u2'
where subject_id = 'general_test'
  and name = 'General Mental Ability';

-- Unit 3 — Numerical Ability
update public.chapters set unit_id = 'general_test__u3'
where subject_id = 'general_test'
  and name = 'Numerical Ability';

-- Unit 4 — Quantitative Reasoning
-- (no existing chapter maps here; unit exists for future questions)

-- Unit 5 — Logical and Analytical Reasoning
update public.chapters set unit_id = 'general_test__u5'
where subject_id = 'general_test'
  and name = 'Logical & Analytical Reasoning';

commit;
