-- Owner authorization, 4 October 2026: student-facing AI (PrepOS replies, Score Recovery tutor)
-- may spend up to USD 25 per IST calendar month. Applies after 20261002121000_runtime_ai_guard
-- and 20261002130000_prepos_credit_reservations.
--
-- Fixes found while preparing production:
--   1. ai_credit_ledger.reason only allowed the older reasons, so every reservation/release
--      insert ('ai_reserve' / 'ai_release') would have failed and broken all paid replies.
--   2. The budget was a lifetime ceiling; the authorization is monthly.
--   3. A single response with missing usage paused ALL student AI until manual intervention.
--      Missing usage now books the full reserved amount (never under-counts spend) without
--      pausing; only a genuine overrun of the reservation pauses dispatch.
--   4. Verified prices expired after 30 days, silently stopping AI each month. Now 90 days;
--      scripts/learning/prepos-readiness.mjs warns before expiry.
-- Rollback: restore the previous function bodies from 20261002121000_runtime_ai_guard.sql and
-- set monthly_cap_usd=0 (dispatch stops; history, wallets and ledger are untouched).

alter table public.ai_credit_ledger drop constraint if exists ai_credit_ledger_reason_check;
alter table public.ai_credit_ledger add constraint ai_credit_ledger_reason_check check (reason = any (array[
  'monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry','ai_reserve','ai_release']::text[]));

alter table public.runtime_ai_budget add column if not exists monthly_cap_usd numeric not null default 0 check (monthly_cap_usd >= 0);
create index if not exists runtime_ai_requests_created_idx on public.runtime_ai_requests(created_at);

create or replace function public.runtime_ai_month_start() returns timestamptz
language sql stable set search_path='' as $$
  select (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata'
$$;

create or replace function public.reserve_runtime_ai(p_key text,p_provider text,p_model text,p_input_bound int,p_output_bound int)
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

create or replace function public.receipt_runtime_ai(p_key text,p_cost numeric,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.runtime_ai_requests%rowtype;cost numeric;
begin
 perform 1 from public.runtime_ai_budget where id='student_ai' for update;
 select * into r from public.runtime_ai_requests where request_key=p_key for update;
 if not found then raise exception 'reservation not found'; end if;
 if r.state<>'reserved' then return true; end if;
 -- Missing usage books the full reservation, so spend is never under-counted.
 cost=coalesce(p_cost,r.reserved_usd);
 if cost<0 then raise exception 'invalid usage cost'; end if;
 update public.runtime_ai_requests set actual_usd=cost,state='receipted',receipt=p_receipt where request_key=p_key;
 update public.runtime_ai_budget set reserved_usd=greatest(0,reserved_usd-r.reserved_usd),spent_usd=spent_usd+cost,
   paused=paused or cost>r.reserved_usd where id='student_ai';
 return true;
end $$;

revoke all on function public.runtime_ai_month_start(),public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.runtime_ai_month_start(),public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb) to service_role;

update public.runtime_ai_budget set monthly_cap_usd=25 where id='student_ai';

-- Official list prices, USD per million tokens, read 4 October 2026.
insert into public.runtime_ai_prices(provider,model,input_per_million,output_per_million,source_url,verified_at) values
 ('anthropic','claude-haiku-4-5',1,5,'https://platform.claude.com/docs/en/about-claude/pricing',now()),
 ('anthropic','claude-sonnet-5-5',2,10,'https://platform.claude.com/docs/en/about-claude/pricing',now()),
 ('openai','gpt-4.1-mini',0.40,1.60,'https://developers.openai.com/api/docs/pricing',now())
on conflict(provider,model) do update set input_per_million=excluded.input_per_million,output_per_million=excluded.output_per_million,
 source_url=excluded.source_url,verified_at=excluded.verified_at;
