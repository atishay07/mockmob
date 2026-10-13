-- NTA mode pool index (data/nta_pool.js loadNtaPoolFromIndex, scripts/nta-index-build.mjs).
-- One row per question whose signed factory evidence passed the NTA score checks offline: signed by
-- the backend, names the question, matches its content hash, not a mock run, both judges scored it and
-- both blind solvers reached the stored key. The runtime reads these slim rows and the questions
-- without their evidence column (about 38 KB a row, 95% of the old payload), re-checks each row's
-- HMAC signature (CUET_EVIDENCE_SIGNING_KEY) and that the question's content hash is unchanged.
-- Rows are derived data: the build job rewrites a subject's rows; the score bar is applied at runtime,
-- so moving NTA_MIN_SCORE needs no rebuild. objective_tag is the question's learning-objective tag
-- (one per paper, see data/nta_objectives.json); it only keeps questions apart and is not signed.
-- Service-role access only. Not applied to any remote database by this change.
create table if not exists public.nta_question_index (
  question_id text primary key references public.questions (id) on delete cascade,
  subject text not null,
  score numeric(4, 2) not null check (score >= 0 and score <= 10),
  luna numeric(4, 2),
  gemini numeric(4, 2),
  content_hash text not null,
  family_id text,
  objective_tag text,
  index_version text not null,
  verified_at timestamptz not null,
  signature text not null
);
create index if not exists nta_question_index_subject_idx on public.nta_question_index (subject);
alter table public.nta_question_index enable row level security;
revoke all on public.nta_question_index from public, anon, authenticated;
grant all on public.nta_question_index to service_role;
