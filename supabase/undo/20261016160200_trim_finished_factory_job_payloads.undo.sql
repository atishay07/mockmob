-- Undo for supabase/optional/20261016160200_trim_finished_factory_job_payloads.sql. NOT a migration.
-- Only works if the backup table named in that migration was created BEFORE it ran:
update public.question_factory_jobs j
   set generation_brief = b.generation_brief, candidate = b.candidate
  from public.question_factory_jobs_payload_backup_20261016 b
 where b.id = j.id and j.state = 'published';
-- Afterwards: drop table public.question_factory_jobs_payload_backup_20261016;
