-- Kept in supabase/optional (not supabase/migrations) on purpose: the CLI must never apply this by itself.
-- OPTIONAL, DESTRUCTIVE: apply only if the owner wants the space. NOT needed for any other change.
-- question_factory_jobs is 46 MB for 903 rows (all TOAST). All 903 jobs are finished: 662 `published`
-- (generation_brief about 21 MB, candidate about 9 MB) and 238 `quarantined` (about 3.7 MB in all).
-- WHAT THIS DELETES: for the 662 `published` jobs only, it sets generation_brief and candidate to NULL.
-- The published question text and answer already live in public.questions (question_factory_publications links
-- job to question), so what is lost is the generation brief (anchor, source and prompt facts) and the draft
-- candidate JSON as authored, not anything a student sees. NOT touched: `result` (small), the 238 quarantined
-- jobs (rejection audit trail), every row, state, stage, subject, chapter and id.
-- What it affects in the code: the admin factory panel (src/lib/server/questionFactory.js) lists candidate and
-- result of the 50 newest jobs and will show an empty candidate for published ones. Enqueueing (planFactoryJobs)
-- reads only state, subject and chapter. The pipeline reads brief and candidate only for unfinished jobs.
-- Back up first if the briefs may ever be wanted again:
--   create table public.question_factory_jobs_payload_backup_20261016 as
--     select id, generation_brief, candidate from public.question_factory_jobs where state = 'published';
-- It cannot be undone from the database after the backup is dropped (see the undo file).
-- Disk: nulling frees the space inside the table for reuse but does not shrink the database file. To shrink
-- it afterwards run, in a quiet minute (it takes an exclusive lock on this table only):
--   vacuum full public.question_factory_jobs;
-- Not applied to any database by this change.
update public.question_factory_jobs
   set generation_brief = null, candidate = null
 where state = 'published' and (generation_brief is not null or candidate is not null);
