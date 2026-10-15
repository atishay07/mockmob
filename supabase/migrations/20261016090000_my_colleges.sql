-- My colleges: one ordered list per student, up to 8 entries, saved on the server so the app's Today
-- ladder (first 3), the Compass college rows and the Account page all read and write the same list.
-- Until now Today's colleges lived in the student's phone-only onboarding answers and Compass Pro's
-- shortlist in browser storage, and the two never met (APP-UX-AUDIT-2026-10-15 findings 5 and 6).
-- Additive and idempotent. Service role only: RLS is enabled with no anon or authenticated policy.
-- users.id is text in this schema, so user_id is text. programme_id is the DU catalog id
-- (public/du/2026/index.json), college is the name as the offerings file spells it.
-- Not applied to any remote database by this change. Undo: supabase/undo/20261016090000_my_colleges.undo.sql
create table if not exists public.my_colleges (
  user_id text not null references public.users(id) on delete cascade,
  programme_id text not null check (programme_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  programme text not null default '' check (char_length(programme) <= 160),
  college text not null check (char_length(college) between 2 and 160),
  position smallint not null check (position between 1 and 8),
  added_at timestamptz not null default now(),
  primary key (user_id, programme_id, college),
  -- Deferred, so a reorder or a compaction can pass through duplicate positions inside one statement.
  constraint my_colleges_position_unique unique (user_id, position) deferrable initially deferred
);

-- Replace the whole ordered list in one transaction. p_items is a jsonb array of
-- {programmeId, programme, college} already validated by the route (at most 8, no repeats); the
-- position is the array order, from 1. Returns the number of rows kept.
create or replace function public.my_colleges_replace(p_user_id text, p_items jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('my_colleges:' || p_user_id));
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 8 then
    raise exception 'my_colleges: at most 8 entries' using errcode = '22023';
  end if;
  delete from public.my_colleges where user_id = p_user_id;
  insert into public.my_colleges (user_id, programme_id, programme, college, position)
  select p_user_id, e.item->>'programmeId', coalesce(e.item->>'programme', ''), e.item->>'college', e.ord::smallint
  from jsonb_array_elements(p_items) with ordinality as e(item, ord);
  get diagnostics n = row_count;
  return n;
end $$;

-- Append one entry. 'added', 'exists' (already on the list, nothing changes) or 'full' (8 already).
create or replace function public.my_colleges_add(p_user_id text, p_programme_id text, p_programme text, p_college text)
returns text language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('my_colleges:' || p_user_id));
  if exists (select 1 from public.my_colleges where user_id = p_user_id and programme_id = p_programme_id and college = p_college) then
    return 'exists';
  end if;
  select count(*) into n from public.my_colleges where user_id = p_user_id;
  if n >= 8 then return 'full'; end if;
  insert into public.my_colleges (user_id, programme_id, programme, college, position)
  values (p_user_id, p_programme_id, coalesce(p_programme, ''), p_college, n + 1);
  return 'added';
end $$;

-- Remove one entry and close the gap so positions stay 1..n. Removing an entry that is not there
-- changes nothing. Returns the number of rows removed (0 or 1).
create or replace function public.my_colleges_remove(p_user_id text, p_programme_id text, p_college text)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('my_colleges:' || p_user_id));
  delete from public.my_colleges where user_id = p_user_id and programme_id = p_programme_id and college = p_college;
  get diagnostics n = row_count;
  if n > 0 then
    update public.my_colleges m set position = r.rn
    from (select programme_id, college, row_number() over (order by position)::smallint as rn
          from public.my_colleges where user_id = p_user_id) r
    where m.user_id = p_user_id and m.programme_id = r.programme_id and m.college = r.college and m.position <> r.rn;
  end if;
  return n;
end $$;

alter table public.my_colleges enable row level security;
revoke all on public.my_colleges from public, anon, authenticated;
grant all on public.my_colleges to service_role;
revoke all on function public.my_colleges_replace(text, jsonb), public.my_colleges_add(text, text, text, text), public.my_colleges_remove(text, text, text) from public, anon, authenticated;
grant execute on function public.my_colleges_replace(text, jsonb), public.my_colleges_add(text, text, text, text), public.my_colleges_remove(text, text, text) to service_role;
