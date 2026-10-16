-- Undo for supabase/migrations/20261017120000_runtime_ai_user_cap.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Restores the 5-argument reserve_runtime_ai exactly as 20261004120000_runtime_ai_monthly_cap.sql left it (global USD 25
-- per IST month only), then removes the per-user pieces. Dropping user_id discards only the per-user attribution of past
-- requests; costs, receipts and the global budget row are untouched. Roll the code back BEFORE running this undo: the
-- 5-argument function rejects the extra p_user_id and p_user_tier parameters.
drop function if exists public.reserve_runtime_ai(text,text,text,int,int,text,text);

create function public.reserve_runtime_ai(p_key text,p_provider text,p_model text,p_input_bound int,p_output_bound int)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;month_spend numeric;
begin
 select * into b from public.runtime_ai_budget where id='student_ai' for update;
 if not found or b.paused then raise exception 'runtime funding unavailable'; end if;
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
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd) values(p_key,p_provider,p_model,cost);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $$;

revoke all on function public.reserve_runtime_ai(text,text,text,int,int) from public,anon,authenticated;
grant execute on function public.reserve_runtime_ai(text,text,text,int,int) to service_role;

delete from public.runtime_ai_budget where id in ('student_user_paid','student_user_free');
drop index if exists public.runtime_ai_requests_user_month_idx;
alter table public.runtime_ai_requests drop column if exists user_id;
