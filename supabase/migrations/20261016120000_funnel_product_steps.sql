-- Funnel: in-product steps counted once per user (src/lib/server/funnelStore.js countStepOnce).
-- Builds on 20261015233000_funnel_daily.sql. Nothing here puts an identifier into funnel_daily: it stays
-- aggregate daily counters. The once-per-user rule is a flag on the person's OWN row (users.funnel_seen, a
-- list of step names they have already reached); the claim and the counter increment happen in one
-- transaction inside funnel_count_once, so a person counts once per step and a failure counts nothing.
-- Service role only. Not applied to production by this change. Undo: supabase/undo/20261016120000_funnel_product_steps.undo.sql

alter table public.users add column if not exists funnel_seen text[] not null default '{}';

-- Widen the step whitelist (same constraint name the first migration created).
alter table public.funnel_daily drop constraint if exists funnel_daily_step_check;
alter table public.funnel_daily add constraint funnel_daily_step_check check (step in (
  'landing_view', 'sample_subject_chosen', 'sample_started', 'sample_done',
  'signup_click', 'signup_complete', 'login_click',
  'first_practice_started', 'first_practice_finished', 'first_mock_finished', 'first_repair',
  'pricing_viewed', 'checkout_opened', 'payment_captured'
));

-- Claims p_step for the user and, only if it was not claimed before, adds 1 to today's counter for
-- (p_step, p_platform). Returns true when it counted. An unknown step or platform raises (check
-- constraint) and the claim rolls back with the statement.
create or replace function public.funnel_count_once(p_user_id text, p_step text, p_platform text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare claimed text;
begin
  update public.users
     set funnel_seen = array_append(funnel_seen, p_step)
   where id = p_user_id and not (p_step = any(funnel_seen))
  returning id into claimed;
  if claimed is null then return false; end if;
  perform public.funnel_increment(p_step, p_platform);
  return true;
end;
$$;

revoke all on function public.funnel_count_once(text, text, text) from public, anon, authenticated;
grant execute on function public.funnel_count_once(text, text, text) to service_role;
