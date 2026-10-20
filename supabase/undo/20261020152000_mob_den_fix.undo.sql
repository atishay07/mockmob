-- Undo for supabase/migrations/20261020152000_mob_den_fix.sql. NOT a migration (outside supabase/migrations). Safe to run twice.
-- Nothing is lost on undo: the function only reads, and the index only speeds a read. The den simply stops sending `fix`
-- (its Now card then skips the Fix it together and check steps), and nothing else changes.
drop function if exists public.mob_den_fix(uuid, text, timestamptz);
drop index if exists public.mob_traps_mob_idx;
