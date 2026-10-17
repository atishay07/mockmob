-- Per-user monthly rupee cap in the student-AI runtime guard (17 Oct 2026). Applies after
-- 20261004120000_runtime_ai_monthly_cap (global USD 25 per IST month, unchanged) and
-- 20261014120000_runtime_ai_price_claude_haiku_5_5.
--
-- Why: "50 credits cost us at most Rs 5-10 per paid user" was only true on average. Nothing capped one student, and
-- runtime_ai_requests had no user. A retry loop on a failing or disputed question (released credits, so the wallet never
-- stops it) could burn the shared USD 25 for everyone. See docs/brain/AI-COST-PER-USER-2026-10-17.md.
--
-- What:
--   1. runtime_ai_requests.user_id (nullable text) + index (user_id, created_at). Calls without a user (scripts, the
--      content pipeline, moderation) leave it null and behave exactly as before.
--   2. Two cap rows in runtime_ai_budget, so the caps change with one UPDATE and no deploy:
--        student_user_paid  monthly_cap_usd 0.0568  (Rs 5 at USD 1 = Rs 88; owner, 17 Oct 2026, 2:15 am)  any active paid plan
--        student_user_free  monthly_cap_usd 0.0114  (Rs 1)                      everyone else
--      Only the row id 'student_ai' carries funding, pause and spend; nothing reads these two rows except this function.
--   3. reserve_runtime_ai takes p_user_id and p_user_tier ('paid', anything else = free) and refuses with
--      'runtime user limit reached' when that user's IST-month-to-date sum of coalesce(actual_usd, reserved_usd) plus the
--      new reservation would exceed the cap. The global check above it is untouched. The global budget row is locked
--      first, so reservations are serialised and the per-user sum cannot race.
--   4. Model allowlist (owner, 17 Oct 2026): the function refuses any provider/model other than openai gpt-6-luna and
--      anthropic claude-haiku-5-5 with 'runtime model not allowed', whatever price rows exist. Other price rows are kept.
--   5. The two new parameters have defaults, so a 5-argument call still works. The old 5-argument function is dropped
--      first, otherwise both would match a 5-argument call.
-- Deploy order: apply this migration BEFORE the code that sends p_user_id (the old function has no such parameter).
-- Rollback: supabase/undo/20261017120000_runtime_ai_user_cap.undo.sql.

alter table public.runtime_ai_requests add column if not exists user_id text;
create index if not exists runtime_ai_requests_user_month_idx on public.runtime_ai_requests(user_id, created_at);

insert into public.runtime_ai_budget(id, monthly_cap_usd) values
  ('student_user_paid', 0.0568),
  ('student_user_free', 0.0114)
on conflict (id) do nothing;

drop function if exists public.reserve_runtime_ai(text,text,text,int,int);

create function public.reserve_runtime_ai(p_key text,p_provider text,p_model text,p_input_bound int,p_output_bound int,p_user_id text default null,p_user_tier text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;month_spend numeric;user_cap numeric;user_spend numeric;
begin
 select * into b from public.runtime_ai_budget where id='student_ai' for update;
 if not found or b.paused then raise exception 'runtime funding unavailable'; end if;
 -- Owner decision, 17 Oct 2026: only GPT-6 Luna (openai) and Claude Haiku 5.5 (anthropic) may be called. Other price rows
 -- stay as history; they can no longer be reserved against.
 if not ((p_provider='openai' and p_model='gpt-6-luna') or (p_provider='anthropic' and p_model='claude-haiku-5-5')) then raise exception 'runtime model not allowed'; end if;
 select * into r from public.runtime_ai_requests where request_key=p_key;
 if found then
   if r.provider<>p_provider or r.model<>p_model then raise exception 'request conflict'; end if;
   return jsonb_build_object('dispatch',false,'state',r.state,'receipt',r.receipt);
 end if;
 select * into price from public.runtime_ai_prices where provider=p_provider and model=p_model and verified_at>now()-interval '90 days';
 if not found then raise exception 'verified model price required'; end if;
 if p_input_bound<1 or p_output_bound<1 then raise exception 'invalid token bounds'; end if;
 cost=(p_input_bound*price.input_per_million+p_output_bound*price.output_per_million)/1000000;
 select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into month_spend
   from public.runtime_ai_requests where created_at>=public.runtime_ai_month_start();
 if month_spend+cost>b.monthly_cap_usd then raise exception 'runtime budget exhausted'; end if;
 if p_user_id is not null then
   -- A missing cap row fails closed (no cap known, no dispatch).
   select monthly_cap_usd into user_cap from public.runtime_ai_budget
     where id=case when p_user_tier='paid' then 'student_user_paid' else 'student_user_free' end;
   if user_cap is null then raise exception 'runtime funding unavailable'; end if;
   select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into user_spend
     from public.runtime_ai_requests where user_id=p_user_id and created_at>=public.runtime_ai_month_start();
   if user_spend+cost>user_cap then raise exception 'runtime user limit reached'; end if;
 end if;
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd,user_id) values(p_key,p_provider,p_model,cost,p_user_id);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $$;

revoke all on function public.reserve_runtime_ai(text,text,text,int,int,text,text) from public,anon,authenticated;
grant execute on function public.reserve_runtime_ai(text,text,text,int,int,text,text) to service_role;
