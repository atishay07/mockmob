-- MockMob: which weekdays the student plans to study, kept on the account (owner ledger L06 and L39).
-- Until now only the number of days lived on the server (study_goals.days_per_week); the chosen days
-- stayed on the phone, so a second device or the website never saw them.
-- One nullable smallint bit mask on the existing row: bit 0 = Monday ... bit 6 = Sunday (Mon, Tue, Thu, Sat = 43).
-- Null means no days chosen. The API only believes the mask while its number of set bits equals
-- days_per_week (src/lib/studyWeekdays.mjs), so a goal changed by an older writer cannot show a wrong plan.
-- Additive and idempotent. No existing row changes. Service-role only (the table already has RLS and no policies).

alter table public.study_goals add column if not exists weekday_mask smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_goals_weekday_mask_range' and conrelid = 'public.study_goals'::regclass) then
    alter table public.study_goals add constraint study_goals_weekday_mask_range check (weekday_mask is null or weekday_mask between 1 and 127);
  end if;
end $$;
