-- Undo for supabase/migrations/20261002122000_rival_atomic_submission.sql (applied to production 16 Oct 2026).
-- Rival submissions fail closed (503 battle_submission_temporarily_unavailable) without it.
drop function if exists public.submit_rival_battle(uuid,text,jsonb,jsonb,jsonb);
