-- MockMob: the daily study goal in minutes, kept on the account (20 Oct 2026). The app lets a student keep any whole
-- number of minutes from 5 to 999 (docs/design-decisions/pass-1019pm/SMART-LAYER-1019PM.md, daily goal "More"), but kept it
-- on the phone only, so the website could not show the same goal and a second device started from the default. The study
-- preferences only ever held 10, 20 or 30, so a longer goal was rounded down to 30 on the way.
--
-- One nullable column on the existing study_goals row (the account's weekly goal), read and written by GET and PUT
-- /api/me/goal as `dailyMinutes` (src/lib/server/appPrefs.js):
--   daily_minutes  smallint  the daily goal in minutes, 5 to 999; null = the student has not set one
-- The API validates the value (a whole number from 5 to 999); the check below is the outer guard only.
-- Additive and idempotent. No existing row changes (every row keeps null). Service-role only (the table already has RLS and
-- no policies; its grants are unchanged). Code ships first and feature-detects the column (a missing column reads as "not on
-- the account yet": the days still save, a minutes-only save answers 409 minutes_not_on_account, and the plan keeps its usual
-- length), so applying this is safe at any time after the code.
-- Undo: supabase/undo/20261020110000_study_goal_daily_minutes.undo.sql
--
-- Dry run, 20 Oct 2026 ~4:35 am IST, STAGING only (onwkqxmjqjrhfbjjdydu, Postgres 17), one transaction that ended in an exception so it ROLLED BACK:
--   migration run twice without error; 12 rows before and after, all 12 null in the new column; one check constraint;
--   the check refused 4, 1000 and 0 and accepted 5 and 999; the undo run twice removed the column and the check, the other
--   8 columns and 12 rows unchanged. Afterwards staging was read again: no column, no constraint, 12 rows. Staging is NOT migrated.
--   Production is NOT migrated: it needs its own save and the order in docs (tmp/walk-1020/goal-minutes/REPORT.md).

alter table public.study_goals add column if not exists daily_minutes smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_goals_daily_minutes_range' and conrelid = 'public.study_goals'::regclass) then
    alter table public.study_goals add constraint study_goals_daily_minutes_range check (daily_minutes is null or daily_minutes between 5 and 999);
  end if;
end $$;
