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
