-- ============================================================
-- MockMob migration 0017 — units layer for Mathematics
-- CUET 2026 syllabus (subject code 319, Section B1)
-- ============================================================
-- CUET Section B1 structure: 6 units
--   I   Relations and Functions
--   II  Algebra
--   III Calculus
--   IV  Vectors and Three-Dimensional Geometry
--   V   Linear Programming
--   VI  Probability
--
-- All 13 existing chapters map directly to CUET units.
--
-- Rename:
--   "Vector Algebra" → "Vectors"
--   (CUET B1 Unit IV uses "Vectors"; the chapter covers the same content)
--
-- No invalid chapters — every existing chapter appears in CUET B1.
-- (Section B2 Applied Mathematics topics are not added here; they
--  would require a separate expansion and new chapter rows.)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('mathematics__u1', 'mathematics', 'Relations and Functions',              0),
  ('mathematics__u2', 'mathematics', 'Algebra',                              1),
  ('mathematics__u3', 'mathematics', 'Calculus',                             2),
  ('mathematics__u4', 'mathematics', 'Vectors and Three-Dimensional Geometry', 3),
  ('mathematics__u5', 'mathematics', 'Linear Programming',                   4),
  ('mathematics__u6', 'mathematics', 'Probability',                          5)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Rename "Vector Algebra" → "Vectors" (CUET B1 exact name)
-- ------------------------------------------------------------
update public.chapters
  set name = 'Vectors'
where id = 'mathematics__vector_algebra';

update public.questions
  set chapter = 'Vectors'
where subject = 'mathematics'
  and chapter = 'Vector Algebra';

-- ------------------------------------------------------------
-- 3. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Relations and Functions
update public.chapters
  set unit_id = 'mathematics__u1'
where subject_id = 'mathematics'
  and name in (
    'Relations & Functions',
    'Inverse Trigonometric Functions'
  );

-- Unit 2 — Algebra
update public.chapters
  set unit_id = 'mathematics__u2'
where subject_id = 'mathematics'
  and name in (
    'Matrices',
    'Determinants'
  );

-- Unit 3 — Calculus
update public.chapters
  set unit_id = 'mathematics__u3'
where subject_id = 'mathematics'
  and name in (
    'Continuity & Differentiability',
    'Application of Derivatives',
    'Integrals',
    'Application of Integrals',
    'Differential Equations'
  );

-- Unit 4 — Vectors and Three-Dimensional Geometry
update public.chapters
  set unit_id = 'mathematics__u4'
where subject_id = 'mathematics'
  and name in (
    'Vectors',
    'Three Dimensional Geometry'
  );

-- Unit 5 — Linear Programming
update public.chapters
  set unit_id = 'mathematics__u5'
where subject_id = 'mathematics'
  and name = 'Linear Programming';

-- Unit 6 — Probability
update public.chapters
  set unit_id = 'mathematics__u6'
where subject_id = 'mathematics'
  and name = 'Probability';

commit;
