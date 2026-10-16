-- Practice start verdicts (data/practice_verdicts.js, scripts/practice-verdict-build.mjs).
-- A practice start used to read the evidence record (about 35 KB each) of every evidence-managed
-- question it had to judge: the newest window, every rejected candidate and every pick. This table
-- keeps one signed verdict per evidence-managed question (eligible or not), so the start decides from
-- the verdict and reads an evidence record only for the questions it actually picks.
-- A verdict is trusted only while ALL of these hold at read time (otherwise the start reads the
-- evidence exactly as before, so a missing, stale or forged row can never change which questions a
-- student gets):
--   - the HMAC signature (CUET_EVIDENCE_SIGNING_KEY) over the verdict's fields is valid;
--   - input_hash matches the question as it is now: its content columns, the evidence signature and
--     the provenance record (counters such as votes and exposure are not part of it);
--   - basis matches the running code: the verdict logic version plus the source registry and
--     calibration manifest shipped with the deployment;
--   - an eligible verdict has not reached expires_at (the evidence record's own expiry).
-- Rows are derived data: the build job rewrites them from the questions' own evidence. Holds, answer
-- integrity and the score floor are still applied at read time to the live row.
-- Service-role access only. Not applied to any remote database by this change.
create table if not exists public.practice_verdict_index (
  question_id text primary key references public.questions (id) on delete cascade,
  subject text not null,
  eligible boolean not null,
  expires_at timestamptz,
  input_hash text not null,
  basis text not null,
  verified_at timestamptz not null,
  signature text not null
);
create index if not exists practice_verdict_index_subject_basis_idx on public.practice_verdict_index (subject, basis);
alter table public.practice_verdict_index enable row level security;
revoke all on public.practice_verdict_index from public, anon, authenticated;
grant all on public.practice_verdict_index to service_role;
