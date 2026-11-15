-- Undo of supabase/migrations/20261116120000_release_unstarted_allowance.sql. NOT APPLIED, and NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself. Run only with the owner's or the CTO's word.
-- Drops the one function. Rows it already gave back stay given back. With the function gone, releaseFirstFullMock
-- (src/lib/server/firstFullMock.js) gets PGRST202 and does the read-then-delete it did before, with its race window.
drop function if exists public.release_unstarted_allowance(text, text, text, text);
