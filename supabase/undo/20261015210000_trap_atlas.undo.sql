-- Undo for supabase/migrations/20261015210000_trap_atlas.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself.
-- The atlas holds derived data only (the trap type named by each committed repair, on one option of one question): the
-- repair receipts in ai_credit_reservations keep every repair, so the table can be refilled from them. While the table or
-- the function is missing, the result page shows only the trap tags the question format gives, and a repair simply does not
-- add to the atlas: src/lib/server/trapAtlas.js treats a missing table or function as "no atlas".
drop function if exists public.record_trap_atlas(text, text, text);
drop table if exists public.trap_atlas;
