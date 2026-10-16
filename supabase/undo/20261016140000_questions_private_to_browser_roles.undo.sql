-- Undo of 20261016140000_questions_private_to_browser_roles.sql. NOT a migration: it lives outside supabase/migrations
-- on purpose, so the Supabase CLI never applies it by itself.
-- Puts back the Supabase default grants that anon and authenticated held on public.questions before the migration
-- (the row policy "anon read live questions" and row level security were never touched). This re-opens every live
-- question with its answer key to anyone holding the public anon key; run it only to roll back a deploy that needed it.
grant all on public.questions to anon, authenticated;
