-- ============================================================
-- MockMob migration 0021 — units layer for Political Science
-- CUET 2026 syllabus (subject code 317)
-- ============================================================
-- CUET structure: 2 books / sections
--   Book 1: Politics in India Since Independence
--     Challenges of Nation Building, Era of One-Party Dominance,
--     Politics of Planned Development, India's External Relations,
--     Challenges to and Restoration of Congress System,
--     Crisis of Democratic Order, Rise of Popular Movements,
--     Regional Aspirations, Recent Issues and Challenges
--   Book 2: Contemporary World Politics
--     The Cold War Era, The End of Bipolarity,
--     US Hegemony in World Politics, Alternative Centres of Power,
--     South Asia and the Contemporary World, International Organisations,
--     Security in the Contemporary World, Environment and Natural Resources,
--     Globalisation
--
-- DB mapping: 2 units (= Books)
--   u1 Politics in India Since Independence
--   u2 Contemporary World Politics
--
-- Gap analysis vs existing chapters:
--   MATCH  (many existing chapters map cleanly)
--   NEW (2): "Democratic Upsurge and Coalition Politics"
--            "Recent Issues and Challenges"
--            (chapters present in CUET but missing from seed data)
--   INVALID (3): "Cold War Era", "US Hegemony in World Politics",
--                "Rise of Popular Movements"
--                (kept in DB, unit_id left null — name collision risk
--                 avoided; these are CUET topics but missing exact match)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('political_science__u1', 'political_science', 'Politics in India Since Independence', 0),
  ('political_science__u2', 'political_science', 'Contemporary World Politics',          1)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Insert missing chapters
-- ------------------------------------------------------------
insert into public.chapters (id, subject_id, name, sort_order) values
  ('political_science__democratic_upsurge_coalition', 'political_science', 'Democratic Upsurge and Coalition Politics', 6),
  ('political_science__recent_issues_challenges',     'political_science', 'Recent Issues and Challenges',              8)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 3. No renames required
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Politics in India Since Independence
update public.chapters set unit_id = 'political_science__u1'
where subject_id = 'political_science'
  and name in (
    'Challenges of Nation Building',
    'Era of One-Party Dominance',
    'Politics of Planned Development',
    'India''s External Relations',
    'Challenges to and Restoration of Congress System',
    'Crisis of Democratic Order',
    'Democratic Upsurge and Coalition Politics',
    'Regional Aspirations',
    'Recent Issues and Challenges'
  );

-- Unit 2 — Contemporary World Politics
update public.chapters set unit_id = 'political_science__u2'
where subject_id = 'political_science'
  and name in (
    'The End of Bipolarity',
    'Alternative Centres of Power',
    'South Asia and the Contemporary World',
    'International Organisations',
    'Security in the Contemporary World',
    'Environment and Natural Resources',
    'Globalisation'
  );

-- Intentionally left without unit_id:
--   "Cold War Era"                  (ambiguous — kept for question continuity)
--   "US Hegemony in World Politics" (ambiguous — kept for question continuity)
--   "Rise of Popular Movements"     (kept for question continuity)

commit;
