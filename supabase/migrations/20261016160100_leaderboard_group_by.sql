-- Leaderboard in one query. getLeaderboard (data/db.js) used to page every attempt row (1,000 per request)
-- and group them in Node, then fetch the users in chunks of 100. One row per user with at least one attempt:
-- attempt count, summed score, and the user's name and image (left join, so a deleted user still appears,
-- with null name and image, exactly as before). Highest total score first.
-- Service role only. The app falls back to the old paging code while this function does not exist.
-- Not applied to production by this change. Undo: supabase/undo/20261016160100_leaderboard_group_by.undo.sql
create or replace function public.mm_leaderboard()
returns table (user_id text, name text, image text, tests integer, total_score bigint)
language sql stable security invoker set search_path = public as $$
  select a.user_id, u.name, u.image, count(*)::integer, coalesce(sum(a.score), 0)::bigint
    from public.attempts a
    left join public.users u on u.id = a.user_id
   where a.user_id is not null
   group by a.user_id, u.name, u.image
   order by 5 desc, a.user_id;
$$;
revoke all on function public.mm_leaderboard() from public, anon, authenticated;
grant execute on function public.mm_leaderboard() to service_role;
