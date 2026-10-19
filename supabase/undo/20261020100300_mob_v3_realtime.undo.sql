-- Undo for supabase/migrations/20261020100300_mob_v3_realtime.sql. NOT a migration (outside supabase/migrations). Apply
-- it first of the four v3 undo files. It drops the policies, triggers, functions and the tickets table. If the Realtime
-- "Allow public access" switch was turned off for Mob rooms, turn it back on in the dashboard (owner step). Lost on
-- undo: room tickets (short-lived). Safe to run twice.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists mob_room_presence on realtime.messages;
    drop policy if exists mob_room_receive on realtime.messages;
  end if;
end $$;
drop trigger if exists mob_room_revoke_block on public.mob_blocks;
drop trigger if exists mob_room_revoke on public.mob_members;
drop function if exists public.mob_room_cancel(text, uuid);
drop function if exists public.mob_room_start(text, uuid, timestamptz, timestamptz);
drop function if exists public.mob_room_ticket(text, uuid, uuid, text, timestamptz);
drop function if exists public.mob_room_revoke_on_block();
drop function if exists public.mob_room_revoke_on_leave();
drop function if exists public.mob_room_ok(text);
drop table if exists public.mob_room_tickets;
