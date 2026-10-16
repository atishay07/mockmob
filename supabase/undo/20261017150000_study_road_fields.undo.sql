-- Undo for supabase/migrations/20261017150000_study_road_fields.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Drops the two road columns and their checks. Dropping them discards the exam dates and mock targets students
-- saved on the account; the code keeps working (it feature-detects the columns and falls back to the expected
-- window and a suggested target), and the app keeps its own copy on the phone. Nothing else on study_goals changes.
alter table public.study_goals drop constraint if exists study_goals_exam_date_range;
alter table public.study_goals drop constraint if exists study_goals_mock_target_range;
alter table public.study_goals drop column if exists exam_date;
alter table public.study_goals drop column if exists mock_target;
