-- Undo for supabase/migrations/20261020100000_mob_v3_core.sql. NOT a migration: it lives outside supabase/migrations,
-- so the Supabase CLI never applies it by itself. Apply it after 20261020100100_mob_v3_games.undo.sql.
-- It drops exactly what the core added (the seat Folds, earned Folds, stickers, seen moments, step-outs, the name key
-- and the podium switch, and the v3 functions) and puts back mob_state (20261017100000) and mob_invite_lookup
-- (20261017190000) as they were. Codes: the 8-character check comes back NOT VALID, so 6-character invites made while
-- v3 was on stay readable rows (they simply stop being created); delete them first if a strict check is wanted.
-- Lost on undo: Folds earned, stickers, seen moments, step-outs and Mob names. Safe to run twice.

drop function if exists public.mob_create_named(text, text, text, smallint, integer, smallint);
drop function if exists public.mob_settings_set(text, uuid, boolean, smallint);
drop function if exists public.mob_profile_set(text, text, text);
drop function if exists public.mob_fold_grant(text, text, text, text, uuid);
drop function if exists public.mob_sticker(text, uuid, uuid, text, text);
drop function if exists public.mob_step_out(text, uuid, date, boolean);
drop function if exists public.mob_seen_mark(text, text[]);

drop table if exists public.mob_step_outs;
drop table if exists public.mob_seen;
drop table if exists public.mob_reactions;
drop table if exists public.fold_unlocks;
drop table if exists public.mob_profiles;

alter table public.mobs drop column if exists show_podium;
alter table public.mobs drop column if exists name_key;

alter table public.mob_invites drop constraint if exists mob_invites_code_len;
alter table public.mob_invites drop constraint if exists mob_invites_code_check;
alter table public.mob_invites add constraint mob_invites_code_check check (code ~ '^[0-9A-HJKMNP-TV-Z]{8}$') not valid;

-- mob_state as 20261017100000_mob.sql made it.
create or replace function public.mob_state(p_user_id text, p_week date, p_mob_id uuid default null, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare m uuid;
begin
  select mm.mob_id into m from public.mob_members mm
  where mm.user_id = p_user_id and (p_mob_id is null or mm.mob_id = p_mob_id)
  order by mm.joined_at, mm.mob_id limit 1;
  if m is null then return null; end if;
  return jsonb_build_object(
    'mob', (select jsonb_build_object('id', id, 'subject', subject, 'created_at', created_at) from public.mobs where id = m),
    'mobs', coalesce((select jsonb_agg(jsonb_build_object('id', a.mob_id, 'subject', b.subject, 'joined_at', a.joined_at) order by a.joined_at, a.mob_id)
      from public.mob_members a join public.mobs b on b.id = a.mob_id where a.user_id = p_user_id), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'display_name', display_name, 'colour', colour,
        'role', role, 'show_score', show_score, 'nudges_muted', nudges_muted, 'joined_at', joined_at) order by joined_at, user_id)
      from public.mob_members where mob_id = m), '[]'::jsonb),
    'paper', (select jsonb_build_object('question_ids', question_ids, 'subject', subject) from public.mob_papers where mob_id = m and week_start = p_week),
    'sittings', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'session_id', session_id, 'score', score,
        'max_score', max_score, 'picks', to_jsonb(picks), 'detail', detail, 'sat_at', sat_at) order by sat_at, user_id)
      from public.mob_sittings where mob_id = m and week_start = p_week), '[]'::jsonb),
    'invite', (select jsonb_build_object('code', code, 'expires_at', expires_at, 'max_uses', max_uses, 'uses', uses)
      from public.mob_invites where mob_id = m and revoked_at is null
      order by created_at desc limit 1),
    'nudges', coalesce((select jsonb_agg(jsonb_build_object('from_user', n.from_user, 'sent_at', n.sent_at,
        'seen', exists (select 1 from public.mob_nudge_seen s where s.mob_id = n.mob_id and s.week_start = n.week_start
                        and s.from_user = n.from_user and s.to_user = p_user_id)) order by n.sent_at)
      from public.mob_nudges n where n.mob_id = m and n.week_start = p_week), '[]'::jsonb),
    'extras', coalesce((select jsonb_agg(public.mob_extra_json(x.id) order by x.created_at)
      from public.mob_extras x where x.mob_id = m and (x.week_start = p_week or x.closes_at > p_now)), '[]'::jsonb),
    'past_weeks', (select count(*)::int from public.mob_papers where mob_id = m and week_start < p_week),
    'sample', (select jsonb_build_object('mob_id', mob_id, 'week_start', week_start) from public.mob_samples where user_id = p_user_id),
    'free_claim', (select jsonb_build_object('mob_id', mob_id) from public.mob_free_claims where user_id = p_user_id and week_start = p_week)
  );
end $$;

-- mob_invite_lookup as 20261017190000_mob_fix_1017.sql made it.
create or replace function public.mob_invite_lookup(p_code text, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; s text;
begin
  select * into inv from public.mob_invites where code = p_code;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < p_now then return jsonb_build_object('status', 'expired'); end if;
  if n >= 5 then return jsonb_build_object('status', 'full'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('status', 'expired'); end if;
  select subject into s from public.mobs where id = inv.mob_id;
  return jsonb_build_object('status', 'valid', 'subject', s, 'size', n, 'seats_left', 5 - n, 'expires_at', inv.expires_at,
    'inviter', (select display_name from public.mob_members where mob_id = inv.mob_id and user_id = inv.created_by));
end $$;

revoke all on function public.mob_state(text, date, uuid, timestamptz), public.mob_invite_lookup(text, timestamptz) from public, anon, authenticated;
grant execute on function public.mob_state(text, date, uuid, timestamptz), public.mob_invite_lookup(text, timestamptz) to service_role;
