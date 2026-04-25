-- ============================================================
-- MockMob migration 0020 — units layer for Biology
-- CUET 2026 syllabus (subject code 302)
-- ============================================================
-- CUET structure: 5 units (Class XII topics, Units VI–X of NCERT)
--   VI   Reproduction
--   VII  Genetics and Evolution
--   VIII Biology and Human Welfare
--   IX   Biotechnology and its Applications
--   X    Ecology and Environment
--
-- Gap analysis vs existing chapters:
--   MATCH  (7): Sexual Reproduction in Flowering Plants,
--               Human Reproduction, Reproductive Health,
--               Molecular Basis of Inheritance,
--               Evolution, Microbes in Human Welfare,
--               Biodiversity & Conservation
--   NEEDS UNIT (2 under CUET units):
--               Principles of Inheritance & Variation → Unit VII
--               Human Health & Disease              → Unit VIII
--               Strategies for Enhancement in Food Production → Unit VIII
--               Biotechnology: Principles & Processes → Unit IX
--               Biotechnology & its Applications    → Unit IX
--               Organisms & Populations             → Unit X
--               Ecosystem                           → Unit X
--   INVALID (2): "Reproduction in Organisms" (Class XI topic, not in CUET 302)
--                "Environmental Issues"             (not in CUET 302 scope)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('biology__u1', 'biology', 'Reproduction',                        0),
  ('biology__u2', 'biology', 'Genetics and Evolution',              1),
  ('biology__u3', 'biology', 'Biology and Human Welfare',           2),
  ('biology__u4', 'biology', 'Biotechnology and its Applications',  3),
  ('biology__u5', 'biology', 'Ecology and Environment',             4)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. No renames required — existing chapter names are kept
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 3. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Reproduction (sexual reproduction in plants + human)
update public.chapters set unit_id = 'biology__u1'
where subject_id = 'biology'
  and name in (
    'Sexual Reproduction in Flowering Plants',
    'Human Reproduction',
    'Reproductive Health'
  );

-- Unit 2 — Genetics and Evolution
update public.chapters set unit_id = 'biology__u2'
where subject_id = 'biology'
  and name in (
    'Principles of Inheritance & Variation',
    'Molecular Basis of Inheritance',
    'Evolution'
  );

-- Unit 3 — Biology and Human Welfare
update public.chapters set unit_id = 'biology__u3'
where subject_id = 'biology'
  and name in (
    'Human Health & Disease',
    'Strategies for Enhancement in Food Production',
    'Microbes in Human Welfare'
  );

-- Unit 4 — Biotechnology and its Applications
update public.chapters set unit_id = 'biology__u4'
where subject_id = 'biology'
  and name in (
    'Biotechnology: Principles & Processes',
    'Biotechnology & its Applications'
  );

-- Unit 5 — Ecology and Environment
update public.chapters set unit_id = 'biology__u5'
where subject_id = 'biology'
  and name in (
    'Organisms & Populations',
    'Ecosystem',
    'Biodiversity & Conservation'
  );

-- Intentionally left without unit_id (not in CUET 2026 Biology):
--   Reproduction in Organisms  (Class XI topic)
--   Environmental Issues        (not assessed in CUET 302)

commit;
