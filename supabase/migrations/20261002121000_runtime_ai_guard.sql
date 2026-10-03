-- Runtime AI funding is separate from the content pipeline ($2/$10 unchanged).
-- Seed zero authorization and no model prices: dispatch stays disabled.
create table public.runtime_ai_budget(id text primary key,funded_usd numeric not null default 0 check(funded_usd>=0),spent_usd numeric not null default 0,reserved_usd numeric not null default 0,paused boolean not null default false);
insert into public.runtime_ai_budget(id) values('student_ai');
create table public.runtime_ai_prices(provider text,model text,input_per_million numeric not null check(input_per_million>0),output_per_million numeric not null check(output_per_million>0),source_url text not null,verified_at timestamptz not null,primary key(provider,model));
create table public.runtime_ai_requests(request_key text primary key,provider text not null,model text not null,reserved_usd numeric not null,actual_usd numeric,state text not null default 'reserved',receipt jsonb,created_at timestamptz not null default now());
create table public.persistent_rate_limits(bucket text primary key,count int not null,reset_at timestamptz not null);
alter table public.runtime_ai_budget enable row level security;
alter table public.runtime_ai_prices enable row level security;
alter table public.runtime_ai_requests enable row level security;
alter table public.persistent_rate_limits enable row level security;
revoke all on public.runtime_ai_budget,public.runtime_ai_prices,public.runtime_ai_requests,public.persistent_rate_limits from public,anon,authenticated;
grant select,update on public.runtime_ai_budget to service_role;
grant select on public.runtime_ai_prices to service_role;
grant select,insert,update on public.runtime_ai_requests,public.persistent_rate_limits to service_role;
create function public.reserve_runtime_ai(p_key text,p_provider text,p_model text,p_input_bound int,p_output_bound int)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;
begin
 select * into b from public.runtime_ai_budget where id='student_ai' for update;
 if not found or b.paused then raise exception 'runtime funding unavailable'; end if;
 select * into r from public.runtime_ai_requests where request_key=p_key;
 if found then
   if r.provider<>p_provider or r.model<>p_model then raise exception 'request conflict'; end if;
   return jsonb_build_object('dispatch',false,'state',r.state,'receipt',r.receipt);
 end if;
 select * into price from public.runtime_ai_prices where provider=p_provider and model=p_model and verified_at>now()-interval '30 days';
 if not found then raise exception 'verified model price required'; end if;
 if p_input_bound<1 or p_output_bound<1 then raise exception 'invalid token bounds'; end if;
 cost=(p_input_bound*price.input_per_million+p_output_bound*price.output_per_million)/1000000;
 if b.spent_usd+b.reserved_usd+cost>b.funded_usd then raise exception 'runtime budget exhausted'; end if;
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd) values(p_key,p_provider,p_model,cost);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $$;
create function public.receipt_runtime_ai(p_key text,p_cost numeric,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.runtime_ai_requests%rowtype;cost numeric;
begin
 perform 1 from public.runtime_ai_budget where id='student_ai' for update;
 select * into r from public.runtime_ai_requests where request_key=p_key for update;
 if not found then raise exception 'reservation not found'; end if;
 if r.state<>'reserved' then return true; end if;
 -- Ambiguous transport failure/missing usage retains the full physical-call cost.
 cost=coalesce(p_cost,r.reserved_usd);
 if cost<0 then raise exception 'invalid usage cost'; end if;
 update public.runtime_ai_requests set actual_usd=cost,state='receipted',receipt=p_receipt where request_key=p_key;
 update public.runtime_ai_budget set reserved_usd=reserved_usd-r.reserved_usd,spent_usd=spent_usd+cost,paused=paused or cost>r.reserved_usd or p_cost is null where id='student_ai';
 return true;
end $$;
create function public.take_rate_limit(p_bucket text,p_limit int,p_window_ms int)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n int;
begin
 if p_limit<1 or p_window_ms<1 then raise exception 'invalid limit'; end if;
 insert into public.persistent_rate_limits values(p_bucket,1,now()+p_window_ms*interval '1 millisecond')
 on conflict(bucket) do update set count=case when public.persistent_rate_limits.reset_at<=now() then 1 else public.persistent_rate_limits.count+1 end,
 reset_at=case when public.persistent_rate_limits.reset_at<=now() then now()+p_window_ms*interval '1 millisecond' else public.persistent_rate_limits.reset_at end returning count into n;
 return n<=p_limit;
end $$;
revoke all on function public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb),public.take_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.reserve_runtime_ai(text,text,text,int,int),public.receipt_runtime_ai(text,numeric,jsonb),public.take_rate_limit(text,int,int) to service_role;
