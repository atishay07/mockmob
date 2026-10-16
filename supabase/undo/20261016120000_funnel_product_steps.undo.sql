-- Undo for supabase/migrations/20261016120000_funnel_product_steps.sql. NOT a migration: it lives outside
-- supabase/migrations so the Supabase CLI never applies it by itself.
-- Removes the once-per-user function, the per-user flag column and the seven in-product step rows, and puts
-- the original seven-step whitelist back. Landing and sign-up counts are untouched. While the function is
-- missing, countStepOnce catches the database error (the student sees nothing).
drop function if exists public.funnel_count_once(text, text, text);
alter table public.users drop column if exists funnel_seen;
delete from public.funnel_daily where step in (
  'first_practice_started', 'first_practice_finished', 'first_mock_finished', 'first_repair',
  'pricing_viewed', 'checkout_opened', 'payment_captured'
);
alter table public.funnel_daily drop constraint if exists funnel_daily_step_check;
alter table public.funnel_daily add constraint funnel_daily_step_check check (step in (
  'landing_view', 'sample_subject_chosen', 'sample_started', 'sample_done',
  'signup_click', 'signup_complete', 'login_click'
));
