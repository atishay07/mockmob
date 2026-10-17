-- MockMob: the Road to May's exam date and full-mock target, kept on the account (TODAY-1017 P0, owner sign-off
-- Q4, 17 Oct 2026). Until now both lived on the phone only (flutter_app road_plan.dart, "Saved on this phone"),
-- so the website could not draw the same road and a second device started from the defaults.
--
-- Two nullable columns on the existing study_goals row (the account's study-day goal and weekday plan), so the
-- road and the weekly goal are read and written together by the same server code (src/lib/server/studyRoad.js):
--   exam_date    date      the day the student aims for; null = the expected window's first day (1 May)
--   mock_target  smallint  full mocks the student wants before that day; null = no target set (a suggestion shows)
-- The API bounds the date (after today, no later than 30 June after the window) and the target (1 to 60); the
-- checks below are the outer guard only.
-- Additive and idempotent. No existing row changes. Service-role only (the table already has RLS and no policies).
-- Code ships first and feature-detects these columns (a missing column reads as "not on the account yet"),
-- so applying this is safe at any time after the code. Undo: supabase/undo/20261017150000_study_road_fields.undo.sql
--
-- Dry run 1, 17 Oct 2026 ~2:40 am, STAGING only (onwkqxmjqjrhfbjjdydu, Postgres 17), one transaction then ROLLBACK:
--   run twice: 2 columns (exam_date date, mock_target smallint) and 2 checks, no error on the second run;
--   the existing study_goals row kept null in both columns; the undo removed both columns.
-- Dry run 2, 17 Oct 2026 ~5:15 am, STAGING only: applied (2 columns, 2 checks, the 1 existing row null in both);
--   the checks rejected mock_target 0 and exam_date 2040-01-01; the undo file removed both columns and both checks
--   (row count unchanged); applied again through the migration tool, recorded on staging as version
--   20261016234321 "study_road_fields" (UTC clock), RLS on, no policies (service role only, as before).
--   Staging is LEFT MIGRATED. Production is NOT migrated: it needs its own save, dry run and the owner's grant;
--   the code feature-detects the columns, so it works before and after.

alter table public.study_goals add column if not exists exam_date date;
alter table public.study_goals add column if not exists mock_target smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_goals_exam_date_range' and conrelid = 'public.study_goals'::regclass) then
    alter table public.study_goals add constraint study_goals_exam_date_range check (exam_date is null or exam_date between date '2026-01-01' and date '2035-12-31');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_goals_mock_target_range' and conrelid = 'public.study_goals'::regclass) then
    alter table public.study_goals add constraint study_goals_mock_target_range check (mock_target is null or mock_target between 1 and 60);
  end if;
end $$;
