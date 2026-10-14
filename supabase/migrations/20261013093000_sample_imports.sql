-- MockMob app: guest sample import (five landing questions answered before sign-in).
-- Additive and idempotent. Service-role only: RLS enabled with no anon/authenticated policies.
-- Deliberately NOT linked to attempts, sessions, credits, rhythm or mocks: it is a plain record.
-- users.id is text in this schema.

create table if not exists public.sample_imports (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(id) on delete cascade,
  import_key text not null unique check (import_key ~ '^[A-Za-z0-9_-]{12,100}$'),
  sample_version text not null check (char_length(sample_version) between 1 and 40),
  subject text not null check (char_length(subject) between 1 and 60),
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  correct smallint not null check (correct >= 0),
  total smallint not null check (total > 0 and correct <= total),
  created_at timestamptz not null default now()
);
-- One import per user per sample version, whatever import key the phone generated.
create unique index if not exists sample_imports_user_version_idx on public.sample_imports (user_id, sample_version);

alter table public.sample_imports enable row level security;
revoke all on public.sample_imports from public, anon, authenticated;
grant all on public.sample_imports to service_role;
grant usage, select on sequence public.sample_imports_id_seq to service_role;

-- Atomic, idempotent save. Returns the stored row and whether this call created it.
-- Raises 'import_key_taken' when the key already belongs to another user.
create or replace function public.save_sample_import(
  p_user_id text, p_import_key text, p_sample_version text, p_subject text,
  p_answers jsonb, p_correct int, p_total int
) returns table (created boolean, correct smallint, total smallint, created_at timestamptz)
language plpgsql
as $$
declare
  r public.sample_imports%rowtype;
begin
  select * into r from public.sample_imports s where s.import_key = p_import_key;
  if found then
    if r.user_id <> p_user_id then raise exception 'import_key_taken'; end if;
    return query select false, r.correct, r.total, r.created_at;
    return;
  end if;
  insert into public.sample_imports (user_id, import_key, sample_version, subject, answers, correct, total)
  values (p_user_id, p_import_key, p_sample_version, p_subject, p_answers, p_correct, p_total)
  on conflict do nothing
  returning * into r;
  if found then
    return query select true, r.correct, r.total, r.created_at;
    return;
  end if;
  -- Lost a race, or the user already has this sample version under another key: return that row.
  select * into r from public.sample_imports s where s.user_id = p_user_id and s.sample_version = p_sample_version;
  if not found then
    select * into r from public.sample_imports s where s.import_key = p_import_key;
    if r.user_id <> p_user_id then raise exception 'import_key_taken'; end if;
  end if;
  return query select false, r.correct, r.total, r.created_at;
end;
$$;
revoke all on function public.save_sample_import(text, text, text, text, jsonb, int, int) from public, anon, authenticated;
grant execute on function public.save_sample_import(text, text, text, text, jsonb, int, int) to service_role;
