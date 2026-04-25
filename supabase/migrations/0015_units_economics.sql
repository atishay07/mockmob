-- ============================================================
-- MockMob migration 0015 — units layer for Economics
-- CUET 2026 syllabus (subject code 309)
-- ============================================================
-- CUET structure: 3 Courses, each with 4–5 Units
-- DB mapping: 3 units (= Courses) → chapters (= CUET Units within each course)
--
-- Units:
--   u1 Introductory Microeconomics       (Course I,  CUET Units I–IV)
--   u2 Introductory Macroeconomics       (Course II, CUET Units I–V)
--   u3 Indian Economic Development       (Course III,CUET Units I–IV)
--
-- Renames:
--   "National Income & Related Aggregates" → "National Income Accounting"
--   "Income Determination"                 → "Determination of Income & Employment"
--   "Balance of Payments"                  → "Open Economy Macroeconomics"
--   "Indian Economy on the Eve of Independence"
--                                          → "Development Policies & Experience (1947–90)"
--
-- Merge (duplicate after rename):
--   "Indian Economic Development 1950–1990"
--       → questions remapped → chapter row deleted
--
-- New chapters (Microeconomics entirely missing from seed):
--   Introduction & Theory of Consumer Behaviour
--   Production & Costs
--   Theory of Firms under Perfect Competition
--   Market Equilibrium & Simple Applications
--   Development Experiences of India
--
-- Invalid (no CUET 2026 equivalent — kept, unit_id left null):
--   "Infrastructure"
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('economics__u1', 'economics', 'Introductory Microeconomics',  0),
  ('economics__u2', 'economics', 'Introductory Macroeconomics',  1),
  ('economics__u3', 'economics', 'Indian Economic Development',  2)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Rename chapters to CUET-canonical names
-- ------------------------------------------------------------

update public.chapters
  set name = 'National Income Accounting'
where id = 'economics__national_income_related_aggregates';

update public.questions
  set chapter = 'National Income Accounting'
where subject = 'economics'
  and chapter = 'National Income & Related Aggregates';

-- --

update public.chapters
  set name = 'Determination of Income & Employment'
where id = 'economics__income_determination';

update public.questions
  set chapter = 'Determination of Income & Employment'
where subject = 'economics'
  and chapter = 'Income Determination';

-- --

update public.chapters
  set name = 'Open Economy Macroeconomics'
where id = 'economics__balance_of_payments';

update public.questions
  set chapter = 'Open Economy Macroeconomics'
where subject = 'economics'
  and chapter = 'Balance of Payments';

-- --

update public.chapters
  set name = 'Development Policies & Experience (1947–90)'
where id = 'economics__indian_economy_on_the_eve_of_independence';

update public.questions
  set chapter = 'Development Policies & Experience (1947–90)'
where subject = 'economics'
  and chapter = 'Indian Economy on the Eve of Independence';

-- ------------------------------------------------------------
-- 3. Merge duplicate: "Indian Economic Development 1950–1990"
--    is covered by "Development Policies & Experience (1947–90)"
-- ------------------------------------------------------------
update public.questions
  set chapter = 'Development Policies & Experience (1947–90)'
where subject = 'economics'
  and chapter = 'Indian Economic Development 1950–1990';

delete from public.chapters
where id = 'economics__indian_economic_development_1950_1990';

-- ------------------------------------------------------------
-- 4. Insert new chapters (Microeconomics was entirely absent)
-- ------------------------------------------------------------
insert into public.chapters (id, subject_id, name, sort_order) values
  ('economics__introduction_consumer_behaviour',   'economics', 'Introduction & Theory of Consumer Behaviour', 0),
  ('economics__production_and_costs',              'economics', 'Production & Costs',                         1),
  ('economics__theory_firms_perfect_competition',  'economics', 'Theory of Firms under Perfect Competition',  2),
  ('economics__market_equilibrium',                'economics', 'Market Equilibrium & Simple Applications',   3),
  ('economics__development_experiences_india',     'economics', 'Development Experiences of India',           14)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 5. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Introductory Microeconomics
update public.chapters
  set unit_id = 'economics__u1'
where subject_id = 'economics'
  and name in (
    'Introduction & Theory of Consumer Behaviour',
    'Production & Costs',
    'Theory of Firms under Perfect Competition',
    'Market Equilibrium & Simple Applications'
  );

-- Unit 2 — Introductory Macroeconomics
update public.chapters
  set unit_id = 'economics__u2'
where subject_id = 'economics'
  and name in (
    'National Income Accounting',
    'Money & Banking',
    'Determination of Income & Employment',
    'Government Budget & the Economy',
    'Open Economy Macroeconomics'
  );

-- Unit 3 — Indian Economic Development
update public.chapters
  set unit_id = 'economics__u3'
where subject_id = 'economics'
  and name in (
    'Development Policies & Experience (1947–90)',
    'Economic Reforms Since 1991',
    'Human Capital Formation',
    'Rural Development',
    'Employment',
    'Environment & Sustainable Development',
    'Development Experiences of India'
  );

-- "Infrastructure" intentionally left without unit_id
-- (not present in CUET 2026 Economics/Business Economics syllabus)

commit;
