-- =====================================================================
-- MockMob — initial schema
-- Mirrors the shape of data/db.json so the seed ports cleanly.
-- IDs are TEXT (not uuid) to preserve the existing id format
-- (e.g. "usr_1776743643988_g0m7ea9", "q_...", "att_...", "a1", "e1", ...).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- USERS ----------
create table if not exists public.users (
  id         text        primary key,
  name       text        not null,
  email      text        unique,
  image      text,
  subjects   jsonb       not null default '[]'::jsonb,
  role       text        not null default 'student',
  created_at timestamptz not null default now()
);

create index if not exists users_name_lower_idx on public.users (lower(name));

-- ---------- QUESTIONS ----------
-- status: 'pending' | 'live' | 'rejected'
create table if not exists public.questions (
  id             text        primary key,
  subject        text        not null,
  chapter        text        not null,
  question       text        not null,
  options        jsonb       not null,
  correct_index  int         not null,
  explanation    text,
  difficulty     text,
  source         text,
  status         text        not null default 'pending',
  uploaded_by    text,
  created_at     timestamptz not null default now(),
  constraint questions_status_chk
    check (status in ('pending','live','rejected'))
);

create index if not exists questions_subject_status_idx on public.questions (subject, status);
create index if not exists questions_status_idx         on public.questions (status);

-- ---------- ATTEMPTS ----------
create table if not exists public.attempts (
  id                 text        primary key,
  user_id            text        not null references public.users(id) on delete cascade,
  subject            text        not null,
  score              int         not null,
  correct            int         not null,
  wrong              int         not null,
  unattempted        int         not null,
  total              int         not null,
  details            jsonb       not null default '[]'::jsonb,
  questions_snapshot jsonb       not null default '[]'::jsonb,
  completed_at       timestamptz not null default now()
);

create index if not exists attempts_user_completed_idx on public.attempts (user_id, completed_at desc);
create index if not exists attempts_subject_idx        on public.attempts (subject);
