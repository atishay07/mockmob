-- Self-hosted app crash reports (src/app/api/app/errors/route.js, src/lib/server/appErrors.js).
-- One row per (India day, message_hash): a repeat of the same error on the same day adds to `count` and moves
-- `last_at`; it never adds a row. `at` is the first time the error was seen that day.
-- Privacy: no user id, no session id, no device id, no IP and no user agent are stored. `message` (at most 500
-- characters) and `stack` (at most 4 KB) are scrubbed of emails, phone numbers, tokens, ids and IP addresses
-- by the server before they get here. The device is kept only as coarse facts: platform, OS version and a
-- phone/tablet class. The day is the India calendar day and is taken by the database, never by the caller.
-- Service role only (row level security is on and no policy exists). Rows older than 30 days are deleted by
-- the first write of each day. At most 2000 distinct errors are kept per day: a flood of random messages
-- cannot grow the table, repeats of errors already stored still count.
-- Not applied to any remote database by this change. Undo: supabase/undo/20261016100000_app_errors.undo.sql
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  build text check (build is null or char_length(build) <= 16),
  platform text not null check (platform in ('android', 'ios', 'web', 'other')),
  os_version text check (os_version is null or char_length(os_version) <= 32),
  device_class text not null default 'other' check (device_class in ('phone', 'tablet', 'other')),
  kind text not null check (kind in ('flutter', 'platform', 'zone', 'other')),
  message_hash text not null check (char_length(message_hash) = 32),
  message text not null check (char_length(message) <= 500),
  stack text check (stack is null or octet_length(stack) <= 4096),
  screen text check (screen is null or char_length(screen) <= 64),
  count int not null default 1 check (count >= 1),
  unique (day, message_hash)
);

create index if not exists app_errors_day_idx on public.app_errors (day);

-- Records a batch. p_rows is a jsonb array of already scrubbed rows, at most one per message_hash (the route
-- merges duplicates first). Returns how many rows were stored or counted; rows over the daily cap are dropped.
create or replace function public.app_error_record(p_rows jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare
  r jsonb;
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_today int;
  v_n int := 0;
  v_count int;
  v_hash text;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  select count(*)::int into v_today from public.app_errors where day = v_day;
  if v_today = 0 then
    delete from public.app_errors where day < v_day - 30;
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_hash := r->>'message_hash';
    v_count := greatest(1, least(coalesce((r->>'count')::int, 1), 1000));
    update public.app_errors
      set count = least(count + v_count, 2000000000),
          last_at = now(),
          app_version = coalesce(r->>'app_version', app_version),
          build = coalesce(r->>'build', build)
      where day = v_day and message_hash = v_hash;
    if found then
      v_n := v_n + 1;
      continue;
    end if;
    if v_today >= 2000 then continue; end if;
    insert into public.app_errors (day, app_version, build, platform, os_version, device_class, kind, message_hash, message, stack, screen, count)
    values (v_day, r->>'app_version', r->>'build', r->>'platform', r->>'os_version', coalesce(r->>'device_class', 'other'),
            r->>'kind', v_hash, r->>'message', r->>'stack', r->>'screen', v_count)
    on conflict (day, message_hash) do update
      set count = least(public.app_errors.count + excluded.count, 2000000000), last_at = now();
    v_today := v_today + 1;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- The admin view: the top errors of the last p_days India days (today included), grouped by message_hash, with
-- the total number of reports and the number of distinct errors in the same window so every share has its
-- denominator. The latest report supplies the text, the screen and the version.
create or replace function public.app_errors_top(p_days int default 7, p_limit int default 50)
returns table (
  message_hash text, kind text, message text, stack text, screen text, platform text, app_version text,
  total bigint, first_seen timestamptz, last_seen timestamptz, window_total bigint, distinct_errors bigint
) language sql stable security invoker set search_path = public as $$
  select
    e.message_hash,
    (array_agg(e.kind order by e.last_at desc))[1],
    (array_agg(e.message order by e.last_at desc))[1],
    (array_agg(e.stack order by e.last_at desc))[1],
    (array_agg(e.screen order by e.last_at desc))[1],
    (array_agg(e.platform order by e.last_at desc))[1],
    (array_agg(e.app_version order by e.last_at desc))[1],
    sum(e.count)::bigint as total,
    min(e.at) as first_seen,
    max(e.last_at) as last_seen,
    sum(sum(e.count)) over ()::bigint as window_total,
    count(*) over ()::bigint as distinct_errors
  from public.app_errors e
  where e.day >= (now() at time zone 'Asia/Kolkata')::date - (greatest(1, least(p_days, 30)) - 1)
  group by e.message_hash
  order by total desc, last_seen desc
  limit greatest(1, least(p_limit, 200));
$$;

alter table public.app_errors enable row level security;
revoke all on public.app_errors from public, anon, authenticated;
grant all on public.app_errors to service_role;
revoke all on function public.app_error_record(jsonb) from public, anon, authenticated;
revoke all on function public.app_errors_top(int, int) from public, anon, authenticated;
grant execute on function public.app_error_record(jsonb) to service_role;
grant execute on function public.app_errors_top(int, int) to service_role;
