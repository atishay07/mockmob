-- Syllabus v2 follow-up, applied on production 31 Oct 2026 (migration name syllabus_v2_fix_live_rows).
-- 8 live chapters got no row from 20261031130000_syllabus_v2: their generated id was already held by the old-named row
-- (for example business_studies__financial_management = "Business Finance", retired as merged), and that migration's
-- insert skips on an id conflict. This adds the live rows under new ids and gives them their unit, key, title and section.
-- Undo: supabase/undo/20261031130000_syllabus_v2.undo.sql deletes chapter rows not in its snapshot, these included.
insert into public.chapters (id, subject_id, name, sort_order) values
  ('business_studies__financial_management_v2', 'business_studies', 'Financial Management', 900),
  ('business_studies__marketing_management_v2', 'business_studies', 'Marketing Management', 1100),
  ('chemistry__d_and_f_block_elements_v2', 'chemistry', 'd- and f-Block Elements', 400),
  ('economics__income_determination_v2', 'economics', 'Income Determination', 700),
  ('economics__national_income_and_related_aggregates_v2', 'economics', 'National Income & Related Aggregates', 500),
  ('economics__indian_economy_on_the_eve_of_independence_v2', 'economics', 'Indian Economy on the Eve of Independence', 1000),
  ('mathematics__vector_algebra_v2', 'mathematics', 'Vector Algebra', 400),
  ('physics__semiconductor_electronics_v2', 'physics', 'Semiconductor Electronics', 900)
on conflict (id) do nothing;
update public.chapters c set
  unit_id = u.id,
  sort_order = l.sort_order,
  chapter_key = l.chapter_key,
  title = l.title,
  section = l.section,
  retired_reason = null
from (values
  ('business_studies', 'Financial Management', 'Business Finance', 900, 'business_studies.financial-management', 'Financial Management', null::text),
  ('business_studies', 'Marketing Management', 'Marketing', 1100, 'business_studies.marketing-management', 'Marketing', null::text),
  ('chemistry', 'd- and f-Block Elements', 'd and f Block Elements', 400, 'chemistry.d-and-f-block-elements', 'The d- and f-Block Elements', null::text),
  ('economics', 'Income Determination', 'Determination of Income and Employment', 700, 'economics.income-determination', 'Determination of Income and Employment', null::text),
  ('economics', 'National Income & Related Aggregates', 'Introduction and National Income Accounting', 500, 'economics.national-income-and-related-aggregates', 'Introduction and National Income Accounting', null::text),
  ('economics', 'Indian Economy on the Eve of Independence', 'Development Policies and Experience (1947-90)', 1000, 'economics.indian-economy-on-the-eve-of-independence', 'Indian Economy on the Eve of Independence', null::text),
  ('mathematics', 'Vector Algebra', 'Vectors and Three-Dimensional Geometry', 400, 'mathematics.vector-algebra', 'Vector Algebra', 'B1'),
  ('physics', 'Semiconductor Electronics', 'Electronic Devices', 900, 'physics.semiconductor-electronics', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', null::text)
) l(subject_id, name, unit_name, sort_order, chapter_key, title, section)
join public.units u on u.subject_id = l.subject_id and u.name = l.unit_name
where c.subject_id = l.subject_id and c.name = l.name;
