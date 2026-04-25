-- ============================================================
-- MockMob migration 0019 — units layer for Chemistry
-- CUET 2026 syllabus (subject code 306)
-- ============================================================
-- CUET structure: 10 units (Class XII topics only)
--   I   Solutions
--   II  Electrochemistry
--   III Chemical Kinetics
--   IV  d and f Block Elements
--   V   Coordination Compounds
--   VI  Haloalkanes and Haloarenes
--   VII Alcohols, Phenols and Ethers
--   VIII Aldehydes, Ketones and Carboxylic Acids
--   IX  Amines
--   X   Biomolecules
--
-- Gap analysis vs existing chapters:
--   MATCH  (10): Solutions, Electrochemistry, Chemical Kinetics,
--                Coordination Compounds, Haloalkanes & Haloarenes,
--                Alcohols Phenols & Ethers,
--                Aldehydes Ketones & Carboxylic Acids, Amines,
--                Biomolecules
--   RENAME  (1): "d- and f-Block Elements" → "d and f Block Elements"
--                (CUET Unit IV exact wording)
--   INVALID (6): Solid State, Surface Chemistry,
--                Isolation of Elements, p-Block Elements,
--                Polymers, Chemistry in Everyday Life
--                (Class XI / non-CUET-306 topics)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('chemistry__u1',  'chemistry', 'Solutions',                                    0),
  ('chemistry__u2',  'chemistry', 'Electrochemistry',                             1),
  ('chemistry__u3',  'chemistry', 'Chemical Kinetics',                            2),
  ('chemistry__u4',  'chemistry', 'd and f Block Elements',                       3),
  ('chemistry__u5',  'chemistry', 'Coordination Compounds',                       4),
  ('chemistry__u6',  'chemistry', 'Haloalkanes and Haloarenes',                   5),
  ('chemistry__u7',  'chemistry', 'Alcohols, Phenols and Ethers',                 6),
  ('chemistry__u8',  'chemistry', 'Aldehydes, Ketones and Carboxylic Acids',      7),
  ('chemistry__u9',  'chemistry', 'Amines',                                       8),
  ('chemistry__u10', 'chemistry', 'Biomolecules',                                 9)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Rename: "d- and f-Block Elements" → "d and f Block Elements"
-- ------------------------------------------------------------
update public.chapters
  set name = 'd and f Block Elements'
where id = 'chemistry__d_and_f_block_elements';

update public.questions
  set chapter = 'd and f Block Elements'
where subject = 'chemistry'
  and chapter = 'd- and f-Block Elements';

-- ------------------------------------------------------------
-- 3. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Solutions
update public.chapters set unit_id = 'chemistry__u1'
where subject_id = 'chemistry'
  and name = 'Solutions';

-- Unit 2 — Electrochemistry
update public.chapters set unit_id = 'chemistry__u2'
where subject_id = 'chemistry'
  and name = 'Electrochemistry';

-- Unit 3 — Chemical Kinetics
update public.chapters set unit_id = 'chemistry__u3'
where subject_id = 'chemistry'
  and name = 'Chemical Kinetics';

-- Unit 4 — d and f Block Elements
update public.chapters set unit_id = 'chemistry__u4'
where subject_id = 'chemistry'
  and name = 'd and f Block Elements';

-- Unit 5 — Coordination Compounds
update public.chapters set unit_id = 'chemistry__u5'
where subject_id = 'chemistry'
  and name = 'Coordination Compounds';

-- Unit 6 — Haloalkanes and Haloarenes
update public.chapters set unit_id = 'chemistry__u6'
where subject_id = 'chemistry'
  and name = 'Haloalkanes & Haloarenes';

-- Unit 7 — Alcohols, Phenols and Ethers
update public.chapters set unit_id = 'chemistry__u7'
where subject_id = 'chemistry'
  and name = 'Alcohols Phenols & Ethers';

-- Unit 8 — Aldehydes, Ketones and Carboxylic Acids
update public.chapters set unit_id = 'chemistry__u8'
where subject_id = 'chemistry'
  and name = 'Aldehydes Ketones & Carboxylic Acids';

-- Unit 9 — Amines
update public.chapters set unit_id = 'chemistry__u9'
where subject_id = 'chemistry'
  and name = 'Amines';

-- Unit 10 — Biomolecules
update public.chapters set unit_id = 'chemistry__u10'
where subject_id = 'chemistry'
  and name = 'Biomolecules';

-- Intentionally left without unit_id (not in CUET 2026 Chemistry):
--   Solid State, Surface Chemistry, Isolation of Elements,
--   p-Block Elements, Polymers, Chemistry in Everyday Life

commit;
