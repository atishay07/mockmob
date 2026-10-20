-- Undo for supabase/migrations/20261020160000_inventory_content_digest_fn.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself. The function is new (nothing existed before), so the undo is a drop.
-- The code (data/inventory_fingerprint.js) treats a missing function as "no digest": a touched row then forces the full count, as before
-- the function existed. No data is touched either way.
drop function if exists public.inventory_content_digest();
