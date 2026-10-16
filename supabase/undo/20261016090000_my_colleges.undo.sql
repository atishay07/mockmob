-- Undo for supabase/migrations/20261016090000_my_colleges.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Dropping the table loses each student's saved college list (up to 8 entries). Nothing else depends
-- on it: GET /api/me/colleges answers 503 "unavailable", and the website shows My colleges as not
-- available while the Compass college rows keep their cutoffs.
drop function if exists public.my_colleges_remove(text, text, text);
drop function if exists public.my_colleges_add(text, text, text, text);
drop function if exists public.my_colleges_replace(text, jsonb);
drop table if exists public.my_colleges;
