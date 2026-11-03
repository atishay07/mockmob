-- EMPTY SEPARATE STAGING ONLY: onwkqxmjqjrhfbjjdydu. NEVER apply to production.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN RAISE EXCEPTION 'empty staging project required'; END IF; END $$;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
-- BEGIN 0001_init.sql
-- =====================================================================
-- MockMob — initial schema
-- Mirrors the shape of data/db.json so the seed ports cleanly.
-- IDs are TEXT (not uuid) to preserve the existing id format
-- (e.g. "usr_1776743643988_g0m7ea9", "q_...", "att_...", "a1", "e1", ...).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- USERS ----------
create table if not exists public.users (
  id         text        primary key,
  name       text        not null,
  email      text        unique,
  image      text,
  subjects   jsonb       not null default '[]'::jsonb,
  role       text        not null default 'student',
  created_at timestamptz not null default now()
);

create index if not exists users_name_lower_idx on public.users (lower(name));

-- ---------- QUESTIONS ----------
-- status: 'pending' | 'live' | 'rejected'
create table if not exists public.questions (
  id             text        primary key,
  subject        text        not null,
  chapter        text        not null,
  question       text        not null,
  options        jsonb       not null,
  correct_index  int         not null,
  explanation    text,
  difficulty     text,
  source         text,
  status         text        not null default 'pending',
  uploaded_by    text,
  created_at     timestamptz not null default now(),
  constraint questions_status_chk
    check (status in ('pending','live','rejected'))
);

create index if not exists questions_subject_status_idx on public.questions (subject, status);
create index if not exists questions_status_idx         on public.questions (status);

-- ---------- ATTEMPTS ----------
create table if not exists public.attempts (
  id                 text        primary key,
  user_id            text        not null references public.users(id) on delete cascade,
  subject            text        not null,
  score              int         not null,
  correct            int         not null,
  wrong              int         not null,
  unattempted        int         not null,
  total              int         not null,
  details            jsonb       not null default '[]'::jsonb,
  questions_snapshot jsonb       not null default '[]'::jsonb,
  completed_at       timestamptz not null default now()
);

create index if not exists attempts_user_completed_idx on public.attempts (user_id, completed_at desc);
create index if not exists attempts_subject_idx        on public.attempts (subject);

-- END 0001_init.sql

-- BEGIN 0002_rls.sql
-- =====================================================================
-- MockMob — Row Level Security
-- The server uses the service_role key (bypasses RLS entirely).
-- These policies only gate anon/authenticated (browser) access.
-- =====================================================================

alter table public.users     enable row level security;
alter table public.questions enable row level security;
alter table public.attempts  enable row level security;

-- ---- USERS ----
-- No anon access to users table (contains email). Server-only reads.
-- (no policies = deny all for anon/authenticated roles)

-- ---- QUESTIONS ----
-- Anyone can read LIVE questions (public question bank).
drop policy if exists "anon read live questions" on public.questions;
create policy "anon read live questions"
  on public.questions
  for select
  to anon, authenticated
  using (status = 'live');

-- ---- ATTEMPTS ----
-- No anon access. Server aggregates everything.
-- (leaderboard joins users+attempts and returns a denormalized view)

-- END 0002_rls.sql

-- BEGIN 0003_chapters.sql
-- ============================================================
-- MockMob migration 0003 — chapters table
-- ============================================================
-- Introduces a normalized chapters table.
--
-- Backward compatibility:
--   questions.chapter stays as a TEXT column (NOT renamed or dropped)
--   so existing rows and writers keep working. We soft-link via the
--   composite (subject_id, name) in the chapters table.
--
-- Going forward, the canonical list of "what chapters exist for a
-- subject" lives here, instead of hard-coded in data/subjects.js.
-- The API reads this table with a fallback to subjects.js when empty.
-- ============================================================

create table if not exists public.chapters (
  id          text primary key,           -- slugish id, e.g. "math__calculus"
  subject_id  text not null,              -- matches subjects.id (not FK: subjects live in code)
  name        text not null,              -- display name, e.g. "Calculus"
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (subject_id, name)
);

create index if not exists chapters_subject_idx on public.chapters (subject_id, sort_order);

-- RLS: allow anyone to read chapters; writes only via service_role (bypasses RLS).
alter table public.chapters enable row level security;

drop policy if exists chapters_read on public.chapters;
create policy chapters_read
  on public.chapters
  for select
  to anon, authenticated
  using (true);

-- END 0003_chapters.sql

-- BEGIN 0004_cuet_seed.sql
-- ============================================================
-- MockMob migration 0004 — CUET subjects & chapters seed
-- ============================================================
-- Populates the chapters table (created in 0003) with the full
-- CUET (UG) syllabus: 13 Section IA languages, 27 domain
-- subjects, and the General Test. Subject metadata (name/short/
-- glyph) lives in data/subjects.js and is exposed via /api/subjects.
--
-- Idempotent: safe to re-run. ON CONFLICT (id) DO UPDATE keeps the
-- display name + sort_order in sync if the source list changes.
-- ============================================================

begin;

-- English (english) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('english__reading_comprehension', 'english', 'Reading Comprehension', 0),
  ('english__grammar_usage', 'english', 'Grammar & Usage', 1),
  ('english__vocabulary', 'english', 'Vocabulary', 2),
  ('english__literature_prose', 'english', 'Literature — Prose', 3),
  ('english__literature_poetry', 'english', 'Literature — Poetry', 4),
  ('english__note_making', 'english', 'Note Making', 5),
  ('english__composition', 'english', 'Composition', 6),
  ('english__figures_of_speech', 'english', 'Figures of Speech', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Hindi (hindi) — 7 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('hindi__apathit_gadyansh', 'hindi', 'Apathit Gadyansh', 0),
  ('hindi__apathit_padyansh', 'hindi', 'Apathit Padyansh', 1),
  ('hindi__vyakaran', 'hindi', 'Vyakaran', 2),
  ('hindi__kavya_khand', 'hindi', 'Kavya Khand', 3),
  ('hindi__gadya_khand', 'hindi', 'Gadya Khand', 4),
  ('hindi__anuvad', 'hindi', 'Anuvad', 5),
  ('hindi__rachnatmak_lekhan', 'hindi', 'Rachnatmak Lekhan', 6)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Assamese (assamese) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('assamese__reading_comprehension', 'assamese', 'Reading Comprehension', 0),
  ('assamese__grammar', 'assamese', 'Grammar', 1),
  ('assamese__vocabulary', 'assamese', 'Vocabulary', 2),
  ('assamese__literature_prose', 'assamese', 'Literature — Prose', 3),
  ('assamese__literature_poetry', 'assamese', 'Literature — Poetry', 4),
  ('assamese__composition', 'assamese', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Bengali (bengali) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('bengali__reading_comprehension', 'bengali', 'Reading Comprehension', 0),
  ('bengali__grammar', 'bengali', 'Grammar', 1),
  ('bengali__vocabulary', 'bengali', 'Vocabulary', 2),
  ('bengali__literature_prose', 'bengali', 'Literature — Prose', 3),
  ('bengali__literature_poetry', 'bengali', 'Literature — Poetry', 4),
  ('bengali__composition', 'bengali', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Gujarati (gujarati) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('gujarati__reading_comprehension', 'gujarati', 'Reading Comprehension', 0),
  ('gujarati__grammar', 'gujarati', 'Grammar', 1),
  ('gujarati__vocabulary', 'gujarati', 'Vocabulary', 2),
  ('gujarati__literature_prose', 'gujarati', 'Literature — Prose', 3),
  ('gujarati__literature_poetry', 'gujarati', 'Literature — Poetry', 4),
  ('gujarati__composition', 'gujarati', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Kannada (kannada) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('kannada__reading_comprehension', 'kannada', 'Reading Comprehension', 0),
  ('kannada__grammar', 'kannada', 'Grammar', 1),
  ('kannada__vocabulary', 'kannada', 'Vocabulary', 2),
  ('kannada__literature_prose', 'kannada', 'Literature — Prose', 3),
  ('kannada__literature_poetry', 'kannada', 'Literature — Poetry', 4),
  ('kannada__composition', 'kannada', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Malayalam (malayalam) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('malayalam__reading_comprehension', 'malayalam', 'Reading Comprehension', 0),
  ('malayalam__grammar', 'malayalam', 'Grammar', 1),
  ('malayalam__vocabulary', 'malayalam', 'Vocabulary', 2),
  ('malayalam__literature_prose', 'malayalam', 'Literature — Prose', 3),
  ('malayalam__literature_poetry', 'malayalam', 'Literature — Poetry', 4),
  ('malayalam__composition', 'malayalam', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Marathi (marathi) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('marathi__reading_comprehension', 'marathi', 'Reading Comprehension', 0),
  ('marathi__grammar', 'marathi', 'Grammar', 1),
  ('marathi__vocabulary', 'marathi', 'Vocabulary', 2),
  ('marathi__literature_prose', 'marathi', 'Literature — Prose', 3),
  ('marathi__literature_poetry', 'marathi', 'Literature — Poetry', 4),
  ('marathi__composition', 'marathi', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Odia (odia) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('odia__reading_comprehension', 'odia', 'Reading Comprehension', 0),
  ('odia__grammar', 'odia', 'Grammar', 1),
  ('odia__vocabulary', 'odia', 'Vocabulary', 2),
  ('odia__literature_prose', 'odia', 'Literature — Prose', 3),
  ('odia__literature_poetry', 'odia', 'Literature — Poetry', 4),
  ('odia__composition', 'odia', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Punjabi (punjabi) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('punjabi__reading_comprehension', 'punjabi', 'Reading Comprehension', 0),
  ('punjabi__grammar', 'punjabi', 'Grammar', 1),
  ('punjabi__vocabulary', 'punjabi', 'Vocabulary', 2),
  ('punjabi__literature_prose', 'punjabi', 'Literature — Prose', 3),
  ('punjabi__literature_poetry', 'punjabi', 'Literature — Poetry', 4),
  ('punjabi__composition', 'punjabi', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Tamil (tamil) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('tamil__reading_comprehension', 'tamil', 'Reading Comprehension', 0),
  ('tamil__grammar', 'tamil', 'Grammar', 1),
  ('tamil__vocabulary', 'tamil', 'Vocabulary', 2),
  ('tamil__literature_prose', 'tamil', 'Literature — Prose', 3),
  ('tamil__literature_poetry', 'tamil', 'Literature — Poetry', 4),
  ('tamil__composition', 'tamil', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Telugu (telugu) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('telugu__reading_comprehension', 'telugu', 'Reading Comprehension', 0),
  ('telugu__grammar', 'telugu', 'Grammar', 1),
  ('telugu__vocabulary', 'telugu', 'Vocabulary', 2),
  ('telugu__literature_prose', 'telugu', 'Literature — Prose', 3),
  ('telugu__literature_poetry', 'telugu', 'Literature — Poetry', 4),
  ('telugu__composition', 'telugu', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Urdu (urdu) — 6 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('urdu__reading_comprehension', 'urdu', 'Reading Comprehension', 0),
  ('urdu__grammar', 'urdu', 'Grammar', 1),
  ('urdu__vocabulary', 'urdu', 'Vocabulary', 2),
  ('urdu__literature_prose', 'urdu', 'Literature — Prose', 3),
  ('urdu__literature_poetry', 'urdu', 'Literature — Poetry', 4),
  ('urdu__composition', 'urdu', 'Composition', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Accountancy (accountancy) — 10 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('accountancy__partnership_fundamentals', 'accountancy', 'Partnership Fundamentals', 0),
  ('accountancy__change_in_profit_sharing_ratio', 'accountancy', 'Change in Profit Sharing Ratio', 1),
  ('accountancy__admission_of_partner', 'accountancy', 'Admission of Partner', 2),
  ('accountancy__retirement_death_of_partner', 'accountancy', 'Retirement & Death of Partner', 3),
  ('accountancy__dissolution_of_partnership', 'accountancy', 'Dissolution of Partnership', 4),
  ('accountancy__share_capital', 'accountancy', 'Share Capital', 5),
  ('accountancy__debentures', 'accountancy', 'Debentures', 6),
  ('accountancy__financial_statements_of_company', 'accountancy', 'Financial Statements of Company', 7),
  ('accountancy__analysis_of_financial_statements', 'accountancy', 'Analysis of Financial Statements', 8),
  ('accountancy__cash_flow_statement', 'accountancy', 'Cash Flow Statement', 9)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Agriculture (agriculture) — 9 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('agriculture__agricultural_meteorology', 'agriculture', 'Agricultural Meteorology', 0),
  ('agriculture__genetics_plant_breeding', 'agriculture', 'Genetics & Plant Breeding', 1),
  ('agriculture__biochemistry_microbiology', 'agriculture', 'Biochemistry & Microbiology', 2),
  ('agriculture__livestock_production', 'agriculture', 'Livestock Production', 3),
  ('agriculture__crop_production', 'agriculture', 'Crop Production', 4),
  ('agriculture__horticulture', 'agriculture', 'Horticulture', 5),
  ('agriculture__agricultural_economics', 'agriculture', 'Agricultural Economics', 6),
  ('agriculture__basic_agricultural_engineering', 'agriculture', 'Basic Agricultural Engineering', 7),
  ('agriculture__extension_education', 'agriculture', 'Extension Education', 8)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Anthropology (anthropology) — 10 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('anthropology__introducing_anthropology', 'anthropology', 'Introducing Anthropology', 0),
  ('anthropology__human_evolution', 'anthropology', 'Human Evolution', 1),
  ('anthropology__human_genetics', 'anthropology', 'Human Genetics', 2),
  ('anthropology__human_ecology', 'anthropology', 'Human Ecology', 3),
  ('anthropology__demographic_anthropology', 'anthropology', 'Demographic Anthropology', 4),
  ('anthropology__archaeological_anthropology', 'anthropology', 'Archaeological Anthropology', 5),
  ('anthropology__indian_anthropology', 'anthropology', 'Indian Anthropology', 6),
  ('anthropology__tribal_india', 'anthropology', 'Tribal India', 7),
  ('anthropology__applied_anthropology', 'anthropology', 'Applied Anthropology', 8),
  ('anthropology__fieldwork_methods', 'anthropology', 'Fieldwork Methods', 9)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Biology (biology) — 15 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('biology__reproduction_in_organisms', 'biology', 'Reproduction in Organisms', 0),
  ('biology__sexual_reproduction_in_flowering_plants', 'biology', 'Sexual Reproduction in Flowering Plants', 1),
  ('biology__human_reproduction', 'biology', 'Human Reproduction', 2),
  ('biology__reproductive_health', 'biology', 'Reproductive Health', 3),
  ('biology__principles_of_inheritance_variation', 'biology', 'Principles of Inheritance & Variation', 4),
  ('biology__molecular_basis_of_inheritance', 'biology', 'Molecular Basis of Inheritance', 5),
  ('biology__evolution', 'biology', 'Evolution', 6),
  ('biology__human_health_disease', 'biology', 'Human Health & Disease', 7),
  ('biology__microbes_in_human_welfare', 'biology', 'Microbes in Human Welfare', 8),
  ('biology__biotechnology_principles_processes', 'biology', 'Biotechnology Principles & Processes', 9),
  ('biology__biotechnology_its_applications', 'biology', 'Biotechnology & its Applications', 10),
  ('biology__organisms_populations', 'biology', 'Organisms & Populations', 11),
  ('biology__ecosystem', 'biology', 'Ecosystem', 12),
  ('biology__biodiversity_conservation', 'biology', 'Biodiversity & Conservation', 13),
  ('biology__environmental_issues', 'biology', 'Environmental Issues', 14)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Business Studies (business_studies) — 13 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('business_studies__nature_significance_of_management', 'business_studies', 'Nature & Significance of Management', 0),
  ('business_studies__principles_of_management', 'business_studies', 'Principles of Management', 1),
  ('business_studies__business_environment', 'business_studies', 'Business Environment', 2),
  ('business_studies__planning', 'business_studies', 'Planning', 3),
  ('business_studies__organising', 'business_studies', 'Organising', 4),
  ('business_studies__staffing', 'business_studies', 'Staffing', 5),
  ('business_studies__directing', 'business_studies', 'Directing', 6),
  ('business_studies__controlling', 'business_studies', 'Controlling', 7),
  ('business_studies__financial_management', 'business_studies', 'Financial Management', 8),
  ('business_studies__financial_markets', 'business_studies', 'Financial Markets', 9),
  ('business_studies__marketing_management', 'business_studies', 'Marketing Management', 10),
  ('business_studies__consumer_protection', 'business_studies', 'Consumer Protection', 11),
  ('business_studies__entrepreneurship_development', 'business_studies', 'Entrepreneurship Development', 12)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Chemistry (chemistry) — 16 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('chemistry__solid_state', 'chemistry', 'Solid State', 0),
  ('chemistry__solutions', 'chemistry', 'Solutions', 1),
  ('chemistry__electrochemistry', 'chemistry', 'Electrochemistry', 2),
  ('chemistry__chemical_kinetics', 'chemistry', 'Chemical Kinetics', 3),
  ('chemistry__surface_chemistry', 'chemistry', 'Surface Chemistry', 4),
  ('chemistry__isolation_of_elements', 'chemistry', 'Isolation of Elements', 5),
  ('chemistry__p_block_elements', 'chemistry', 'p-Block Elements', 6),
  ('chemistry__d_and_f_block_elements', 'chemistry', 'd- and f-Block Elements', 7),
  ('chemistry__coordination_compounds', 'chemistry', 'Coordination Compounds', 8),
  ('chemistry__haloalkanes_haloarenes', 'chemistry', 'Haloalkanes & Haloarenes', 9),
  ('chemistry__alcohols_phenols_ethers', 'chemistry', 'Alcohols, Phenols & Ethers', 10),
  ('chemistry__aldehydes_ketones_carboxylic_acids', 'chemistry', 'Aldehydes, Ketones & Carboxylic Acids', 11),
  ('chemistry__amines', 'chemistry', 'Amines', 12),
  ('chemistry__biomolecules', 'chemistry', 'Biomolecules', 13),
  ('chemistry__polymers', 'chemistry', 'Polymers', 14),
  ('chemistry__chemistry_in_everyday_life', 'chemistry', 'Chemistry in Everyday Life', 15)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Computer Science / Informatics Practices (computer_science) — 10 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('computer_science__python_revision', 'computer_science', 'Python Revision', 0),
  ('computer_science__functions', 'computer_science', 'Functions', 1),
  ('computer_science__file_handling', 'computer_science', 'File Handling', 2),
  ('computer_science__data_structures', 'computer_science', 'Data Structures', 3),
  ('computer_science__computer_networks', 'computer_science', 'Computer Networks', 4),
  ('computer_science__database_concepts', 'computer_science', 'Database Concepts', 5),
  ('computer_science__mysql', 'computer_science', 'MySQL', 6),
  ('computer_science__interface_python_with_mysql', 'computer_science', 'Interface Python with MySQL', 7),
  ('computer_science__boolean_algebra', 'computer_science', 'Boolean Algebra', 8),
  ('computer_science__communication_technologies', 'computer_science', 'Communication Technologies', 9)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Economics / Business Economics (economics) — 13 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('economics__national_income_related_aggregates', 'economics', 'National Income & Related Aggregates', 0),
  ('economics__money_banking', 'economics', 'Money & Banking', 1),
  ('economics__income_determination', 'economics', 'Income Determination', 2),
  ('economics__government_budget_the_economy', 'economics', 'Government Budget & the Economy', 3),
  ('economics__balance_of_payments', 'economics', 'Balance of Payments', 4),
  ('economics__indian_economy_on_the_eve_of_independence', 'economics', 'Indian Economy on the Eve of Independence', 5),
  ('economics__indian_economic_development_1950_1990', 'economics', 'Indian Economic Development 1950–1990', 6),
  ('economics__economic_reforms_since_1991', 'economics', 'Economic Reforms Since 1991', 7),
  ('economics__human_capital_formation', 'economics', 'Human Capital Formation', 8),
  ('economics__rural_development', 'economics', 'Rural Development', 9),
  ('economics__employment', 'economics', 'Employment', 10),
  ('economics__infrastructure', 'economics', 'Infrastructure', 11),
  ('economics__environment_sustainable_development', 'economics', 'Environment & Sustainable Development', 12)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Engineering Graphics (engineering_graphics) — 10 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('engineering_graphics__isometric_projection_of_solids', 'engineering_graphics', 'Isometric Projection of Solids', 0),
  ('engineering_graphics__machine_drawing', 'engineering_graphics', 'Machine Drawing', 1),
  ('engineering_graphics__building_drawing', 'engineering_graphics', 'Building Drawing', 2),
  ('engineering_graphics__engineering_curves', 'engineering_graphics', 'Engineering Curves', 3),
  ('engineering_graphics__projection_of_points_lines', 'engineering_graphics', 'Projection of Points & Lines', 4),
  ('engineering_graphics__projection_of_planes', 'engineering_graphics', 'Projection of Planes', 5),
  ('engineering_graphics__projection_of_solids', 'engineering_graphics', 'Projection of Solids', 6),
  ('engineering_graphics__sectional_views', 'engineering_graphics', 'Sectional Views', 7),
  ('engineering_graphics__orthographic_projections', 'engineering_graphics', 'Orthographic Projections', 8),
  ('engineering_graphics__computer_aided_drawing', 'engineering_graphics', 'Computer-Aided Drawing', 9)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Entrepreneurship (entrepreneurship) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('entrepreneurship__entrepreneurial_opportunity', 'entrepreneurship', 'Entrepreneurial Opportunity', 0),
  ('entrepreneurship__entrepreneurial_planning', 'entrepreneurship', 'Entrepreneurial Planning', 1),
  ('entrepreneurship__enterprise_marketing', 'entrepreneurship', 'Enterprise Marketing', 2),
  ('entrepreneurship__enterprise_growth_strategies', 'entrepreneurship', 'Enterprise Growth Strategies', 3),
  ('entrepreneurship__business_arithmetic', 'entrepreneurship', 'Business Arithmetic', 4),
  ('entrepreneurship__resource_mobilization', 'entrepreneurship', 'Resource Mobilization', 5),
  ('entrepreneurship__entrepreneurial_ethics', 'entrepreneurship', 'Entrepreneurial Ethics', 6),
  ('entrepreneurship__concept_functions_of_entrepreneurship', 'entrepreneurship', 'Concept & Functions of Entrepreneurship', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Environmental Studies (environmental_studies) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('environmental_studies__natural_resources', 'environmental_studies', 'Natural Resources', 0),
  ('environmental_studies__ecosystems', 'environmental_studies', 'Ecosystems', 1),
  ('environmental_studies__biodiversity', 'environmental_studies', 'Biodiversity', 2),
  ('environmental_studies__environmental_pollution', 'environmental_studies', 'Environmental Pollution', 3),
  ('environmental_studies__social_issues_environment', 'environmental_studies', 'Social Issues & Environment', 4),
  ('environmental_studies__human_population', 'environmental_studies', 'Human Population', 5),
  ('environmental_studies__environmental_policies', 'environmental_studies', 'Environmental Policies', 6),
  ('environmental_studies__case_studies', 'environmental_studies', 'Case Studies', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Fine Arts / Visual Arts (fine_arts) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('fine_arts__the_rajasthani_school', 'fine_arts', 'The Rajasthani School', 0),
  ('fine_arts__the_pahari_school', 'fine_arts', 'The Pahari School', 1),
  ('fine_arts__the_mughal_school', 'fine_arts', 'The Mughal School', 2),
  ('fine_arts__the_deccan_school', 'fine_arts', 'The Deccan School', 3),
  ('fine_arts__the_bengal_school', 'fine_arts', 'The Bengal School', 4),
  ('fine_arts__modern_indian_art', 'fine_arts', 'Modern Indian Art', 5),
  ('fine_arts__graphic_prints', 'fine_arts', 'Graphic Prints', 6),
  ('fine_arts__sculpture_post_independence', 'fine_arts', 'Sculpture Post-Independence', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Geography / Geology (geography) — 14 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('geography__human_geography_nature_scope', 'geography', 'Human Geography — Nature & Scope', 0),
  ('geography__population_distribution_density_growth', 'geography', 'Population — Distribution, Density, Growth', 1),
  ('geography__migration', 'geography', 'Migration', 2),
  ('geography__human_development', 'geography', 'Human Development', 3),
  ('geography__human_settlements', 'geography', 'Human Settlements', 4),
  ('geography__primary_activities', 'geography', 'Primary Activities', 5),
  ('geography__secondary_activities', 'geography', 'Secondary Activities', 6),
  ('geography__tertiary_quaternary_activities', 'geography', 'Tertiary & Quaternary Activities', 7),
  ('geography__transport_communication', 'geography', 'Transport & Communication', 8),
  ('geography__international_trade', 'geography', 'International Trade', 9),
  ('geography__india_people_economy', 'geography', 'India — People & Economy', 10),
  ('geography__resources_development', 'geography', 'Resources & Development', 11),
  ('geography__manufacturing_industries', 'geography', 'Manufacturing Industries', 12),
  ('geography__planning_sustainable_development', 'geography', 'Planning & Sustainable Development', 13)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- History (history) — 14 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('history__bricks_beads_bones', 'history', 'Bricks, Beads & Bones', 0),
  ('history__kings_farmers_towns', 'history', 'Kings, Farmers & Towns', 1),
  ('history__kinship_caste_class', 'history', 'Kinship, Caste & Class', 2),
  ('history__thinkers_beliefs_buildings', 'history', 'Thinkers, Beliefs & Buildings', 3),
  ('history__through_the_eyes_of_travellers', 'history', 'Through the Eyes of Travellers', 4),
  ('history__bhakti_sufi_traditions', 'history', 'Bhakti-Sufi Traditions', 5),
  ('history__an_imperial_capital_vijayanagara', 'history', 'An Imperial Capital — Vijayanagara', 6),
  ('history__peasants_zamindars_the_state', 'history', 'Peasants, Zamindars & the State', 7),
  ('history__kings_chronicles', 'history', 'Kings & Chronicles', 8),
  ('history__colonialism_the_countryside', 'history', 'Colonialism & the Countryside', 9),
  ('history__rebels_the_raj', 'history', 'Rebels & the Raj', 10),
  ('history__mahatma_gandhi_the_nationalist_movement', 'history', 'Mahatma Gandhi & the Nationalist Movement', 11),
  ('history__partition', 'history', 'Partition', 12),
  ('history__framing_the_constitution', 'history', 'Framing the Constitution', 13)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Home Science (home_science) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('home_science__human_development', 'home_science', 'Human Development', 0),
  ('home_science__nutrition_for_self_family_community', 'home_science', 'Nutrition for Self, Family & Community', 1),
  ('home_science__money_management_consumer_education', 'home_science', 'Money Management & Consumer Education', 2),
  ('home_science__apparel_designing_care', 'home_science', 'Apparel Designing & Care', 3),
  ('home_science__community_development', 'home_science', 'Community Development', 4),
  ('home_science__food_safety_quality', 'home_science', 'Food Safety & Quality', 5),
  ('home_science__child_care_development', 'home_science', 'Child Care & Development', 6),
  ('home_science__household_management', 'home_science', 'Household Management', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Knowledge Tradition & Practices of India (knowledge_tradition_india) — 9 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('knowledge_tradition_india__indian_languages_literature_scriptures', 'knowledge_tradition_india', 'Indian Languages, Literature & Scriptures', 0),
  ('knowledge_tradition_india__indian_philosophy', 'knowledge_tradition_india', 'Indian Philosophy', 1),
  ('knowledge_tradition_india__religion_spirituality', 'knowledge_tradition_india', 'Religion & Spirituality', 2),
  ('knowledge_tradition_india__indian_arts', 'knowledge_tradition_india', 'Indian Arts', 3),
  ('knowledge_tradition_india__indian_architecture', 'knowledge_tradition_india', 'Indian Architecture', 4),
  ('knowledge_tradition_india__science_technology_in_india', 'knowledge_tradition_india', 'Science & Technology in India', 5),
  ('knowledge_tradition_india__polity_economy', 'knowledge_tradition_india', 'Polity & Economy', 6),
  ('knowledge_tradition_india__education_system', 'knowledge_tradition_india', 'Education System', 7),
  ('knowledge_tradition_india__agriculture_crafts', 'knowledge_tradition_india', 'Agriculture & Crafts', 8)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Legal Studies (legal_studies) — 10 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('legal_studies__judiciary', 'legal_studies', 'Judiciary', 0),
  ('legal_studies__topics_of_law', 'legal_studies', 'Topics of Law', 1),
  ('legal_studies__arbitration_tribunal_adjudication_adr', 'legal_studies', 'Arbitration, Tribunal Adjudication & ADR', 2),
  ('legal_studies__human_rights', 'legal_studies', 'Human Rights', 3),
  ('legal_studies__legal_profession_in_india', 'legal_studies', 'Legal Profession in India', 4),
  ('legal_studies__legal_services', 'legal_studies', 'Legal Services', 5),
  ('legal_studies__international_context', 'legal_studies', 'International Context', 6),
  ('legal_studies__constitutional_law', 'legal_studies', 'Constitutional Law', 7),
  ('legal_studies__criminal_law', 'legal_studies', 'Criminal Law', 8),
  ('legal_studies__family_law', 'legal_studies', 'Family Law', 9)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Mass Media / Mass Communication (mass_media) — 9 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('mass_media__introduction_to_mass_communication', 'mass_media', 'Introduction to Mass Communication', 0),
  ('mass_media__print_media', 'mass_media', 'Print Media', 1),
  ('mass_media__radio', 'mass_media', 'Radio', 2),
  ('mass_media__television', 'mass_media', 'Television', 3),
  ('mass_media__cinema', 'mass_media', 'Cinema', 4),
  ('mass_media__new_media', 'mass_media', 'New Media', 5),
  ('mass_media__advertising', 'mass_media', 'Advertising', 6),
  ('mass_media__public_relations', 'mass_media', 'Public Relations', 7),
  ('mass_media__media_ethics', 'mass_media', 'Media Ethics', 8)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Mathematics / Applied Mathematics (mathematics) — 13 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('mathematics__relations_functions', 'mathematics', 'Relations & Functions', 0),
  ('mathematics__inverse_trigonometric_functions', 'mathematics', 'Inverse Trigonometric Functions', 1),
  ('mathematics__matrices', 'mathematics', 'Matrices', 2),
  ('mathematics__determinants', 'mathematics', 'Determinants', 3),
  ('mathematics__continuity_differentiability', 'mathematics', 'Continuity & Differentiability', 4),
  ('mathematics__application_of_derivatives', 'mathematics', 'Application of Derivatives', 5),
  ('mathematics__integrals', 'mathematics', 'Integrals', 6),
  ('mathematics__application_of_integrals', 'mathematics', 'Application of Integrals', 7),
  ('mathematics__differential_equations', 'mathematics', 'Differential Equations', 8),
  ('mathematics__vector_algebra', 'mathematics', 'Vector Algebra', 9),
  ('mathematics__three_dimensional_geometry', 'mathematics', 'Three Dimensional Geometry', 10),
  ('mathematics__linear_programming', 'mathematics', 'Linear Programming', 11),
  ('mathematics__probability', 'mathematics', 'Probability', 12)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Performing Arts (performing_arts) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('performing_arts__indian_classical_dance', 'performing_arts', 'Indian Classical Dance', 0),
  ('performing_arts__folk_dances_of_india', 'performing_arts', 'Folk Dances of India', 1),
  ('performing_arts__hindustani_music', 'performing_arts', 'Hindustani Music', 2),
  ('performing_arts__carnatic_music', 'performing_arts', 'Carnatic Music', 3),
  ('performing_arts__theatre_traditions', 'performing_arts', 'Theatre Traditions', 4),
  ('performing_arts__rasa_theory', 'performing_arts', 'Rasa Theory', 5),
  ('performing_arts__notable_performers', 'performing_arts', 'Notable Performers', 6),
  ('performing_arts__regional_dance_forms', 'performing_arts', 'Regional Dance Forms', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Physical Education (physical_education) — 10 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('physical_education__planning_in_sports', 'physical_education', 'Planning in Sports', 0),
  ('physical_education__sports_nutrition', 'physical_education', 'Sports & Nutrition', 1),
  ('physical_education__yoga_lifestyle', 'physical_education', 'Yoga & Lifestyle', 2),
  ('physical_education__physical_education_sports_for_cwsn', 'physical_education', 'Physical Education & Sports for CWSN', 3),
  ('physical_education__children_women_in_sports', 'physical_education', 'Children & Women in Sports', 4),
  ('physical_education__test_measurement_evaluation', 'physical_education', 'Test, Measurement & Evaluation', 5),
  ('physical_education__physiology_injuries_in_sports', 'physical_education', 'Physiology & Injuries in Sports', 6),
  ('physical_education__biomechanics_sports', 'physical_education', 'Biomechanics & Sports', 7),
  ('physical_education__psychology_sports', 'physical_education', 'Psychology & Sports', 8),
  ('physical_education__training_in_sports', 'physical_education', 'Training in Sports', 9)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Physics (physics) — 15 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('physics__electric_charges_fields', 'physics', 'Electric Charges & Fields', 0),
  ('physics__electrostatic_potential_capacitance', 'physics', 'Electrostatic Potential & Capacitance', 1),
  ('physics__current_electricity', 'physics', 'Current Electricity', 2),
  ('physics__moving_charges_magnetism', 'physics', 'Moving Charges & Magnetism', 3),
  ('physics__magnetism_matter', 'physics', 'Magnetism & Matter', 4),
  ('physics__electromagnetic_induction', 'physics', 'Electromagnetic Induction', 5),
  ('physics__alternating_current', 'physics', 'Alternating Current', 6),
  ('physics__electromagnetic_waves', 'physics', 'Electromagnetic Waves', 7),
  ('physics__ray_optics_optical_instruments', 'physics', 'Ray Optics & Optical Instruments', 8),
  ('physics__wave_optics', 'physics', 'Wave Optics', 9),
  ('physics__dual_nature_of_radiation_matter', 'physics', 'Dual Nature of Radiation & Matter', 10),
  ('physics__atoms', 'physics', 'Atoms', 11),
  ('physics__nuclei', 'physics', 'Nuclei', 12),
  ('physics__semiconductor_electronics', 'physics', 'Semiconductor Electronics', 13),
  ('physics__communication_systems', 'physics', 'Communication Systems', 14)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Political Science (political_science) — 17 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('political_science__cold_war_era', 'political_science', 'Cold War Era', 0),
  ('political_science__end_of_bipolarity', 'political_science', 'End of Bipolarity', 1),
  ('political_science__us_hegemony_in_world_politics', 'political_science', 'US Hegemony in World Politics', 2),
  ('political_science__alternative_centres_of_power', 'political_science', 'Alternative Centres of Power', 3),
  ('political_science__contemporary_south_asia', 'political_science', 'Contemporary South Asia', 4),
  ('political_science__international_organisations', 'political_science', 'International Organisations', 5),
  ('political_science__security_in_the_contemporary_world', 'political_science', 'Security in the Contemporary World', 6),
  ('political_science__environment_natural_resources', 'political_science', 'Environment & Natural Resources', 7),
  ('political_science__globalisation', 'political_science', 'Globalisation', 8),
  ('political_science__challenges_of_nation_building', 'political_science', 'Challenges of Nation Building', 9),
  ('political_science__era_of_one_party_dominance', 'political_science', 'Era of One-Party Dominance', 10),
  ('political_science__politics_of_planned_development', 'political_science', 'Politics of Planned Development', 11),
  ('political_science__india_s_external_relations', 'political_science', 'India''s External Relations', 12),
  ('political_science__challenges_to_restoration_of_the_congress_system', 'political_science', 'Challenges to & Restoration of the Congress System', 13),
  ('political_science__crisis_of_the_democratic_order', 'political_science', 'Crisis of the Democratic Order', 14),
  ('political_science__rise_of_popular_movements', 'political_science', 'Rise of Popular Movements', 15),
  ('political_science__regional_aspirations', 'political_science', 'Regional Aspirations', 16)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Psychology (psychology) — 9 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('psychology__variations_in_psychological_attributes', 'psychology', 'Variations in Psychological Attributes', 0),
  ('psychology__self_personality', 'psychology', 'Self & Personality', 1),
  ('psychology__meeting_life_challenges', 'psychology', 'Meeting Life Challenges', 2),
  ('psychology__psychological_disorders', 'psychology', 'Psychological Disorders', 3),
  ('psychology__therapeutic_approaches', 'psychology', 'Therapeutic Approaches', 4),
  ('psychology__attitude_social_cognition', 'psychology', 'Attitude & Social Cognition', 5),
  ('psychology__social_influence_group_processes', 'psychology', 'Social Influence & Group Processes', 6),
  ('psychology__psychology_life', 'psychology', 'Psychology & Life', 7),
  ('psychology__developing_psychological_skills', 'psychology', 'Developing Psychological Skills', 8)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Sanskrit (sanskrit) — 7 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('sanskrit__apathit_avabodhanam', 'sanskrit', 'Apathit Avabodhanam', 0),
  ('sanskrit__vyakaranam', 'sanskrit', 'Vyakaranam', 1),
  ('sanskrit__racnanatmakam_karya', 'sanskrit', 'Racnanatmakam Karya', 2),
  ('sanskrit__padyam', 'sanskrit', 'Padyam', 3),
  ('sanskrit__gadyam', 'sanskrit', 'Gadyam', 4),
  ('sanskrit__natyam', 'sanskrit', 'Natyam', 5),
  ('sanskrit__sanskrit_literature', 'sanskrit', 'Sanskrit Literature', 6)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Sociology (sociology) — 14 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('sociology__introducing_indian_society', 'sociology', 'Introducing Indian Society', 0),
  ('sociology__demographic_structure', 'sociology', 'Demographic Structure', 1),
  ('sociology__social_institutions', 'sociology', 'Social Institutions', 2),
  ('sociology__market_as_a_social_institution', 'sociology', 'Market as a Social Institution', 3),
  ('sociology__patterns_of_social_inequality', 'sociology', 'Patterns of Social Inequality', 4),
  ('sociology__challenges_of_cultural_diversity', 'sociology', 'Challenges of Cultural Diversity', 5),
  ('sociology__structural_change', 'sociology', 'Structural Change', 6),
  ('sociology__cultural_change', 'sociology', 'Cultural Change', 7),
  ('sociology__story_of_indian_democracy', 'sociology', 'Story of Indian Democracy', 8),
  ('sociology__change_development_in_rural_society', 'sociology', 'Change & Development in Rural Society', 9),
  ('sociology__change_development_in_industrial_society', 'sociology', 'Change & Development in Industrial Society', 10),
  ('sociology__globalisation_social_change', 'sociology', 'Globalisation & Social Change', 11),
  ('sociology__mass_media_communications', 'sociology', 'Mass Media & Communications', 12),
  ('sociology__social_movements', 'sociology', 'Social Movements', 13)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Teaching Aptitude (teaching_aptitude) — 9 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('teaching_aptitude__teaching_methodology', 'teaching_aptitude', 'Teaching Methodology', 0),
  ('teaching_aptitude__learning_learner', 'teaching_aptitude', 'Learning & Learner', 1),
  ('teaching_aptitude__teaching_aids', 'teaching_aptitude', 'Teaching Aids', 2),
  ('teaching_aptitude__classroom_management', 'teaching_aptitude', 'Classroom Management', 3),
  ('teaching_aptitude__assessment_evaluation', 'teaching_aptitude', 'Assessment & Evaluation', 4),
  ('teaching_aptitude__educational_psychology', 'teaching_aptitude', 'Educational Psychology', 5),
  ('teaching_aptitude__communication_skills', 'teaching_aptitude', 'Communication Skills', 6),
  ('teaching_aptitude__research_aptitude', 'teaching_aptitude', 'Research Aptitude', 7),
  ('teaching_aptitude__information_communication_technology', 'teaching_aptitude', 'Information & Communication Technology', 8)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- General Test (gat) — 8 chapters
insert into public.chapters (id, subject_id, name, sort_order) values
  ('gat__general_knowledge', 'gat', 'General Knowledge', 0),
  ('gat__current_affairs', 'gat', 'Current Affairs', 1),
  ('gat__general_mental_ability', 'gat', 'General Mental Ability', 2),
  ('gat__numerical_ability', 'gat', 'Numerical Ability', 3),
  ('gat__quantitative_reasoning', 'gat', 'Quantitative Reasoning', 4),
  ('gat__logical_analytical_reasoning', 'gat', 'Logical & Analytical Reasoning', 5),
  ('gat__basic_mathematical_concepts', 'gat', 'Basic Mathematical Concepts', 6),
  ('gat__statistical_data_analysis', 'gat', 'Statistical Data Analysis', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

commit;

-- Row-count check:
--   select count(*) from public.chapters;
-- expected: 385 chapters across 41 subjects.

-- END 0004_cuet_seed.sql

-- BEGIN 0010_phase1_compat.sql
-- ============================================================
-- Migration 0010 — Phase 1 compatibility layer
--
-- Designed for a PARTIALLY MIGRATED database that already has
-- the 0001–0004 schema (TEXT PKs, original questions/users/attempts).
--
-- Rules:
--   • ALTER TABLE ... ADD COLUMN IF NOT EXISTS everywhere
--   • CREATE TABLE IF NOT EXISTS everywhere
--   • CREATE OR REPLACE for all functions
--   • No DROPs, no RECREATEs of existing objects
--   • All ID/FK columns are TEXT to match existing schema
--   • Enum columns stored as TEXT (no CREATE TYPE needed)
-- ============================================================


-- ============================================================
-- SECTION 1: Fix existing columns blocking Phase 1 inserts
-- ============================================================

-- Phase 1's upload route does not supply `question`, `correct_index`,
-- or `options` (it uses `body`, `correct_answer`, and optionally null
-- options for open-ended questions). Drop their NOT NULL constraints
-- so Phase 1 inserts don't fail on columns it doesn't own.
ALTER TABLE public.questions ALTER COLUMN question       DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN correct_index  DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN options        DROP NOT NULL;

-- questions.id has no DEFAULT — Supabase returns it on .single() after
-- insert, so we need the DB to generate it when the caller omits it.
ALTER TABLE public.questions
    ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;


-- ============================================================
-- SECTION 2: New columns on existing `questions` table
-- ============================================================

-- Phase 1 field names (alongside the original schema's field names)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS body           TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_answer TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS author_id      TEXT;   -- maps to uploaded_by
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS tags           TEXT[]      NOT NULL DEFAULT '{}';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- AI moderation
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_tier              TEXT        NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_score             NUMERIC(5,3);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS recommended_difficulty TEXT;

-- Verification & ranking
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS verification_state TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS quality_band        TEXT NOT NULL DEFAULT 'unrated';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS quality_score       NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS momentum_score      NUMERIC(8,4) NOT NULL DEFAULT 0;

-- Exploration
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exposure_budget   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exposure_used      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exploration_lane   TEXT    NOT NULL DEFAULT 'none';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exploration_state  TEXT    NOT NULL DEFAULT 'pending';

-- Duplicate detection
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS duplicate_group_id TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS content_hash       TEXT;

-- Lifecycle
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS live_at    TIMESTAMPTZ;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;


-- ============================================================
-- SECTION 3: New columns on existing `users` table
-- ============================================================

-- interact route reads: created_at (exists), subscription_status, is_moderator
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT    NOT NULL DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_moderator        BOOLEAN NOT NULL DEFAULT FALSE;

-- Phase 1 trust/reputation fields (not yet used by routes, safe to add now)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at         TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_level           INTEGER  NOT NULL DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reputation_total       INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contribution_points_90d INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hidden_trust_score     SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trust_tier             TEXT     NOT NULL DEFAULT 'T2';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flags_count            INTEGER  NOT NULL DEFAULT 0;


-- ============================================================
-- SECTION 4: New table — question_interactions
-- ============================================================
-- Append-only event log. FKs use TEXT to match existing PKs.
-- user_id intentionally has NO FK constraint so dev 'test-user'
-- can write interactions without a matching users row.

CREATE TABLE IF NOT EXISTS public.question_interactions (
    id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    question_id      TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id          TEXT        NOT NULL,   -- no FK: allows dev 'test-user'
    interaction_type TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id       TEXT,
    flow_context     TEXT        CHECK (flow_context IS NULL
                                     OR flow_context IN ('mock','review','explore','shadow')),
    dwell_ms         INTEGER,
    metadata         JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_qi_question_id
    ON public.question_interactions(question_id);

CREATE INDEX IF NOT EXISTS idx_qi_user_id
    ON public.question_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_qi_question_user_type
    ON public.question_interactions(question_id, user_id, interaction_type);

CREATE INDEX IF NOT EXISTS idx_qi_user_flow_type_created
    ON public.question_interactions(user_id, flow_context, interaction_type, created_at);


-- ============================================================
-- SECTION 5: New table — question_scores
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_scores (
    question_id               TEXT          PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    subject                   TEXT          NOT NULL,
    chapter                   TEXT          NOT NULL,
    difficulty                TEXT          NOT NULL,
    rank_score                NUMERIC(10,4) NOT NULL DEFAULT 0,
    momentum_score            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    quality_score             NUMERIC(8,4)  NOT NULL DEFAULT 0,
    attempts_qualified        INTEGER       NOT NULL DEFAULT 0,
    exposures_total           INTEGER       NOT NULL DEFAULT 0,
    like_count                INTEGER       NOT NULL DEFAULT 0,
    save_count                INTEGER       NOT NULL DEFAULT 0,
    skip_count                INTEGER       NOT NULL DEFAULT 0,
    shallow_bounce_count      INTEGER       NOT NULL DEFAULT 0,
    report_count              INTEGER       NOT NULL DEFAULT 0,
    unique_user_count         INTEGER       NOT NULL DEFAULT 0,
    save_rate                 NUMERIC(6,4),
    like_rate                 NUMERIC(6,4),
    skip_rate                 NUMERIC(6,4),
    report_rate               NUMERIC(6,4),
    weighted_likes            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    weighted_saves            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    weighted_skips            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    weighted_reports          NUMERIC(8,4)  NOT NULL DEFAULT 0,
    is_eligible_for_discovery BOOLEAN       NOT NULL DEFAULT FALSE,
    exploration_lane          TEXT          NOT NULL DEFAULT 'none',
    last_computed_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qs_subject_chapter
    ON public.question_scores(subject, chapter);

CREATE INDEX IF NOT EXISTS idx_qs_rank_eligible
    ON public.question_scores(rank_score DESC)
    WHERE is_eligible_for_discovery = TRUE;

CREATE INDEX IF NOT EXISTS idx_qs_explore_bucket
    ON public.question_scores(subject, chapter, difficulty, exploration_lane, rank_score DESC)
    WHERE is_eligible_for_discovery = TRUE;


-- ============================================================
-- SECTION 6: New table — ai_moderation_reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_moderation_reviews (
    id                        TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    question_id               TEXT          NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at              TIMESTAMPTZ,
    tier                      TEXT,
    ai_score                  NUMERIC(5,3),
    clarity_score             NUMERIC(4,3),
    syllabus_relevance_score  NUMERIC(4,3),
    answerability_score       NUMERIC(4,3),
    explanation_quality_score NUMERIC(4,3),
    duplicate_risk_score      NUMERIC(4,3),
    difficulty_confidence     NUMERIC(4,3),
    recommended_difficulty    TEXT,
    duplicate_candidate_ids   TEXT[]        NOT NULL DEFAULT '{}',
    duplicate_reason_codes    TEXT[]        NOT NULL DEFAULT '{}',
    rule_violations           JSONB         NOT NULL DEFAULT '[]',
    llm_response              JSONB,
    model_used                TEXT,
    processing_ms             INTEGER,
    error_message             TEXT,
    retry_count               INTEGER       NOT NULL DEFAULT 0,
    is_canonical              BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_air_question
    ON public.ai_moderation_reviews(question_id);

-- At most one canonical review per question
CREATE UNIQUE INDEX IF NOT EXISTS idx_air_one_canonical_per_question
    ON public.ai_moderation_reviews(question_id)
    WHERE is_canonical = TRUE;


-- ============================================================
-- SECTION 7: New table — moderation_jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.moderation_jobs (
    id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    question_id    TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    status         TEXT        NOT NULL DEFAULT 'queued',
    priority       INTEGER     NOT NULL DEFAULT 5,
    queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    picked_up_at   TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    next_retry_at  TIMESTAMPTZ,
    retry_count    INTEGER     NOT NULL DEFAULT 0,
    max_retries    INTEGER     NOT NULL DEFAULT 3,
    error_message  TEXT,
    worker_id      TEXT
);

-- Job claim index: only queued/retrying rows
CREATE INDEX IF NOT EXISTS idx_mj_claim
    ON public.moderation_jobs(priority ASC, queued_at ASC)
    WHERE status IN ('queued','retrying');

CREATE INDEX IF NOT EXISTS idx_mj_question_id
    ON public.moderation_jobs(question_id);

CREATE INDEX IF NOT EXISTS idx_mj_retry_due
    ON public.moderation_jobs(next_retry_at)
    WHERE status = 'retrying';

-- At most one active job per question (prevents double-processing on retry)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mj_one_active_per_question
    ON public.moderation_jobs(question_id)
    WHERE status IN ('queued','processing','retrying');


-- ============================================================
-- SECTION 8: Unique index — content_hash dedup guard
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_content_hash_unique
    ON public.questions(content_hash)
    WHERE content_hash IS NOT NULL
      AND is_deleted = FALSE;


-- ============================================================
-- SECTION 9: RPC — claim_moderation_job
-- Uses TEXT ids to match the existing schema.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_moderation_job(p_worker_id TEXT)
RETURNS TABLE (
    id          TEXT,
    question_id TEXT,
    retry_count INTEGER,
    max_retries INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id TEXT;
BEGIN
    SELECT mj.id
    INTO   v_job_id
    FROM   public.moderation_jobs mj
    WHERE  (
               mj.status = 'queued'
           OR (mj.status = 'retrying' AND mj.next_retry_at <= NOW())
           )
    ORDER BY mj.priority ASC, mj.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.moderation_jobs
    SET    status       = 'processing',
           picked_up_at = NOW(),
           worker_id    = p_worker_id
    WHERE  public.moderation_jobs.id = v_job_id;

    RETURN QUERY
    SELECT mj.id, mj.question_id, mj.retry_count, mj.max_retries
    FROM   public.moderation_jobs mj
    WHERE  mj.id = v_job_id;
END;
$$;


-- ============================================================
-- SECTION 10: RPC — count_distinct_mock_sessions
-- Counts distinct completed mock sessions for a user.
-- user_id is TEXT to match question_interactions.user_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_distinct_mock_sessions(
    p_user_id TEXT,
    p_since   TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(DISTINCT session_id)::INTEGER
    FROM   public.question_interactions
    WHERE  user_id          = p_user_id
      AND  flow_context     = 'mock'
      AND  interaction_type = 'attempted'
      AND  session_id       IS NOT NULL
      AND  created_at       >= p_since;
$$;


-- ============================================================
-- SECTION 11: RPC — recover_stale_moderation_jobs
-- Resets stuck 'processing' jobs (worker crash recovery).
-- ============================================================

CREATE OR REPLACE FUNCTION public.recover_stale_moderation_jobs(
    p_stale_after_minutes INTEGER DEFAULT 2
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_recovered INTEGER;
BEGIN
    UPDATE public.moderation_jobs
    SET    status        = 'retrying',
           next_retry_at = NOW(),
           worker_id     = NULL,
           error_message = COALESCE(error_message || ' ', '')
                           || '[recovered: stale processing at ' || NOW()::TEXT || ']'
    WHERE  status       = 'processing'
      AND  picked_up_at < NOW() - (p_stale_after_minutes || ' minutes')::INTERVAL
      AND  retry_count  < max_retries;

    GET DIAGNOSTICS v_recovered = ROW_COUNT;

    UPDATE public.moderation_jobs
    SET    status        = 'failed',
           completed_at  = NOW(),
           worker_id     = NULL,
           error_message = COALESCE(error_message || ' ', '')
                           || '[failed: stale processing exhausted retries at ' || NOW()::TEXT || ']'
    WHERE  status       = 'processing'
      AND  picked_up_at < NOW() - (p_stale_after_minutes || ' minutes')::INTERVAL
      AND  retry_count  >= max_retries;

    RETURN v_recovered;
END;
$$;


-- ============================================================
-- SECTION 12: Sync trigger — keep question_scores metadata
-- in sync when questions.subject/chapter/difficulty changes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_question_scores_metadata()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.subject    IS DISTINCT FROM OLD.subject
     OR NEW.chapter    IS DISTINCT FROM OLD.chapter
     OR NEW.difficulty IS DISTINCT FROM OLD.difficulty) THEN
        UPDATE public.question_scores
        SET    subject    = NEW.subject,
               chapter    = NEW.chapter,
               difficulty = NEW.difficulty
        WHERE  question_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Drop before recreate so this is idempotent
DROP TRIGGER IF EXISTS trg_questions_sync_scores_metadata ON public.questions;

CREATE TRIGGER trg_questions_sync_scores_metadata
    AFTER UPDATE OF subject, chapter, difficulty ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_question_scores_metadata();

-- END 0010_phase1_compat.sql

-- BEGIN 0011_credits_system.sql
-- Add credit balance to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 100;
ALTER TABLE users ALTER COLUMN credit_balance SET DEFAULT 100;
UPDATE users SET credit_balance = 100 WHERE credit_balance = 0;

-- Create enum for transaction types if it doesn't exist
DO $$ BEGIN
    CREATE TYPE credit_transaction_type AS ENUM ('earn', 'spend', 'bonus');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ledger table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type credit_transaction_type NOT NULL,
    reference TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);

-- Atomic RPC for spending credits
CREATE OR REPLACE FUNCTION spend_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT credit_balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN FALSE; -- Insufficient funds
  END IF;

  -- Deduct
  UPDATE users SET credit_balance = credit_balance - p_amount WHERE id = p_user_id;

  -- Insert ledger entry
  INSERT INTO credit_transactions (user_id, amount, type, reference)
  VALUES (p_user_id, -p_amount, 'spend', p_reference);

  RETURN TRUE;
END;
$$;

-- Atomic RPC for granting credits
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_reference TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Add credits
  UPDATE users SET credit_balance = credit_balance + p_amount WHERE id = p_user_id;

  -- Insert ledger entry
  INSERT INTO credit_transactions (user_id, amount, type, reference)
  VALUES (p_user_id, p_amount, 'earn', p_reference);
END;
$$;

-- END 0011_credits_system.sql

-- BEGIN 0012_units.sql
-- ============================================================
-- MockMob migration 0012 — units table + accountancy mapping
-- ============================================================
-- Adds a units layer between subjects and chapters.
-- Only accountancy is wired in this migration; other subjects
-- follow in subsequent migrations as their syllabi are updated.
--
-- Backward compatibility:
--   chapters.unit_id is nullable — chapters without a unit still
--   appear in the flat fallback so no existing query breaks.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. units table
-- ------------------------------------------------------------
create table if not exists public.units (
  id          text primary key,
  subject_id  text not null,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (subject_id, name)
);

create index if not exists units_subject_idx on public.units (subject_id, sort_order);

alter table public.units enable row level security;

drop policy if exists units_read on public.units;
create policy units_read
  on public.units
  for select
  to anon, authenticated
  using (true);

-- ------------------------------------------------------------
-- 2. Add unit_id FK column to chapters
-- ------------------------------------------------------------
alter table public.chapters
  add column if not exists unit_id text references public.units(id);

create index if not exists chapters_unit_idx on public.chapters (unit_id);

-- ------------------------------------------------------------
-- 3. Insert accountancy units (CUET 2026)
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('accountancy__u1',  'accountancy', 'Accounting for Partnership',         0),
  ('accountancy__u2',  'accountancy', 'Reconstitution of Partnership Firm', 1),
  ('accountancy__u3',  'accountancy', 'Dissolution of Partnership Firm',    2),
  ('accountancy__u4',  'accountancy', 'Company Accounts',                   3),
  ('accountancy__u5',  'accountancy', 'Analysis of Financial Statements',   4),
  ('accountancy__u5b', 'accountancy', 'Computerised Accounting System',     5)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 4. Insert new accountancy chapters that were missing from 0004
-- ------------------------------------------------------------
insert into public.chapters (id, subject_id, name, sort_order) values
  ('accountancy__profit_loss_appropriation',      'accountancy', 'Profit & Loss Appropriation Account',  1),
  ('accountancy__goodwill_valuation',             'accountancy', 'Goodwill Valuation',                   4),
  ('accountancy__dissolution_of_partnership_firm','accountancy', 'Dissolution of Partnership Firm',      5),
  ('accountancy__comparative_common_size',        'accountancy', 'Comparative & Common Size Statements', 8),
  ('accountancy__accounting_ratios',              'accountancy', 'Accounting Ratios',                    9),
  ('accountancy__computerised_accounting_system', 'accountancy', 'Computerised Accounting System',       11)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 5. Map all accountancy chapters to their units
-- ------------------------------------------------------------

-- Unit I — Accounting for Partnership
update public.chapters set unit_id = 'accountancy__u1'
where subject_id = 'accountancy' and name in (
  'Partnership Fundamentals',
  'Profit & Loss Appropriation Account'
);

-- Unit II — Reconstitution of Partnership Firm
update public.chapters set unit_id = 'accountancy__u2'
where subject_id = 'accountancy' and name in (
  'Change in Profit Sharing Ratio',
  'Goodwill Valuation',
  'Admission of Partner',
  'Retirement & Death of Partner'
);

-- Unit III — Dissolution of Partnership Firm
update public.chapters set unit_id = 'accountancy__u3'
where subject_id = 'accountancy' and name in (
  'Dissolution of Partnership',
  'Dissolution of Partnership Firm'
);

-- Unit IV — Company Accounts
update public.chapters set unit_id = 'accountancy__u4'
where subject_id = 'accountancy' and name in (
  'Share Capital',
  'Debentures'
);

-- Unit V — Analysis of Financial Statements
update public.chapters set unit_id = 'accountancy__u5'
where subject_id = 'accountancy' and name in (
  'Financial Statements of Company',
  'Comparative & Common Size Statements',
  'Accounting Ratios',
  'Analysis of Financial Statements',
  'Cash Flow Statement'
);

-- Unit V (optional) — Computerised Accounting System
update public.chapters set unit_id = 'accountancy__u5b'
where subject_id = 'accountancy' and name in (
  'Computerised Accounting System',
  'Computerized Accounting System'
);

-- ------------------------------------------------------------
-- 6. Fix spelling in questions table (122 rows)
--    "Computerized" → "Computerised" to match chapters table
-- ------------------------------------------------------------
update public.questions
  set chapter = 'Computerised Accounting System'
where subject = 'accountancy'
  and chapter = 'Computerized Accounting System';

commit;

-- END 0012_units.sql

-- BEGIN 0013_dedup_chapters.sql
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

-- END 0013_dedup_chapters.sql

-- BEGIN 0014_units_business_studies.sql
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

-- END 0014_units_business_studies.sql

-- BEGIN 0015_units_economics.sql
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

-- END 0015_units_economics.sql

-- BEGIN 0016_units_english.sql
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

-- END 0016_units_english.sql

-- BEGIN 0017_units_mathematics.sql
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

-- END 0017_units_mathematics.sql

-- BEGIN 0018_units_physics.sql
-- ============================================================
-- MockMob migration 0018 — units layer for Physics
-- CUET 2026 syllabus (subject code 322)
-- ============================================================
-- CUET structure: 9 units (exact wording from PDF)
--
-- Gap analysis vs existing 15 chapters:
--   MATCH  (13): Electric Charges & Fields, Electrostatic Potential &
--                Capacitance, Current Electricity, Moving Charges &
--                Magnetism, Magnetism & Matter, Electromagnetic Induction,
--                Alternating Current, Electromagnetic Waves,
--                Ray Optics & Optical Instruments, Wave Optics,
--                Dual Nature of Radiation & Matter, Atoms, Nuclei
--   RENAME (1):  "Semiconductor Electronics" → "Electronic Devices"
--                (CUET Unit 9 name)
--   INVALID(1):  "Communication Systems" — removed from CUET 2026
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('physics__u1', 'physics', 'Electrostatics',                                 0),
  ('physics__u2', 'physics', 'Current Electricity',                            1),
  ('physics__u3', 'physics', 'Magnetic Effects of Current and Magnetism',      2),
  ('physics__u4', 'physics', 'Electromagnetic Induction and Alternating Currents', 3),
  ('physics__u5', 'physics', 'Electromagnetic Waves',                          4),
  ('physics__u6', 'physics', 'Optics',                                         5),
  ('physics__u7', 'physics', 'Dual Nature of Matter and Radiation',            6),
  ('physics__u8', 'physics', 'Atoms and Nuclei',                               7),
  ('physics__u9', 'physics', 'Electronic Devices',                             8)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Rename: "Semiconductor Electronics" → "Electronic Devices"
-- ------------------------------------------------------------
update public.chapters
  set name = 'Electronic Devices'
where id = 'physics__semiconductor_electronics';

update public.questions
  set chapter = 'Electronic Devices'
where subject = 'physics'
  and chapter = 'Semiconductor Electronics';

-- ------------------------------------------------------------
-- 3. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Electrostatics
update public.chapters set unit_id = 'physics__u1'
where subject_id = 'physics'
  and name in ('Electric Charges & Fields', 'Electrostatic Potential & Capacitance');

-- Unit 2 — Current Electricity
update public.chapters set unit_id = 'physics__u2'
where subject_id = 'physics'
  and name = 'Current Electricity';

-- Unit 3 — Magnetic Effects of Current and Magnetism
update public.chapters set unit_id = 'physics__u3'
where subject_id = 'physics'
  and name in ('Moving Charges & Magnetism', 'Magnetism & Matter');

-- Unit 4 — Electromagnetic Induction and Alternating Currents
update public.chapters set unit_id = 'physics__u4'
where subject_id = 'physics'
  and name in ('Electromagnetic Induction', 'Alternating Current');

-- Unit 5 — Electromagnetic Waves
update public.chapters set unit_id = 'physics__u5'
where subject_id = 'physics'
  and name = 'Electromagnetic Waves';

-- Unit 6 — Optics
update public.chapters set unit_id = 'physics__u6'
where subject_id = 'physics'
  and name in ('Ray Optics & Optical Instruments', 'Wave Optics');

-- Unit 7 — Dual Nature of Matter and Radiation
update public.chapters set unit_id = 'physics__u7'
where subject_id = 'physics'
  and name = 'Dual Nature of Radiation & Matter';

-- Unit 8 — Atoms and Nuclei
update public.chapters set unit_id = 'physics__u8'
where subject_id = 'physics'
  and name in ('Atoms', 'Nuclei');

-- Unit 9 — Electronic Devices
update public.chapters set unit_id = 'physics__u9'
where subject_id = 'physics'
  and name = 'Electronic Devices';

-- "Communication Systems" left without unit_id
-- (not present in CUET 2026 Physics syllabus)

commit;

-- END 0018_units_physics.sql

-- BEGIN 0019_units_chemistry.sql
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

-- END 0019_units_chemistry.sql

-- BEGIN 0020_units_biology.sql
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

-- END 0020_units_biology.sql

-- BEGIN 0021_units_political_science.sql
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

-- END 0021_units_political_science.sql

-- BEGIN 0022_units_psychology.sql
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

-- END 0022_units_psychology.sql

-- BEGIN 0023_units_general_test.sql
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

-- END 0023_units_general_test.sql

-- BEGIN 0024_autonomous_gen.sql
-- Autonomous Question Generation Schema Updates

-- 1. Generation Jobs Table
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id     TEXT        NOT NULL,
    chapter        TEXT        NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    priority       INTEGER     NOT NULL DEFAULT 5,        -- 1 (highest) to 10
    target_count   INTEGER     NOT NULL DEFAULT 20,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    error_message  TEXT
);

-- 2. Generation Stats Table (for Feedback Loop)
CREATE TABLE IF NOT EXISTS public.generation_stats (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id         TEXT        NOT NULL,
    subject_id     TEXT        NOT NULL,
    chapter        TEXT        NOT NULL,
    total_attempted INTEGER    NOT NULL DEFAULT 0,
    accepted_count  INTEGER    NOT NULL DEFAULT 0,
    rejected_count  INTEGER    NOT NULL DEFAULT 0,
    duplicate_count INTEGER    NOT NULL DEFAULT 0,
    avg_score       NUMERIC(4,2),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Concept Tracking Table (Optional but requested)
CREATE TABLE IF NOT EXISTS public.question_concepts (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    subject_id     TEXT        NOT NULL,
    chapter        TEXT        NOT NULL,
    concept_pattern TEXT       NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_gen_jobs_status ON public.generation_jobs(status, priority);
CREATE INDEX IF NOT EXISTS idx_question_concepts_lookup ON public.question_concepts(subject_id, chapter, concept_pattern);

-- END 0024_autonomous_gen.sql

-- BEGIN 0025_phase1_votes_credits.sql
-- Phase 1 quality engine: server-backed voting and anti-farming credits.

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TYPE public.quality_band_enum ADD VALUE IF NOT EXISTS 'low_quality';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_score_live
  ON public.questions(subject, chapter, score DESC)
  WHERE is_deleted = FALSE;

DO $$ BEGIN
  CREATE TYPE public.question_vote_type AS ENUM ('up', 'down');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.question_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  vote_type public.question_vote_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_votes_user_question_unique UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_votes_question ON public.question_votes(question_id);

CREATE TABLE IF NOT EXISTS public.user_question_answer_credits (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answered_credit_granted BOOLEAN NOT NULL DEFAULT FALSE,
  correct_credit_granted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.user_daily_login_credits (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, login_date)
);

CREATE OR REPLACE FUNCTION public.apply_question_vote(
  p_user_id TEXT,
  p_question_id TEXT,
  p_vote_type public.question_vote_type DEFAULT NULL
) RETURNS TABLE (
  question_id TEXT,
  upvotes INTEGER,
  downvotes INTEGER,
  score INTEGER,
  user_vote TEXT,
  credit_balance INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.question_vote_type;
  v_up_delta INTEGER := 0;
  v_down_delta INTEGER := 0;
  v_quality_band TEXT;
  v_credit_reference TEXT;
  v_credits_added BOOLEAN := FALSE;
  v_final_vote TEXT := NULL;
BEGIN
  IF p_user_id IS NULL OR p_question_id IS NULL THEN
    RAISE EXCEPTION 'user_id and question_id are required';
  END IF;

  PERFORM 1 FROM public.questions
    WHERE id = p_question_id AND COALESCE(is_deleted, FALSE) = FALSE
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found';
  END IF;

  SELECT vote_type INTO v_existing
  FROM public.question_votes
  WHERE user_id = p_user_id AND question_id = p_question_id
  FOR UPDATE;

  IF p_vote_type IS NULL THEN
    IF v_existing = 'up' THEN
      v_up_delta := -1;
    ELSIF v_existing = 'down' THEN
      v_down_delta := -1;
    END IF;

    IF v_existing IS NOT NULL THEN
      DELETE FROM public.question_votes
      WHERE user_id = p_user_id AND question_id = p_question_id;
    END IF;
  ELSIF v_existing IS NULL THEN
    INSERT INTO public.question_votes (user_id, question_id, vote_type)
    VALUES (p_user_id, p_question_id, p_vote_type);
    IF p_vote_type = 'up' THEN v_up_delta := 1; ELSE v_down_delta := 1; END IF;
    v_credits_added := FALSE;
    v_final_vote := p_vote_type::TEXT;
  ELSIF v_existing <> p_vote_type THEN
    UPDATE public.question_votes
      SET vote_type = p_vote_type, updated_at = NOW()
      WHERE user_id = p_user_id AND question_id = p_question_id;
    IF p_vote_type = 'up' THEN
      v_up_delta := 1;
      v_down_delta := -1;
    ELSE
      v_up_delta := -1;
      v_down_delta := 1;
    END IF;
    v_final_vote := p_vote_type::TEXT;
  ELSE
    v_final_vote := p_vote_type::TEXT;
  END IF;

  UPDATE public.questions
  SET
    upvotes = GREATEST(0, upvotes + v_up_delta),
    downvotes = GREATEST(0, downvotes + v_down_delta),
    score = GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta),
    quality_band = CASE
      WHEN (GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta)) < -3 THEN 'low_quality'
      WHEN quality_band = 'low_quality' AND (GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta)) >= -3 THEN 'unrated'
      ELSE quality_band
    END,
    exploration_state = CASE
      WHEN (GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta)) < -3 THEN 'frozen'
      ELSE exploration_state
    END,
    updated_at = NOW()
  WHERE id = p_question_id;

  IF v_credits_added THEN
    v_credit_reference := 'vote:' || p_question_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, reference)
    VALUES (p_user_id, 2, 'earn', v_credit_reference);
    UPDATE public.users SET credit_balance = credit_balance + 2 WHERE id = p_user_id;
  END IF;

  SELECT q.quality_band INTO v_quality_band FROM public.questions q WHERE q.id = p_question_id;
  IF v_quality_band = 'low_quality' THEN
    RAISE LOG 'Question % flagged low_quality via votes', p_question_id;
  END IF;
  RAISE LOG 'Vote applied question=% user=% vote=%', p_question_id, p_user_id, v_final_vote;

  RETURN QUERY
  SELECT q.id, q.upvotes, q.downvotes, q.score, v_final_vote, u.credit_balance
  FROM public.questions q
  JOIN public.users u ON u.id = p_user_id
  WHERE q.id = p_question_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_daily_login_credits(
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  RETURN FALSE;

  INSERT INTO public.user_daily_login_credits (user_id, login_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE public.users SET credit_balance = credit_balance + 10 WHERE id = p_user_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, reference)
    VALUES (p_user_id, 10, 'bonus', 'daily_login:' || CURRENT_DATE::TEXT);
    RAISE LOG 'Daily login credits granted user=% amount=10', p_user_id;
  END IF;

  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_attempt_answer_credits(
  p_user_id TEXT,
  p_attempt_id TEXT,
  p_details JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_detail JSONB;
  v_qid TEXT;
  v_is_correct BOOLEAN;
  v_amount INTEGER := 0;
  v_added INTEGER := 0;
  v_existing public.user_question_answer_credits%ROWTYPE;
BEGIN
  RETURN 0;

  IF p_user_id IS NULL OR p_attempt_id IS NULL OR jsonb_typeof(p_details) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_detail IN SELECT * FROM jsonb_array_elements(p_details)
  LOOP
    v_qid := v_detail->>'qid';
    IF v_qid IS NULL OR (v_detail ? 'givenIndex') IS FALSE OR v_detail->>'givenIndex' IS NULL THEN
      CONTINUE;
    END IF;

    v_is_correct := COALESCE((v_detail->>'isCorrect')::BOOLEAN, FALSE);

    IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = v_qid) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.user_question_answer_credits (user_id, question_id)
    VALUES (p_user_id, v_qid)
    ON CONFLICT (user_id, question_id) DO NOTHING;

    SELECT * INTO v_existing
    FROM public.user_question_answer_credits
    WHERE user_id = p_user_id AND question_id = v_qid
    FOR UPDATE;

    v_amount := 0;
    IF NOT v_existing.answered_credit_granted THEN
      v_amount := v_amount + 1;
      UPDATE public.user_question_answer_credits
        SET answered_credit_granted = TRUE, updated_at = NOW()
        WHERE user_id = p_user_id AND question_id = v_qid;
    END IF;

    IF v_is_correct AND NOT v_existing.correct_credit_granted THEN
      v_amount := v_amount + 2;
      UPDATE public.user_question_answer_credits
        SET correct_credit_granted = TRUE, updated_at = NOW()
        WHERE user_id = p_user_id AND question_id = v_qid;
    END IF;

    IF v_amount > 0 THEN
      v_added := v_added + v_amount;
      INSERT INTO public.credit_transactions (user_id, amount, type, reference)
      VALUES (p_user_id, v_amount, 'earn', 'attempt:' || p_attempt_id || ':question:' || v_qid);
    END IF;
  END LOOP;

  IF v_added > 0 THEN
    UPDATE public.users SET credit_balance = credit_balance + v_added WHERE id = p_user_id;
    RAISE LOG 'Attempt credits granted user=% attempt=% amount=%', p_user_id, p_attempt_id, v_added;
  END IF;

  RETURN v_added;
END;
$$;

-- END 0025_phase1_votes_credits.sql

-- BEGIN 0026_cuet_2026_canonical_syllabus.sql
-- ============================================================
-- MockMob migration 0026 - CUET 2026 canonical syllabus map
-- Generated from data/canonical_syllabus.js.
-- Minimal-disruption policy: upsert + map only; no table drops, no deletes.
-- ============================================================

begin;

create table if not exists public.units (
  id text primary key,
  subject_id text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

alter table public.units enable row level security;

drop policy if exists units_read on public.units;
create policy units_read on public.units for select to anon, authenticated using (true);

alter table public.chapters add column if not exists unit_id text references public.units(id);

create index if not exists units_subject_idx on public.units (subject_id, sort_order);
create index if not exists chapters_unit_idx on public.chapters (unit_id);

-- Light spelling normalization allowed by the CUET 2026 mapping task.
update public.questions
  set chapter = 'Computerized Accounting System'
where subject = 'accountancy'
  and chapter = 'Computerised Accounting System';

update public.chapters
  set unit_id = null
where subject_id = 'accountancy'
  and name = 'Computerised Accounting System';

insert into public.units (id, name, subject_id, sort_order) values
  ('english__u1', 'Reading Comprehension', 'english', 0),
  ('english__u2', 'Verbal Ability', 'english', 1),
  ('english__u3', 'Existing Language Coverage', 'english', 2),
  ('hindi__u1', 'Reading Comprehension', 'hindi', 0),
  ('hindi__u2', 'Verbal Ability', 'hindi', 1),
  ('hindi__u3', 'Existing Language Coverage', 'hindi', 2),
  ('assamese__u1', 'Reading Comprehension', 'assamese', 0),
  ('assamese__u2', 'Verbal Ability', 'assamese', 1),
  ('assamese__u3', 'Existing Language Coverage', 'assamese', 2),
  ('bengali__u1', 'Reading Comprehension', 'bengali', 0),
  ('bengali__u2', 'Verbal Ability', 'bengali', 1),
  ('bengali__u3', 'Existing Language Coverage', 'bengali', 2),
  ('gujarati__u1', 'Reading Comprehension', 'gujarati', 0),
  ('gujarati__u2', 'Verbal Ability', 'gujarati', 1),
  ('gujarati__u3', 'Existing Language Coverage', 'gujarati', 2),
  ('kannada__u1', 'Reading Comprehension', 'kannada', 0),
  ('kannada__u2', 'Verbal Ability', 'kannada', 1),
  ('kannada__u3', 'Existing Language Coverage', 'kannada', 2),
  ('malayalam__u1', 'Reading Comprehension', 'malayalam', 0),
  ('malayalam__u2', 'Verbal Ability', 'malayalam', 1),
  ('malayalam__u3', 'Existing Language Coverage', 'malayalam', 2),
  ('marathi__u1', 'Reading Comprehension', 'marathi', 0),
  ('marathi__u2', 'Verbal Ability', 'marathi', 1),
  ('marathi__u3', 'Existing Language Coverage', 'marathi', 2),
  ('odia__u1', 'Reading Comprehension', 'odia', 0),
  ('odia__u2', 'Verbal Ability', 'odia', 1),
  ('odia__u3', 'Existing Language Coverage', 'odia', 2),
  ('punjabi__u1', 'Reading Comprehension', 'punjabi', 0),
  ('punjabi__u2', 'Verbal Ability', 'punjabi', 1),
  ('punjabi__u3', 'Existing Language Coverage', 'punjabi', 2),
  ('tamil__u1', 'Reading Comprehension', 'tamil', 0),
  ('tamil__u2', 'Verbal Ability', 'tamil', 1),
  ('tamil__u3', 'Existing Language Coverage', 'tamil', 2),
  ('telugu__u1', 'Reading Comprehension', 'telugu', 0),
  ('telugu__u2', 'Verbal Ability', 'telugu', 1),
  ('telugu__u3', 'Existing Language Coverage', 'telugu', 2),
  ('urdu__u1', 'Reading Comprehension', 'urdu', 0),
  ('urdu__u2', 'Verbal Ability', 'urdu', 1),
  ('urdu__u3', 'Existing Language Coverage', 'urdu', 2),
  ('accountancy__u1', 'Accounting for Partnership', 'accountancy', 0),
  ('accountancy__u2', 'Reconstitution of a Partnership firm', 'accountancy', 1),
  ('accountancy__u3', 'Dissolution of Partnership Firm', 'accountancy', 2),
  ('accountancy__u4', 'Company Accounts: Accounting for Share and Debenture Capital', 'accountancy', 3),
  ('accountancy__u5', 'Analysis of Financial Statements', 'accountancy', 4),
  ('accountancy__u6', 'Computerized Accounting System', 'accountancy', 5),
  ('agriculture__u1', 'Agrometeorology, Genetics and Plant Breeding, Biochemistry and Microbiology', 'agriculture', 0),
  ('agriculture__u2', 'Livestock Production', 'agriculture', 1),
  ('agriculture__u3', 'Crop Production', 'agriculture', 2),
  ('agriculture__u4', 'Horticulture', 'agriculture', 3),
  ('agriculture__u5', 'Existing Agriculture Coverage', 'agriculture', 4),
  ('anthropology__u1', 'Physical/Biological Anthropology', 'anthropology', 0),
  ('anthropology__u2', 'Archaeological Anthropology', 'anthropology', 1),
  ('anthropology__u3', 'Socio-Cultural Anthropology', 'anthropology', 2),
  ('anthropology__u4', 'Linguistic and Tribal Anthropology', 'anthropology', 3),
  ('anthropology__u5', 'Social Change and Applied Anthropology', 'anthropology', 4),
  ('biology__u1', 'Reproduction', 'biology', 0),
  ('biology__u2', 'Genetics and Evolution', 'biology', 1),
  ('biology__u3', 'Biology and Human Welfare', 'biology', 2),
  ('biology__u4', 'Biotechnology and its Applications', 'biology', 3),
  ('biology__u5', 'Ecology and Environment', 'biology', 4),
  ('business_studies__u1', 'Nature and Significance of Management', 'business_studies', 0),
  ('business_studies__u2', 'Principles of Management', 'business_studies', 1),
  ('business_studies__u3', 'Business Environment', 'business_studies', 2),
  ('business_studies__u4', 'Planning', 'business_studies', 3),
  ('business_studies__u5', 'Organising', 'business_studies', 4),
  ('business_studies__u6', 'Staffing', 'business_studies', 5),
  ('business_studies__u7', 'Directing', 'business_studies', 6),
  ('business_studies__u8', 'Controlling', 'business_studies', 7),
  ('business_studies__u9', 'Business Finance', 'business_studies', 8),
  ('business_studies__u10', 'Financial Markets', 'business_studies', 9),
  ('business_studies__u11', 'Marketing', 'business_studies', 10),
  ('business_studies__u12', 'Consumer Protection', 'business_studies', 11),
  ('business_studies__u13', 'Existing Business Studies Coverage', 'business_studies', 12),
  ('chemistry__u1', 'Solutions', 'chemistry', 0),
  ('chemistry__u2', 'Electrochemistry', 'chemistry', 1),
  ('chemistry__u3', 'Chemical Kinetics', 'chemistry', 2),
  ('chemistry__u4', 'd and f Block Elements', 'chemistry', 3),
  ('chemistry__u5', 'Coordination Compounds', 'chemistry', 4),
  ('chemistry__u6', 'Haloalkanes and Haloarenes', 'chemistry', 5),
  ('chemistry__u7', 'Alcohols, Phenols and Ethers', 'chemistry', 6),
  ('chemistry__u8', 'Aldehydes, Ketones and Carboxylic Acids', 'chemistry', 7),
  ('chemistry__u9', 'Amines', 'chemistry', 8),
  ('chemistry__u10', 'Biomolecules', 'chemistry', 9),
  ('chemistry__u11', 'Existing Chemistry Coverage', 'chemistry', 10),
  ('computer_science__u1', 'Section A: Database and Networks', 'computer_science', 0),
  ('computer_science__u2', 'Section B1: Computer Science', 'computer_science', 1),
  ('computer_science__u3', 'Section B2: Informatics Practices', 'computer_science', 2),
  ('economics__u1', 'Introductory Microeconomics', 'economics', 0),
  ('economics__u2', 'Introductory Macroeconomics', 'economics', 1),
  ('economics__u3', 'Indian Economic Development', 'economics', 2),
  ('engineering_graphics__u1', 'Existing Engineering Graphics Coverage', 'engineering_graphics', 0),
  ('entrepreneurship__u1', 'Existing Entrepreneurship Coverage', 'entrepreneurship', 0),
  ('environmental_studies__u1', 'CUET 2026 Environmental Science Topics', 'environmental_studies', 0),
  ('environmental_studies__u2', 'Existing Environmental Studies Coverage', 'environmental_studies', 1),
  ('fine_arts__u1', 'The Rajasthani and Pahari Schools of Miniature Painting', 'fine_arts', 0),
  ('fine_arts__u2', 'The Mughal and Deccan Schools of Miniature Painting', 'fine_arts', 1),
  ('fine_arts__u3', 'The Bengal School and Cultural Nationalism', 'fine_arts', 2),
  ('fine_arts__u4', 'The Modern Trends in Indian Art', 'fine_arts', 3),
  ('geography__u1', 'Human Geography - Nature and Scope', 'geography', 0),
  ('geography__u2', 'People', 'geography', 1),
  ('geography__u3', 'Human Activities', 'geography', 2),
  ('geography__u4', 'Transport, Communication and Trade', 'geography', 3),
  ('geography__u5', 'Human Settlements', 'geography', 4),
  ('geography__u6', 'Resources and Development', 'geography', 5),
  ('geography__u7', 'Geographical Perspective on Selected Issues and Problems', 'geography', 6),
  ('history__u1', 'Themes in Indian History Part I', 'history', 0),
  ('history__u2', 'Themes in Indian History Part II', 'history', 1),
  ('history__u3', 'Themes in Indian History Part III', 'history', 2),
  ('home_science__u1', 'Work, livelihood and career', 'home_science', 0),
  ('home_science__u2', 'Nutrition, Food Science and Technology', 'home_science', 1),
  ('home_science__u3', 'Human Development and Family Studies', 'home_science', 2),
  ('home_science__u4', 'Fabric and Apparel', 'home_science', 3),
  ('home_science__u5', 'Resource Management', 'home_science', 4),
  ('home_science__u6', 'Communication and Extension', 'home_science', 5),
  ('knowledge_tradition_india__u1', 'CUET 2026 Knowledge Traditions Topics', 'knowledge_tradition_india', 0),
  ('knowledge_tradition_india__u2', 'Existing Knowledge Traditions Coverage', 'knowledge_tradition_india', 1),
  ('legal_studies__u1', 'Existing Legal Studies Coverage', 'legal_studies', 0),
  ('mass_media__u1', 'CUET 2026 Mass Media Topics', 'mass_media', 0),
  ('mass_media__u2', 'Existing Mass Media Coverage', 'mass_media', 1),
  ('mathematics__u1', 'Relations and Functions', 'mathematics', 0),
  ('mathematics__u2', 'Algebra', 'mathematics', 1),
  ('mathematics__u3', 'Calculus', 'mathematics', 2),
  ('mathematics__u4', 'Vectors and Three-Dimensional Geometry', 'mathematics', 3),
  ('mathematics__u5', 'Linear Programming', 'mathematics', 4),
  ('mathematics__u6', 'Probability', 'mathematics', 5),
  ('mathematics__u7', 'Applied Mathematics', 'mathematics', 6),
  ('performing_arts__u1', 'Music', 'performing_arts', 0),
  ('performing_arts__u2', 'Dance', 'performing_arts', 1),
  ('performing_arts__u3', 'Theatre', 'performing_arts', 2),
  ('performing_arts__u4', 'Existing Performing Arts Coverage', 'performing_arts', 3),
  ('physical_education__u1', 'Health Status and Programmes in India', 'physical_education', 0),
  ('physical_education__u2', 'Existing Physical Education Coverage', 'physical_education', 1),
  ('physics__u1', 'Electrostatics', 'physics', 0),
  ('physics__u2', 'Current Electricity', 'physics', 1),
  ('physics__u3', 'Magnetic Effects of Current and Magnetism', 'physics', 2),
  ('physics__u4', 'Electromagnetic Induction and Alternating Currents', 'physics', 3),
  ('physics__u5', 'Electromagnetic Waves', 'physics', 4),
  ('physics__u6', 'Optics', 'physics', 5),
  ('physics__u7', 'Dual Nature of Matter and Radiation', 'physics', 6),
  ('physics__u8', 'Atoms and Nuclei', 'physics', 7),
  ('physics__u9', 'Electronic Devices', 'physics', 8),
  ('physics__u10', 'Existing Physics Coverage', 'physics', 9),
  ('political_science__u1', 'Politics in India Since Independence', 'political_science', 0),
  ('political_science__u2', 'Contemporary World Politics', 'political_science', 1),
  ('psychology__u1', 'Variations in Psychological Attributes', 'psychology', 0),
  ('psychology__u2', 'Self and Personality', 'psychology', 1),
  ('psychology__u3', 'Meeting Life Challenges', 'psychology', 2),
  ('psychology__u4', 'Psychological Disorders', 'psychology', 3),
  ('psychology__u5', 'Therapeutic Approaches', 'psychology', 4),
  ('psychology__u6', 'Attitude and Social Cognition', 'psychology', 5),
  ('psychology__u7', 'Social Influence and Group Processes', 'psychology', 6),
  ('psychology__u8', 'Existing Psychology Coverage', 'psychology', 7),
  ('sanskrit__u1', 'Sanskrit Grammar and Language', 'sanskrit', 0),
  ('sanskrit__u2', 'Sanskrit Literature', 'sanskrit', 1),
  ('sociology__u1', 'Indian Society', 'sociology', 0),
  ('sociology__u2', 'Social Change and Development in India', 'sociology', 1),
  ('teaching_aptitude__u1', 'Existing Teaching Aptitude Coverage', 'teaching_aptitude', 0),
  ('gat__u1', 'General Knowledge and Current Affairs', 'gat', 0),
  ('gat__u2', 'General Mental Ability', 'gat', 1),
  ('gat__u3', 'Numerical Ability', 'gat', 2),
  ('gat__u4', 'Quantitative Reasoning', 'gat', 3),
  ('gat__u5', 'Logical and Analytical Reasoning', 'gat', 4),
  ('gat__u6', 'General Science and Environment Literacy', 'gat', 5)
on conflict (id) do update set
  name = excluded.name,
  subject_id = excluded.subject_id,
  sort_order = excluded.sort_order;

-- Merge existing rows that already have the same (subject_id, name)
-- but a non-canonical id, before inserting by canonical id.
update public.chapters as c
set
  id = new_data.id,
  unit_id = new_data.unit_id,
  sort_order = new_data.sort_order
from (values
  ('english__reading_comprehension', 'english', 'Reading Comprehension', 'english__u1', 0),
  ('english__grammar_usage', 'english', 'Grammar & Usage', 'english__u2', 100),
  ('english__vocabulary', 'english', 'Vocabulary', 'english__u2', 101),
  ('english__figures_of_speech', 'english', 'Figures of Speech', 'english__u2', 102),
  ('english__literature_prose', 'english', 'Literature — Prose', 'english__u3', 200),
  ('english__literature_poetry', 'english', 'Literature — Poetry', 'english__u3', 201),
  ('english__note_making', 'english', 'Note Making', 'english__u3', 202),
  ('english__composition', 'english', 'Composition', 'english__u3', 203),
  ('hindi__apathit_gadyansh', 'hindi', 'Apathit Gadyansh', 'hindi__u1', 0),
  ('hindi__apathit_padyansh', 'hindi', 'Apathit Padyansh', 'hindi__u1', 1),
  ('hindi__vyakaran', 'hindi', 'Vyakaran', 'hindi__u2', 100),
  ('hindi__anuvad', 'hindi', 'Anuvad', 'hindi__u2', 101),
  ('hindi__kavya_khand', 'hindi', 'Kavya Khand', 'hindi__u3', 200),
  ('hindi__gadya_khand', 'hindi', 'Gadya Khand', 'hindi__u3', 201),
  ('hindi__rachnatmak_lekhan', 'hindi', 'Rachnatmak Lekhan', 'hindi__u3', 202),
  ('assamese__reading_comprehension', 'assamese', 'Reading Comprehension', 'assamese__u1', 0),
  ('assamese__grammar', 'assamese', 'Grammar', 'assamese__u2', 100),
  ('assamese__vocabulary', 'assamese', 'Vocabulary', 'assamese__u2', 101),
  ('assamese__literature_prose', 'assamese', 'Literature — Prose', 'assamese__u3', 200),
  ('assamese__literature_poetry', 'assamese', 'Literature — Poetry', 'assamese__u3', 201),
  ('assamese__composition', 'assamese', 'Composition', 'assamese__u3', 202),
  ('bengali__reading_comprehension', 'bengali', 'Reading Comprehension', 'bengali__u1', 0),
  ('bengali__grammar', 'bengali', 'Grammar', 'bengali__u2', 100),
  ('bengali__vocabulary', 'bengali', 'Vocabulary', 'bengali__u2', 101),
  ('bengali__literature_prose', 'bengali', 'Literature — Prose', 'bengali__u3', 200),
  ('bengali__literature_poetry', 'bengali', 'Literature — Poetry', 'bengali__u3', 201),
  ('bengali__composition', 'bengali', 'Composition', 'bengali__u3', 202),
  ('gujarati__reading_comprehension', 'gujarati', 'Reading Comprehension', 'gujarati__u1', 0),
  ('gujarati__grammar', 'gujarati', 'Grammar', 'gujarati__u2', 100),
  ('gujarati__vocabulary', 'gujarati', 'Vocabulary', 'gujarati__u2', 101),
  ('gujarati__literature_prose', 'gujarati', 'Literature — Prose', 'gujarati__u3', 200),
  ('gujarati__literature_poetry', 'gujarati', 'Literature — Poetry', 'gujarati__u3', 201),
  ('gujarati__composition', 'gujarati', 'Composition', 'gujarati__u3', 202),
  ('kannada__reading_comprehension', 'kannada', 'Reading Comprehension', 'kannada__u1', 0),
  ('kannada__grammar', 'kannada', 'Grammar', 'kannada__u2', 100),
  ('kannada__vocabulary', 'kannada', 'Vocabulary', 'kannada__u2', 101),
  ('kannada__literature_prose', 'kannada', 'Literature — Prose', 'kannada__u3', 200),
  ('kannada__literature_poetry', 'kannada', 'Literature — Poetry', 'kannada__u3', 201),
  ('kannada__composition', 'kannada', 'Composition', 'kannada__u3', 202),
  ('malayalam__reading_comprehension', 'malayalam', 'Reading Comprehension', 'malayalam__u1', 0),
  ('malayalam__grammar', 'malayalam', 'Grammar', 'malayalam__u2', 100),
  ('malayalam__vocabulary', 'malayalam', 'Vocabulary', 'malayalam__u2', 101),
  ('malayalam__literature_prose', 'malayalam', 'Literature — Prose', 'malayalam__u3', 200),
  ('malayalam__literature_poetry', 'malayalam', 'Literature — Poetry', 'malayalam__u3', 201),
  ('malayalam__composition', 'malayalam', 'Composition', 'malayalam__u3', 202),
  ('marathi__reading_comprehension', 'marathi', 'Reading Comprehension', 'marathi__u1', 0),
  ('marathi__grammar', 'marathi', 'Grammar', 'marathi__u2', 100),
  ('marathi__vocabulary', 'marathi', 'Vocabulary', 'marathi__u2', 101),
  ('marathi__literature_prose', 'marathi', 'Literature — Prose', 'marathi__u3', 200),
  ('marathi__literature_poetry', 'marathi', 'Literature — Poetry', 'marathi__u3', 201),
  ('marathi__composition', 'marathi', 'Composition', 'marathi__u3', 202),
  ('odia__reading_comprehension', 'odia', 'Reading Comprehension', 'odia__u1', 0),
  ('odia__grammar', 'odia', 'Grammar', 'odia__u2', 100),
  ('odia__vocabulary', 'odia', 'Vocabulary', 'odia__u2', 101),
  ('odia__literature_prose', 'odia', 'Literature — Prose', 'odia__u3', 200),
  ('odia__literature_poetry', 'odia', 'Literature — Poetry', 'odia__u3', 201),
  ('odia__composition', 'odia', 'Composition', 'odia__u3', 202),
  ('punjabi__reading_comprehension', 'punjabi', 'Reading Comprehension', 'punjabi__u1', 0),
  ('punjabi__grammar', 'punjabi', 'Grammar', 'punjabi__u2', 100),
  ('punjabi__vocabulary', 'punjabi', 'Vocabulary', 'punjabi__u2', 101),
  ('punjabi__literature_prose', 'punjabi', 'Literature — Prose', 'punjabi__u3', 200),
  ('punjabi__literature_poetry', 'punjabi', 'Literature — Poetry', 'punjabi__u3', 201),
  ('punjabi__composition', 'punjabi', 'Composition', 'punjabi__u3', 202),
  ('tamil__reading_comprehension', 'tamil', 'Reading Comprehension', 'tamil__u1', 0),
  ('tamil__grammar', 'tamil', 'Grammar', 'tamil__u2', 100),
  ('tamil__vocabulary', 'tamil', 'Vocabulary', 'tamil__u2', 101),
  ('tamil__literature_prose', 'tamil', 'Literature — Prose', 'tamil__u3', 200),
  ('tamil__literature_poetry', 'tamil', 'Literature — Poetry', 'tamil__u3', 201),
  ('tamil__composition', 'tamil', 'Composition', 'tamil__u3', 202),
  ('telugu__reading_comprehension', 'telugu', 'Reading Comprehension', 'telugu__u1', 0),
  ('telugu__grammar', 'telugu', 'Grammar', 'telugu__u2', 100),
  ('telugu__vocabulary', 'telugu', 'Vocabulary', 'telugu__u2', 101),
  ('telugu__literature_prose', 'telugu', 'Literature — Prose', 'telugu__u3', 200),
  ('telugu__literature_poetry', 'telugu', 'Literature — Poetry', 'telugu__u3', 201),
  ('telugu__composition', 'telugu', 'Composition', 'telugu__u3', 202),
  ('urdu__reading_comprehension', 'urdu', 'Reading Comprehension', 'urdu__u1', 0),
  ('urdu__grammar', 'urdu', 'Grammar', 'urdu__u2', 100),
  ('urdu__vocabulary', 'urdu', 'Vocabulary', 'urdu__u2', 101),
  ('urdu__literature_prose', 'urdu', 'Literature — Prose', 'urdu__u3', 200),
  ('urdu__literature_poetry', 'urdu', 'Literature — Poetry', 'urdu__u3', 201),
  ('urdu__composition', 'urdu', 'Composition', 'urdu__u3', 202),
  ('accountancy__partnership_fundamentals', 'accountancy', 'Partnership Fundamentals', 'accountancy__u1', 0),
  ('accountancy__profit_loss_appropriation_account', 'accountancy', 'Profit & Loss Appropriation Account', 'accountancy__u1', 1),
  ('accountancy__change_in_profit_sharing_ratio', 'accountancy', 'Change in Profit Sharing Ratio', 'accountancy__u2', 100),
  ('accountancy__goodwill_valuation', 'accountancy', 'Goodwill Valuation', 'accountancy__u2', 101),
  ('accountancy__admission_of_partner', 'accountancy', 'Admission of Partner', 'accountancy__u2', 102),
  ('accountancy__retirement_death_of_partner', 'accountancy', 'Retirement & Death of Partner', 'accountancy__u2', 103),
  ('accountancy__dissolution_of_partnership', 'accountancy', 'Dissolution of Partnership', 'accountancy__u3', 200),
  ('accountancy__dissolution_of_partnership_firm', 'accountancy', 'Dissolution of Partnership Firm', 'accountancy__u3', 201),
  ('accountancy__share_capital', 'accountancy', 'Share Capital', 'accountancy__u4', 300),
  ('accountancy__debentures', 'accountancy', 'Debentures', 'accountancy__u4', 301),
  ('accountancy__financial_statements_of_company', 'accountancy', 'Financial Statements of Company', 'accountancy__u5', 400),
  ('accountancy__analysis_of_financial_statements', 'accountancy', 'Analysis of Financial Statements', 'accountancy__u5', 401),
  ('accountancy__comparative_common_size_statements', 'accountancy', 'Comparative & Common Size Statements', 'accountancy__u5', 402),
  ('accountancy__accounting_ratios', 'accountancy', 'Accounting Ratios', 'accountancy__u5', 403),
  ('accountancy__cash_flow_statement', 'accountancy', 'Cash Flow Statement', 'accountancy__u5', 404),
  ('accountancy__computerized_accounting_system', 'accountancy', 'Computerized Accounting System', 'accountancy__u6', 500),
  ('agriculture__agricultural_meteorology', 'agriculture', 'Agricultural Meteorology', 'agriculture__u1', 0),
  ('agriculture__genetics_plant_breeding', 'agriculture', 'Genetics & Plant Breeding', 'agriculture__u1', 1),
  ('agriculture__biochemistry_microbiology', 'agriculture', 'Biochemistry & Microbiology', 'agriculture__u1', 2),
  ('agriculture__seed_science', 'agriculture', 'Seed Science', 'agriculture__u1', 3),
  ('agriculture__livestock_production', 'agriculture', 'Livestock Production', 'agriculture__u2', 100),
  ('agriculture__crop_production', 'agriculture', 'Crop Production', 'agriculture__u3', 200),
  ('agriculture__horticulture', 'agriculture', 'Horticulture', 'agriculture__u4', 300),
  ('agriculture__agricultural_economics', 'agriculture', 'Agricultural Economics', 'agriculture__u5', 400),
  ('agriculture__basic_agricultural_engineering', 'agriculture', 'Basic Agricultural Engineering', 'agriculture__u5', 401),
  ('agriculture__extension_education', 'agriculture', 'Extension Education', 'agriculture__u5', 402),
  ('anthropology__introducing_anthropology', 'anthropology', 'Introducing Anthropology', 'anthropology__u1', 0),
  ('anthropology__human_evolution', 'anthropology', 'Human Evolution', 'anthropology__u1', 1),
  ('anthropology__human_genetics', 'anthropology', 'Human Genetics', 'anthropology__u1', 2),
  ('anthropology__archaeological_anthropology', 'anthropology', 'Archaeological Anthropology', 'anthropology__u2', 100),
  ('anthropology__fieldwork_methods', 'anthropology', 'Fieldwork Methods', 'anthropology__u2', 101),
  ('anthropology__human_ecology', 'anthropology', 'Human Ecology', 'anthropology__u3', 200),
  ('anthropology__demographic_anthropology', 'anthropology', 'Demographic Anthropology', 'anthropology__u3', 201),
  ('anthropology__indian_anthropology', 'anthropology', 'Indian Anthropology', 'anthropology__u4', 300),
  ('anthropology__tribal_india', 'anthropology', 'Tribal India', 'anthropology__u4', 301),
  ('anthropology__applied_anthropology', 'anthropology', 'Applied Anthropology', 'anthropology__u5', 400),
  ('biology__reproduction_in_organisms', 'biology', 'Reproduction in Organisms', 'biology__u1', 0),
  ('biology__sexual_reproduction_in_flowering_plants', 'biology', 'Sexual Reproduction in Flowering Plants', 'biology__u1', 1),
  ('biology__human_reproduction', 'biology', 'Human Reproduction', 'biology__u1', 2),
  ('biology__reproductive_health', 'biology', 'Reproductive Health', 'biology__u1', 3),
  ('biology__principles_of_inheritance_variation', 'biology', 'Principles of Inheritance & Variation', 'biology__u2', 100),
  ('biology__molecular_basis_of_inheritance', 'biology', 'Molecular Basis of Inheritance', 'biology__u2', 101),
  ('biology__evolution', 'biology', 'Evolution', 'biology__u2', 102),
  ('biology__human_health_disease', 'biology', 'Human Health & Disease', 'biology__u3', 200),
  ('biology__microbes_in_human_welfare', 'biology', 'Microbes in Human Welfare', 'biology__u3', 201),
  ('biology__biotechnology_principles_processes', 'biology', 'Biotechnology Principles & Processes', 'biology__u4', 300),
  ('biology__biotechnology_its_applications', 'biology', 'Biotechnology & its Applications', 'biology__u4', 301),
  ('biology__organisms_populations', 'biology', 'Organisms & Populations', 'biology__u5', 400),
  ('biology__ecosystem', 'biology', 'Ecosystem', 'biology__u5', 401),
  ('biology__biodiversity_conservation', 'biology', 'Biodiversity & Conservation', 'biology__u5', 402),
  ('biology__environmental_issues', 'biology', 'Environmental Issues', 'biology__u5', 403),
  ('business_studies__nature_significance_of_management', 'business_studies', 'Nature & Significance of Management', 'business_studies__u1', 0),
  ('business_studies__principles_of_management', 'business_studies', 'Principles of Management', 'business_studies__u2', 100),
  ('business_studies__business_environment', 'business_studies', 'Business Environment', 'business_studies__u3', 200),
  ('business_studies__planning', 'business_studies', 'Planning', 'business_studies__u4', 300),
  ('business_studies__organising', 'business_studies', 'Organising', 'business_studies__u5', 400),
  ('business_studies__staffing', 'business_studies', 'Staffing', 'business_studies__u6', 500),
  ('business_studies__directing', 'business_studies', 'Directing', 'business_studies__u7', 600),
  ('business_studies__controlling', 'business_studies', 'Controlling', 'business_studies__u8', 700),
  ('business_studies__financial_management', 'business_studies', 'Financial Management', 'business_studies__u9', 800),
  ('business_studies__financial_markets', 'business_studies', 'Financial Markets', 'business_studies__u10', 900),
  ('business_studies__marketing_management', 'business_studies', 'Marketing Management', 'business_studies__u11', 1000),
  ('business_studies__consumer_protection', 'business_studies', 'Consumer Protection', 'business_studies__u12', 1100),
  ('business_studies__entrepreneurship_development', 'business_studies', 'Entrepreneurship Development', 'business_studies__u13', 1200),
  ('chemistry__solutions', 'chemistry', 'Solutions', 'chemistry__u1', 0),
  ('chemistry__electrochemistry', 'chemistry', 'Electrochemistry', 'chemistry__u2', 100),
  ('chemistry__chemical_kinetics', 'chemistry', 'Chemical Kinetics', 'chemistry__u3', 200),
  ('chemistry__d_and_f_block_elements', 'chemistry', 'd- and f-Block Elements', 'chemistry__u4', 300),
  ('chemistry__coordination_compounds', 'chemistry', 'Coordination Compounds', 'chemistry__u5', 400),
  ('chemistry__haloalkanes_haloarenes', 'chemistry', 'Haloalkanes & Haloarenes', 'chemistry__u6', 500),
  ('chemistry__alcohols_phenols_ethers', 'chemistry', 'Alcohols, Phenols & Ethers', 'chemistry__u7', 600),
  ('chemistry__aldehydes_ketones_carboxylic_acids', 'chemistry', 'Aldehydes, Ketones & Carboxylic Acids', 'chemistry__u8', 700),
  ('chemistry__amines', 'chemistry', 'Amines', 'chemistry__u9', 800),
  ('chemistry__biomolecules', 'chemistry', 'Biomolecules', 'chemistry__u10', 900),
  ('chemistry__solid_state', 'chemistry', 'Solid State', 'chemistry__u11', 1000),
  ('chemistry__surface_chemistry', 'chemistry', 'Surface Chemistry', 'chemistry__u11', 1001),
  ('chemistry__isolation_of_elements', 'chemistry', 'Isolation of Elements', 'chemistry__u11', 1002),
  ('chemistry__p_block_elements', 'chemistry', 'p-Block Elements', 'chemistry__u11', 1003),
  ('chemistry__polymers', 'chemistry', 'Polymers', 'chemistry__u11', 1004),
  ('chemistry__chemistry_in_everyday_life', 'chemistry', 'Chemistry in Everyday Life', 'chemistry__u11', 1005),
  ('computer_science__database_concepts', 'computer_science', 'Database Concepts', 'computer_science__u1', 0),
  ('computer_science__mysql', 'computer_science', 'MySQL', 'computer_science__u1', 1),
  ('computer_science__structured_query_language', 'computer_science', 'Structured Query Language', 'computer_science__u1', 2),
  ('computer_science__computer_networks', 'computer_science', 'Computer Networks', 'computer_science__u1', 3),
  ('computer_science__python_revision', 'computer_science', 'Python Revision', 'computer_science__u2', 100),
  ('computer_science__functions', 'computer_science', 'Functions', 'computer_science__u2', 101),
  ('computer_science__file_handling', 'computer_science', 'File Handling', 'computer_science__u2', 102),
  ('computer_science__exception_and_file_handling_in_python', 'computer_science', 'Exception and File Handling in Python', 'computer_science__u2', 103),
  ('computer_science__data_structures', 'computer_science', 'Data Structures', 'computer_science__u2', 104),
  ('computer_science__stack', 'computer_science', 'Stack', 'computer_science__u2', 105),
  ('computer_science__queue', 'computer_science', 'Queue', 'computer_science__u2', 106),
  ('computer_science__searching', 'computer_science', 'Searching', 'computer_science__u2', 107),
  ('computer_science__sorting', 'computer_science', 'Sorting', 'computer_science__u2', 108),
  ('computer_science__understanding_data', 'computer_science', 'Understanding Data', 'computer_science__u2', 109),
  ('computer_science__interface_python_with_mysql', 'computer_science', 'Interface Python with MySQL', 'computer_science__u2', 110),
  ('computer_science__data_communication', 'computer_science', 'Data Communication', 'computer_science__u2', 111),
  ('computer_science__security_aspects', 'computer_science', 'Security Aspects', 'computer_science__u2', 112),
  ('computer_science__communication_technologies', 'computer_science', 'Communication Technologies', 'computer_science__u2', 113),
  ('computer_science__boolean_algebra', 'computer_science', 'Boolean Algebra', 'computer_science__u2', 114),
  ('computer_science__data_handling_using_pandas', 'computer_science', 'Data Handling using Pandas', 'computer_science__u3', 200),
  ('computer_science__plotting_data_using_matplotlib', 'computer_science', 'Plotting Data using Matplotlib', 'computer_science__u3', 201),
  ('computer_science__societal_impacts', 'computer_science', 'Societal Impacts', 'computer_science__u3', 202),
  ('computer_science__project_based_learning', 'computer_science', 'Project Based Learning', 'computer_science__u3', 203),
  ('economics__introduction_theory_of_consumer_behaviour', 'economics', 'Introduction & Theory of Consumer Behaviour', 'economics__u1', 0),
  ('economics__production_costs', 'economics', 'Production & Costs', 'economics__u1', 1),
  ('economics__theory_of_firms_under_perfect_competition', 'economics', 'Theory of Firms under Perfect Competition', 'economics__u1', 2),
  ('economics__market_equilibrium_simple_applications', 'economics', 'Market Equilibrium & Simple Applications', 'economics__u1', 3),
  ('economics__national_income_related_aggregates', 'economics', 'National Income & Related Aggregates', 'economics__u2', 100),
  ('economics__money_banking', 'economics', 'Money & Banking', 'economics__u2', 101),
  ('economics__income_determination', 'economics', 'Income Determination', 'economics__u2', 102),
  ('economics__government_budget_the_economy', 'economics', 'Government Budget & the Economy', 'economics__u2', 103),
  ('economics__balance_of_payments', 'economics', 'Balance of Payments', 'economics__u2', 104),
  ('economics__indian_economy_on_the_eve_of_independence', 'economics', 'Indian Economy on the Eve of Independence', 'economics__u3', 200),
  ('economics__indian_economic_development_1950_1990', 'economics', 'Indian Economic Development 1950–1990', 'economics__u3', 201),
  ('economics__economic_reforms_since_1991', 'economics', 'Economic Reforms Since 1991', 'economics__u3', 202),
  ('economics__human_capital_formation', 'economics', 'Human Capital Formation', 'economics__u3', 203),
  ('economics__rural_development', 'economics', 'Rural Development', 'economics__u3', 204),
  ('economics__employment', 'economics', 'Employment', 'economics__u3', 205),
  ('economics__infrastructure', 'economics', 'Infrastructure', 'economics__u3', 206),
  ('economics__environment_sustainable_development', 'economics', 'Environment & Sustainable Development', 'economics__u3', 207),
  ('economics__development_experiences_of_india', 'economics', 'Development Experiences of India', 'economics__u3', 208),
  ('engineering_graphics__isometric_projection_of_solids', 'engineering_graphics', 'Isometric Projection of Solids', 'engineering_graphics__u1', 0),
  ('engineering_graphics__machine_drawing', 'engineering_graphics', 'Machine Drawing', 'engineering_graphics__u1', 1),
  ('engineering_graphics__building_drawing', 'engineering_graphics', 'Building Drawing', 'engineering_graphics__u1', 2),
  ('engineering_graphics__engineering_curves', 'engineering_graphics', 'Engineering Curves', 'engineering_graphics__u1', 3),
  ('engineering_graphics__projection_of_points_lines', 'engineering_graphics', 'Projection of Points & Lines', 'engineering_graphics__u1', 4),
  ('engineering_graphics__projection_of_planes', 'engineering_graphics', 'Projection of Planes', 'engineering_graphics__u1', 5),
  ('engineering_graphics__projection_of_solids', 'engineering_graphics', 'Projection of Solids', 'engineering_graphics__u1', 6),
  ('engineering_graphics__sectional_views', 'engineering_graphics', 'Sectional Views', 'engineering_graphics__u1', 7),
  ('engineering_graphics__orthographic_projections', 'engineering_graphics', 'Orthographic Projections', 'engineering_graphics__u1', 8),
  ('engineering_graphics__computer_aided_drawing', 'engineering_graphics', 'Computer-Aided Drawing', 'engineering_graphics__u1', 9),
  ('entrepreneurship__entrepreneurial_opportunity', 'entrepreneurship', 'Entrepreneurial Opportunity', 'entrepreneurship__u1', 0),
  ('entrepreneurship__entrepreneurial_planning', 'entrepreneurship', 'Entrepreneurial Planning', 'entrepreneurship__u1', 1),
  ('entrepreneurship__enterprise_marketing', 'entrepreneurship', 'Enterprise Marketing', 'entrepreneurship__u1', 2),
  ('entrepreneurship__enterprise_growth_strategies', 'entrepreneurship', 'Enterprise Growth Strategies', 'entrepreneurship__u1', 3),
  ('entrepreneurship__business_arithmetic', 'entrepreneurship', 'Business Arithmetic', 'entrepreneurship__u1', 4),
  ('entrepreneurship__resource_mobilization', 'entrepreneurship', 'Resource Mobilization', 'entrepreneurship__u1', 5),
  ('entrepreneurship__entrepreneurial_ethics', 'entrepreneurship', 'Entrepreneurial Ethics', 'entrepreneurship__u1', 6),
  ('entrepreneurship__concept_functions_of_entrepreneurship', 'entrepreneurship', 'Concept & Functions of Entrepreneurship', 'entrepreneurship__u1', 7),
  ('environmental_studies__human_beings_and_nature', 'environmental_studies', 'Human Beings and Nature', 'environmental_studies__u1', 0),
  ('environmental_studies__population_and_conservation_ecology', 'environmental_studies', 'Population and Conservation Ecology', 'environmental_studies__u1', 1),
  ('environmental_studies__environmental_pollution', 'environmental_studies', 'Environmental Pollution', 'environmental_studies__u1', 2),
  ('environmental_studies__development_and_environment', 'environmental_studies', 'Development and Environment', 'environmental_studies__u1', 3),
  ('environmental_studies__sustainable_agriculture_in_india', 'environmental_studies', 'Sustainable Agriculture in India', 'environmental_studies__u1', 4),
  ('environmental_studies__environmental_and_natural_resource_economics', 'environmental_studies', 'Environmental and Natural Resource Economics', 'environmental_studies__u1', 5),
  ('environmental_studies__international_relations_and_the_environment', 'environmental_studies', 'International Relations and the Environment', 'environmental_studies__u1', 6),
  ('environmental_studies__natural_resources', 'environmental_studies', 'Natural Resources', 'environmental_studies__u2', 100),
  ('environmental_studies__ecosystems', 'environmental_studies', 'Ecosystems', 'environmental_studies__u2', 101),
  ('environmental_studies__biodiversity', 'environmental_studies', 'Biodiversity', 'environmental_studies__u2', 102),
  ('environmental_studies__social_issues_environment', 'environmental_studies', 'Social Issues & Environment', 'environmental_studies__u2', 103),
  ('environmental_studies__human_population', 'environmental_studies', 'Human Population', 'environmental_studies__u2', 104),
  ('environmental_studies__environmental_policies', 'environmental_studies', 'Environmental Policies', 'environmental_studies__u2', 105),
  ('environmental_studies__case_studies', 'environmental_studies', 'Case Studies', 'environmental_studies__u2', 106),
  ('fine_arts__the_rajasthani_school', 'fine_arts', 'The Rajasthani School', 'fine_arts__u1', 0),
  ('fine_arts__the_pahari_school', 'fine_arts', 'The Pahari School', 'fine_arts__u1', 1),
  ('fine_arts__the_mughal_school', 'fine_arts', 'The Mughal School', 'fine_arts__u2', 100),
  ('fine_arts__the_deccan_school', 'fine_arts', 'The Deccan School', 'fine_arts__u2', 101),
  ('fine_arts__the_bengal_school', 'fine_arts', 'The Bengal School', 'fine_arts__u3', 200),
  ('fine_arts__modern_indian_art', 'fine_arts', 'Modern Indian Art', 'fine_arts__u4', 300),
  ('fine_arts__graphic_prints', 'fine_arts', 'Graphic Prints', 'fine_arts__u4', 301),
  ('fine_arts__sculpture_post_independence', 'fine_arts', 'Sculpture Post-Independence', 'fine_arts__u4', 302),
  ('fine_arts__modern_trends_in_indian_art', 'fine_arts', 'Modern Trends in Indian Art', 'fine_arts__u4', 303),
  ('geography__human_geography_nature_scope', 'geography', 'Human Geography — Nature & Scope', 'geography__u1', 0),
  ('geography__population_distribution_density_growth', 'geography', 'Population — Distribution, Density, Growth', 'geography__u2', 100),
  ('geography__migration', 'geography', 'Migration', 'geography__u2', 101),
  ('geography__human_development', 'geography', 'Human Development', 'geography__u2', 102),
  ('geography__india_people_economy', 'geography', 'India — People & Economy', 'geography__u2', 103),
  ('geography__primary_activities', 'geography', 'Primary Activities', 'geography__u3', 200),
  ('geography__secondary_activities', 'geography', 'Secondary Activities', 'geography__u3', 201),
  ('geography__tertiary_quaternary_activities', 'geography', 'Tertiary & Quaternary Activities', 'geography__u3', 202),
  ('geography__transport_communication', 'geography', 'Transport & Communication', 'geography__u4', 300),
  ('geography__international_trade', 'geography', 'International Trade', 'geography__u4', 301),
  ('geography__human_settlements', 'geography', 'Human Settlements', 'geography__u5', 400),
  ('geography__resources_development', 'geography', 'Resources & Development', 'geography__u6', 500),
  ('geography__manufacturing_industries', 'geography', 'Manufacturing Industries', 'geography__u6', 501),
  ('geography__planning_sustainable_development', 'geography', 'Planning & Sustainable Development', 'geography__u6', 502),
  ('geography__geographical_perspective_on_selected_issues_and_problems', 'geography', 'Geographical Perspective on Selected Issues and Problems', 'geography__u7', 600),
  ('history__bricks_beads_bones', 'history', 'Bricks, Beads & Bones', 'history__u1', 0),
  ('history__kings_farmers_towns', 'history', 'Kings, Farmers & Towns', 'history__u1', 1),
  ('history__kinship_caste_class', 'history', 'Kinship, Caste & Class', 'history__u1', 2),
  ('history__thinkers_beliefs_buildings', 'history', 'Thinkers, Beliefs & Buildings', 'history__u1', 3),
  ('history__through_the_eyes_of_travellers', 'history', 'Through the Eyes of Travellers', 'history__u2', 100),
  ('history__bhakti_sufi_traditions', 'history', 'Bhakti-Sufi Traditions', 'history__u2', 101),
  ('history__an_imperial_capital_vijayanagara', 'history', 'An Imperial Capital — Vijayanagara', 'history__u2', 102),
  ('history__peasants_zamindars_the_state', 'history', 'Peasants, Zamindars & the State', 'history__u2', 103),
  ('history__kings_chronicles', 'history', 'Kings & Chronicles', 'history__u2', 104),
  ('history__colonialism_the_countryside', 'history', 'Colonialism & the Countryside', 'history__u3', 200),
  ('history__rebels_the_raj', 'history', 'Rebels & the Raj', 'history__u3', 201),
  ('history__mahatma_gandhi_the_nationalist_movement', 'history', 'Mahatma Gandhi & the Nationalist Movement', 'history__u3', 202),
  ('history__partition', 'history', 'Partition', 'history__u3', 203),
  ('history__framing_the_constitution', 'history', 'Framing the Constitution', 'history__u3', 204),
  ('home_science__work_livelihood_and_career', 'home_science', 'Work, Livelihood and Career', 'home_science__u1', 0),
  ('home_science__nutrition_for_self_family_community', 'home_science', 'Nutrition for Self, Family & Community', 'home_science__u2', 100),
  ('home_science__food_safety_quality', 'home_science', 'Food Safety & Quality', 'home_science__u2', 101),
  ('home_science__human_development', 'home_science', 'Human Development', 'home_science__u3', 200),
  ('home_science__child_care_development', 'home_science', 'Child Care & Development', 'home_science__u3', 201),
  ('home_science__apparel_designing_care', 'home_science', 'Apparel Designing & Care', 'home_science__u4', 300),
  ('home_science__money_management_consumer_education', 'home_science', 'Money Management & Consumer Education', 'home_science__u5', 400),
  ('home_science__household_management', 'home_science', 'Household Management', 'home_science__u5', 401),
  ('home_science__community_development', 'home_science', 'Community Development', 'home_science__u6', 500),
  ('home_science__communication_and_extension', 'home_science', 'Communication and Extension', 'home_science__u6', 501),
  ('knowledge_tradition_india__agriculture_a_survey', 'knowledge_tradition_india', 'Agriculture: A Survey', 'knowledge_tradition_india__u1', 0),
  ('knowledge_tradition_india__architecture_a_survey', 'knowledge_tradition_india', 'Architecture: A Survey', 'knowledge_tradition_india__u1', 1),
  ('knowledge_tradition_india__dance_a_survey', 'knowledge_tradition_india', 'Dance: A Survey', 'knowledge_tradition_india__u1', 2),
  ('knowledge_tradition_india__education_systems_and_practices', 'knowledge_tradition_india', 'Education Systems and Practices', 'knowledge_tradition_india__u1', 3),
  ('knowledge_tradition_india__indian_ethics', 'knowledge_tradition_india', 'Indian Ethics', 'knowledge_tradition_india__u1', 4),
  ('knowledge_tradition_india__martial_arts_traditions', 'knowledge_tradition_india', 'Martial Arts Traditions', 'knowledge_tradition_india__u1', 5),
  ('knowledge_tradition_india__language_and_grammar', 'knowledge_tradition_india', 'Language and Grammar', 'knowledge_tradition_india__u1', 6),
  ('knowledge_tradition_india__other_technologies', 'knowledge_tradition_india', 'Other Technologies', 'knowledge_tradition_india__u1', 7),
  ('knowledge_tradition_india__indian_languages_literature_scriptures', 'knowledge_tradition_india', 'Indian Languages, Literature & Scriptures', 'knowledge_tradition_india__u2', 100),
  ('knowledge_tradition_india__indian_philosophy', 'knowledge_tradition_india', 'Indian Philosophy', 'knowledge_tradition_india__u2', 101),
  ('knowledge_tradition_india__religion_spirituality', 'knowledge_tradition_india', 'Religion & Spirituality', 'knowledge_tradition_india__u2', 102),
  ('knowledge_tradition_india__indian_arts', 'knowledge_tradition_india', 'Indian Arts', 'knowledge_tradition_india__u2', 103),
  ('knowledge_tradition_india__indian_architecture', 'knowledge_tradition_india', 'Indian Architecture', 'knowledge_tradition_india__u2', 104),
  ('knowledge_tradition_india__science_technology_in_india', 'knowledge_tradition_india', 'Science & Technology in India', 'knowledge_tradition_india__u2', 105),
  ('knowledge_tradition_india__polity_economy', 'knowledge_tradition_india', 'Polity & Economy', 'knowledge_tradition_india__u2', 106),
  ('knowledge_tradition_india__education_system', 'knowledge_tradition_india', 'Education System', 'knowledge_tradition_india__u2', 107),
  ('knowledge_tradition_india__agriculture_crafts', 'knowledge_tradition_india', 'Agriculture & Crafts', 'knowledge_tradition_india__u2', 108),
  ('legal_studies__judiciary', 'legal_studies', 'Judiciary', 'legal_studies__u1', 0),
  ('legal_studies__topics_of_law', 'legal_studies', 'Topics of Law', 'legal_studies__u1', 1),
  ('legal_studies__arbitration_tribunal_adjudication_adr', 'legal_studies', 'Arbitration, Tribunal Adjudication & ADR', 'legal_studies__u1', 2),
  ('legal_studies__human_rights', 'legal_studies', 'Human Rights', 'legal_studies__u1', 3),
  ('legal_studies__legal_profession_in_india', 'legal_studies', 'Legal Profession in India', 'legal_studies__u1', 4),
  ('legal_studies__legal_services', 'legal_studies', 'Legal Services', 'legal_studies__u1', 5),
  ('legal_studies__international_context', 'legal_studies', 'International Context', 'legal_studies__u1', 6),
  ('legal_studies__constitutional_law', 'legal_studies', 'Constitutional Law', 'legal_studies__u1', 7),
  ('legal_studies__criminal_law', 'legal_studies', 'Criminal Law', 'legal_studies__u1', 8),
  ('legal_studies__family_law', 'legal_studies', 'Family Law', 'legal_studies__u1', 9),
  ('mass_media__communication', 'mass_media', 'Communication', 'mass_media__u1', 0),
  ('mass_media__journalism', 'mass_media', 'Journalism', 'mass_media__u1', 1),
  ('mass_media__advertising_and_public_relations', 'mass_media', 'Advertising and Public Relations', 'mass_media__u1', 2),
  ('mass_media__tv_production_process_and_programmes', 'mass_media', 'TV Production Process and Programmes', 'mass_media__u1', 3),
  ('mass_media__radio', 'mass_media', 'Radio', 'mass_media__u1', 4),
  ('mass_media__cinema', 'mass_media', 'Cinema', 'mass_media__u1', 5),
  ('mass_media__social_media', 'mass_media', 'Social Media', 'mass_media__u1', 6),
  ('mass_media__new_media', 'mass_media', 'New Media', 'mass_media__u1', 7),
  ('mass_media__introduction_to_mass_communication', 'mass_media', 'Introduction to Mass Communication', 'mass_media__u2', 100),
  ('mass_media__print_media', 'mass_media', 'Print Media', 'mass_media__u2', 101),
  ('mass_media__television', 'mass_media', 'Television', 'mass_media__u2', 102),
  ('mass_media__advertising', 'mass_media', 'Advertising', 'mass_media__u2', 103),
  ('mass_media__public_relations', 'mass_media', 'Public Relations', 'mass_media__u2', 104),
  ('mass_media__media_ethics', 'mass_media', 'Media Ethics', 'mass_media__u2', 105),
  ('mathematics__relations_functions', 'mathematics', 'Relations & Functions', 'mathematics__u1', 0),
  ('mathematics__inverse_trigonometric_functions', 'mathematics', 'Inverse Trigonometric Functions', 'mathematics__u1', 1),
  ('mathematics__matrices', 'mathematics', 'Matrices', 'mathematics__u2', 100),
  ('mathematics__determinants', 'mathematics', 'Determinants', 'mathematics__u2', 101),
  ('mathematics__continuity_differentiability', 'mathematics', 'Continuity & Differentiability', 'mathematics__u3', 200),
  ('mathematics__application_of_derivatives', 'mathematics', 'Application of Derivatives', 'mathematics__u3', 201),
  ('mathematics__integrals', 'mathematics', 'Integrals', 'mathematics__u3', 202),
  ('mathematics__application_of_integrals', 'mathematics', 'Application of Integrals', 'mathematics__u3', 203),
  ('mathematics__differential_equations', 'mathematics', 'Differential Equations', 'mathematics__u3', 204),
  ('mathematics__vector_algebra', 'mathematics', 'Vector Algebra', 'mathematics__u4', 300),
  ('mathematics__three_dimensional_geometry', 'mathematics', 'Three Dimensional Geometry', 'mathematics__u4', 301),
  ('mathematics__linear_programming', 'mathematics', 'Linear Programming', 'mathematics__u5', 400),
  ('mathematics__probability', 'mathematics', 'Probability', 'mathematics__u6', 500),
  ('mathematics__numbers_quantification_and_numerical_applications', 'mathematics', 'Numbers, Quantification and Numerical Applications', 'mathematics__u7', 600),
  ('mathematics__probability_distributions', 'mathematics', 'Probability Distributions', 'mathematics__u7', 601),
  ('mathematics__time_based_data', 'mathematics', 'Time Based Data', 'mathematics__u7', 602),
  ('mathematics__inferential_statistics', 'mathematics', 'Inferential Statistics', 'mathematics__u7', 603),
  ('mathematics__financial_mathematics', 'mathematics', 'Financial Mathematics', 'mathematics__u7', 604),
  ('performing_arts__hindustani_music', 'performing_arts', 'Hindustani Music', 'performing_arts__u1', 0),
  ('performing_arts__carnatic_music', 'performing_arts', 'Carnatic Music', 'performing_arts__u1', 1),
  ('performing_arts__laya_tala', 'performing_arts', 'Laya & Tala', 'performing_arts__u1', 2),
  ('performing_arts__musical_forms', 'performing_arts', 'Musical Forms', 'performing_arts__u1', 3),
  ('performing_arts__musical_instruments', 'performing_arts', 'Musical Instruments', 'performing_arts__u1', 4),
  ('performing_arts__indian_classical_dance', 'performing_arts', 'Indian Classical Dance', 'performing_arts__u2', 100),
  ('performing_arts__folk_dances_of_india', 'performing_arts', 'Folk Dances of India', 'performing_arts__u2', 101),
  ('performing_arts__regional_dance_forms', 'performing_arts', 'Regional Dance Forms', 'performing_arts__u2', 102),
  ('performing_arts__rasa_theory', 'performing_arts', 'Rasa Theory', 'performing_arts__u2', 103),
  ('performing_arts__theatre_traditions', 'performing_arts', 'Theatre Traditions', 'performing_arts__u3', 200),
  ('performing_arts__notable_performers', 'performing_arts', 'Notable Performers', 'performing_arts__u4', 300),
  ('physical_education__health_status_and_programmes_in_india', 'physical_education', 'Health Status and Programmes in India', 'physical_education__u1', 0),
  ('physical_education__planning_in_sports', 'physical_education', 'Planning in Sports', 'physical_education__u2', 100),
  ('physical_education__sports_nutrition', 'physical_education', 'Sports & Nutrition', 'physical_education__u2', 101),
  ('physical_education__yoga_lifestyle', 'physical_education', 'Yoga & Lifestyle', 'physical_education__u2', 102),
  ('physical_education__physical_education_sports_for_cwsn', 'physical_education', 'Physical Education & Sports for CWSN', 'physical_education__u2', 103),
  ('physical_education__children_women_in_sports', 'physical_education', 'Children & Women in Sports', 'physical_education__u2', 104),
  ('physical_education__test_measurement_evaluation', 'physical_education', 'Test, Measurement & Evaluation', 'physical_education__u2', 105),
  ('physical_education__physiology_injuries_in_sports', 'physical_education', 'Physiology & Injuries in Sports', 'physical_education__u2', 106),
  ('physical_education__biomechanics_sports', 'physical_education', 'Biomechanics & Sports', 'physical_education__u2', 107),
  ('physical_education__psychology_sports', 'physical_education', 'Psychology & Sports', 'physical_education__u2', 108),
  ('physical_education__training_in_sports', 'physical_education', 'Training in Sports', 'physical_education__u2', 109),
  ('physics__electric_charges_fields', 'physics', 'Electric Charges & Fields', 'physics__u1', 0),
  ('physics__electrostatic_potential_capacitance', 'physics', 'Electrostatic Potential & Capacitance', 'physics__u1', 1),
  ('physics__current_electricity', 'physics', 'Current Electricity', 'physics__u2', 100),
  ('physics__moving_charges_magnetism', 'physics', 'Moving Charges & Magnetism', 'physics__u3', 200),
  ('physics__magnetism_matter', 'physics', 'Magnetism & Matter', 'physics__u3', 201),
  ('physics__electromagnetic_induction', 'physics', 'Electromagnetic Induction', 'physics__u4', 300),
  ('physics__alternating_current', 'physics', 'Alternating Current', 'physics__u4', 301),
  ('physics__electromagnetic_waves', 'physics', 'Electromagnetic Waves', 'physics__u5', 400),
  ('physics__ray_optics_optical_instruments', 'physics', 'Ray Optics & Optical Instruments', 'physics__u6', 500),
  ('physics__wave_optics', 'physics', 'Wave Optics', 'physics__u6', 501),
  ('physics__dual_nature_of_radiation_matter', 'physics', 'Dual Nature of Radiation & Matter', 'physics__u7', 600),
  ('physics__atoms', 'physics', 'Atoms', 'physics__u8', 700),
  ('physics__nuclei', 'physics', 'Nuclei', 'physics__u8', 701),
  ('physics__semiconductor_electronics', 'physics', 'Semiconductor Electronics', 'physics__u9', 800),
  ('physics__communication_systems', 'physics', 'Communication Systems', 'physics__u10', 900),
  ('political_science__challenges_of_nation_building', 'political_science', 'Challenges of Nation Building', 'political_science__u1', 0),
  ('political_science__era_of_one_party_dominance', 'political_science', 'Era of One-Party Dominance', 'political_science__u1', 1),
  ('political_science__politics_of_planned_development', 'political_science', 'Politics of Planned Development', 'political_science__u1', 2),
  ('political_science__india_s_external_relations', 'political_science', 'India''s External Relations', 'political_science__u1', 3),
  ('political_science__challenges_to_restoration_of_the_congress_system', 'political_science', 'Challenges to & Restoration of the Congress System', 'political_science__u1', 4),
  ('political_science__crisis_of_the_democratic_order', 'political_science', 'Crisis of the Democratic Order', 'political_science__u1', 5),
  ('political_science__rise_of_popular_movements', 'political_science', 'Rise of Popular Movements', 'political_science__u1', 6),
  ('political_science__regional_aspirations', 'political_science', 'Regional Aspirations', 'political_science__u1', 7),
  ('political_science__democratic_upsurge_and_coalition_politics', 'political_science', 'Democratic Upsurge and Coalition Politics', 'political_science__u1', 8),
  ('political_science__recent_issues_and_challenges', 'political_science', 'Recent Issues and Challenges', 'political_science__u1', 9),
  ('political_science__cold_war_era', 'political_science', 'Cold War Era', 'political_science__u2', 100),
  ('political_science__end_of_bipolarity', 'political_science', 'End of Bipolarity', 'political_science__u2', 101),
  ('political_science__us_hegemony_in_world_politics', 'political_science', 'US Hegemony in World Politics', 'political_science__u2', 102),
  ('political_science__alternative_centres_of_power', 'political_science', 'Alternative Centres of Power', 'political_science__u2', 103),
  ('political_science__contemporary_south_asia', 'political_science', 'Contemporary South Asia', 'political_science__u2', 104),
  ('political_science__international_organisations', 'political_science', 'International Organisations', 'political_science__u2', 105),
  ('political_science__security_in_the_contemporary_world', 'political_science', 'Security in the Contemporary World', 'political_science__u2', 106),
  ('political_science__environment_natural_resources', 'political_science', 'Environment & Natural Resources', 'political_science__u2', 107),
  ('political_science__globalisation', 'political_science', 'Globalisation', 'political_science__u2', 108),
  ('psychology__variations_in_psychological_attributes', 'psychology', 'Variations in Psychological Attributes', 'psychology__u1', 0),
  ('psychology__self_personality', 'psychology', 'Self & Personality', 'psychology__u2', 100),
  ('psychology__meeting_life_challenges', 'psychology', 'Meeting Life Challenges', 'psychology__u3', 200),
  ('psychology__psychological_disorders', 'psychology', 'Psychological Disorders', 'psychology__u4', 300),
  ('psychology__therapeutic_approaches', 'psychology', 'Therapeutic Approaches', 'psychology__u5', 400),
  ('psychology__attitude_social_cognition', 'psychology', 'Attitude & Social Cognition', 'psychology__u6', 500),
  ('psychology__social_influence_group_processes', 'psychology', 'Social Influence & Group Processes', 'psychology__u7', 600),
  ('psychology__psychology_life', 'psychology', 'Psychology & Life', 'psychology__u8', 700),
  ('psychology__developing_psychological_skills', 'psychology', 'Developing Psychological Skills', 'psychology__u8', 701),
  ('sanskrit__apathit_avabodhanam', 'sanskrit', 'Apathit Avabodhanam', 'sanskrit__u1', 0),
  ('sanskrit__vyakaranam', 'sanskrit', 'Vyakaranam', 'sanskrit__u1', 1),
  ('sanskrit__racnanatmakam_karya', 'sanskrit', 'Racnanatmakam Karya', 'sanskrit__u1', 2),
  ('sanskrit__shabda_roopani', 'sanskrit', 'Shabda Roopani', 'sanskrit__u1', 3),
  ('sanskrit__dhatu_roopani', 'sanskrit', 'Dhatu Roopani', 'sanskrit__u1', 4),
  ('sanskrit__sandhi', 'sanskrit', 'Sandhi', 'sanskrit__u1', 5),
  ('sanskrit__samasa', 'sanskrit', 'Samasa', 'sanskrit__u1', 6),
  ('sanskrit__pratyaya', 'sanskrit', 'Pratyaya', 'sanskrit__u1', 7),
  ('sanskrit__padyam', 'sanskrit', 'Padyam', 'sanskrit__u2', 100),
  ('sanskrit__gadyam', 'sanskrit', 'Gadyam', 'sanskrit__u2', 101),
  ('sanskrit__natyam', 'sanskrit', 'Natyam', 'sanskrit__u2', 102),
  ('sanskrit__sanskrit_literature', 'sanskrit', 'Sanskrit Literature', 'sanskrit__u2', 103),
  ('sociology__introducing_indian_society', 'sociology', 'Introducing Indian Society', 'sociology__u1', 0),
  ('sociology__demographic_structure', 'sociology', 'Demographic Structure', 'sociology__u1', 1),
  ('sociology__social_institutions', 'sociology', 'Social Institutions', 'sociology__u1', 2),
  ('sociology__patterns_of_social_inequality', 'sociology', 'Patterns of Social Inequality', 'sociology__u1', 3),
  ('sociology__challenges_of_cultural_diversity', 'sociology', 'Challenges of Cultural Diversity', 'sociology__u1', 4),
  ('sociology__structural_change', 'sociology', 'Structural Change', 'sociology__u2', 100),
  ('sociology__cultural_change', 'sociology', 'Cultural Change', 'sociology__u2', 101),
  ('sociology__story_of_indian_democracy', 'sociology', 'Story of Indian Democracy', 'sociology__u2', 102),
  ('sociology__change_development_in_rural_society', 'sociology', 'Change & Development in Rural Society', 'sociology__u2', 103),
  ('sociology__change_development_in_industrial_society', 'sociology', 'Change & Development in Industrial Society', 'sociology__u2', 104),
  ('sociology__market_as_a_social_institution', 'sociology', 'Market as a Social Institution', 'sociology__u2', 105),
  ('sociology__globalisation_social_change', 'sociology', 'Globalisation & Social Change', 'sociology__u2', 106),
  ('sociology__mass_media_communications', 'sociology', 'Mass Media & Communications', 'sociology__u2', 107),
  ('sociology__social_movements', 'sociology', 'Social Movements', 'sociology__u2', 108),
  ('teaching_aptitude__teaching_methodology', 'teaching_aptitude', 'Teaching Methodology', 'teaching_aptitude__u1', 0),
  ('teaching_aptitude__learning_learner', 'teaching_aptitude', 'Learning & Learner', 'teaching_aptitude__u1', 1),
  ('teaching_aptitude__teaching_aids', 'teaching_aptitude', 'Teaching Aids', 'teaching_aptitude__u1', 2),
  ('teaching_aptitude__classroom_management', 'teaching_aptitude', 'Classroom Management', 'teaching_aptitude__u1', 3),
  ('teaching_aptitude__assessment_evaluation', 'teaching_aptitude', 'Assessment & Evaluation', 'teaching_aptitude__u1', 4),
  ('teaching_aptitude__educational_psychology', 'teaching_aptitude', 'Educational Psychology', 'teaching_aptitude__u1', 5),
  ('teaching_aptitude__communication_skills', 'teaching_aptitude', 'Communication Skills', 'teaching_aptitude__u1', 6),
  ('teaching_aptitude__research_aptitude', 'teaching_aptitude', 'Research Aptitude', 'teaching_aptitude__u1', 7),
  ('teaching_aptitude__information_communication_technology', 'teaching_aptitude', 'Information & Communication Technology', 'teaching_aptitude__u1', 8),
  ('gat__general_knowledge', 'gat', 'General Knowledge', 'gat__u1', 0),
  ('gat__current_affairs', 'gat', 'Current Affairs', 'gat__u1', 1),
  ('gat__general_mental_ability', 'gat', 'General Mental Ability', 'gat__u2', 100),
  ('gat__numerical_ability', 'gat', 'Numerical Ability', 'gat__u3', 200),
  ('gat__quantitative_reasoning', 'gat', 'Quantitative Reasoning', 'gat__u4', 300),
  ('gat__basic_mathematical_concepts', 'gat', 'Basic Mathematical Concepts', 'gat__u4', 301),
  ('gat__statistical_data_analysis', 'gat', 'Statistical Data Analysis', 'gat__u4', 302),
  ('gat__logical_analytical_reasoning', 'gat', 'Logical & Analytical Reasoning', 'gat__u5', 400),
  ('gat__general_science_and_environment_literacy', 'gat', 'General Science and Environment Literacy', 'gat__u6', 500)
) as new_data(id, subject_id, name, unit_id, sort_order)
where c.subject_id = new_data.subject_id
  and c.name = new_data.name;

insert into public.chapters (id, name, subject_id, unit_id, sort_order) values
  ('english__reading_comprehension', 'Reading Comprehension', 'english', 'english__u1', 0),
  ('english__grammar_usage', 'Grammar & Usage', 'english', 'english__u2', 100),
  ('english__vocabulary', 'Vocabulary', 'english', 'english__u2', 101),
  ('english__figures_of_speech', 'Figures of Speech', 'english', 'english__u2', 102),
  ('english__literature_prose', 'Literature — Prose', 'english', 'english__u3', 200),
  ('english__literature_poetry', 'Literature — Poetry', 'english', 'english__u3', 201),
  ('english__note_making', 'Note Making', 'english', 'english__u3', 202),
  ('english__composition', 'Composition', 'english', 'english__u3', 203),
  ('hindi__apathit_gadyansh', 'Apathit Gadyansh', 'hindi', 'hindi__u1', 0),
  ('hindi__apathit_padyansh', 'Apathit Padyansh', 'hindi', 'hindi__u1', 1),
  ('hindi__vyakaran', 'Vyakaran', 'hindi', 'hindi__u2', 100),
  ('hindi__anuvad', 'Anuvad', 'hindi', 'hindi__u2', 101),
  ('hindi__kavya_khand', 'Kavya Khand', 'hindi', 'hindi__u3', 200),
  ('hindi__gadya_khand', 'Gadya Khand', 'hindi', 'hindi__u3', 201),
  ('hindi__rachnatmak_lekhan', 'Rachnatmak Lekhan', 'hindi', 'hindi__u3', 202),
  ('assamese__reading_comprehension', 'Reading Comprehension', 'assamese', 'assamese__u1', 0),
  ('assamese__grammar', 'Grammar', 'assamese', 'assamese__u2', 100),
  ('assamese__vocabulary', 'Vocabulary', 'assamese', 'assamese__u2', 101),
  ('assamese__literature_prose', 'Literature — Prose', 'assamese', 'assamese__u3', 200),
  ('assamese__literature_poetry', 'Literature — Poetry', 'assamese', 'assamese__u3', 201),
  ('assamese__composition', 'Composition', 'assamese', 'assamese__u3', 202),
  ('bengali__reading_comprehension', 'Reading Comprehension', 'bengali', 'bengali__u1', 0),
  ('bengali__grammar', 'Grammar', 'bengali', 'bengali__u2', 100),
  ('bengali__vocabulary', 'Vocabulary', 'bengali', 'bengali__u2', 101),
  ('bengali__literature_prose', 'Literature — Prose', 'bengali', 'bengali__u3', 200),
  ('bengali__literature_poetry', 'Literature — Poetry', 'bengali', 'bengali__u3', 201),
  ('bengali__composition', 'Composition', 'bengali', 'bengali__u3', 202),
  ('gujarati__reading_comprehension', 'Reading Comprehension', 'gujarati', 'gujarati__u1', 0),
  ('gujarati__grammar', 'Grammar', 'gujarati', 'gujarati__u2', 100),
  ('gujarati__vocabulary', 'Vocabulary', 'gujarati', 'gujarati__u2', 101),
  ('gujarati__literature_prose', 'Literature — Prose', 'gujarati', 'gujarati__u3', 200),
  ('gujarati__literature_poetry', 'Literature — Poetry', 'gujarati', 'gujarati__u3', 201),
  ('gujarati__composition', 'Composition', 'gujarati', 'gujarati__u3', 202),
  ('kannada__reading_comprehension', 'Reading Comprehension', 'kannada', 'kannada__u1', 0),
  ('kannada__grammar', 'Grammar', 'kannada', 'kannada__u2', 100),
  ('kannada__vocabulary', 'Vocabulary', 'kannada', 'kannada__u2', 101),
  ('kannada__literature_prose', 'Literature — Prose', 'kannada', 'kannada__u3', 200),
  ('kannada__literature_poetry', 'Literature — Poetry', 'kannada', 'kannada__u3', 201),
  ('kannada__composition', 'Composition', 'kannada', 'kannada__u3', 202),
  ('malayalam__reading_comprehension', 'Reading Comprehension', 'malayalam', 'malayalam__u1', 0),
  ('malayalam__grammar', 'Grammar', 'malayalam', 'malayalam__u2', 100),
  ('malayalam__vocabulary', 'Vocabulary', 'malayalam', 'malayalam__u2', 101),
  ('malayalam__literature_prose', 'Literature — Prose', 'malayalam', 'malayalam__u3', 200),
  ('malayalam__literature_poetry', 'Literature — Poetry', 'malayalam', 'malayalam__u3', 201),
  ('malayalam__composition', 'Composition', 'malayalam', 'malayalam__u3', 202),
  ('marathi__reading_comprehension', 'Reading Comprehension', 'marathi', 'marathi__u1', 0),
  ('marathi__grammar', 'Grammar', 'marathi', 'marathi__u2', 100),
  ('marathi__vocabulary', 'Vocabulary', 'marathi', 'marathi__u2', 101),
  ('marathi__literature_prose', 'Literature — Prose', 'marathi', 'marathi__u3', 200),
  ('marathi__literature_poetry', 'Literature — Poetry', 'marathi', 'marathi__u3', 201),
  ('marathi__composition', 'Composition', 'marathi', 'marathi__u3', 202),
  ('odia__reading_comprehension', 'Reading Comprehension', 'odia', 'odia__u1', 0),
  ('odia__grammar', 'Grammar', 'odia', 'odia__u2', 100),
  ('odia__vocabulary', 'Vocabulary', 'odia', 'odia__u2', 101),
  ('odia__literature_prose', 'Literature — Prose', 'odia', 'odia__u3', 200),
  ('odia__literature_poetry', 'Literature — Poetry', 'odia', 'odia__u3', 201),
  ('odia__composition', 'Composition', 'odia', 'odia__u3', 202),
  ('punjabi__reading_comprehension', 'Reading Comprehension', 'punjabi', 'punjabi__u1', 0),
  ('punjabi__grammar', 'Grammar', 'punjabi', 'punjabi__u2', 100),
  ('punjabi__vocabulary', 'Vocabulary', 'punjabi', 'punjabi__u2', 101),
  ('punjabi__literature_prose', 'Literature — Prose', 'punjabi', 'punjabi__u3', 200),
  ('punjabi__literature_poetry', 'Literature — Poetry', 'punjabi', 'punjabi__u3', 201),
  ('punjabi__composition', 'Composition', 'punjabi', 'punjabi__u3', 202),
  ('tamil__reading_comprehension', 'Reading Comprehension', 'tamil', 'tamil__u1', 0),
  ('tamil__grammar', 'Grammar', 'tamil', 'tamil__u2', 100),
  ('tamil__vocabulary', 'Vocabulary', 'tamil', 'tamil__u2', 101),
  ('tamil__literature_prose', 'Literature — Prose', 'tamil', 'tamil__u3', 200),
  ('tamil__literature_poetry', 'Literature — Poetry', 'tamil', 'tamil__u3', 201),
  ('tamil__composition', 'Composition', 'tamil', 'tamil__u3', 202),
  ('telugu__reading_comprehension', 'Reading Comprehension', 'telugu', 'telugu__u1', 0),
  ('telugu__grammar', 'Grammar', 'telugu', 'telugu__u2', 100),
  ('telugu__vocabulary', 'Vocabulary', 'telugu', 'telugu__u2', 101),
  ('telugu__literature_prose', 'Literature — Prose', 'telugu', 'telugu__u3', 200),
  ('telugu__literature_poetry', 'Literature — Poetry', 'telugu', 'telugu__u3', 201),
  ('telugu__composition', 'Composition', 'telugu', 'telugu__u3', 202),
  ('urdu__reading_comprehension', 'Reading Comprehension', 'urdu', 'urdu__u1', 0),
  ('urdu__grammar', 'Grammar', 'urdu', 'urdu__u2', 100),
  ('urdu__vocabulary', 'Vocabulary', 'urdu', 'urdu__u2', 101),
  ('urdu__literature_prose', 'Literature — Prose', 'urdu', 'urdu__u3', 200),
  ('urdu__literature_poetry', 'Literature — Poetry', 'urdu', 'urdu__u3', 201),
  ('urdu__composition', 'Composition', 'urdu', 'urdu__u3', 202),
  ('accountancy__partnership_fundamentals', 'Partnership Fundamentals', 'accountancy', 'accountancy__u1', 0),
  ('accountancy__profit_loss_appropriation_account', 'Profit & Loss Appropriation Account', 'accountancy', 'accountancy__u1', 1),
  ('accountancy__change_in_profit_sharing_ratio', 'Change in Profit Sharing Ratio', 'accountancy', 'accountancy__u2', 100),
  ('accountancy__goodwill_valuation', 'Goodwill Valuation', 'accountancy', 'accountancy__u2', 101),
  ('accountancy__admission_of_partner', 'Admission of Partner', 'accountancy', 'accountancy__u2', 102),
  ('accountancy__retirement_death_of_partner', 'Retirement & Death of Partner', 'accountancy', 'accountancy__u2', 103),
  ('accountancy__dissolution_of_partnership', 'Dissolution of Partnership', 'accountancy', 'accountancy__u3', 200),
  ('accountancy__dissolution_of_partnership_firm', 'Dissolution of Partnership Firm', 'accountancy', 'accountancy__u3', 201),
  ('accountancy__share_capital', 'Share Capital', 'accountancy', 'accountancy__u4', 300),
  ('accountancy__debentures', 'Debentures', 'accountancy', 'accountancy__u4', 301),
  ('accountancy__financial_statements_of_company', 'Financial Statements of Company', 'accountancy', 'accountancy__u5', 400),
  ('accountancy__analysis_of_financial_statements', 'Analysis of Financial Statements', 'accountancy', 'accountancy__u5', 401),
  ('accountancy__comparative_common_size_statements', 'Comparative & Common Size Statements', 'accountancy', 'accountancy__u5', 402),
  ('accountancy__accounting_ratios', 'Accounting Ratios', 'accountancy', 'accountancy__u5', 403),
  ('accountancy__cash_flow_statement', 'Cash Flow Statement', 'accountancy', 'accountancy__u5', 404),
  ('accountancy__computerized_accounting_system', 'Computerized Accounting System', 'accountancy', 'accountancy__u6', 500),
  ('agriculture__agricultural_meteorology', 'Agricultural Meteorology', 'agriculture', 'agriculture__u1', 0),
  ('agriculture__genetics_plant_breeding', 'Genetics & Plant Breeding', 'agriculture', 'agriculture__u1', 1),
  ('agriculture__biochemistry_microbiology', 'Biochemistry & Microbiology', 'agriculture', 'agriculture__u1', 2),
  ('agriculture__seed_science', 'Seed Science', 'agriculture', 'agriculture__u1', 3),
  ('agriculture__livestock_production', 'Livestock Production', 'agriculture', 'agriculture__u2', 100),
  ('agriculture__crop_production', 'Crop Production', 'agriculture', 'agriculture__u3', 200),
  ('agriculture__horticulture', 'Horticulture', 'agriculture', 'agriculture__u4', 300),
  ('agriculture__agricultural_economics', 'Agricultural Economics', 'agriculture', 'agriculture__u5', 400),
  ('agriculture__basic_agricultural_engineering', 'Basic Agricultural Engineering', 'agriculture', 'agriculture__u5', 401),
  ('agriculture__extension_education', 'Extension Education', 'agriculture', 'agriculture__u5', 402),
  ('anthropology__introducing_anthropology', 'Introducing Anthropology', 'anthropology', 'anthropology__u1', 0),
  ('anthropology__human_evolution', 'Human Evolution', 'anthropology', 'anthropology__u1', 1),
  ('anthropology__human_genetics', 'Human Genetics', 'anthropology', 'anthropology__u1', 2),
  ('anthropology__archaeological_anthropology', 'Archaeological Anthropology', 'anthropology', 'anthropology__u2', 100),
  ('anthropology__fieldwork_methods', 'Fieldwork Methods', 'anthropology', 'anthropology__u2', 101),
  ('anthropology__human_ecology', 'Human Ecology', 'anthropology', 'anthropology__u3', 200),
  ('anthropology__demographic_anthropology', 'Demographic Anthropology', 'anthropology', 'anthropology__u3', 201),
  ('anthropology__indian_anthropology', 'Indian Anthropology', 'anthropology', 'anthropology__u4', 300),
  ('anthropology__tribal_india', 'Tribal India', 'anthropology', 'anthropology__u4', 301),
  ('anthropology__applied_anthropology', 'Applied Anthropology', 'anthropology', 'anthropology__u5', 400),
  ('biology__reproduction_in_organisms', 'Reproduction in Organisms', 'biology', 'biology__u1', 0),
  ('biology__sexual_reproduction_in_flowering_plants', 'Sexual Reproduction in Flowering Plants', 'biology', 'biology__u1', 1),
  ('biology__human_reproduction', 'Human Reproduction', 'biology', 'biology__u1', 2),
  ('biology__reproductive_health', 'Reproductive Health', 'biology', 'biology__u1', 3),
  ('biology__principles_of_inheritance_variation', 'Principles of Inheritance & Variation', 'biology', 'biology__u2', 100),
  ('biology__molecular_basis_of_inheritance', 'Molecular Basis of Inheritance', 'biology', 'biology__u2', 101),
  ('biology__evolution', 'Evolution', 'biology', 'biology__u2', 102),
  ('biology__human_health_disease', 'Human Health & Disease', 'biology', 'biology__u3', 200),
  ('biology__microbes_in_human_welfare', 'Microbes in Human Welfare', 'biology', 'biology__u3', 201),
  ('biology__biotechnology_principles_processes', 'Biotechnology Principles & Processes', 'biology', 'biology__u4', 300),
  ('biology__biotechnology_its_applications', 'Biotechnology & its Applications', 'biology', 'biology__u4', 301),
  ('biology__organisms_populations', 'Organisms & Populations', 'biology', 'biology__u5', 400),
  ('biology__ecosystem', 'Ecosystem', 'biology', 'biology__u5', 401),
  ('biology__biodiversity_conservation', 'Biodiversity & Conservation', 'biology', 'biology__u5', 402),
  ('biology__environmental_issues', 'Environmental Issues', 'biology', 'biology__u5', 403),
  ('business_studies__nature_significance_of_management', 'Nature & Significance of Management', 'business_studies', 'business_studies__u1', 0),
  ('business_studies__principles_of_management', 'Principles of Management', 'business_studies', 'business_studies__u2', 100),
  ('business_studies__business_environment', 'Business Environment', 'business_studies', 'business_studies__u3', 200),
  ('business_studies__planning', 'Planning', 'business_studies', 'business_studies__u4', 300),
  ('business_studies__organising', 'Organising', 'business_studies', 'business_studies__u5', 400),
  ('business_studies__staffing', 'Staffing', 'business_studies', 'business_studies__u6', 500),
  ('business_studies__directing', 'Directing', 'business_studies', 'business_studies__u7', 600),
  ('business_studies__controlling', 'Controlling', 'business_studies', 'business_studies__u8', 700),
  ('business_studies__financial_management', 'Financial Management', 'business_studies', 'business_studies__u9', 800),
  ('business_studies__financial_markets', 'Financial Markets', 'business_studies', 'business_studies__u10', 900),
  ('business_studies__marketing_management', 'Marketing Management', 'business_studies', 'business_studies__u11', 1000),
  ('business_studies__consumer_protection', 'Consumer Protection', 'business_studies', 'business_studies__u12', 1100),
  ('business_studies__entrepreneurship_development', 'Entrepreneurship Development', 'business_studies', 'business_studies__u13', 1200),
  ('chemistry__solutions', 'Solutions', 'chemistry', 'chemistry__u1', 0),
  ('chemistry__electrochemistry', 'Electrochemistry', 'chemistry', 'chemistry__u2', 100),
  ('chemistry__chemical_kinetics', 'Chemical Kinetics', 'chemistry', 'chemistry__u3', 200),
  ('chemistry__d_and_f_block_elements', 'd- and f-Block Elements', 'chemistry', 'chemistry__u4', 300),
  ('chemistry__coordination_compounds', 'Coordination Compounds', 'chemistry', 'chemistry__u5', 400),
  ('chemistry__haloalkanes_haloarenes', 'Haloalkanes & Haloarenes', 'chemistry', 'chemistry__u6', 500),
  ('chemistry__alcohols_phenols_ethers', 'Alcohols, Phenols & Ethers', 'chemistry', 'chemistry__u7', 600),
  ('chemistry__aldehydes_ketones_carboxylic_acids', 'Aldehydes, Ketones & Carboxylic Acids', 'chemistry', 'chemistry__u8', 700),
  ('chemistry__amines', 'Amines', 'chemistry', 'chemistry__u9', 800),
  ('chemistry__biomolecules', 'Biomolecules', 'chemistry', 'chemistry__u10', 900),
  ('chemistry__solid_state', 'Solid State', 'chemistry', 'chemistry__u11', 1000),
  ('chemistry__surface_chemistry', 'Surface Chemistry', 'chemistry', 'chemistry__u11', 1001),
  ('chemistry__isolation_of_elements', 'Isolation of Elements', 'chemistry', 'chemistry__u11', 1002),
  ('chemistry__p_block_elements', 'p-Block Elements', 'chemistry', 'chemistry__u11', 1003),
  ('chemistry__polymers', 'Polymers', 'chemistry', 'chemistry__u11', 1004),
  ('chemistry__chemistry_in_everyday_life', 'Chemistry in Everyday Life', 'chemistry', 'chemistry__u11', 1005),
  ('computer_science__database_concepts', 'Database Concepts', 'computer_science', 'computer_science__u1', 0),
  ('computer_science__mysql', 'MySQL', 'computer_science', 'computer_science__u1', 1),
  ('computer_science__structured_query_language', 'Structured Query Language', 'computer_science', 'computer_science__u1', 2),
  ('computer_science__computer_networks', 'Computer Networks', 'computer_science', 'computer_science__u1', 3),
  ('computer_science__python_revision', 'Python Revision', 'computer_science', 'computer_science__u2', 100),
  ('computer_science__functions', 'Functions', 'computer_science', 'computer_science__u2', 101),
  ('computer_science__file_handling', 'File Handling', 'computer_science', 'computer_science__u2', 102),
  ('computer_science__exception_and_file_handling_in_python', 'Exception and File Handling in Python', 'computer_science', 'computer_science__u2', 103),
  ('computer_science__data_structures', 'Data Structures', 'computer_science', 'computer_science__u2', 104),
  ('computer_science__stack', 'Stack', 'computer_science', 'computer_science__u2', 105),
  ('computer_science__queue', 'Queue', 'computer_science', 'computer_science__u2', 106),
  ('computer_science__searching', 'Searching', 'computer_science', 'computer_science__u2', 107),
  ('computer_science__sorting', 'Sorting', 'computer_science', 'computer_science__u2', 108),
  ('computer_science__understanding_data', 'Understanding Data', 'computer_science', 'computer_science__u2', 109),
  ('computer_science__interface_python_with_mysql', 'Interface Python with MySQL', 'computer_science', 'computer_science__u2', 110),
  ('computer_science__data_communication', 'Data Communication', 'computer_science', 'computer_science__u2', 111),
  ('computer_science__security_aspects', 'Security Aspects', 'computer_science', 'computer_science__u2', 112),
  ('computer_science__communication_technologies', 'Communication Technologies', 'computer_science', 'computer_science__u2', 113),
  ('computer_science__boolean_algebra', 'Boolean Algebra', 'computer_science', 'computer_science__u2', 114),
  ('computer_science__data_handling_using_pandas', 'Data Handling using Pandas', 'computer_science', 'computer_science__u3', 200),
  ('computer_science__plotting_data_using_matplotlib', 'Plotting Data using Matplotlib', 'computer_science', 'computer_science__u3', 201),
  ('computer_science__societal_impacts', 'Societal Impacts', 'computer_science', 'computer_science__u3', 202),
  ('computer_science__project_based_learning', 'Project Based Learning', 'computer_science', 'computer_science__u3', 203),
  ('economics__introduction_theory_of_consumer_behaviour', 'Introduction & Theory of Consumer Behaviour', 'economics', 'economics__u1', 0),
  ('economics__production_costs', 'Production & Costs', 'economics', 'economics__u1', 1),
  ('economics__theory_of_firms_under_perfect_competition', 'Theory of Firms under Perfect Competition', 'economics', 'economics__u1', 2),
  ('economics__market_equilibrium_simple_applications', 'Market Equilibrium & Simple Applications', 'economics', 'economics__u1', 3),
  ('economics__national_income_related_aggregates', 'National Income & Related Aggregates', 'economics', 'economics__u2', 100),
  ('economics__money_banking', 'Money & Banking', 'economics', 'economics__u2', 101),
  ('economics__income_determination', 'Income Determination', 'economics', 'economics__u2', 102),
  ('economics__government_budget_the_economy', 'Government Budget & the Economy', 'economics', 'economics__u2', 103),
  ('economics__balance_of_payments', 'Balance of Payments', 'economics', 'economics__u2', 104),
  ('economics__indian_economy_on_the_eve_of_independence', 'Indian Economy on the Eve of Independence', 'economics', 'economics__u3', 200),
  ('economics__indian_economic_development_1950_1990', 'Indian Economic Development 1950–1990', 'economics', 'economics__u3', 201),
  ('economics__economic_reforms_since_1991', 'Economic Reforms Since 1991', 'economics', 'economics__u3', 202),
  ('economics__human_capital_formation', 'Human Capital Formation', 'economics', 'economics__u3', 203),
  ('economics__rural_development', 'Rural Development', 'economics', 'economics__u3', 204),
  ('economics__employment', 'Employment', 'economics', 'economics__u3', 205),
  ('economics__infrastructure', 'Infrastructure', 'economics', 'economics__u3', 206),
  ('economics__environment_sustainable_development', 'Environment & Sustainable Development', 'economics', 'economics__u3', 207),
  ('economics__development_experiences_of_india', 'Development Experiences of India', 'economics', 'economics__u3', 208),
  ('engineering_graphics__isometric_projection_of_solids', 'Isometric Projection of Solids', 'engineering_graphics', 'engineering_graphics__u1', 0),
  ('engineering_graphics__machine_drawing', 'Machine Drawing', 'engineering_graphics', 'engineering_graphics__u1', 1),
  ('engineering_graphics__building_drawing', 'Building Drawing', 'engineering_graphics', 'engineering_graphics__u1', 2),
  ('engineering_graphics__engineering_curves', 'Engineering Curves', 'engineering_graphics', 'engineering_graphics__u1', 3),
  ('engineering_graphics__projection_of_points_lines', 'Projection of Points & Lines', 'engineering_graphics', 'engineering_graphics__u1', 4),
  ('engineering_graphics__projection_of_planes', 'Projection of Planes', 'engineering_graphics', 'engineering_graphics__u1', 5),
  ('engineering_graphics__projection_of_solids', 'Projection of Solids', 'engineering_graphics', 'engineering_graphics__u1', 6),
  ('engineering_graphics__sectional_views', 'Sectional Views', 'engineering_graphics', 'engineering_graphics__u1', 7),
  ('engineering_graphics__orthographic_projections', 'Orthographic Projections', 'engineering_graphics', 'engineering_graphics__u1', 8),
  ('engineering_graphics__computer_aided_drawing', 'Computer-Aided Drawing', 'engineering_graphics', 'engineering_graphics__u1', 9),
  ('entrepreneurship__entrepreneurial_opportunity', 'Entrepreneurial Opportunity', 'entrepreneurship', 'entrepreneurship__u1', 0),
  ('entrepreneurship__entrepreneurial_planning', 'Entrepreneurial Planning', 'entrepreneurship', 'entrepreneurship__u1', 1),
  ('entrepreneurship__enterprise_marketing', 'Enterprise Marketing', 'entrepreneurship', 'entrepreneurship__u1', 2),
  ('entrepreneurship__enterprise_growth_strategies', 'Enterprise Growth Strategies', 'entrepreneurship', 'entrepreneurship__u1', 3),
  ('entrepreneurship__business_arithmetic', 'Business Arithmetic', 'entrepreneurship', 'entrepreneurship__u1', 4),
  ('entrepreneurship__resource_mobilization', 'Resource Mobilization', 'entrepreneurship', 'entrepreneurship__u1', 5),
  ('entrepreneurship__entrepreneurial_ethics', 'Entrepreneurial Ethics', 'entrepreneurship', 'entrepreneurship__u1', 6),
  ('entrepreneurship__concept_functions_of_entrepreneurship', 'Concept & Functions of Entrepreneurship', 'entrepreneurship', 'entrepreneurship__u1', 7),
  ('environmental_studies__human_beings_and_nature', 'Human Beings and Nature', 'environmental_studies', 'environmental_studies__u1', 0),
  ('environmental_studies__population_and_conservation_ecology', 'Population and Conservation Ecology', 'environmental_studies', 'environmental_studies__u1', 1),
  ('environmental_studies__environmental_pollution', 'Environmental Pollution', 'environmental_studies', 'environmental_studies__u1', 2),
  ('environmental_studies__development_and_environment', 'Development and Environment', 'environmental_studies', 'environmental_studies__u1', 3),
  ('environmental_studies__sustainable_agriculture_in_india', 'Sustainable Agriculture in India', 'environmental_studies', 'environmental_studies__u1', 4),
  ('environmental_studies__environmental_and_natural_resource_economics', 'Environmental and Natural Resource Economics', 'environmental_studies', 'environmental_studies__u1', 5),
  ('environmental_studies__international_relations_and_the_environment', 'International Relations and the Environment', 'environmental_studies', 'environmental_studies__u1', 6),
  ('environmental_studies__natural_resources', 'Natural Resources', 'environmental_studies', 'environmental_studies__u2', 100),
  ('environmental_studies__ecosystems', 'Ecosystems', 'environmental_studies', 'environmental_studies__u2', 101),
  ('environmental_studies__biodiversity', 'Biodiversity', 'environmental_studies', 'environmental_studies__u2', 102),
  ('environmental_studies__social_issues_environment', 'Social Issues & Environment', 'environmental_studies', 'environmental_studies__u2', 103),
  ('environmental_studies__human_population', 'Human Population', 'environmental_studies', 'environmental_studies__u2', 104),
  ('environmental_studies__environmental_policies', 'Environmental Policies', 'environmental_studies', 'environmental_studies__u2', 105),
  ('environmental_studies__case_studies', 'Case Studies', 'environmental_studies', 'environmental_studies__u2', 106),
  ('fine_arts__the_rajasthani_school', 'The Rajasthani School', 'fine_arts', 'fine_arts__u1', 0),
  ('fine_arts__the_pahari_school', 'The Pahari School', 'fine_arts', 'fine_arts__u1', 1),
  ('fine_arts__the_mughal_school', 'The Mughal School', 'fine_arts', 'fine_arts__u2', 100),
  ('fine_arts__the_deccan_school', 'The Deccan School', 'fine_arts', 'fine_arts__u2', 101),
  ('fine_arts__the_bengal_school', 'The Bengal School', 'fine_arts', 'fine_arts__u3', 200),
  ('fine_arts__modern_indian_art', 'Modern Indian Art', 'fine_arts', 'fine_arts__u4', 300),
  ('fine_arts__graphic_prints', 'Graphic Prints', 'fine_arts', 'fine_arts__u4', 301),
  ('fine_arts__sculpture_post_independence', 'Sculpture Post-Independence', 'fine_arts', 'fine_arts__u4', 302),
  ('fine_arts__modern_trends_in_indian_art', 'Modern Trends in Indian Art', 'fine_arts', 'fine_arts__u4', 303),
  ('geography__human_geography_nature_scope', 'Human Geography — Nature & Scope', 'geography', 'geography__u1', 0),
  ('geography__population_distribution_density_growth', 'Population — Distribution, Density, Growth', 'geography', 'geography__u2', 100),
  ('geography__migration', 'Migration', 'geography', 'geography__u2', 101),
  ('geography__human_development', 'Human Development', 'geography', 'geography__u2', 102),
  ('geography__india_people_economy', 'India — People & Economy', 'geography', 'geography__u2', 103),
  ('geography__primary_activities', 'Primary Activities', 'geography', 'geography__u3', 200),
  ('geography__secondary_activities', 'Secondary Activities', 'geography', 'geography__u3', 201),
  ('geography__tertiary_quaternary_activities', 'Tertiary & Quaternary Activities', 'geography', 'geography__u3', 202),
  ('geography__transport_communication', 'Transport & Communication', 'geography', 'geography__u4', 300),
  ('geography__international_trade', 'International Trade', 'geography', 'geography__u4', 301),
  ('geography__human_settlements', 'Human Settlements', 'geography', 'geography__u5', 400),
  ('geography__resources_development', 'Resources & Development', 'geography', 'geography__u6', 500),
  ('geography__manufacturing_industries', 'Manufacturing Industries', 'geography', 'geography__u6', 501),
  ('geography__planning_sustainable_development', 'Planning & Sustainable Development', 'geography', 'geography__u6', 502),
  ('geography__geographical_perspective_on_selected_issues_and_problems', 'Geographical Perspective on Selected Issues and Problems', 'geography', 'geography__u7', 600),
  ('history__bricks_beads_bones', 'Bricks, Beads & Bones', 'history', 'history__u1', 0),
  ('history__kings_farmers_towns', 'Kings, Farmers & Towns', 'history', 'history__u1', 1),
  ('history__kinship_caste_class', 'Kinship, Caste & Class', 'history', 'history__u1', 2),
  ('history__thinkers_beliefs_buildings', 'Thinkers, Beliefs & Buildings', 'history', 'history__u1', 3),
  ('history__through_the_eyes_of_travellers', 'Through the Eyes of Travellers', 'history', 'history__u2', 100),
  ('history__bhakti_sufi_traditions', 'Bhakti-Sufi Traditions', 'history', 'history__u2', 101),
  ('history__an_imperial_capital_vijayanagara', 'An Imperial Capital — Vijayanagara', 'history', 'history__u2', 102),
  ('history__peasants_zamindars_the_state', 'Peasants, Zamindars & the State', 'history', 'history__u2', 103),
  ('history__kings_chronicles', 'Kings & Chronicles', 'history', 'history__u2', 104),
  ('history__colonialism_the_countryside', 'Colonialism & the Countryside', 'history', 'history__u3', 200),
  ('history__rebels_the_raj', 'Rebels & the Raj', 'history', 'history__u3', 201),
  ('history__mahatma_gandhi_the_nationalist_movement', 'Mahatma Gandhi & the Nationalist Movement', 'history', 'history__u3', 202),
  ('history__partition', 'Partition', 'history', 'history__u3', 203),
  ('history__framing_the_constitution', 'Framing the Constitution', 'history', 'history__u3', 204),
  ('home_science__work_livelihood_and_career', 'Work, Livelihood and Career', 'home_science', 'home_science__u1', 0),
  ('home_science__nutrition_for_self_family_community', 'Nutrition for Self, Family & Community', 'home_science', 'home_science__u2', 100),
  ('home_science__food_safety_quality', 'Food Safety & Quality', 'home_science', 'home_science__u2', 101),
  ('home_science__human_development', 'Human Development', 'home_science', 'home_science__u3', 200),
  ('home_science__child_care_development', 'Child Care & Development', 'home_science', 'home_science__u3', 201),
  ('home_science__apparel_designing_care', 'Apparel Designing & Care', 'home_science', 'home_science__u4', 300),
  ('home_science__money_management_consumer_education', 'Money Management & Consumer Education', 'home_science', 'home_science__u5', 400),
  ('home_science__household_management', 'Household Management', 'home_science', 'home_science__u5', 401),
  ('home_science__community_development', 'Community Development', 'home_science', 'home_science__u6', 500),
  ('home_science__communication_and_extension', 'Communication and Extension', 'home_science', 'home_science__u6', 501),
  ('knowledge_tradition_india__agriculture_a_survey', 'Agriculture: A Survey', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 0),
  ('knowledge_tradition_india__architecture_a_survey', 'Architecture: A Survey', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 1),
  ('knowledge_tradition_india__dance_a_survey', 'Dance: A Survey', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 2),
  ('knowledge_tradition_india__education_systems_and_practices', 'Education Systems and Practices', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 3),
  ('knowledge_tradition_india__indian_ethics', 'Indian Ethics', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 4),
  ('knowledge_tradition_india__martial_arts_traditions', 'Martial Arts Traditions', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 5),
  ('knowledge_tradition_india__language_and_grammar', 'Language and Grammar', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 6),
  ('knowledge_tradition_india__other_technologies', 'Other Technologies', 'knowledge_tradition_india', 'knowledge_tradition_india__u1', 7),
  ('knowledge_tradition_india__indian_languages_literature_scriptures', 'Indian Languages, Literature & Scriptures', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 100),
  ('knowledge_tradition_india__indian_philosophy', 'Indian Philosophy', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 101),
  ('knowledge_tradition_india__religion_spirituality', 'Religion & Spirituality', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 102),
  ('knowledge_tradition_india__indian_arts', 'Indian Arts', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 103),
  ('knowledge_tradition_india__indian_architecture', 'Indian Architecture', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 104),
  ('knowledge_tradition_india__science_technology_in_india', 'Science & Technology in India', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 105),
  ('knowledge_tradition_india__polity_economy', 'Polity & Economy', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 106),
  ('knowledge_tradition_india__education_system', 'Education System', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 107),
  ('knowledge_tradition_india__agriculture_crafts', 'Agriculture & Crafts', 'knowledge_tradition_india', 'knowledge_tradition_india__u2', 108),
  ('legal_studies__judiciary', 'Judiciary', 'legal_studies', 'legal_studies__u1', 0),
  ('legal_studies__topics_of_law', 'Topics of Law', 'legal_studies', 'legal_studies__u1', 1),
  ('legal_studies__arbitration_tribunal_adjudication_adr', 'Arbitration, Tribunal Adjudication & ADR', 'legal_studies', 'legal_studies__u1', 2),
  ('legal_studies__human_rights', 'Human Rights', 'legal_studies', 'legal_studies__u1', 3),
  ('legal_studies__legal_profession_in_india', 'Legal Profession in India', 'legal_studies', 'legal_studies__u1', 4),
  ('legal_studies__legal_services', 'Legal Services', 'legal_studies', 'legal_studies__u1', 5),
  ('legal_studies__international_context', 'International Context', 'legal_studies', 'legal_studies__u1', 6),
  ('legal_studies__constitutional_law', 'Constitutional Law', 'legal_studies', 'legal_studies__u1', 7),
  ('legal_studies__criminal_law', 'Criminal Law', 'legal_studies', 'legal_studies__u1', 8),
  ('legal_studies__family_law', 'Family Law', 'legal_studies', 'legal_studies__u1', 9),
  ('mass_media__communication', 'Communication', 'mass_media', 'mass_media__u1', 0),
  ('mass_media__journalism', 'Journalism', 'mass_media', 'mass_media__u1', 1),
  ('mass_media__advertising_and_public_relations', 'Advertising and Public Relations', 'mass_media', 'mass_media__u1', 2),
  ('mass_media__tv_production_process_and_programmes', 'TV Production Process and Programmes', 'mass_media', 'mass_media__u1', 3),
  ('mass_media__radio', 'Radio', 'mass_media', 'mass_media__u1', 4),
  ('mass_media__cinema', 'Cinema', 'mass_media', 'mass_media__u1', 5),
  ('mass_media__social_media', 'Social Media', 'mass_media', 'mass_media__u1', 6),
  ('mass_media__new_media', 'New Media', 'mass_media', 'mass_media__u1', 7),
  ('mass_media__introduction_to_mass_communication', 'Introduction to Mass Communication', 'mass_media', 'mass_media__u2', 100),
  ('mass_media__print_media', 'Print Media', 'mass_media', 'mass_media__u2', 101),
  ('mass_media__television', 'Television', 'mass_media', 'mass_media__u2', 102),
  ('mass_media__advertising', 'Advertising', 'mass_media', 'mass_media__u2', 103),
  ('mass_media__public_relations', 'Public Relations', 'mass_media', 'mass_media__u2', 104),
  ('mass_media__media_ethics', 'Media Ethics', 'mass_media', 'mass_media__u2', 105),
  ('mathematics__relations_functions', 'Relations & Functions', 'mathematics', 'mathematics__u1', 0),
  ('mathematics__inverse_trigonometric_functions', 'Inverse Trigonometric Functions', 'mathematics', 'mathematics__u1', 1),
  ('mathematics__matrices', 'Matrices', 'mathematics', 'mathematics__u2', 100),
  ('mathematics__determinants', 'Determinants', 'mathematics', 'mathematics__u2', 101),
  ('mathematics__continuity_differentiability', 'Continuity & Differentiability', 'mathematics', 'mathematics__u3', 200),
  ('mathematics__application_of_derivatives', 'Application of Derivatives', 'mathematics', 'mathematics__u3', 201),
  ('mathematics__integrals', 'Integrals', 'mathematics', 'mathematics__u3', 202),
  ('mathematics__application_of_integrals', 'Application of Integrals', 'mathematics', 'mathematics__u3', 203),
  ('mathematics__differential_equations', 'Differential Equations', 'mathematics', 'mathematics__u3', 204),
  ('mathematics__vector_algebra', 'Vector Algebra', 'mathematics', 'mathematics__u4', 300),
  ('mathematics__three_dimensional_geometry', 'Three Dimensional Geometry', 'mathematics', 'mathematics__u4', 301),
  ('mathematics__linear_programming', 'Linear Programming', 'mathematics', 'mathematics__u5', 400),
  ('mathematics__probability', 'Probability', 'mathematics', 'mathematics__u6', 500),
  ('mathematics__numbers_quantification_and_numerical_applications', 'Numbers, Quantification and Numerical Applications', 'mathematics', 'mathematics__u7', 600),
  ('mathematics__probability_distributions', 'Probability Distributions', 'mathematics', 'mathematics__u7', 601),
  ('mathematics__time_based_data', 'Time Based Data', 'mathematics', 'mathematics__u7', 602),
  ('mathematics__inferential_statistics', 'Inferential Statistics', 'mathematics', 'mathematics__u7', 603),
  ('mathematics__financial_mathematics', 'Financial Mathematics', 'mathematics', 'mathematics__u7', 604),
  ('performing_arts__hindustani_music', 'Hindustani Music', 'performing_arts', 'performing_arts__u1', 0),
  ('performing_arts__carnatic_music', 'Carnatic Music', 'performing_arts', 'performing_arts__u1', 1),
  ('performing_arts__laya_tala', 'Laya & Tala', 'performing_arts', 'performing_arts__u1', 2),
  ('performing_arts__musical_forms', 'Musical Forms', 'performing_arts', 'performing_arts__u1', 3),
  ('performing_arts__musical_instruments', 'Musical Instruments', 'performing_arts', 'performing_arts__u1', 4),
  ('performing_arts__indian_classical_dance', 'Indian Classical Dance', 'performing_arts', 'performing_arts__u2', 100),
  ('performing_arts__folk_dances_of_india', 'Folk Dances of India', 'performing_arts', 'performing_arts__u2', 101),
  ('performing_arts__regional_dance_forms', 'Regional Dance Forms', 'performing_arts', 'performing_arts__u2', 102),
  ('performing_arts__rasa_theory', 'Rasa Theory', 'performing_arts', 'performing_arts__u2', 103),
  ('performing_arts__theatre_traditions', 'Theatre Traditions', 'performing_arts', 'performing_arts__u3', 200),
  ('performing_arts__notable_performers', 'Notable Performers', 'performing_arts', 'performing_arts__u4', 300),
  ('physical_education__health_status_and_programmes_in_india', 'Health Status and Programmes in India', 'physical_education', 'physical_education__u1', 0),
  ('physical_education__planning_in_sports', 'Planning in Sports', 'physical_education', 'physical_education__u2', 100),
  ('physical_education__sports_nutrition', 'Sports & Nutrition', 'physical_education', 'physical_education__u2', 101),
  ('physical_education__yoga_lifestyle', 'Yoga & Lifestyle', 'physical_education', 'physical_education__u2', 102),
  ('physical_education__physical_education_sports_for_cwsn', 'Physical Education & Sports for CWSN', 'physical_education', 'physical_education__u2', 103),
  ('physical_education__children_women_in_sports', 'Children & Women in Sports', 'physical_education', 'physical_education__u2', 104),
  ('physical_education__test_measurement_evaluation', 'Test, Measurement & Evaluation', 'physical_education', 'physical_education__u2', 105),
  ('physical_education__physiology_injuries_in_sports', 'Physiology & Injuries in Sports', 'physical_education', 'physical_education__u2', 106),
  ('physical_education__biomechanics_sports', 'Biomechanics & Sports', 'physical_education', 'physical_education__u2', 107),
  ('physical_education__psychology_sports', 'Psychology & Sports', 'physical_education', 'physical_education__u2', 108),
  ('physical_education__training_in_sports', 'Training in Sports', 'physical_education', 'physical_education__u2', 109),
  ('physics__electric_charges_fields', 'Electric Charges & Fields', 'physics', 'physics__u1', 0),
  ('physics__electrostatic_potential_capacitance', 'Electrostatic Potential & Capacitance', 'physics', 'physics__u1', 1),
  ('physics__current_electricity', 'Current Electricity', 'physics', 'physics__u2', 100),
  ('physics__moving_charges_magnetism', 'Moving Charges & Magnetism', 'physics', 'physics__u3', 200),
  ('physics__magnetism_matter', 'Magnetism & Matter', 'physics', 'physics__u3', 201),
  ('physics__electromagnetic_induction', 'Electromagnetic Induction', 'physics', 'physics__u4', 300),
  ('physics__alternating_current', 'Alternating Current', 'physics', 'physics__u4', 301),
  ('physics__electromagnetic_waves', 'Electromagnetic Waves', 'physics', 'physics__u5', 400),
  ('physics__ray_optics_optical_instruments', 'Ray Optics & Optical Instruments', 'physics', 'physics__u6', 500),
  ('physics__wave_optics', 'Wave Optics', 'physics', 'physics__u6', 501),
  ('physics__dual_nature_of_radiation_matter', 'Dual Nature of Radiation & Matter', 'physics', 'physics__u7', 600),
  ('physics__atoms', 'Atoms', 'physics', 'physics__u8', 700),
  ('physics__nuclei', 'Nuclei', 'physics', 'physics__u8', 701),
  ('physics__semiconductor_electronics', 'Semiconductor Electronics', 'physics', 'physics__u9', 800),
  ('physics__communication_systems', 'Communication Systems', 'physics', 'physics__u10', 900),
  ('political_science__challenges_of_nation_building', 'Challenges of Nation Building', 'political_science', 'political_science__u1', 0),
  ('political_science__era_of_one_party_dominance', 'Era of One-Party Dominance', 'political_science', 'political_science__u1', 1),
  ('political_science__politics_of_planned_development', 'Politics of Planned Development', 'political_science', 'political_science__u1', 2),
  ('political_science__india_s_external_relations', 'India''s External Relations', 'political_science', 'political_science__u1', 3),
  ('political_science__challenges_to_restoration_of_the_congress_system', 'Challenges to & Restoration of the Congress System', 'political_science', 'political_science__u1', 4),
  ('political_science__crisis_of_the_democratic_order', 'Crisis of the Democratic Order', 'political_science', 'political_science__u1', 5),
  ('political_science__rise_of_popular_movements', 'Rise of Popular Movements', 'political_science', 'political_science__u1', 6),
  ('political_science__regional_aspirations', 'Regional Aspirations', 'political_science', 'political_science__u1', 7),
  ('political_science__democratic_upsurge_and_coalition_politics', 'Democratic Upsurge and Coalition Politics', 'political_science', 'political_science__u1', 8),
  ('political_science__recent_issues_and_challenges', 'Recent Issues and Challenges', 'political_science', 'political_science__u1', 9),
  ('political_science__cold_war_era', 'Cold War Era', 'political_science', 'political_science__u2', 100),
  ('political_science__end_of_bipolarity', 'End of Bipolarity', 'political_science', 'political_science__u2', 101),
  ('political_science__us_hegemony_in_world_politics', 'US Hegemony in World Politics', 'political_science', 'political_science__u2', 102),
  ('political_science__alternative_centres_of_power', 'Alternative Centres of Power', 'political_science', 'political_science__u2', 103),
  ('political_science__contemporary_south_asia', 'Contemporary South Asia', 'political_science', 'political_science__u2', 104),
  ('political_science__international_organisations', 'International Organisations', 'political_science', 'political_science__u2', 105),
  ('political_science__security_in_the_contemporary_world', 'Security in the Contemporary World', 'political_science', 'political_science__u2', 106),
  ('political_science__environment_natural_resources', 'Environment & Natural Resources', 'political_science', 'political_science__u2', 107),
  ('political_science__globalisation', 'Globalisation', 'political_science', 'political_science__u2', 108),
  ('psychology__variations_in_psychological_attributes', 'Variations in Psychological Attributes', 'psychology', 'psychology__u1', 0),
  ('psychology__self_personality', 'Self & Personality', 'psychology', 'psychology__u2', 100),
  ('psychology__meeting_life_challenges', 'Meeting Life Challenges', 'psychology', 'psychology__u3', 200),
  ('psychology__psychological_disorders', 'Psychological Disorders', 'psychology', 'psychology__u4', 300),
  ('psychology__therapeutic_approaches', 'Therapeutic Approaches', 'psychology', 'psychology__u5', 400),
  ('psychology__attitude_social_cognition', 'Attitude & Social Cognition', 'psychology', 'psychology__u6', 500),
  ('psychology__social_influence_group_processes', 'Social Influence & Group Processes', 'psychology', 'psychology__u7', 600),
  ('psychology__psychology_life', 'Psychology & Life', 'psychology', 'psychology__u8', 700),
  ('psychology__developing_psychological_skills', 'Developing Psychological Skills', 'psychology', 'psychology__u8', 701),
  ('sanskrit__apathit_avabodhanam', 'Apathit Avabodhanam', 'sanskrit', 'sanskrit__u1', 0),
  ('sanskrit__vyakaranam', 'Vyakaranam', 'sanskrit', 'sanskrit__u1', 1),
  ('sanskrit__racnanatmakam_karya', 'Racnanatmakam Karya', 'sanskrit', 'sanskrit__u1', 2),
  ('sanskrit__shabda_roopani', 'Shabda Roopani', 'sanskrit', 'sanskrit__u1', 3),
  ('sanskrit__dhatu_roopani', 'Dhatu Roopani', 'sanskrit', 'sanskrit__u1', 4),
  ('sanskrit__sandhi', 'Sandhi', 'sanskrit', 'sanskrit__u1', 5),
  ('sanskrit__samasa', 'Samasa', 'sanskrit', 'sanskrit__u1', 6),
  ('sanskrit__pratyaya', 'Pratyaya', 'sanskrit', 'sanskrit__u1', 7),
  ('sanskrit__padyam', 'Padyam', 'sanskrit', 'sanskrit__u2', 100),
  ('sanskrit__gadyam', 'Gadyam', 'sanskrit', 'sanskrit__u2', 101),
  ('sanskrit__natyam', 'Natyam', 'sanskrit', 'sanskrit__u2', 102),
  ('sanskrit__sanskrit_literature', 'Sanskrit Literature', 'sanskrit', 'sanskrit__u2', 103),
  ('sociology__introducing_indian_society', 'Introducing Indian Society', 'sociology', 'sociology__u1', 0),
  ('sociology__demographic_structure', 'Demographic Structure', 'sociology', 'sociology__u1', 1),
  ('sociology__social_institutions', 'Social Institutions', 'sociology', 'sociology__u1', 2),
  ('sociology__patterns_of_social_inequality', 'Patterns of Social Inequality', 'sociology', 'sociology__u1', 3),
  ('sociology__challenges_of_cultural_diversity', 'Challenges of Cultural Diversity', 'sociology', 'sociology__u1', 4),
  ('sociology__structural_change', 'Structural Change', 'sociology', 'sociology__u2', 100),
  ('sociology__cultural_change', 'Cultural Change', 'sociology', 'sociology__u2', 101),
  ('sociology__story_of_indian_democracy', 'Story of Indian Democracy', 'sociology', 'sociology__u2', 102),
  ('sociology__change_development_in_rural_society', 'Change & Development in Rural Society', 'sociology', 'sociology__u2', 103),
  ('sociology__change_development_in_industrial_society', 'Change & Development in Industrial Society', 'sociology', 'sociology__u2', 104),
  ('sociology__market_as_a_social_institution', 'Market as a Social Institution', 'sociology', 'sociology__u2', 105),
  ('sociology__globalisation_social_change', 'Globalisation & Social Change', 'sociology', 'sociology__u2', 106),
  ('sociology__mass_media_communications', 'Mass Media & Communications', 'sociology', 'sociology__u2', 107),
  ('sociology__social_movements', 'Social Movements', 'sociology', 'sociology__u2', 108),
  ('teaching_aptitude__teaching_methodology', 'Teaching Methodology', 'teaching_aptitude', 'teaching_aptitude__u1', 0),
  ('teaching_aptitude__learning_learner', 'Learning & Learner', 'teaching_aptitude', 'teaching_aptitude__u1', 1),
  ('teaching_aptitude__teaching_aids', 'Teaching Aids', 'teaching_aptitude', 'teaching_aptitude__u1', 2),
  ('teaching_aptitude__classroom_management', 'Classroom Management', 'teaching_aptitude', 'teaching_aptitude__u1', 3),
  ('teaching_aptitude__assessment_evaluation', 'Assessment & Evaluation', 'teaching_aptitude', 'teaching_aptitude__u1', 4),
  ('teaching_aptitude__educational_psychology', 'Educational Psychology', 'teaching_aptitude', 'teaching_aptitude__u1', 5),
  ('teaching_aptitude__communication_skills', 'Communication Skills', 'teaching_aptitude', 'teaching_aptitude__u1', 6),
  ('teaching_aptitude__research_aptitude', 'Research Aptitude', 'teaching_aptitude', 'teaching_aptitude__u1', 7),
  ('teaching_aptitude__information_communication_technology', 'Information & Communication Technology', 'teaching_aptitude', 'teaching_aptitude__u1', 8),
  ('gat__general_knowledge', 'General Knowledge', 'gat', 'gat__u1', 0),
  ('gat__current_affairs', 'Current Affairs', 'gat', 'gat__u1', 1),
  ('gat__general_mental_ability', 'General Mental Ability', 'gat', 'gat__u2', 100),
  ('gat__numerical_ability', 'Numerical Ability', 'gat', 'gat__u3', 200),
  ('gat__quantitative_reasoning', 'Quantitative Reasoning', 'gat', 'gat__u4', 300),
  ('gat__basic_mathematical_concepts', 'Basic Mathematical Concepts', 'gat', 'gat__u4', 301),
  ('gat__statistical_data_analysis', 'Statistical Data Analysis', 'gat', 'gat__u4', 302),
  ('gat__logical_analytical_reasoning', 'Logical & Analytical Reasoning', 'gat', 'gat__u5', 400),
  ('gat__general_science_and_environment_literacy', 'General Science and Environment Literacy', 'gat', 'gat__u6', 500)
on conflict (id) do update set
  unit_id = excluded.unit_id,
  sort_order = excluded.sort_order;

commit;

-- END 0026_cuet_2026_canonical_syllabus.sql

-- BEGIN 0027_enforce_credit_integrity.sql
-- Enforce the credit source of truth:
-- 1. New users start with exactly 100 credits.
-- 2. Credits decrease only for server-defined question generation/attempt actions.
-- 3. Credits increase only for approved valid contributions.
-- 4. Every credit mutation is atomic, logged, and idempotent by reference.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 100;

ALTER TABLE public.users
  ALTER COLUMN credit_balance SET DEFAULT 100;

UPDATE public.users
SET credit_balance = 100
WHERE credit_balance = 0;

ALTER TABLE public.users
  ALTER COLUMN credit_balance SET NOT NULL;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS credit_delta INTEGER;

UPDATE public.credit_transactions
SET
  credit_delta = COALESCE(credit_delta, amount),
  action = COALESCE(
    action,
    CASE
      WHEN reference LIKE 'question_approved_%' THEN 'contribute'
      WHEN reference LIKE 'generate_mock_%' THEN 'generate'
      ELSE 'legacy'
    END
  );

ALTER TABLE public.credit_transactions
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN credit_delta SET NOT NULL;

WITH duplicates AS (
  SELECT
    ctid,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at, id) AS rn
  FROM public.credit_transactions
)
UPDATE public.credit_transactions ct
SET reference = ct.reference || ':legacy_duplicate:' || duplicates.rn::TEXT
FROM duplicates
WHERE ct.ctid = duplicates.ctid
  AND duplicates.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_reference_unique
  ON public.credit_transactions(reference);

DROP FUNCTION IF EXISTS public.spend_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.grant_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.grant_daily_login_credits(TEXT);
DROP FUNCTION IF EXISTS public.grant_attempt_answer_credits(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id TEXT,
  p_action TEXT,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_amount INTEGER;
  v_balance INTEGER;
  v_existing public.credit_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'user_id, action, and reference are required';
  END IF;

  v_amount := CASE p_action
    WHEN 'generate' THEN 10
    WHEN 'attempt' THEN 10
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'unsupported credit spend action: %', p_action;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.credit_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id = p_user_id
       AND v_existing.action = p_action
       AND v_existing.credit_delta = -v_amount THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'credit reference already used for a different transaction';
  END IF;

  SELECT credit_balance
  INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF v_balance < v_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET credit_balance = credit_balance - v_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  VALUES (p_user_id, -v_amount, 'spend', p_reference, p_action, -v_amount);

  RAISE LOG 'credit_change user_id=% action=% credit_delta=%', p_user_id, p_action, -v_amount;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_contribution_credits(
  p_user_id TEXT,
  p_action TEXT,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_amount INTEGER := 15;
  v_existing public.credit_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action <> 'contribute' OR p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'valid contribution credit grant parameters are required';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.credit_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id = p_user_id
       AND v_existing.action = p_action
       AND v_existing.credit_delta = v_amount THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'credit reference already used for a different transaction';
  END IF;

  PERFORM 1
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  UPDATE public.users
  SET credit_balance = credit_balance + v_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  VALUES (p_user_id, v_amount, 'earn', p_reference, p_action, v_amount);

  RAISE LOG 'credit_change user_id=% action=% credit_delta=%', p_user_id, p_action, v_amount;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_daily_login_credits(
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_attempt_answer_credits(
  p_user_id TEXT,
  p_attempt_id TEXT,
  p_details JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_question_with_credit(
  p_question_id TEXT,
  p_action TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_question public.questions%ROWTYPE;
  v_credit_user_id TEXT;
BEGIN
  IF p_question_id IS NULL OR p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid moderation parameters';
  END IF;

  SELECT *
  INTO v_question
  FROM public.questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND OR v_question.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.questions
    SET
      status = 'live',
      verification_state = 'verified',
      exploration_state = 'active',
      live_at = NOW()
    WHERE id = p_question_id
    RETURNING * INTO v_question;

    v_credit_user_id := COALESCE(v_question.author_id, v_question.uploaded_by);
    IF v_credit_user_id IS NOT NULL THEN
      PERFORM public.grant_contribution_credits(
        v_credit_user_id,
        'contribute',
        'contribute:' || p_question_id
      );
    END IF;
  ELSE
    UPDATE public.questions
    SET
      status = 'rejected',
      verification_state = 'rejected',
      exploration_state = 'rejected'
    WHERE id = p_question_id
    RETURNING * INTO v_question;
  END IF;

  UPDATE public.moderation_jobs
  SET status = 'completed', completed_at = NOW()
  WHERE question_id = p_question_id
    AND status IN ('queued', 'processing', 'retrying');

  RETURN to_jsonb(v_question);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_credits(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_contribution_credits(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_question_with_credit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_daily_login_credits(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_attempt_answer_credits(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.spend_credits(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_contribution_credits(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.moderate_question_with_credit(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_daily_login_credits(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_attempt_answer_credits(TEXT, TEXT, JSONB) TO service_role;

-- END 0027_enforce_credit_integrity.sql

-- BEGIN 0028_learning_progress_bookmarks.sql
-- Student learning layer: durable bookmarks, feed progress, and premium-aware limits.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS public.question_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'explore',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_bookmarks_user_created
  ON public.question_bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_bookmarks_question
  ON public.question_bookmarks(question_id);

CREATE TABLE IF NOT EXISTS public.user_question_progress (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  subject TEXT,
  chapter TEXT,
  seen_count INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_selected_key TEXT,
  last_correct BOOLEAN,
  best_dwell_ms INTEGER,
  last_seen_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_user_question_progress_user_subject
  ON public.user_question_progress(user_id, subject, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_question_progress_user_updated
  ON public.user_question_progress(user_id, updated_at DESC);

-- END 0028_learning_progress_bookmarks.sql

-- BEGIN 0029_fix_apply_question_vote_ambiguity.sql
CREATE OR REPLACE FUNCTION public.apply_question_vote(
  p_user_id TEXT,
  p_question_id TEXT,
  p_vote_type public.question_vote_type DEFAULT NULL
) RETURNS TABLE (
  question_id TEXT,
  upvotes INTEGER,
  downvotes INTEGER,
  score INTEGER,
  user_vote TEXT,
  credit_balance INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.question_vote_type;
  v_up_delta INTEGER := 0;
  v_down_delta INTEGER := 0;
  v_quality_band TEXT;
  v_credit_reference TEXT;
  v_credits_added BOOLEAN := FALSE;
  v_final_vote TEXT := NULL;
BEGIN
  IF p_user_id IS NULL OR p_question_id IS NULL THEN
    RAISE EXCEPTION 'user_id and question_id are required';
  END IF;

  PERFORM 1
  FROM public.questions q
  WHERE q.id = p_question_id AND COALESCE(q.is_deleted, FALSE) = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found';
  END IF;

  SELECT qv.vote_type INTO v_existing
  FROM public.question_votes qv
  WHERE qv.user_id = p_user_id AND qv.question_id = p_question_id
  FOR UPDATE;

  IF p_vote_type IS NULL THEN
    IF v_existing = 'up' THEN
      v_up_delta := -1;
    ELSIF v_existing = 'down' THEN
      v_down_delta := -1;
    END IF;

    IF v_existing IS NOT NULL THEN
      DELETE FROM public.question_votes qv
      WHERE qv.user_id = p_user_id AND qv.question_id = p_question_id;
    END IF;
  ELSIF v_existing IS NULL THEN
    INSERT INTO public.question_votes (user_id, question_id, vote_type)
    VALUES (p_user_id, p_question_id, p_vote_type);
    IF p_vote_type = 'up' THEN
      v_up_delta := 1;
    ELSE
      v_down_delta := 1;
    END IF;
    v_final_vote := p_vote_type::TEXT;
  ELSIF v_existing <> p_vote_type THEN
    UPDATE public.question_votes qv
    SET vote_type = p_vote_type, updated_at = NOW()
    WHERE qv.user_id = p_user_id AND qv.question_id = p_question_id;

    IF p_vote_type = 'up' THEN
      v_up_delta := 1;
      v_down_delta := -1;
    ELSE
      v_up_delta := -1;
      v_down_delta := 1;
    END IF;
    v_final_vote := p_vote_type::TEXT;
  ELSE
    v_final_vote := p_vote_type::TEXT;
  END IF;

  UPDATE public.questions q
  SET
    upvotes = GREATEST(0, q.upvotes + v_up_delta),
    downvotes = GREATEST(0, q.downvotes + v_down_delta),
    score = GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta),
    quality_band = CASE
      WHEN (GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta)) < -3 THEN 'low_quality'
      WHEN q.quality_band = 'low_quality' AND (GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta)) >= -3 THEN 'unrated'
      ELSE q.quality_band
    END,
    exploration_state = CASE
      WHEN (GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta)) < -3 THEN 'frozen'
      ELSE q.exploration_state
    END,
    updated_at = NOW()
  WHERE q.id = p_question_id;

  IF v_credits_added THEN
    v_credit_reference := 'vote:' || p_question_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, reference)
    VALUES (p_user_id, 2, 'earn', v_credit_reference);

    UPDATE public.users u
    SET credit_balance = u.credit_balance + 2
    WHERE u.id = p_user_id;
  END IF;

  SELECT q.quality_band INTO v_quality_band
  FROM public.questions q
  WHERE q.id = p_question_id;

  IF v_quality_band = 'low_quality' THEN
    RAISE LOG 'Question % flagged low_quality via votes', p_question_id;
  END IF;

  RETURN QUERY
  SELECT q.id::TEXT, q.upvotes::INTEGER, q.downvotes::INTEGER, q.score::INTEGER, v_final_vote, u.credit_balance::INTEGER
  FROM public.questions q
  JOIN public.users u ON u.id = p_user_id
  WHERE q.id = p_question_id;
END;
$$;

-- END 0029_fix_apply_question_vote_ambiguity.sql

-- BEGIN 0030_razorpay_payments.sql
alter table public.users
  add column if not exists is_premium boolean not null default false;

create table if not exists public.payments (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  order_id text unique,
  subscription_id text unique,
  payment_id text unique,
  plan_id text not null,
  razorpay_plan_id text,
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'attempted', 'captured', 'failed', 'cancelled', 'completed', 'expired')),
  raw_order jsonb not null default '{}'::jsonb,
  raw_subscription jsonb not null default '{}'::jsonb,
  raw_payment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  alter column order_id drop not null,
  add column if not exists subscription_id text unique,
  add column if not exists razorpay_plan_id text,
  add column if not exists raw_subscription jsonb not null default '{}'::jsonb;

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('created', 'authenticated', 'active', 'attempted', 'captured', 'failed', 'cancelled', 'completed', 'expired'));

create index if not exists payments_user_created_idx
  on public.payments(user_id, created_at desc);

create index if not exists payments_payment_id_idx
  on public.payments(payment_id);

create index if not exists payments_subscription_id_idx
  on public.payments(subscription_id);

alter table public.payments enable row level security;

revoke all on public.payments from anon;
revoke all on public.payments from authenticated;
grant select on public.payments to authenticated;

create policy "Users can read their own payments"
  on public.payments
  for select
  to authenticated
  using (user_id = auth.uid()::text);

-- END 0030_razorpay_payments.sql

-- BEGIN 0031_question_validation.sql
-- ============================================================
-- Migration 0031 — Question validation pipeline columns.
--
-- Adds the four classification fields written by
-- `scripts/pipeline/validate-existing.mjs`. The script reuses
-- existing fields where possible (difficulty, quality_score,
-- verification_state) and only adds what is genuinely new.
--
-- Rules:
--   • ADD COLUMN IF NOT EXISTS only — no destructive ops.
--   • Defaults are NULL so we can distinguish "not yet validated"
--     from "validated and {true|false|low}". A nullable column +
--     index on validated_at lets us re-run only the unvalidated
--     subset on subsequent passes.
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_ncert_relevant     BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_cuet_syllabus      BOOLEAN,
  ADD COLUMN IF NOT EXISTS validation_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS topic                 TEXT,
  ADD COLUMN IF NOT EXISTS validated_at          TIMESTAMPTZ;

-- Sanity bound — confidence is always 0..1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_validation_confidence_range'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_validation_confidence_range
      CHECK (validation_confidence IS NULL OR (validation_confidence >= 0 AND validation_confidence <= 1));
  END IF;
END $$;

-- Index for incremental re-runs: pull rows that haven't been validated yet,
-- or that fell into the flagged band and may be re-classified.
CREATE INDEX IF NOT EXISTS idx_questions_validation_pending
  ON public.questions(validated_at)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_questions_topic
  ON public.questions(subject, topic)
  WHERE is_deleted = FALSE AND topic IS NOT NULL;

-- END 0031_question_validation.sql

-- BEGIN 0032_creator_referral_phase_a.sql
-- ============================================================
-- 0032 — Creator + referral system, Phase A
--
-- Adds:
--   1) users.role check (student | moderator | creator | admin)
--   2) Admin-email lock trigger (only atishay07jain@gmail.com may be admin;
--      that email is auto-elevated to admin on insert/update)
--   3) creators table (code -> Razorpay offer_id mapping, commission)
--   4) Creator attribution columns on payments
--   5) webhook_events table for idempotent webhook processing
--   6) audit_logs table for admin action history
--
-- Idempotent — safe to run repeatedly.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Role check on users
--    Existing values are 'student' | 'moderator'. Extend to allow
--    'creator' and 'admin'.
-- ============================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'moderator', 'creator', 'admin'));

-- ============================================================
-- 2) Admin-email lock
--    Only atishay07jain@gmail.com may hold role='admin'. If anyone else
--    is set to 'admin', the trigger raises. If atishay07jain@gmail.com
--    is created/updated, role is auto-elevated to 'admin'.
--    Lookup is case-insensitive.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_admin_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  admin_email CONSTANT TEXT := 'atishay07jain@gmail.com';
  norm_email TEXT;
BEGIN
  norm_email := lower(btrim(COALESCE(NEW.email, '')));

  IF NEW.role = 'admin' AND norm_email <> admin_email THEN
    RAISE EXCEPTION 'Only % may hold the admin role (attempted: %)', admin_email, NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  IF norm_email = admin_email THEN
    NEW.role := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_enforce_admin_role ON public.users;
CREATE TRIGGER trg_users_enforce_admin_role
  BEFORE INSERT OR UPDATE OF role, email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_role();

-- Backfill: if the admin user already exists, ensure they hold the role.
UPDATE public.users
   SET role = 'admin'
 WHERE lower(btrim(email)) = 'atishay07jain@gmail.com'
   AND role IS DISTINCT FROM 'admin';

-- ============================================================
-- 3) creators table
--    Phase A scope: code -> offer_id mapping plus commission rate.
--    Future phases extend with payouts, performance views, etc.
--    user_id is OPTIONAL — a creator may exist before they ever log in.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.creators (
  id              TEXT PRIMARY KEY DEFAULT ('crt_' || replace(gen_random_uuid()::text, '-', '')),
  user_id         TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  email           TEXT,
  code            TEXT NOT NULL,
  offer_id        TEXT,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20
                  CHECK (commission_rate >= 0 AND commission_rate <= 1),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness on the code (codes are matched in lowercase).
CREATE UNIQUE INDEX IF NOT EXISTS creators_code_lower_idx
  ON public.creators (lower(btrim(code)));

CREATE INDEX IF NOT EXISTS creators_user_id_idx
  ON public.creators (user_id);

CREATE INDEX IF NOT EXISTS creators_active_idx
  ON public.creators (is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_creators_updated_at ON public.creators;
CREATE TRIGGER trg_creators_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creators FROM anon;
REVOKE ALL ON public.creators FROM authenticated;
-- All access goes through service_role from server-only routes.

-- ============================================================
-- 4) Payment attribution columns
--    Attach the creator code, creator id, Razorpay offer_id, and
--    actual amount paid (post-discount) to every payments row.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS creator_code TEXT,
  ADD COLUMN IF NOT EXISTS creator_id   TEXT REFERENCES public.creators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id     TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid  INTEGER;

CREATE INDEX IF NOT EXISTS payments_creator_id_idx
  ON public.payments (creator_id) WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_creator_code_idx
  ON public.payments (creator_code) WHERE creator_code IS NOT NULL;

-- ============================================================
-- 5) Webhook idempotency
--    One row per Razorpay webhook event_id. PRIMARY KEY enforces
--    "process once" semantics — duplicate deliveries are no-ops.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id      TEXT PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'razorpay',
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS webhook_events_received_idx
  ON public.webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
  ON public.webhook_events (received_at) WHERE processed_at IS NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_events FROM anon;
REVOKE ALL ON public.webhook_events FROM authenticated;

-- ============================================================
-- 6) Audit logs
--    Append-only history of admin/creator mutations. Used by the
--    admin dashboard's "audit trail" view.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    TEXT,
  actor_email TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_target_idx
  ON public.audit_logs (target_type, target_id);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM authenticated;

COMMIT;

-- END 0032_creator_referral_phase_a.sql

-- BEGIN 0033_creators_payouts_phase_b.sql
-- ============================================================
-- 0033 — Creator + payout system, Phase B
--
-- Adds:
--   1) creators.payout_per_sale (paise) — fixed earning per sale
--   2) payouts table (executed payout runs)
--   3) payments.creator_earning + payments.payout_id
--   4) Auto-link triggers: when a user signs up with an email matching
--      an active creator, role becomes 'creator' and creators.user_id
--      is set automatically. Backfills existing rows.
--   5) RPC: create_pending_payout(creator_id, actor_id) — bundles all
--      unpaid earnings into a single payouts row atomically.
--
-- Idempotent — safe to run repeatedly.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) payout_per_sale on creators (paise; default ₹20 = 2000 paise)
-- ============================================================

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS payout_per_sale INTEGER NOT NULL DEFAULT 2000
                          CHECK (payout_per_sale >= 0);

-- ============================================================
-- 2) payouts table (must exist before payments.payout_id FK below)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payouts (
  id             TEXT PRIMARY KEY DEFAULT ('pyt_' || replace(gen_random_uuid()::text, '-', '')),
  creator_id     TEXT NOT NULL REFERENCES public.creators(id) ON DELETE RESTRICT,
  amount         INTEGER NOT NULL CHECK (amount >= 0),
  payment_count  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ,
  marked_paid_by TEXT
);

CREATE INDEX IF NOT EXISTS payouts_creator_status_idx
  ON public.payouts (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS payouts_status_created_idx
  ON public.payouts (status, created_at DESC);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payouts FROM anon;
REVOKE ALL ON public.payouts FROM authenticated;

-- ============================================================
-- 3) Earnings + payout link on payments
--    creator_earning is paise; nullable until first success event.
--    payout_id is set when this payment is bundled into a payout run.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS creator_earning INTEGER,
  ADD COLUMN IF NOT EXISTS payout_id       TEXT REFERENCES public.payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_payout_id_idx
  ON public.payments (payout_id);

CREATE INDEX IF NOT EXISTS payments_creator_unpaid_idx
  ON public.payments (creator_id)
  WHERE creator_id IS NOT NULL AND payout_id IS NULL AND creator_earning IS NOT NULL;

-- ============================================================
-- 4) Creator linking
--    BEFORE trigger sets role='creator' when signing up with a
--    creator's email. AFTER trigger writes the new user_id back
--    to the creators row.
--
--    Naming: trg_users_aa_link_creator_role fires alphabetically
--    BEFORE trg_users_enforce_admin_role, so the admin trigger
--    always wins for the admin email.
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_creator_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  norm_email TEXT;
  has_creator BOOLEAN;
BEGIN
  norm_email := lower(btrim(COALESCE(NEW.email, '')));
  IF norm_email = '' THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.creators
     WHERE lower(btrim(email)) = norm_email
       AND is_active = TRUE
  ) INTO has_creator;

  IF has_creator AND NEW.role NOT IN ('admin', 'moderator') THEN
    NEW.role := 'creator';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_aa_link_creator_role ON public.users;
CREATE TRIGGER trg_users_aa_link_creator_role
  BEFORE INSERT OR UPDATE OF role, email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.link_creator_role();

CREATE OR REPLACE FUNCTION public.link_user_to_creator()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  UPDATE public.creators
     SET user_id = NEW.id
   WHERE lower(btrim(email)) = lower(btrim(NEW.email))
     AND user_id IS DISTINCT FROM NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_link_to_creator ON public.users;
CREATE TRIGGER trg_users_link_to_creator
  AFTER INSERT OR UPDATE OF email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.link_user_to_creator();

-- Backfill: existing users matching active creators
UPDATE public.users u
   SET role = 'creator'
  FROM public.creators c
 WHERE lower(btrim(u.email)) = lower(btrim(c.email))
   AND c.is_active = TRUE
   AND u.role NOT IN ('admin', 'moderator')
   AND u.role IS DISTINCT FROM 'creator';

UPDATE public.creators c
   SET user_id = u.id
  FROM public.users u
 WHERE lower(btrim(c.email)) = lower(btrim(u.email))
   AND c.user_id IS NULL;

-- ============================================================
-- 5) Atomic payout creation
--    Sums all unpaid creator_earning rows for the given creator,
--    inserts a single payouts row with status='paid' (since the
--    admin clicks "Mark as Paid" to settle outside the system),
--    and stamps payout_id on every covered payment.
--    Raises if there is nothing to pay out.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_pending_payout(
  p_creator_id TEXT,
  p_actor_id   TEXT
)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_payout_id TEXT;
  v_amount    INTEGER;
  v_count     INTEGER;
BEGIN
  SELECT COALESCE(SUM(creator_earning), 0)::INTEGER, COUNT(*)::INTEGER
    INTO v_amount, v_count
    FROM public.payments
   WHERE creator_id = p_creator_id
     AND payout_id IS NULL
     AND status IN ('active', 'authenticated', 'captured')
     AND COALESCE(creator_earning, 0) > 0;

  IF v_amount <= 0 OR v_count = 0 THEN
    RAISE EXCEPTION 'No unpaid earnings for creator %', p_creator_id
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.payouts (creator_id, amount, payment_count, status, paid_at, marked_paid_by)
  VALUES (p_creator_id, v_amount, v_count, 'paid', NOW(), p_actor_id)
  RETURNING id INTO v_payout_id;

  UPDATE public.payments
     SET payout_id = v_payout_id
   WHERE creator_id = p_creator_id
     AND payout_id IS NULL
     AND status IN ('active', 'authenticated', 'captured')
     AND COALESCE(creator_earning, 0) > 0;

  RETURN v_payout_id;
END;
$$;

COMMIT;

-- END 0033_creators_payouts_phase_b.sql

-- BEGIN 0034_fix_role_system.sql
-- ============================================================
-- 0034 — Defensive role-system fix
--
-- Symptom: users.role rejected values other than 'student' on some
-- environments, and /admin crashed because session.user.role wasn't
-- 'admin' for the admin email. This migration:
--
--   1. Drops every role-related CHECK constraint we know about (in
--      case earlier migrations were partially applied with different
--      constraint names).
--   2. Forces users.role to be TEXT (no enum). If it somehow was an
--      enum, the column is converted in place.
--   3. Sets default 'student' and backfills NULLs.
--   4. Re-adds the CHECK with the four supported roles.
--   5. Forces atishay07jain@gmail.com to role='admin'.
--   6. Softens the admin trigger: instead of raising an exception
--      when a non-admin email is set to 'admin' (which would crash
--      whatever caller did the write), it silently rolls the role
--      back to its previous value. The app-layer guard is the
--      authoritative check; the trigger is a safety net.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) Drop any prior role check constraints by every name we've used.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_chk;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_role;

-- 2) Force TEXT, only if it's not already TEXT (handles enum -> text).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'users'
       AND column_name  = 'role'
       AND data_type   <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text';
  END IF;
END $$;

-- 3) Default + backfill NULLs.
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'student';

UPDATE public.users
   SET role = 'student'
 WHERE role IS NULL OR btrim(role) = '';

-- 4) Re-add CHECK with all four roles (drop-if-exists first so the
--    constraint definition is always the latest).
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'moderator', 'creator', 'admin'));

-- 5) Force admin on the right email (case + whitespace tolerant).
UPDATE public.users
   SET role = 'admin'
 WHERE lower(btrim(email)) = 'atishay07jain@gmail.com'
   AND role IS DISTINCT FROM 'admin';

-- 6) Replace the admin trigger with a non-throwing version. If a write
--    tries to set role='admin' for the wrong email, we silently
--    downgrade rather than aborting. The application uses isAdmin() in
--    src/lib/admin/roles.js as the authoritative check; this trigger is
--    a guardrail.
CREATE OR REPLACE FUNCTION public.enforce_admin_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  admin_email CONSTANT TEXT := 'atishay07jain@gmail.com';
  norm_email TEXT;
BEGIN
  norm_email := lower(btrim(COALESCE(NEW.email, '')));

  -- Wrong email being set to admin -> roll back to previous role
  -- (or 'student' on insert).
  IF NEW.role = 'admin' AND norm_email <> admin_email THEN
    IF TG_OP = 'UPDATE' AND OLD.role IS NOT NULL AND OLD.role <> 'admin' THEN
      NEW.role := OLD.role;
    ELSE
      NEW.role := 'student';
    END IF;
  END IF;

  -- Right email -> always admin.
  IF norm_email = admin_email THEN
    NEW.role := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger may not exist if 0032 was never applied — recreate it.
DROP TRIGGER IF EXISTS trg_users_enforce_admin_role ON public.users;
CREATE TRIGGER trg_users_enforce_admin_role
  BEFORE INSERT OR UPDATE OF role, email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_role();

COMMIT;

-- END 0034_fix_role_system.sql

-- BEGIN 0035_cuet_traceability.sql
-- ============================================================
-- Migration 0035 - CUET-first traceability fields.
--
-- Every AI-generated question must be traceable to:
-- CUET syllabus -> chapter -> topic -> concept -> concept_id.
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS concept TEXT,
  ADD COLUMN IF NOT EXISTS concept_id TEXT,
  ADD COLUMN IF NOT EXISTS pyq_anchor_id TEXT,
  ADD COLUMN IF NOT EXISTS anchor_tier INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty_weight INTEGER,
  ADD COLUMN IF NOT EXISTS question_type TEXT;

UPDATE public.questions
SET difficulty_weight = CASE difficulty
  WHEN 'easy' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'hard' THEN 3
  ELSE 2
END
WHERE difficulty_weight IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_concept_id
  ON public.questions(subject, chapter, concept_id)
  WHERE is_deleted = FALSE AND concept_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_question_type
  ON public.questions(subject, question_type)
  WHERE is_deleted = FALSE AND question_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_pyq_anchor_id
  ON public.questions(pyq_anchor_id)
  WHERE is_deleted = FALSE AND pyq_anchor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_anchor_tier
  ON public.questions(anchor_tier)
  WHERE is_deleted = FALSE AND anchor_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_difficulty_weight
  ON public.questions(difficulty_weight)
  WHERE is_deleted = FALSE AND difficulty_weight IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_anchor_tier_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_anchor_tier_check
      CHECK (anchor_tier IS NULL OR anchor_tier IN (1, 2, 3, 4));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_difficulty_weight_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_difficulty_weight_check
      CHECK (difficulty_weight IS NULL OR difficulty_weight IN (1, 2, 3));
  END IF;
END $$;

-- END 0035_cuet_traceability.sql

-- BEGIN 0036_mode_aware_credits.sql
-- ============================================================
-- Migration 0036 — mode-aware credit costs.
--
-- Quick Practice  -> 'attempt'       -> 10 credits (unchanged)
-- Full Mock       -> 'attempt_full'  -> 50 credits (new)
-- Smart / NTA Mode are premium-only and never call spend_credits.
--
-- The 'generate' action (10 credits) is left untouched.
-- ============================================================

CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id TEXT,
  p_action TEXT,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
DECLARE
  v_amount INTEGER;
  v_balance INTEGER;
  v_existing public.credit_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'user_id, action, and reference are required';
  END IF;

  v_amount := CASE p_action
    WHEN 'generate'      THEN 10
    WHEN 'attempt'       THEN 10
    WHEN 'attempt_full'  THEN 50
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'unsupported credit spend action: %', p_action;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.credit_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id = p_user_id
       AND v_existing.action = p_action
       AND v_existing.credit_delta = -v_amount THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'credit reference already used for a different transaction';
  END IF;

  SELECT credit_balance
  INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF v_balance < v_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET credit_balance = credit_balance - v_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  VALUES (p_user_id, -v_amount, 'spend', p_reference, p_action, -v_amount);

  RAISE LOG 'credit_change user_id=% action=% credit_delta=%', p_user_id, p_action, -v_amount;
  RETURN TRUE;
END;
$function$;

-- The function is owned by the same role; permissions remain via the
-- service-role grant established in 0027.

-- END 0036_mode_aware_credits.sql

-- BEGIN 0037_nta_passage_groups.sql
-- ============================================================
-- Migration 0037 - NTA passage group support.
--
-- Keeps English reading-comprehension passages as first-class
-- groups so NTA mode can select and display a passage with all
-- linked questions instead of orphaning child questions.
--
-- Production compatibility note:
-- Some environments may not have run 0035_cuet_traceability yet.
-- NTA mode requires traceability metadata, so this migration adds
-- those columns idempotently as nullable fields. It does not backfill
-- or invent anchor tiers; rows remain excluded from strict NTA mocks
-- until real PYQ-anchor metadata is populated.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.passage_groups (
  id TEXT PRIMARY KEY DEFAULT ('pg_' || replace(gen_random_uuid()::text, '-', '')),
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  passage_type TEXT,
  title TEXT,
  passage_text TEXT NOT NULL,
  source TEXT,
  difficulty TEXT,
  status TEXT NOT NULL DEFAULT 'live',
  discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  mode_visibility TEXT[] NOT NULL DEFAULT ARRAY['full_mock', 'nta_mode'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS concept TEXT,
  ADD COLUMN IF NOT EXISTS concept_id TEXT,
  ADD COLUMN IF NOT EXISTS pyq_anchor_id TEXT,
  ADD COLUMN IF NOT EXISTS anchor_tier INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty_weight INTEGER,
  ADD COLUMN IF NOT EXISTS question_type TEXT,
  ADD COLUMN IF NOT EXISTS passage_group_id TEXT,
  ADD COLUMN IF NOT EXISTS passage_id TEXT,
  ADD COLUMN IF NOT EXISTS passage_type TEXT,
  ADD COLUMN IF NOT EXISTS order_index INTEGER;

UPDATE public.questions
SET difficulty_weight = CASE difficulty
  WHEN 'easy' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'hard' THEN 3
  ELSE 2
END
WHERE difficulty_weight IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_anchor_tier_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_anchor_tier_check
      CHECK (anchor_tier IS NULL OR anchor_tier IN (1, 2, 3, 4));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_difficulty_weight_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_difficulty_weight_check
      CHECK (difficulty_weight IS NULL OR difficulty_weight IN (1, 2, 3));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_passage_groups_subject_chapter
  ON public.passage_groups(subject, chapter)
  WHERE status = 'live' AND discoverable = TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name = 'is_deleted'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_passage_group
      ON public.questions(passage_group_id, order_index)
      WHERE is_deleted = FALSE AND passage_group_id IS NOT NULL';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_passage_group
      ON public.questions(passage_group_id, order_index)
      WHERE passage_group_id IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_pyq_anchor_id
  ON public.questions(pyq_anchor_id)
  WHERE pyq_anchor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_anchor_tier
  ON public.questions(anchor_tier)
  WHERE anchor_tier IS NOT NULL;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name IN (
        'subject',
        'anchor_tier',
        'quality_band',
        'difficulty',
        'status',
        'verification_state',
        'exploration_state'
      )
  ) = 7 AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name = 'is_deleted'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_nta_pool
      ON public.questions(subject, anchor_tier, quality_band, difficulty)
      WHERE is_deleted = FALSE
        AND status = ''live''
        AND verification_state = ''verified''
        AND exploration_state IN (''active'', ''fast_track'', ''promoted'')';
  ELSIF (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name IN (
        'subject',
        'anchor_tier',
        'quality_band',
        'difficulty',
        'status',
        'verification_state',
        'exploration_state'
      )
  ) = 7 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_nta_pool
      ON public.questions(subject, anchor_tier, quality_band, difficulty)
      WHERE status = ''live''
        AND verification_state = ''verified''
        AND exploration_state IN (''active'', ''fast_track'', ''promoted'')';
  ELSE
    RAISE NOTICE 'Skipping idx_questions_nta_pool because required questions columns are missing.';
  END IF;
END $$;

-- END 0037_nta_passage_groups.sql

-- BEGIN 0038_ai_credit_purchase_grant_rpc.sql
CREATE TABLE public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int, included_credits_used int check(included_credits_used>=0), bonus_credits int check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
CREATE TABLE public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any(array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text check (wallet_source = any(array['included','bonus','mixed','grant','adjustment','none'])), balance_after int, idempotency_key text);
ALTER TABLE public.ai_credit_wallets ENABLE ROW LEVEL SECURITY;ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_credit_wallets,public.ai_credit_ledger FROM anon,authenticated;GRANT ALL ON public.ai_credit_wallets,public.ai_credit_ledger TO service_role;
-- Atomic, idempotent PrepOS credit purchase grants.
-- Both checkout verification and Razorpay webhooks use this RPC with the same
-- idempotency key, so one captured payment can only add credits once.

create unique index if not exists ai_credit_ledger_idempotency_idx
on public.ai_credit_ledger (idempotency_key)
where idempotency_key is not null;

create or replace function public.mm_ai_grant_bonus_credits(
  p_user_id text,
  p_amount integer,
  p_reason text,
  p_reference text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_existing public.ai_credit_ledger%rowtype;
  v_balance integer;
  v_period_start timestamptz;
  v_reset_at timestamptz;
  v_reason text;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  v_reason := case
    when p_reason in ('monthly_grant', 'pack_purchase', 'admin_adjustment', 'ai_spend', 'expiry') then p_reason
    else 'pack_purchase'
  end;

  if p_idempotency_key is not null then
    select * into v_existing
      from public.ai_credit_ledger
     where idempotency_key = p_idempotency_key
     limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'granted', greatest(0, v_existing.amount),
        'balance', coalesce(v_existing.balance_after, 0),
        'reference', v_existing.reference
      );
    end if;
  end if;

  v_period_start := date_trunc('month', timezone('Asia/Kolkata', now())) at time zone 'Asia/Kolkata';
  v_reset_at := (date_trunc('month', timezone('Asia/Kolkata', now())) + interval '1 month') at time zone 'Asia/Kolkata';

  insert into public.ai_credit_wallets (
    user_id,
    included_monthly_credits,
    included_credits_used,
    bonus_credits,
    period_start,
    reset_at
  )
  values (
    p_user_id,
    10,
    0,
    0,
    v_period_start,
    v_reset_at
  )
  on conflict (user_id) do nothing;

  select * into v_wallet
    from public.ai_credit_wallets
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  -- Re-check after the wallet lock. If checkout verify and webhook arrive
  -- together, the second caller waits here and then sees the first ledger row.
  if p_idempotency_key is not null then
    select * into v_existing
      from public.ai_credit_ledger
     where idempotency_key = p_idempotency_key
     limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'granted', greatest(0, v_existing.amount),
        'balance', coalesce(v_existing.balance_after, 0),
        'reference', v_existing.reference
      );
    end if;
  end if;

  update public.ai_credit_wallets
     set bonus_credits = bonus_credits + p_amount,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (
    user_id,
    amount,
    reason,
    feature,
    reference,
    wallet_source,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_amount,
    v_reason,
    'ai_credit_purchase',
    p_reference,
    'grant',
    v_balance,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'granted', p_amount,
    'balance', v_balance,
    'bonusCredits', v_wallet.bonus_credits,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.mm_ai_grant_bonus_credits(
  text, integer, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.mm_ai_grant_bonus_credits(
  text, integer, text, text, text, jsonb
) to service_role;

-- END 0038_ai_credit_purchase_grant_rpc.sql

-- BEGIN 20260502220148_paid_premium_entitlements.sql
-- Paid entitlement hardening:
-- - premium_until records the paid-through access window.
-- - access_until mirrors the entitlement window on payment rows.
-- This prevents immediate access loss when a paid subscription is cancelled
-- after a successful charge, while still allowing entitlement expiry.

alter table public.users
  add column if not exists premium_until timestamptz,
  add column if not exists razorpay_subscription_id text;

alter table public.payments
  add column if not exists access_until timestamptz;

create index if not exists users_premium_until_idx
  on public.users (premium_until)
  where premium_until is not null;

create index if not exists users_razorpay_subscription_id_idx
  on public.users (razorpay_subscription_id)
  where razorpay_subscription_id is not null;

create index if not exists payments_access_until_idx
  on public.payments (access_until)
  where access_until is not null;

with paid_periods as (
  select
    p.user_id,
    max(p.subscription_id) filter (where p.subscription_id is not null) as subscription_id,
    max(
      coalesce(
        p.access_until,
        case
          when (p.raw_subscription->>'current_end') ~ '^[0-9]+$'
            then to_timestamp((p.raw_subscription->>'current_end')::double precision)
          else null
        end,
        p.created_at + interval '32 days'
      )
    ) as paid_until
  from public.payments p
  where p.payment_id is not null
    and coalesce(p.amount_paid, 0) > 0
  group by p.user_id
)
update public.users u
set
  premium_until = greatest(coalesce(u.premium_until, '-infinity'::timestamptz), pp.paid_until),
  razorpay_subscription_id = coalesce(u.razorpay_subscription_id, pp.subscription_id),
  is_premium = case
    when pp.paid_until > now() then true
    else u.is_premium
  end
from paid_periods pp
where u.id = pp.user_id
  and pp.paid_until is not null;

-- END 20260502220148_paid_premium_entitlements.sql

-- BEGIN 20260503040628_mock_selection_usage_metadata.sql
-- Store per-attempt picker metadata and keep the newest-first mock pool fast.

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS selection_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_mock_latest_pool
  ON public.questions(subject, difficulty, created_at DESC)
  WHERE is_deleted = FALSE
    AND (
      status = 'live'
      OR (verification_state = 'verified' AND exploration_state = 'active')
    );

-- END 20260503040628_mock_selection_usage_metadata.sql

-- BEGIN 20260503220558_robust_referral_attribution.sql
-- ============================================================
-- Robust referral attribution
--
-- Razorpay only changes checkout/payment evidence when a subscription has
-- an offer_id. These fields keep first-party referral evidence even when a
-- valid creator code has no discount offer, or when a user entered an
-- inactive/unknown code.
-- ============================================================

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS referral_code_attempted TEXT,
  ADD COLUMN IF NOT EXISTS referral_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS referral_reason TEXT;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_referral_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_referral_status_check
  CHECK (referral_status IN (
    'none',
    'offer_attached',
    'tracked_no_offer',
    'inactive',
    'unknown'
  ));

UPDATE public.payments
   SET referral_code_attempted = COALESCE(referral_code_attempted, creator_code),
       referral_status = CASE
         WHEN referral_status IS DISTINCT FROM 'none' THEN referral_status
         WHEN creator_code IS NOT NULL AND offer_id IS NOT NULL THEN 'offer_attached'
         WHEN creator_code IS NOT NULL THEN 'tracked_no_offer'
         ELSE 'none'
       END,
       referral_reason = COALESCE(
         referral_reason,
         CASE
           WHEN creator_code IS NOT NULL AND offer_id IS NOT NULL THEN 'Backfilled from existing creator offer attribution'
           WHEN creator_code IS NOT NULL THEN 'Backfilled from existing creator attribution without offer'
           ELSE NULL
         END
       )
 WHERE referral_status = 'none'
    OR referral_code_attempted IS NULL
    OR referral_reason IS NULL;

CREATE INDEX IF NOT EXISTS payments_referral_status_idx
  ON public.payments (referral_status, created_at DESC)
  WHERE referral_status <> 'none';

CREATE INDEX IF NOT EXISTS payments_referral_attempted_idx
  ON public.payments (lower(btrim(referral_code_attempted)))
  WHERE referral_code_attempted IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_pending_payout(
  p_creator_id TEXT,
  p_actor_id   TEXT
)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_payout_id TEXT;
  v_amount    INTEGER;
  v_count     INTEGER;
BEGIN
  SELECT COALESCE(SUM(creator_earning), 0)::INTEGER, COUNT(*)::INTEGER
    INTO v_amount, v_count
    FROM public.payments
   WHERE creator_id = p_creator_id
     AND payout_id IS NULL
     AND payment_id IS NOT NULL
     AND amount_paid > 0
     AND status IN ('captured', 'completed', 'paid')
     AND COALESCE(creator_earning, 0) > 0;

  IF v_amount <= 0 OR v_count = 0 THEN
    RAISE EXCEPTION 'No unpaid earnings for creator %', p_creator_id
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.payouts (creator_id, amount, payment_count, status, paid_at, marked_paid_by)
  VALUES (p_creator_id, v_amount, v_count, 'paid', NOW(), p_actor_id)
  RETURNING id INTO v_payout_id;

  UPDATE public.payments
     SET payout_id = v_payout_id
   WHERE creator_id = p_creator_id
     AND payout_id IS NULL
     AND payment_id IS NOT NULL
     AND amount_paid > 0
     AND status IN ('captured', 'completed', 'paid')
     AND COALESCE(creator_earning, 0) > 0;

  RETURN v_payout_id;
END;
$$;

COMMIT;

-- END 20260503220558_robust_referral_attribution.sql

-- BEGIN 20261001105920_score_recovery_foundations.sql
-- Service-only APIs. No answer-bearing snapshots are exposed through the public client.
alter table public.questions add column if not exists evidence jsonb;
alter table public.questions add column if not exists family_id text;
alter table public.questions add column if not exists passage_text text;
create table public.recovery_family_holds(family_id text primary key,reason text not null,created_at timestamptz not null default now());
alter table public.recovery_family_holds enable row level security;
revoke all on public.recovery_family_holds from public,anon,authenticated;
grant all on public.recovery_family_holds to service_role;
alter table public.attempts add column if not exists selection_meta jsonb not null default '{}';
create table public.recovery_sessions (
 id text primary key, user_id text not null references public.users(id), request_key text not null,
 subject text not null, mode text not null, state text not null check(state in ('active','submitted')),
 questions jsonb not null, selection_meta jsonb not null default '{}', events jsonb not null default '[]',
 created_at timestamptz not null, expires_at timestamptz not null,
 unique(user_id, request_key)
);
create table public.recovery_review_queue (
 user_id text not null references public.users(id), question_id text not null,
 attempt_id text not null references public.attempts(id), due_at timestamptz not null,
 state text not null default 'pending', primary key(user_id, question_id, attempt_id)
);
create table public.question_version_history (
 id bigint generated always as identity primary key, question_id text not null,
 previous_row jsonb not null, reason text not null, created_at timestamptz not null default now()
);
create table public.recovery_playbook (
 id bigint generated always as identity primary key, user_id text not null references public.users(id),
 attempt_id text not null references public.attempts(id), strategy text not null,
 reflection text not null default '', evidence_state text not null default 'more_evidence_needed',
 created_at timestamptz not null default now(), unique(user_id,attempt_id,strategy)
);
alter table public.recovery_playbook enable row level security;
revoke all on public.recovery_playbook from anon,authenticated;
grant all on public.recovery_playbook to service_role;
grant usage,select on sequence public.recovery_playbook_id_seq to service_role;
alter table public.recovery_sessions enable row level security;
alter table public.recovery_review_queue enable row level security;
alter table public.question_version_history enable row level security;
revoke all on public.recovery_sessions, public.recovery_review_queue, public.question_version_history from anon, authenticated;
grant all on public.recovery_sessions, public.recovery_review_queue, public.question_version_history to service_role;
grant usage, select on sequence public.question_version_history_id_seq to service_role;

create function public.start_recovery_session(p_row jsonb, p_credit_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.recovery_sessions%rowtype;
begin
 -- Serialize starts for an owner before checking idempotency or charging.
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into existing from public.recovery_sessions
 where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(existing); end if;
 if p_credit_action is not null and not public.spend_credits(p_row->>'user_id',p_credit_action,'recovery:'||(p_row->>'id'))
 then raise exception 'insufficient credits'; end if;
 insert into public.recovery_sessions select * from jsonb_populate_record(null::public.recovery_sessions,jsonb_set(p_row,'{events}',coalesce(p_row->'events','[]'::jsonb)))
 returning * into existing;
 return to_jsonb(existing);
end $$;

create function public.record_recovery_events(p_id text, p_user_id text, p_events jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; e jsonb; n int;
begin
 select * into s from public.recovery_sessions where id=p_id and user_id=p_user_id for update;
 if not found then raise exception 'session not found'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
   n=(e->>'seq')::int;
   if n<=jsonb_array_length(s.events) then
     if s.events->(n-1)<>e then raise exception 'event conflict'; end if;
     continue;
   end if;
   if s.state<>'active' or now()>s.expires_at then raise exception 'session expired'; end if;
   if n<>jsonb_array_length(s.events)+1 or n>5000 then raise exception 'event sequence gap'; end if;
   if jsonb_array_length(s.events)>0 and (e->>'at')::numeric<(s.events->-1->>'at')::numeric then raise exception 'event clock conflict'; end if;
   s.events=s.events||jsonb_build_array(e);
 end loop;
 update public.recovery_sessions set events=s.events where id=s.id;
 return s.events;
end $$;

create function public.finish_recovery_session(p_id text, p_user_id text, p_result jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; d jsonb; q jsonb;
begin
 select * into s from public.recovery_sessions where id=p_id and user_id=p_user_id for update;
 if not found then raise exception 'session not found'; end if;
 if s.state='submitted' then return s.id; end if;
 if p_result->>'expected_event_count' is null or (p_result->>'expected_event_count')::int<>jsonb_array_length(s.events) then raise exception 'event conflict'; end if;
 if now()>s.expires_at+interval '2 minutes' then raise exception 'session expired'; end if;
 insert into public.attempts(id,user_id,subject,score,correct,wrong,unattempted,total,details,questions_snapshot,selection_meta)
 values(s.id,s.user_id,s.subject,(p_result->>'score')::int,(p_result->>'correct')::int,
 (p_result->>'wrong')::int,(p_result->>'unattempted')::int,(p_result->>'total')::int,
 p_result->'details',s.questions,p_result->'selectionMeta');
 for d in select value from jsonb_array_elements(p_result->'details') loop
   select value into q from jsonb_array_elements(s.questions) where value->>'id'=d->>'qid';
   insert into public.user_question_progress(user_id,question_id,subject,chapter,seen_count,attempt_count,correct_count,skip_count,last_selected_key,last_correct,last_seen_at,last_attempted_at,updated_at)
   values(s.user_id,d->>'qid',s.subject,q->>'chapter',1,
     case when d->>'givenIndex' is null then 0 else 1 end,
     case when (d->>'isCorrect')::boolean is true then 1 else 0 end,
     case when d->>'givenIndex' is null then 1 else 0 end,
     substr('ABCD',coalesce((d->>'givenIndex')::int, -1)+1,1),(d->>'isCorrect')::boolean,now(),now(),now())
   on conflict(user_id,question_id) do update set
     seen_count=public.user_question_progress.seen_count+1,
     attempt_count=public.user_question_progress.attempt_count+excluded.attempt_count,
     correct_count=public.user_question_progress.correct_count+excluded.correct_count,
     skip_count=public.user_question_progress.skip_count+excluded.skip_count,
     last_selected_key=excluded.last_selected_key,last_correct=excluded.last_correct,last_seen_at=now(),last_attempted_at=now(),updated_at=now();
   if (d->>'isCorrect')::boolean is not true then
     insert into public.recovery_review_queue(user_id,question_id,attempt_id,due_at)
     values(s.user_id,d->>'qid',s.id,now()+interval '1 day') on conflict do nothing;
   end if;
 end loop;
 update public.recovery_sessions set state='submitted' where id=s.id;
 return s.id;
end $$;
revoke all on function public.start_recovery_session(jsonb,text), public.finish_recovery_session(text,text,jsonb), public.record_recovery_events(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.start_recovery_session(jsonb,text), public.finish_recovery_session(text,text,jsonb), public.record_recovery_events(text,text,jsonb) to service_role;

-- A quarantine changes eligibility only. Attempts and question IDs stay intact.
create function public.quarantine_recovery_questions(p_changes jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare c jsonb; r jsonb; expected jsonb; actual jsonb; n int=0; family text; dependent record;
begin
 for c in select value from jsonb_array_elements(p_changes) loop
   select to_jsonb(q) into r from public.questions q where id=c->>'id' for update;
   if r is null then raise exception 'audit item missing'; end if;
   expected=c->'expected_content';
   -- Match answer-bearing fields in the saved dry run. Passage lookup can attach text.
   actual=jsonb_build_object('subject',r->'subject','chapter',r->'chapter',
     'concept',coalesce(r->>'concept_id',r->>'concept',''),
     'body',coalesce(r->>'body',r->>'question_text',r->>'question',''),
     'explanation',coalesce(r->>'explanation',r->>'answer_explanation',''));
   if actual->>'subject'<>expected->>'subject' or actual->>'chapter'<>expected->>'chapter'
      or actual->>'concept'<>expected->>'concept' or actual->>'body'<>expected->>'body'
      or actual->>'explanation'<>expected->>'explanation'
      or r->'options' is distinct from c->'expected_options'
      or coalesce(r->>'correct_answer',r->>'correct_option',r->>'correct_index','') is distinct from c->>'expected_key'
   then raise exception 'audit snapshot stale'; end if;
   family=coalesce(r->>'family_id',r->'evidence'->'record'->>'family_id');
   if family is not null then
     insert into public.recovery_family_holds(family_id,reason) values(family,c->>'reason') on conflict(family_id) do update set reason=excluded.reason;
   end if;
   for dependent in select q.id,to_jsonb(q) as previous_row from public.questions q
     where q.id=c->>'id' or (family is not null and (q.family_id=family or q.evidence->'record'->>'family_id'=family)) for update loop
     insert into public.question_version_history(question_id,previous_row,reason)
       values(dependent.id,dependent.previous_row,c->>'reason');
     update public.questions set evidence=jsonb_build_object('record',jsonb_build_object('state','quarantined'),'reason',c->>'reason') where id=dependent.id;
     n=n+1;
   end loop;
 end loop;
 return n;
end $$;
create function public.restore_recovery_question(p_history_id bigint)
returns text language plpgsql security invoker set search_path='' as $$
declare h public.question_version_history%rowtype;
begin
 select * into h from public.question_version_history where id=p_history_id;
 if not found then raise exception 'history missing'; end if;
 update public.questions set evidence=h.previous_row->'evidence' where id=h.question_id and evidence->'record'->>'state'='quarantined';
 if not found then raise exception 'item is not quarantined'; end if;
 return h.question_id;
end $$;
revoke all on function public.quarantine_recovery_questions(jsonb),public.restore_recovery_question(bigint) from public,anon,authenticated;
grant execute on function public.quarantine_recovery_questions(jsonb),public.restore_recovery_question(bigint) to service_role;

-- Publish passage and all checked children in the same Postgres transaction.
-- Column names are quoted identifiers; values remain bound JSON parameters.
create function public.publish_recovery_passage(p_group jsonb,p_questions jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q jsonb; cols text; ids jsonb='[]';
begin
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<2 or jsonb_array_length(p_questions)>20 then raise exception 'complete passage unit required'; end if;
 if coalesce(p_group->>'id','')='' or coalesce(p_group->>'passage_text','')='' then raise exception 'invalid passage'; end if;
 select string_agg(format('%I',key),',') into cols from jsonb_object_keys(p_group) key;
 execute format('insert into public.passage_groups (%s) select %s from jsonb_populate_record(null::public.passage_groups,$1)',cols,cols) using p_group;
 for q in select value from jsonb_array_elements(p_questions) loop
   if q->>'passage_group_id' is distinct from p_group->>'id' or q->>'passage_text' is distinct from p_group->>'passage_text'
     or q->'evidence'->'record'->>'route' is distinct from 'passage'
     or not coalesce(q->'evidence'->'record'->>'state' in ('eligible','published'),false)
     or q->'evidence'->>'signature' is null then raise exception 'invalid passage child evidence'; end if;
   select string_agg(format('%I',key),',') into cols from jsonb_object_keys(q) key;
   execute format('insert into public.questions (%s) select %s from jsonb_populate_record(null::public.questions,$1)',cols,cols) using q;
   ids=ids||jsonb_build_array(q->>'id');
 end loop;
 return ids;
end $$;
revoke all on function public.publish_recovery_passage(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_recovery_passage(jsonb,jsonb) to service_role;

-- END 20261001105920_score_recovery_foundations.sql

-- BEGIN 20261002120000_connected_learning.sql
-- Saved only. Apply to staging explicitly after foundation migration and backup.
-- Service-only, owner-bound transactions; no production changes are implicit.
create table public.learning_allowances (
 user_id text not null references public.users(id), kind text not null, period text not null,
 reference text not null, created_at timestamptz not null default now(), primary key(user_id,kind,period)
);
create table public.learning_episodes (
 id text primary key, user_id text not null references public.users(id), request_key text not null,
 concept_id text not null, pathway jsonb not null, projection jsonb not null,
 revision int not null default 0, created_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index learning_episodes_owner on public.learning_episodes(user_id,created_at desc);
create table public.learning_observations (
 id bigint generated always as identity primary key, episode_id text not null references public.learning_episodes(id),
 user_id text not null references public.users(id), request_key text not null, response jsonb not null,
 projection jsonb not null, created_at timestamptz not null default now(), unique(episode_id,request_key)
);
create table public.learning_family_exposure (
 user_id text not null references public.users(id), family_id text not null,
 reference text not null, created_at timestamptz not null default now(), primary key(user_id,family_id)
);
create table public.learning_question_exposure (
 user_id text not null references public.users(id), question_id text not null,
 reference text not null, created_at timestamptz not null default now(), primary key(user_id,question_id)
);
create index recovery_sessions_owner_state on public.recovery_sessions(user_id,state,expires_at);
alter table public.learning_allowances enable row level security;
alter table public.learning_episodes enable row level security;
alter table public.learning_observations enable row level security;
alter table public.learning_family_exposure enable row level security;
alter table public.learning_question_exposure enable row level security;
revoke all on public.learning_allowances,public.learning_episodes,public.learning_observations,public.learning_family_exposure,public.learning_question_exposure from public,anon,authenticated;
grant all on public.learning_allowances,public.learning_episodes,public.learning_family_exposure,public.learning_question_exposure to service_role;
-- Append-only observations; no UPDATE/DELETE grant even to the application role.
grant select,insert on public.learning_observations to service_role;
grant usage,select on sequence public.learning_observations_id_seq to service_role;

create function public.start_learning_episode(p_row jsonb,p_free_period text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.learning_episodes%rowtype; i jsonb;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into e from public.learning_episodes where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(e); end if;
 select * into e from public.learning_episodes where user_id=p_row->>'user_id' and concept_id=p_row->>'concept_id'
 and projection->>'state' not in ('invalidated','maintained');
 if found then return to_jsonb(e); end if;
 for i in select value from jsonb_array_elements((p_row->'pathway'->'probes')||(p_row->'pathway'->'repair')||(p_row->'pathway'->'checks')) loop
   if exists(select 1 from public.learning_family_exposure where user_id=p_row->>'user_id' and family_id=i->>'familyId')
   or exists(select 1 from public.learning_question_exposure where user_id=p_row->>'user_id' and question_id=i->>'questionId')
   or exists(select 1 from public.attempts a,lateral jsonb_array_elements(coalesce(a.questions_snapshot,'[]')) q where a.user_id=p_row->>'user_id' and (q->>'id'=i->>'questionId' or coalesce(q->>'familyId',q->>'family_id')=i->>'familyId'))
   or exists(select 1 from public.questions q where (q.id=i->>'questionId' or coalesce(q.family_id,q.evidence->'record'->>'family_id')=i->>'familyId') and (
     coalesce(to_jsonb(q)->>'author_id',to_jsonb(q)->>'uploaded_by')=p_row->>'user_id'
     or exists(select 1 from public.question_bookmarks b where b.user_id=p_row->>'user_id' and b.question_id=q.id)
     or exists(select 1 from public.user_question_progress g where g.user_id=p_row->>'user_id' and g.question_id=q.id and (g.seen_count>0 or g.attempt_count>0))
     or exists(select 1 from public.question_interactions x where x.user_id=p_row->>'user_id' and x.question_id=q.id))) then raise exception 'insufficient fresh content'; end if;
 end loop;
 if p_free_period is not null then
   if exists(select 1 from public.learning_allowances where user_id=p_row->>'user_id' and kind='weekly_episode' and period=p_free_period) then raise exception 'weekly allowance used'; end if;
   insert into public.learning_allowances values(p_row->>'user_id','weekly_episode',p_free_period,p_row->>'id',now());
 end if;
 insert into public.learning_episodes(id,user_id,request_key,concept_id,pathway,projection)
 values(p_row->>'id',p_row->>'user_id',p_row->>'request_key',p_row->>'concept_id',p_row->'pathway',p_row->'projection') returning * into e;
 for i in select value from jsonb_array_elements((e.pathway->'probes')||(e.pathway->'repair')||(e.pathway->'checks')) loop
   insert into public.learning_family_exposure values(e.user_id,i->>'familyId',e.id,now()) on conflict do nothing;
   insert into public.learning_question_exposure values(e.user_id,i->>'questionId',e.id,now()) on conflict do nothing;
 end loop;
 return to_jsonb(e);
end $$;

create function public.advance_learning_episode(p_id text,p_user text,p_key text,p_response jsonb,p_revision int,p_projection jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.learning_episodes%rowtype; o public.learning_observations%rowtype;
begin
 select * into e from public.learning_episodes where id=p_id and user_id=p_user for update;
 if not found then raise exception 'episode not found'; end if;
 select * into o from public.learning_observations where episode_id=p_id and request_key=p_key;
 if found then
   if o.response is distinct from p_response then raise exception 'idempotency conflict'; end if;
   return o.projection;
 end if;
 if e.revision<>p_revision or (p_projection->>'revision')::int<>p_revision+1 then raise exception 'revision conflict'; end if;
 insert into public.learning_observations(episode_id,user_id,request_key,response,projection) values(p_id,p_user,p_key,p_response,p_projection);
 update public.learning_episodes set projection=p_projection,revision=p_revision+1 where id=p_id;
 return p_projection;
end $$;

create function public.start_learning_session(p_row jsonb,p_credit_action text,p_quota_kind text,p_period text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.recovery_sessions%rowtype; result jsonb; q jsonb; used boolean=false;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into s from public.recovery_sessions where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(s); end if;
 if p_quota_kind is not null then
   used=exists(select 1 from public.learning_allowances where user_id=p_row->>'user_id' and kind=p_quota_kind and period=p_period);
   if not used then insert into public.learning_allowances values(p_row->>'user_id',p_quota_kind,p_period,p_row->>'id',now()); end if;
 end if;
 result=public.start_recovery_session(p_row,case when p_quota_kind is not null and not used then null else p_credit_action end);
 for q in select value from jsonb_array_elements(p_row->'questions') loop
   insert into public.learning_question_exposure values(p_row->>'user_id',q->>'id',p_row->>'id',now()) on conflict do nothing;
   if q->>'familyId' is not null then insert into public.learning_family_exposure values(p_row->>'user_id',q->>'familyId',p_row->>'id',now()) on conflict do nothing; end if;
 end loop;
 return result;
end $$;
revoke all on function public.start_learning_episode(jsonb,text),public.advance_learning_episode(text,text,text,jsonb,int,jsonb),public.start_learning_session(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.start_learning_episode(jsonb,text),public.advance_learning_episode(text,text,text,jsonb,int,jsonb),public.start_learning_session(jsonb,text,text,text) to service_role;

-- Invalidate derived learning claims as soon as answer-bearing content changes.
create function public.invalidate_learning_evidence() returns trigger language plpgsql security definer set search_path='' as $$
declare eid text;
begin
 if to_jsonb(new) is distinct from to_jsonb(old) and (
 new.evidence is distinct from old.evidence or new.body is distinct from old.body
 or new.options is distinct from old.options or new.correct_answer is distinct from old.correct_answer
 or new.explanation is distinct from old.explanation or to_jsonb(new)->'correct_index' is distinct from to_jsonb(old)->'correct_index'
 or to_jsonb(new)->'status' is distinct from to_jsonb(old)->'status' or to_jsonb(new)->'verification_state' is distinct from to_jsonb(old)->'verification_state') then
   for eid in select distinct e.id from public.learning_episodes e,
     lateral jsonb_array_elements((e.pathway->'probes')||(e.pathway->'repair')||(e.pathway->'checks')) i
     where i->>'questionId'=new.id and e.projection->>'state'<>'invalidated' loop
     insert into public.learning_observations(episode_id,user_id,request_key,response,projection)
     select id,user_id,'invalidate:'||revision,jsonb_build_object('reason','content_changed','questionId',new.id),
       jsonb_set(jsonb_set(projection,'{state}','"invalidated"'),'{revision}',to_jsonb(revision+1)) from public.learning_episodes where id=eid for update;
     update public.learning_episodes set projection=jsonb_set(jsonb_set(projection,'{state}','"invalidated"'),'{revision}',to_jsonb(revision+1)),revision=revision+1 where id=eid;
   end loop;
 end if;
 return new;
end $$;
revoke all on function public.invalidate_learning_evidence() from public,anon,authenticated;
create trigger learning_evidence_change after update on public.questions for each row execute function public.invalidate_learning_evidence();

create function public.invalidate_held_learning_family() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.learning_episodes%rowtype;
begin
 for e in select * from public.learning_episodes where projection->>'state'<>'invalidated' and exists(
   select 1 from jsonb_array_elements((pathway->'probes')||(pathway->'repair')||(pathway->'checks')) i where i->>'familyId'=new.family_id) for update loop
   insert into public.learning_observations(episode_id,user_id,request_key,response,projection) values(e.id,e.user_id,'invalidate:'||e.revision,jsonb_build_object('reason','family_held','familyId',new.family_id),jsonb_set(jsonb_set(e.projection,'{state}','"invalidated"'),'{revision}',to_jsonb(e.revision+1)));
   update public.learning_episodes set projection=jsonb_set(jsonb_set(projection,'{state}','"invalidated"'),'{revision}',to_jsonb(revision+1)),revision=revision+1 where id=e.id;
 end loop;
 return new;
end $$;
revoke all on function public.invalidate_held_learning_family() from public,anon,authenticated;
create trigger held_family_learning after insert or update on public.recovery_family_holds for each row execute function public.invalidate_held_learning_family();

-- END 20261002120000_connected_learning.sql

-- BEGIN 20261002121000_runtime_ai_guard.sql
-- Runtime AI funding is separate from the content pipeline ($2/$10 unchanged).
-- Seed zero authorization and no model prices: dispatch stays disabled.
create table public.runtime_ai_budget(id text primary key,funded_usd numeric not null default 0 check(funded_usd>=0),spent_usd numeric not null default 0,reserved_usd numeric not null default 0,paused boolean not null default false);
insert into public.runtime_ai_budget(id) values('student_ai');
create table public.runtime_ai_prices(provider text,model text,input_per_million numeric not null check(input_per_million>0),output_per_million numeric not null check(output_per_million>0),source_url text not null,verified_at timestamptz not null,primary key(provider,model));
create table public.runtime_ai_requests(request_key text primary key,provider text not null,model text not null,reserved_usd numeric not null,actual_usd numeric,state text not null default 'reserved',receipt jsonb,created_at timestamptz not null default now());
create table public.persistent_rate_limits(bucket text primary key,count int not null,reset_at timestamptz not null);
alter table public.runtime_ai_budget enable row level security;
alter table public.runtime_ai_prices enable row level security;
alter table public.runtime_ai_requests enable row level security;
alter table public.persistent_rate_limits enable row level security;
revoke all on public.runtime_ai_budget,public.runtime_ai_prices,public.runtime_ai_requests,public.persistent_rate_limits from public,anon,authenticated;
grant select,update on public.runtime_ai_budget to service_role;
grant select on public.runtime_ai_prices to service_role;
grant select,insert,update on public.runtime_ai_requests,public.persistent_rate_limits to service_role;
create function public.reserve_runtime_ai(p_key text,p_provider text,p_model text,p_input_bound int,p_output_bound int)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;
begin
 select * into b from public.runtime_ai_budget where id='student_ai' for update;
 if not found or b.paused then raise exception 'runtime funding unavailable'; end if;
 select * into r from public.runtime_ai_requests where request_key=p_key;
 if found then
   if r.provider<>p_provider or r.model<>p_model then raise exception 'request conflict'; end if;
   return jsonb_build_object('dispatch',false,'state',r.state,'receipt',r.receipt);
 end if;
 select * into price from public.runtime_ai_prices where provider=p_provider and model=p_model and verified_at>now()-interval '30 days';
 if not found then raise exception 'verified model price required'; end if;
 if p_input_bound<1 or p_output_bound<1 then raise exception 'invalid token bounds'; end if;
 cost=(p_input_bound*price.input_per_million+p_output_bound*price.output_per_million)/1000000;
 if b.spent_usd+b.reserved_usd+cost>b.funded_usd then raise exception 'runtime budget exhausted'; end if;
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd) values(p_key,p_provider,p_model,cost);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $$;
create function public.receipt_runtime_ai(p_key text,p_cost numeric,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.runtime_ai_requests%rowtype;cost numeric;
begin
 perform 1 from public.runtime_ai_budget where id='student_ai' for update;
 select * into r from public.runtime_ai_requests where request_key=p_key for update;
 if not found then raise exception 'reservation not found'; end if;
 if r.state<>'reserved' then return true; end if;
 -- Ambiguous transport failure/missing usage retains the full physical-call cost.
 cost=coalesce(p_cost,r.reserved_usd);
 if cost<0 then raise exception 'invalid usage cost'; end if;
 update public.runtime_ai_requests set actual_usd=cost,state='receipted',receipt=p_receipt where request_key=p_key;
 update public.runtime_ai_budget set reserved_usd=reserved_usd-r.reserved_usd,spent_usd=spent_usd+cost,paused=paused or cost>r.reserved_usd or p_cost is null where id='student_ai';
 return true;
end $$;
create function public.take_rate_limit(p_bucket text,p_limit int,p_window_ms int)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n int;
begin
 if p_limit<1 or p_window_ms<1 then raise exception 'invalid limit'; end if;
 insert into public.persistent_rate_limits values(p_bucket,1,now()+p_window_ms*interval '1 millisecond')
 on conflict(bucket) do update set count=case when public.persistent_rate_limits.reset_at<=now() then 1 else public.persistent_rate_limits.count+1 end,
 reset_at=case when public.persistent_rate_limits.reset_at<=now() then now()+p_window_ms*interval '1 millisecond' else public.persistent_rate_limits.reset_at end returning count into n;
 return n<=p_limit;
end $$;
revoke all on function public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb),public.take_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb),public.take_rate_limit(text,int,int) to service_role;

-- END 20261002121000_runtime_ai_guard.sql

-- BEGIN 20261002122000_rival_atomic_submission.sql
-- Requires the existing rival tables. Save/apply separately after schema dry run.
create function public.submit_rival_battle(p_id uuid,p_user text,p_answers jsonb,p_update jsonb,p_response jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b record;a jsonb;
begin
 select * into b from public.rival_battles where id=p_id and user_id=p_user for update;
 if not found then raise exception 'battle not found'; end if;
 if b.status='submitted' then
   if b.metadata->'submittedAnswers' is distinct from p_answers then raise exception 'submission conflict'; end if;
   return b.metadata->'submissionResponse';
 end if;
 if (select count(*) from jsonb_array_elements(p_answers))<>(select count(distinct value->>'question_id') from jsonb_array_elements(p_answers)) then raise exception 'duplicate question ids'; end if;
 for a in select value from jsonb_array_elements(p_answers) loop
   insert into public.rival_battle_answers(battle_id,user_id,question_id,selected_answer,is_correct,time_spent_seconds)
   values(p_id,p_user,a->>'question_id',(a->>'selected_answer')::int,(a->>'is_correct')::boolean,(a->>'time_spent_seconds')::numeric);
 end loop;
 update public.rival_battles set status='submitted',user_score=(p_update->>'user_score')::int,
 user_accuracy=(p_update->>'user_accuracy')::numeric,user_time_seconds=(p_update->>'user_time_seconds')::numeric,
 result=p_update->>'result',submitted_at=now(),metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object('shareCard',p_response->'shareCard','nextMoveHint',p_response->'nextMoveHint','submittedAnswers',p_answers,'submissionResponse',p_response)
 where id=p_id;
 return p_response;
end $$;
revoke all on function public.submit_rival_battle(uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_rival_battle(uuid,text,jsonb,jsonb,jsonb) to service_role;

-- END 20261002122000_rival_atomic_submission.sql

-- BEGIN 20261002123000_answer_correction_history.sql
-- Derived corrections never overwrite an original scored attempt/snapshot.
create table public.attempt_recalculation_queue (
 attempt_id text not null references public.attempts(id),question_id text not null,
 question_version bigint not null references public.question_version_history(id),state text not null default 'awaiting_revalidation',
 created_at timestamptz not null default now(),primary key(attempt_id,question_id,question_version)
);
create table public.attempt_score_revisions (
 id bigint generated always as identity primary key,attempt_id text not null references public.attempts(id),
 question_version bigint not null references public.question_version_history(id),result jsonb not null,
 evidence_state text not null,created_at timestamptz not null default now(),unique(attempt_id,question_version)
);
alter table public.attempt_recalculation_queue enable row level security;
alter table public.attempt_score_revisions enable row level security;
revoke all on public.attempt_recalculation_queue,public.attempt_score_revisions from public,anon,authenticated;
grant select,insert,update on public.attempt_recalculation_queue to service_role;
grant select,insert on public.attempt_score_revisions to service_role;
grant usage,select on sequence public.attempt_score_revisions_id_seq to service_role;
create function public.archive_answer_change() returns trigger language plpgsql security definer set search_path='' as $$
declare version_id bigint;
begin
 if old.body is distinct from new.body or old.options is distinct from new.options or old.correct_answer is distinct from new.correct_answer
 or old.explanation is distinct from new.explanation or to_jsonb(old)->'correct_index' is distinct from to_jsonb(new)->'correct_index' then
   insert into public.question_version_history(question_id,previous_row,reason) values(old.id,to_jsonb(old),'answer-bearing change; revalidation required') returning id into version_id;
   insert into public.attempt_recalculation_queue(attempt_id,question_id,question_version)
   select a.id,old.id,version_id from public.attempts a where exists(select 1 from jsonb_array_elements(a.questions_snapshot) q where q->>'id'=old.id);
 end if;
 return new;
end $$;
revoke all on function public.archive_answer_change() from public,anon,authenticated;
create trigger archive_answer_version before update on public.questions for each row execute function public.archive_answer_change();

-- END 20261002123000_answer_correction_history.sql

-- BEGIN 20261002130000_prepos_credit_reservations.sql
-- PrepOS student-credit reservations: reserved -> executing -> committed | released.
--
-- NOT APPLIED. Save, review and run on staging first (docs/brain/LEARNING-DEPLOYMENT.md).
-- Depends on db/migrations/2026_05_02_ai_overlay_credits_fix.sql (wallet + ledger tables).
-- Rollback: drop the four functions and the table below; the wallet and ledger tables are
-- untouched and existing balances keep working. The older mm_ai_consume_credits stays for
-- zero-risk callers; paid model replies use this lifecycle instead.
--
-- Guarantees:
--   * One stable operation key per student action. Retrying the same key never charges twice.
--   * Reserving takes the credits out of the wallet inside the same transaction that records the
--     reservation and its ledger row, so concurrent requests cannot overspend.
--   * Release returns exactly what was taken (included first, bonus second). If the monthly
--     period has rolled, expired included credits come back as bonus credits, so a failed reply
--     never costs the student anything.
--   * Commit makes the charge final. A committed reservation can never be released, and a
--     released one can never be committed.
--   * Provider spend is recorded separately (runtime_ai_requests); a release does not erase it.

create table if not exists public.ai_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  operation_key text not null,
  amount integer not null check (amount > 0),
  action text not null,
  state text not null default 'reserved' check (state in ('reserved', 'executing', 'committed', 'released')),
  from_included integer not null default 0 check (from_included >= 0),
  from_bonus integer not null default 0 check (from_bonus >= 0),
  period_start timestamptz not null,
  provider_key text,
  receipt jsonb,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  constraint ai_credit_reservations_split check (from_included + from_bonus = amount)
);
create unique index if not exists ai_credit_reservations_operation_idx on public.ai_credit_reservations (operation_key);
create index if not exists ai_credit_reservations_open_idx on public.ai_credit_reservations (expires_at) where state in ('reserved', 'executing');
create index if not exists ai_credit_reservations_user_idx on public.ai_credit_reservations (user_id, created_at desc);

alter table public.ai_credit_reservations enable row level security;
revoke all on public.ai_credit_reservations from public, anon, authenticated;
grant select, insert, update on public.ai_credit_reservations to service_role;

create or replace function public.mm_ai_reserve_credits(
  p_user_id text,
  p_amount integer,
  p_action text,
  p_operation_key text,
  p_included_monthly_credits integer,
  p_period_start timestamptz,
  p_reset_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_existing public.ai_credit_reservations%rowtype;
  v_allow integer := greatest(0, coalesce(p_included_monthly_credits, 10));
  v_included_remaining integer;
  v_from_included integer;
  v_from_bonus integer;
  v_balance integer;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_operation_key is null or length(p_operation_key) < 8 then
    return jsonb_build_object('ok', false, 'error', 'operation_key_required');
  end if;

  insert into public.ai_credit_wallets (user_id, included_monthly_credits, included_credits_used, bonus_credits, period_start, reset_at)
  values (p_user_id, v_allow, 0, 0, p_period_start, p_reset_at)
  on conflict (user_id) do nothing;

  -- One lock order everywhere: wallet first. This serialises concurrent reservations per user
  -- before the idempotency record is read.
  select * into v_wallet from public.ai_credit_wallets where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  select * into v_existing from public.ai_credit_reservations where operation_key = p_operation_key;
  if found then
    if v_existing.user_id <> p_user_id then
      return jsonb_build_object('ok', false, 'error', 'operation_key_conflict');
    end if;
    if v_existing.state = 'released' then
      return jsonb_build_object('ok', false, 'error', 'operation_released', 'state', v_existing.state);
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', v_existing.state, 'amount', v_existing.amount);
  end if;

  if v_wallet.period_start < p_period_start or v_wallet.included_monthly_credits <> v_allow then
    update public.ai_credit_wallets
       set included_monthly_credits = v_allow,
           included_credits_used = case when v_wallet.period_start < p_period_start then 0 else least(v_wallet.included_credits_used, v_allow) end,
           period_start = case when v_wallet.period_start < p_period_start then p_period_start else v_wallet.period_start end,
           reset_at = case when v_wallet.period_start < p_period_start then p_reset_at else v_wallet.reset_at end,
           updated_at = now()
     where user_id = p_user_id
     returning * into v_wallet;
  end if;

  v_included_remaining := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used);
  v_balance := v_included_remaining + v_wallet.bonus_credits;
  if v_balance < p_amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_ai_credits', 'balance', v_balance, 'required', p_amount);
  end if;

  v_from_included := least(v_included_remaining, p_amount);
  v_from_bonus := p_amount - v_from_included;

  update public.ai_credit_wallets
     set included_credits_used = included_credits_used + v_from_included,
         bonus_credits = bonus_credits - v_from_bonus,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.ai_credit_reservations (user_id, operation_key, amount, action, from_included, from_bonus, period_start)
  values (p_user_id, p_operation_key, p_amount, coalesce(p_action, 'ai'), v_from_included, v_from_bonus, v_wallet.period_start);

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    p_user_id, -p_amount, 'ai_reserve', coalesce(p_action, 'ai'), p_operation_key,
    case when v_from_included > 0 and v_from_bonus > 0 then 'mixed' when v_from_included > 0 then 'included' else 'bonus' end,
    v_balance, 'reserve:' || p_operation_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('kind', 'reserve', 'includedSpent', v_from_included, 'bonusSpent', v_from_bonus)
  );

  return jsonb_build_object('ok', true, 'state', 'reserved', 'amount', p_amount, 'balance', v_balance,
    'includedSpent', v_from_included, 'bonusSpent', v_from_bonus);
end;
$$;

create or replace function public.mm_ai_mark_executing(p_operation_key text, p_provider_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.ai_credit_reservations%rowtype;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  if v_res.state = 'reserved' then
    update public.ai_credit_reservations
       set state = 'executing', provider_key = p_provider_key, expires_at = now() + interval '10 minutes', updated_at = now()
     where id = v_res.id;
    return jsonb_build_object('ok', true, 'state', 'executing');
  end if;
  if v_res.state = 'executing' then
    return jsonb_build_object('ok', true, 'state', 'executing', 'idempotent', true);
  end if;
  return jsonb_build_object('ok', false, 'error', 'reservation_' || v_res.state, 'state', v_res.state);
end;
$$;

create or replace function public.mm_ai_commit_credits(p_operation_key text, p_receipt jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.ai_credit_reservations%rowtype;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  if v_res.state = 'committed' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', 'committed', 'amount', v_res.amount);
  end if;
  if v_res.state = 'released' then
    return jsonb_build_object('ok', false, 'error', 'already_released', 'state', 'released');
  end if;
  update public.ai_credit_reservations
     set state = 'committed', receipt = coalesce(p_receipt, '{}'::jsonb), updated_at = now()
   where id = v_res.id;
  return jsonb_build_object('ok', true, 'state', 'committed', 'amount', v_res.amount);
end;
$$;

create or replace function public.mm_ai_release_credits(p_operation_key text, p_reason text default 'released')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.ai_credit_reservations%rowtype;
  v_wallet public.ai_credit_wallets%rowtype;
  v_to_included integer;
  v_to_bonus integer;
  v_balance integer;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  -- Lock order matches reserve: wallet, then the reservation.
  select * into v_wallet from public.ai_credit_wallets where user_id = v_res.user_id for update;
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key for update;

  if v_res.state = 'released' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', 'released');
  end if;
  if v_res.state = 'committed' then
    return jsonb_build_object('ok', false, 'error', 'already_committed', 'state', 'committed');
  end if;

  if v_wallet.period_start = v_res.period_start then
    v_to_included := v_res.from_included;
    v_to_bonus := v_res.from_bonus;
  else
    -- The monthly allowance already reset; hand back the expired included credits as bonus.
    v_to_included := 0;
    v_to_bonus := v_res.from_included + v_res.from_bonus;
  end if;

  update public.ai_credit_wallets
     set included_credits_used = greatest(0, included_credits_used - v_to_included),
         bonus_credits = bonus_credits + v_to_bonus,
         updated_at = now()
   where user_id = v_res.user_id
   returning * into v_wallet;

  update public.ai_credit_reservations
     set state = 'released', release_reason = left(coalesce(p_reason, 'released'), 200), updated_at = now()
   where id = v_res.id;

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    v_res.user_id, v_res.amount, 'ai_release', v_res.action, p_operation_key, 'adjustment', v_balance, 'release:' || p_operation_key,
    jsonb_build_object('kind', 'release', 'includedRestored', v_to_included, 'bonusRestored', v_to_bonus, 'reason', left(coalesce(p_reason, 'released'), 200))
  );

  return jsonb_build_object('ok', true, 'state', 'released', 'restored', v_res.amount, 'balance', v_balance);
end;
$$;

-- Sweeps reservations whose reply never finished (crash, timeout). Safe to run on a schedule.
create or replace function public.mm_ai_release_expired(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_count integer := 0;
begin
  for v_key in
    select operation_key from public.ai_credit_reservations
     where state in ('reserved', 'executing') and expires_at < now()
     order by expires_at
     limit greatest(1, least(coalesce(p_limit, 100), 1000))
  loop
    perform public.mm_ai_release_credits(v_key, 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.mm_ai_reserve_credits(text, integer, text, text, integer, timestamptz, timestamptz, jsonb),
  public.mm_ai_mark_executing(text, text), public.mm_ai_commit_credits(text, jsonb),
  public.mm_ai_release_credits(text, text), public.mm_ai_release_expired(integer) from public, anon, authenticated;
grant execute on function public.mm_ai_reserve_credits(text, integer, text, text, integer, timestamptz, timestamptz, jsonb),
  public.mm_ai_mark_executing(text, text), public.mm_ai_commit_credits(text, jsonb),
  public.mm_ai_release_credits(text, text), public.mm_ai_release_expired(integer) to service_role;

-- END 20261002130000_prepos_credit_reservations.sql

-- BEGIN 20261004120000_runtime_ai_monthly_cap.sql
-- Owner authorization, 4 October 2026: student-facing AI (PrepOS replies, Score Recovery tutor)
-- may spend up to USD 25 per IST calendar month. Applies after 20261002121000_runtime_ai_guard
-- and 20261002130000_prepos_credit_reservations.
--
-- Fixes found while preparing production:
--   1. ai_credit_ledger.reason only allowed the older reasons, so every reservation/release
--      insert ('ai_reserve' / 'ai_release') would have failed and broken all paid replies.
--   2. The budget was a lifetime ceiling; the authorization is monthly.
--   3. A single response with missing usage paused ALL student AI until manual intervention.
--      Missing usage now books the full reserved amount (never under-counts spend) without
--      pausing; only a genuine overrun of the reservation pauses dispatch.
--   4. Verified prices expired after 30 days, silently stopping AI each month. Now 90 days;
--      scripts/learning/prepos-readiness.mjs warns before expiry.
-- Rollback: restore the previous function bodies from 20261002121000_runtime_ai_guard.sql and
-- set monthly_cap_usd=0 (dispatch stops; history, wallets and ledger are untouched).

alter table public.ai_credit_ledger drop constraint if exists ai_credit_ledger_reason_check;
alter table public.ai_credit_ledger add constraint ai_credit_ledger_reason_check check (reason = any (array[
  'monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry','ai_reserve','ai_release']::text[]));

alter table public.runtime_ai_budget add column if not exists monthly_cap_usd numeric not null default 0 check (monthly_cap_usd >= 0);
create index if not exists runtime_ai_requests_created_idx on public.runtime_ai_requests(created_at);

create or replace function public.runtime_ai_month_start() returns timestamptz
language sql stable set search_path='' as $$
  select (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata'
$$;

create or replace function public.reserve_runtime_ai(p_key text,p_provider text,p_model text,p_input_bound int,p_output_bound int)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;month_spend numeric;
begin
 select * into b from public.runtime_ai_budget where id='student_ai' for update;
 if not found or b.paused then raise exception 'runtime funding unavailable'; end if;
 select * into r from public.runtime_ai_requests where request_key=p_key;
 if found then
   if r.provider<>p_provider or r.model<>p_model then raise exception 'request conflict'; end if;
   return jsonb_build_object('dispatch',false,'state',r.state,'receipt',r.receipt);
 end if;
 select * into price from public.runtime_ai_prices where provider=p_provider and model=p_model and verified_at>now()-interval '90 days';
 if not found then raise exception 'verified model price required'; end if;
 if p_input_bound<1 or p_output_bound<1 then raise exception 'invalid token bounds'; end if;
 cost=(p_input_bound*price.input_per_million+p_output_bound*price.output_per_million)/1000000;
 select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into month_spend
   from public.runtime_ai_requests where created_at>=public.runtime_ai_month_start();
 if month_spend+cost>b.monthly_cap_usd then raise exception 'runtime budget exhausted'; end if;
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd) values(p_key,p_provider,p_model,cost);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $$;

create or replace function public.receipt_runtime_ai(p_key text,p_cost numeric,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.runtime_ai_requests%rowtype;cost numeric;
begin
 perform 1 from public.runtime_ai_budget where id='student_ai' for update;
 select * into r from public.runtime_ai_requests where request_key=p_key for update;
 if not found then raise exception 'reservation not found'; end if;
 if r.state<>'reserved' then return true; end if;
 -- Missing usage books the full reservation, so spend is never under-counted.
 cost=coalesce(p_cost,r.reserved_usd);
 if cost<0 then raise exception 'invalid usage cost'; end if;
 update public.runtime_ai_requests set actual_usd=cost,state='receipted',receipt=p_receipt where request_key=p_key;
 update public.runtime_ai_budget set reserved_usd=greatest(0,reserved_usd-r.reserved_usd),spent_usd=spent_usd+cost,
   paused=paused or cost>r.reserved_usd where id='student_ai';
 return true;
end $$;

revoke all on function public.runtime_ai_month_start(),public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.runtime_ai_month_start(),public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb) to service_role;

update public.runtime_ai_budget set monthly_cap_usd=25 where id='student_ai';

-- Official list prices, USD per million tokens, read 4 October 2026.
insert into public.runtime_ai_prices(provider,model,input_per_million,output_per_million,source_url,verified_at) values
 ('anthropic','claude-haiku-4-5',1,5,'https://platform.claude.com/docs/en/about-claude/pricing',now()),
 ('anthropic','claude-sonnet-5-5',2,10,'https://platform.claude.com/docs/en/about-claude/pricing',now()),
 ('openai','gpt-4.1-mini',0.40,1.60,'https://developers.openai.com/api/docs/pricing',now())
on conflict(provider,model) do update set input_per_million=excluded.input_per_million,output_per_million=excluded.output_per_million,
 source_url=excluded.source_url,verified_at=excluded.verified_at;

-- END 20261004120000_runtime_ai_monthly_cap.sql

-- BEGIN 20261004154217_connected_study_suite.sql
-- Saved migration. Requires connected_learning. Explicit staging apply and verification first.
create schema if not exists study_private;
revoke all on schema study_private from public,anon,authenticated;
create table public.study_preferences (
 user_id text primary key references public.users(id), preferences jsonb not null,
 revision integer not null default 0, updated_at timestamptz not null default now()
);
create table public.study_units (
 id text not null, version integer not null, subject text not null, chapter text not null,
 concept_id text not null, content jsonb not null, content_hash text not null,
 publication_state text not null check(publication_state in ('candidate','published','quarantined')),
 primary key(id,version)
);
create table public.study_cards (
 id text not null, version integer not null, unit_id text not null, unit_version integer not null,
 content jsonb not null, content_hash text not null,
 primary key(id,version), foreign key(unit_id,unit_version) references public.study_units(id,version)
);
create table public.study_runs (
 id text primary key, user_id text not null references public.users(id), request_key text not null,
 request jsonb not null, mode text not null check(mode in ('learn','recall')), content jsonb not null,
 projection jsonb not null, revision integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index study_runs_owner on public.study_runs(user_id,updated_at desc);
create table public.study_events (
 id bigint generated always as identity primary key, run_id text not null references public.study_runs(id),
 user_id text not null references public.users(id), request_key text not null, event jsonb not null,
 result jsonb not null, created_at timestamptz not null default now(), unique(run_id,request_key)
);
create table public.study_card_states (
 user_id text not null references public.users(id), card_id text not null, content_version integer not null,
 schedule jsonb not null, revision integer not null default 0, lapse_count integer not null default 0, introduced_day text not null,
 scheduler_version text not null, updated_at timestamptz not null default now(),
 primary key(user_id,card_id)
);
alter table public.study_preferences enable row level security;
alter table public.study_units enable row level security;
alter table public.study_cards enable row level security;
alter table public.study_runs enable row level security;
alter table public.study_events enable row level security;
alter table public.study_card_states enable row level security;
revoke all on public.study_preferences,public.study_units,public.study_cards,public.study_runs,public.study_events,public.study_card_states from public,anon,authenticated;
grant select,insert,update on public.study_preferences,public.study_units,public.study_cards,public.study_runs,public.study_card_states to service_role;
grant select,insert on public.study_events to service_role;
grant usage,select on sequence public.study_events_id_seq to service_role;

create function public.start_study_run(p_row jsonb,p_states jsonb,p_day text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_runs%rowtype; s jsonb; item jsonb; used integer; unseen integer; overdue integer;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into r from public.study_runs where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then
   if r.request <> p_row->'request' then raise exception 'idempotency conflict'; end if;
   return to_jsonb(r);
 end if;
 -- Resume the same mode before creating a competing queue in another tab.
 select * into r from public.study_runs where user_id=p_row->>'user_id' and mode=p_row->>'mode' and projection->>'state'='active' order by created_at limit 1;
 if found then return to_jsonb(r); end if;
 for item in select value from jsonb_array_elements(p_row->'content'->'units') loop
   if not exists(select 1 from public.study_units where id=item->>'id' and version=(item->>'version')::integer and publication_state='published' and content_hash=item->>'contentHash') then raise exception 'content changed'; end if;
 end loop;
 -- Never expose a family reserved by a formal recovery episode.
 for item in select value from jsonb_array_elements(p_row->'content'->'items') loop
   if p_row->>'mode'='recall' and not exists(select 1 from public.study_cards c where c.id=item->>'id' and c.version=(item->>'version')::integer and c.content_hash=item->>'contentHash') then raise exception 'card content changed'; end if;
   if exists(select 1 from public.learning_episodes e, lateral jsonb_array_elements(coalesce(e.pathway->'checks','[]'::jsonb)) c where c->>'familyId'=item->>'familyId') then raise exception 'reserved assessment family'; end if;
 end loop;
 if p_row->>'mode'='recall' then
   select count(*) into used from public.study_card_states where user_id=p_row->>'user_id' and introduced_day=p_day;
   select count(*) into unseen from jsonb_array_elements(p_states) x where not exists(select 1 from public.study_card_states where user_id=p_row->>'user_id' and card_id=x->>'card_id' and content_version=(x->>'content_version')::integer);
   select count(*) into overdue from public.study_card_states where user_id=p_row->>'user_id' and (schedule->>'due')::timestamptz < now()-interval '1 day';
   if used+unseen>5 or (overdue>20 and unseen>0) then raise exception 'daily new card conflict'; end if;
 end if;
 insert into public.study_runs(id,user_id,request_key,request,mode,content,projection)
 values(p_row->>'id',p_row->>'user_id',p_row->>'request_key',p_row->'request',p_row->>'mode',p_row->'content',p_row->'projection') returning * into r;
 for s in select value from jsonb_array_elements(p_states) loop
   insert into public.study_card_states(user_id,card_id,content_version,schedule,introduced_day,scheduler_version)
   values(r.user_id,s->>'card_id',(s->>'content_version')::integer,s->'schedule',p_day,s->>'scheduler_version') on conflict(user_id,card_id) do update set content_version=excluded.content_version,schedule=excluded.schedule,revision=public.study_card_states.revision+1,lapse_count=0,introduced_day=excluded.introduced_day,scheduler_version=excluded.scheduler_version where public.study_card_states.content_version<>excluded.content_version;
 end loop;
 for item in select value from jsonb_array_elements(p_row->'content'->'items') loop
   insert into public.learning_family_exposure(user_id,family_id,reference) values(r.user_id,item->>'familyId',r.id) on conflict do nothing;
 end loop;
 return to_jsonb(r);
end $$;

create function public.advance_study_run(p_user text,p_id text,p_key text,p_event jsonb,p_revision integer,p_projection jsonb,p_result jsonb,p_schedule jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_runs%rowtype; old public.study_events%rowtype; item jsonb;
begin
 -- Consistent lock order with start, preference writes and other card reviews.
 perform 1 from public.users where id=p_user for update;
 select * into r from public.study_runs where id=p_id and user_id=p_user for update;
 if not found then raise exception 'run not found'; end if;
 select * into old from public.study_events where run_id=p_id and request_key=p_key;
 if found then
   if old.event<>p_event then raise exception 'idempotency conflict'; end if;
   return old.result;
 end if;
 if r.revision<>p_revision or (p_projection->>'revision')::integer<>p_revision+1 then raise exception 'revision conflict'; end if;
 for item in select value from jsonb_array_elements(r.content->'units') loop
   if not exists(select 1 from public.study_units where id=item->>'id' and version=(item->>'version')::integer and publication_state='published' and content_hash=item->>'contentHash') then raise exception 'content changed'; end if;
 end loop;
 if r.mode='recall' then
   for item in select value from jsonb_array_elements(r.content->'items') loop
     if not exists(select 1 from public.study_cards c where c.id=item->>'id' and c.version=(item->>'version')::integer and c.content_hash=item->>'contentHash') then raise exception 'card content changed'; end if;
   end loop;
 end if;
 if p_schedule is not null then
   update public.study_card_states set schedule=p_schedule->'schedule',revision=revision+1,lapse_count=lapse_count+case when p_schedule->'log'->>'rating'='1' then 1 else 0 end,updated_at=now(),scheduler_version=p_schedule->>'schedulerVersion'
   where user_id=p_user and card_id=p_schedule->>'cardId' and content_version=(p_schedule->>'contentVersion')::integer and revision=(p_schedule->>'expectedRevision')::integer;
   if not found then raise exception 'card revision conflict'; end if;
 end if;
 update public.study_runs set projection=p_projection,revision=p_revision+1,updated_at=now() where id=p_id;
 insert into public.study_events(run_id,user_id,request_key,event,result) values(p_id,p_user,p_key,p_event,p_result);
 return p_result;
end $$;

create function public.save_study_preferences(p_user text,p_revision integer,p_preferences jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_preferences%rowtype;
begin
 perform 1 from public.users where id=p_user for update;
 if not found then raise exception 'user not found'; end if;
 select * into r from public.study_preferences where user_id=p_user;
 if coalesce(r.revision,0)<>p_revision then raise exception 'revision conflict'; end if;
 insert into public.study_preferences(user_id,preferences,revision) values(p_user,p_preferences,p_revision+1)
 on conflict(user_id) do update set preferences=excluded.preferences,revision=excluded.revision,updated_at=now();
 return p_preferences;
end $$;
revoke all on function public.start_study_run(jsonb,jsonb,text),public.advance_study_run(text,text,text,jsonb,integer,jsonb,jsonb,jsonb),public.save_study_preferences(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.start_study_run(jsonb,jsonb,text),public.advance_study_run(text,text,text,jsonb,integer,jsonb,jsonb,jsonb),public.save_study_preferences(text,integer,jsonb) to service_role;

create function public.record_study_exposure(p_user text,p_unit text,p_version integer,p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare u public.study_units%rowtype; item jsonb; family text;
begin
 perform 1 from public.users where id=p_user for update;
 if not found then raise exception 'user not found'; end if;
 select * into u from public.study_units where id=p_unit and version=p_version and content_hash=p_hash and publication_state='published';
 if not found then raise exception 'content changed'; end if;
 family='study:'||p_unit||':teaching:v'||p_version;
 if exists(select 1 from public.learning_episodes e,lateral jsonb_array_elements(coalesce(e.pathway->'checks','[]'::jsonb)) c where c->>'familyId'=family) then raise exception 'reserved assessment family'; end if;
 insert into public.learning_family_exposure(user_id,family_id,reference) values(p_user,family,p_unit||'@'||p_version) on conflict do nothing;
 return true;
end $$;
revoke all on function public.record_study_exposure(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.record_study_exposure(text,text,integer,text) to service_role;

-- Corrections withdraw affected active and completed claims, while keeping immutable history.
create function study_private.invalidate_study_content() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.study_runs%rowtype; reason text; identifier text;
begin
 if tg_table_name='study_units' and new.content_hash=old.content_hash and new.publication_state=old.publication_state then return new; end if;
 if tg_table_name='study_cards' and new.content_hash=old.content_hash then return new; end if;
 reason='content_corrected'; identifier=old.id||'@'||old.version;
 for r in select * from public.study_runs where projection->>'state'<>'invalidated' and (
   (tg_table_name='study_units' and exists(select 1 from jsonb_array_elements(content->'units') i where i->>'id'=old.id and (i->>'version')::integer=old.version))
   or (tg_table_name='study_cards' and exists(select 1 from jsonb_array_elements(content->'items') i where i->>'id'=old.id and (i->>'version')::integer=old.version))
 ) for update loop
   update public.study_runs set projection=jsonb_set(jsonb_set(projection,'{state}','"invalidated"'::jsonb),'{revision}',to_jsonb(revision+1)),revision=revision+1,updated_at=now() where id=r.id;
   insert into public.study_events(run_id,user_id,request_key,event,result) values(r.id,r.user_id,'system:'||identifier||':'||(r.revision+1),jsonb_build_object('type',reason,'content',identifier),jsonb_build_object('state','invalidated','reason',reason));
 end loop;
 return new;
end $$;
revoke all on function study_private.invalidate_study_content() from public,anon,authenticated;
create trigger study_unit_correction after update of content_hash,publication_state on public.study_units for each row execute function study_private.invalidate_study_content();
create trigger study_card_correction after update of content_hash on public.study_cards for each row execute function study_private.invalidate_study_content();

create function public.study_progress_summary(p_user text) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('lessonsRead',(select count(distinct u.id) from public.study_units u where u.publication_state='published' and exists(
   select 1 from public.study_runs r,lateral jsonb_array_elements(r.content->'units') i where r.user_id=p_user and r.mode='learn' and r.projection->>'state'='complete' and i->>'id'=u.id and (i->>'version')::integer=u.version and i->>'contentHash'=u.content_hash
 )), 'completedUnits',(select coalesce(jsonb_agg(distinct i),'[]'::jsonb) from public.study_runs r,lateral jsonb_array_elements(r.content->'units') i where r.user_id=p_user and r.mode='learn' and r.projection->>'state'='complete'),
 'recallReviews',(select count(*) from public.study_events e where e.user_id=p_user and e.result->>'mode'='recall' and e.event->>'type' in ('answer','rate')))
$$;
revoke all on function public.study_progress_summary(text) from public,anon,authenticated;
grant execute on function public.study_progress_summary(text) to service_role;

-- END 20261004154217_connected_study_suite.sql

-- BEGIN 20261004172214_study_review_backlog.sql
-- Current published content only. Withdrawn and superseded card versions cannot permanently block new study.
create or replace function public.start_study_run(p_row jsonb,p_states jsonb,p_day text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_runs%rowtype; s jsonb; item jsonb; used integer; unseen integer; overdue integer;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into r from public.study_runs where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then
   if r.request <> p_row->'request' then raise exception 'idempotency conflict'; end if;
   return to_jsonb(r);
 end if;
 -- Resume the same mode before creating a competing queue in another tab.
 select * into r from public.study_runs where user_id=p_row->>'user_id' and mode=p_row->>'mode' and projection->>'state'='active' order by created_at limit 1;
 if found then return to_jsonb(r); end if;
 for item in select value from jsonb_array_elements(p_row->'content'->'units') loop
   if not exists(select 1 from public.study_units where id=item->>'id' and version=(item->>'version')::integer and publication_state='published' and content_hash=item->>'contentHash') then raise exception 'content changed'; end if;
 end loop;
 -- Never expose a family reserved by a formal recovery episode.
 for item in select value from jsonb_array_elements(p_row->'content'->'items') loop
   if p_row->>'mode'='recall' and not exists(select 1 from public.study_cards c where c.id=item->>'id' and c.version=(item->>'version')::integer and c.content_hash=item->>'contentHash') then raise exception 'card content changed'; end if;
   if exists(select 1 from public.learning_episodes e, lateral jsonb_array_elements(coalesce(e.pathway->'checks','[]'::jsonb)) c where c->>'familyId'=item->>'familyId') then raise exception 'reserved assessment family'; end if;
 end loop;
 if p_row->>'mode'='recall' then
   select count(*) into used from public.study_card_states where user_id=p_row->>'user_id' and introduced_day=p_day;
   select count(*) into unseen from jsonb_array_elements(p_states) x where not exists(select 1 from public.study_card_states where user_id=p_row->>'user_id' and card_id=x->>'card_id' and content_version=(x->>'content_version')::integer);
   select count(*) into overdue from public.study_card_states s join public.study_cards c on c.id=s.card_id and c.version=s.content_version join public.study_units u on u.id=c.unit_id and u.version=c.unit_version where s.user_id=p_row->>'user_id' and u.publication_state='published' and (s.schedule->>'due')::timestamptz < now()-interval '1 day' and not exists(select 1 from public.study_units newer where newer.id=u.id and newer.publication_state='published' and newer.version>u.version) and not exists(select 1 from public.study_cards newer where newer.id=c.id and newer.unit_id=c.unit_id and newer.unit_version=c.unit_version and newer.version>c.version);
   if used+unseen>5 or (overdue>20 and unseen>0) then raise exception 'daily new card conflict'; end if;
 end if;
 insert into public.study_runs(id,user_id,request_key,request,mode,content,projection)
 values(p_row->>'id',p_row->>'user_id',p_row->>'request_key',p_row->'request',p_row->>'mode',p_row->'content',p_row->'projection') returning * into r;
 for s in select value from jsonb_array_elements(p_states) loop
   insert into public.study_card_states(user_id,card_id,content_version,schedule,introduced_day,scheduler_version)
   values(r.user_id,s->>'card_id',(s->>'content_version')::integer,s->'schedule',p_day,s->>'scheduler_version') on conflict(user_id,card_id) do update set content_version=excluded.content_version,schedule=excluded.schedule,revision=public.study_card_states.revision+1,lapse_count=0,introduced_day=excluded.introduced_day,scheduler_version=excluded.scheduler_version where public.study_card_states.content_version<>excluded.content_version;
 end loop;
 for item in select value from jsonb_array_elements(p_row->'content'->'items') loop
   insert into public.learning_family_exposure(user_id,family_id,reference) values(r.user_id,item->>'familyId',r.id) on conflict do nothing;
 end loop;
 return to_jsonb(r);
end $$;

-- END 20261004172214_study_review_backlog.sql

-- BEGIN 20261005090000_runtime_ai_price_gpt6_luna.sql
-- Owner, 5 October 2026: Mistake Repair runs on GPT-6 Luna (low effort; high for the blind second opinion).
-- Official standard price, read 5 October 2026 from https://developers.openai.com/api/docs/pricing.
-- Config row only; no student data. Re-verify within 90 days or the budget guard refuses the model.
insert into public.runtime_ai_prices(provider,model,input_per_million,output_per_million,source_url,verified_at) values
 ('openai','gpt-6-luna',0.10,0.50,'https://developers.openai.com/api/docs/pricing',now())
on conflict(provider,model) do update set input_per_million=excluded.input_per_million,output_per_million=excluded.output_per_million,
 source_url=excluded.source_url,verified_at=excluded.verified_at;

-- END 20261005090000_runtime_ai_price_gpt6_luna.sql

-- BEGIN 20261005185759_question_factory.sql
-- Saved only: deploy explicitly after local/staging dry runs. No existing data is promoted.
alter table public.questions add column if not exists provenance jsonb;
alter table public.questions add column if not exists legacy_screening jsonb;
create table public.question_factory_control (
  id integer primary key check(id=1), paused boolean not null default true,
  phase text not null default 'pilot' check(phase in ('pilot','1000','10000')),
  pilot_target integer not null default 800 check(pilot_target between 4 and 800 and pilot_target%4=0),
  worker_id text, lease_until timestamptz, updated_at timestamptz not null default now(),
  snapshot jsonb not null default '{}', publication_enabled boolean not null default false
);
insert into public.question_factory_control(id) values(1);
create table public.question_factory_jobs (
  id text primary key, subject text not null check(subject in ('english','accountancy','business_studies','economics')),
  chapter text not null, anchor_id text, kind text not null check(kind in ('authentic_pyq','pyq_adapted','original_practice')),
  generation_brief jsonb,
  state text not null default 'queued', stage text not null default 'authoring', attempt integer not null default 0,
  candidate jsonb, result jsonb, provider_batch_id text, budget_reservation_id text, passage_group_id text,
  lease_owner text,lease_until timestamptz,batch_key text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index question_factory_jobs_state on public.question_factory_jobs(state,created_at);
create table public.question_factory_publications (
  question_id text primary key references public.questions(id), fingerprint text not null unique,
  family_id text not null, subject text not null, chapter text not null, kind text not null check(kind in ('authentic_pyq','pyq_adapted','original_practice')),
  published_at timestamptz not null default now(), job_id text not null unique references public.question_factory_jobs(id)
);
create table public.question_content_disputes (
  id text primary key, question_id text not null references public.questions(id), content_hash text not null,
  state text not null default 'open', reason text not null, receipt jsonb not null,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.question_factory_control enable row level security;
alter table public.question_factory_jobs enable row level security;
alter table public.question_factory_publications enable row level security;
alter table public.question_content_disputes enable row level security;
revoke all on public.question_factory_control,public.question_factory_jobs,public.question_factory_publications,public.question_content_disputes from public,anon,authenticated;
grant all on public.question_factory_control,public.question_factory_jobs,public.question_factory_publications,public.question_content_disputes to service_role;

-- One host/ledger binds permanently. A second machine cannot create a fresh $50 ledger.
create function public.claim_question_factory(p_worker text) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update public.question_factory_control set worker_id=p_worker,lease_until=now()+interval '5 minutes'
 where id=1 and (worker_id is null or worker_id=p_worker) and (lease_until is null or lease_until<now() or worker_id=p_worker);
 get diagnostics changed=row_count; return changed=1;
end $$;
revoke all on function public.claim_question_factory(text) from public,anon,authenticated;
grant execute on function public.claim_question_factory(text) to service_role;

create function public.record_question_dispute(p_id text,p_question text,p_hash text,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.questions where id=p_question for update;
 if not found then return false; end if;
 insert into public.question_content_disputes(id,question_id,content_hash,reason,receipt)
 values(p_id,p_question,p_hash,'ai_key_dispute',p_receipt) on conflict(id) do nothing;
 -- Conservatively withhold even if content changed while the model was solving.
 update public.questions set status='pending',verification_state='disputed',exploration_state='pending_review',updated_at=now()
 where id=p_question and status is distinct from 'rejected';
 return true;
end $$;
revoke all on function public.record_question_dispute(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_question_dispute(text,text,text,jsonb) to service_role;

create function public.publish_factory_question(p_row jsonb,p_fingerprint text,p_job text)
returns text language plpgsql security invoker set search_path='' as $$
declare control public.question_factory_control; existing text; cols text; p_kind text; total integer; derived integer;
begin
 select * into control from public.question_factory_control where id=1 for update;
 if control.paused or not control.publication_enabled or control.phase='pilot' then raise exception 'factory publication paused'; end if;
 select question_id into existing from public.question_factory_publications where job_id=p_job;
 if existing is not null then return existing; end if;
 if p_row->'evidence'->'record'->>'policy_version' is distinct from 'cuet-llm-v3' or p_row->'evidence'->>'signature' is null
    or p_row->'evidence'->'record'->>'state' is distinct from 'published' then raise exception 'factory evidence required'; end if;
 p_kind=p_row->'provenance'->>'kind';
 select count(*),count(*) filter(where kind in ('authentic_pyq','pyq_adapted')) into total,derived from public.question_factory_publications;
 if total>=10000 or (control.phase='1000' and total>=1000) then raise exception 'factory checkpoint reached'; end if;
 -- Original source-backed practice has no mandatory PYQ share. Authentic labels
 -- retain their stricter application evidence/authentication contract.
 if (select count(*) from public.question_factory_publications where subject=p_row->>'subject')>=2500 then raise exception 'subject target reached'; end if;
 if not exists(select 1 from public.question_factory_jobs where id=p_job and id=p_row->>'id' and subject=p_row->>'subject') then raise exception 'factory job mismatch'; end if;
 if p_row->>'status' is distinct from 'live' or p_row->>'verification_state' is distinct from 'verified' then raise exception 'invalid publication state'; end if;
 if p_row->>'passage_group_id' is not null and current_setting('mockmob.factory_group',true) is distinct from p_row->>'passage_group_id' then raise exception 'complete passage group required'; end if;
 select string_agg(format('%I',key),',') into cols from jsonb_object_keys(p_row) key;
 execute format('insert into public.questions (%s) select %s from jsonb_populate_record(null::public.questions,$1)',cols,cols) using p_row;
 insert into public.question_factory_publications(question_id,fingerprint,family_id,subject,chapter,kind,job_id)
 values(p_row->>'id',p_fingerprint,p_row->>'family_id',p_row->>'subject',p_row->>'chapter',p_kind,p_job);
 update public.question_factory_jobs set state='published',stage='complete',updated_at=now() where id=p_job;
 return p_row->>'id';
end $$;
revoke all on function public.publish_factory_question(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.publish_factory_question(jsonb,text,text) to service_role;

create function public.publish_factory_passage_group(p_group jsonb,p_rows jsonb,p_fingerprints jsonb,p_jobs jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare i integer; n integer; gid text; existing integer;
begin
 gid=p_group->>'id'; n=jsonb_array_length(p_rows);
 if gid is null or n<2 or n>10 or jsonb_array_length(p_fingerprints)<>n or jsonb_array_length(p_jobs)<>n then raise exception 'complete passage group required'; end if;
 perform 1 from public.question_factory_control where id=1 for update;
 select count(*) into existing from public.question_factory_publications where job_id in(select jsonb_array_elements_text(p_jobs));
 if existing=n then return gid; end if;
 if existing<>0 then raise exception 'partial passage group forbidden'; end if;
 if (select count(*) from public.question_factory_jobs where passage_group_id=gid)<>n then raise exception 'passage jobs incomplete'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_rows))<>n then raise exception 'duplicate passage children'; end if;
 insert into public.passage_groups(id,subject,chapter,passage_text,title,passage_type,status,discoverable,source)
 values(gid,p_group->>'subject',p_group->>'chapter',p_group->>'passage_text',p_group->>'title',p_group->>'passage_type','live',true,p_group->>'source');
 perform set_config('mockmob.factory_group',gid,true);
 for i in 0..n-1 loop
   if p_rows->i->>'passage_group_id' is distinct from gid or p_rows->i->>'passage_text' is distinct from p_group->>'passage_text'
     or p_rows->i->>'subject' is distinct from p_group->>'subject' or p_rows->i->>'chapter' is distinct from p_group->>'chapter'
     or not exists(select 1 from public.question_factory_jobs where id=p_jobs->>i and passage_group_id=gid) then raise exception 'passage child mismatch'; end if;
   perform public.publish_factory_question(p_rows->i,p_fingerprints->>i,p_jobs->>i);
 end loop;
 perform set_config('mockmob.factory_group','',true);
 return gid;
end $$;
revoke all on function public.publish_factory_passage_group(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_factory_passage_group(jsonb,jsonb,jsonb,jsonb) to service_role;

create function public.apply_factory_screening(p_question text,p_expected jsonb,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare q public.questions; resolved_passage text;
begin
 select * into q from public.questions where id=p_question for update;
 if not found then raise exception 'screen snapshot stale'; end if;
 resolved_passage=q.passage_text;
 if coalesce(resolved_passage,'')='' and q.passage_group_id is not null then
   select passage_text into resolved_passage from public.passage_groups where id=q.passage_group_id for share;
 end if;
 if q.body is distinct from p_expected->>'body' or q.options is distinct from nullif(p_expected->'options','null'::jsonb)
    or q.correct_answer is distinct from p_expected->>'correct_answer' or q.explanation is distinct from p_expected->>'explanation'
    or q.subject is distinct from p_expected->>'subject' or q.chapter is distinct from p_expected->>'chapter'
    or q.family_id is distinct from p_expected->>'family_id' or resolved_passage is distinct from p_expected->>'passage_text'
    or q.verification_state is distinct from p_expected->>'verification_state' or q.status is distinct from p_expected->>'status'
    or q.concept_id is distinct from p_expected->>'concept_id' then raise exception 'screen snapshot stale'; end if;
 if q.evidence is not null or q.provenance is not null then raise exception 'evidence managed screening forbidden'; end if;
 if p_receipt->>'question_id' is distinct from p_question or p_receipt->>'review_version' is distinct from 'subscription-screen-v1'
    or coalesce(p_receipt->>'verdict','') not in ('no_issue_found','suspect','incomplete') then raise exception 'invalid screening receipt'; end if;
 update public.questions set legacy_screening=p_receipt where id=p_question;
 return true;
end $$;
revoke all on function public.apply_factory_screening(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_factory_screening(text,jsonb,jsonb) to service_role;

-- END 20261005185759_question_factory.sql
