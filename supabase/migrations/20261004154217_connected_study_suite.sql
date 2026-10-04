-- Saved migration. Requires connected_learning. Explicit staging apply and verification first.
create schema if not exists study_private;
revoke all on schema study_private from public,anon,authenticated;
create table public.study_preferences (
 user_id text primary key references public.users(id), preferences jsonb not null,
 revision integer not null default 0, updated_at timestamptz not null default now()
);
create table public.study_units (
 id text not null, version integer not null, subject text not null, chapter text not null,
 concept_id text not null, content jsonb not null, content_hash text not null,
 publication_state text not null check(publication_state in ('candidate','published','quarantined')),
 primary key(id,version)
);
create table public.study_cards (
 id text not null, version integer not null, unit_id text not null, unit_version integer not null,
 content jsonb not null, content_hash text not null,
 primary key(id,version), foreign key(unit_id,unit_version) references public.study_units(id,version)
);
create table public.study_runs (
 id text primary key, user_id text not null references public.users(id), request_key text not null,
 request jsonb not null, mode text not null check(mode in ('learn','recall')), content jsonb not null,
 projection jsonb not null, revision integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index study_runs_owner on public.study_runs(user_id,updated_at desc);
create table public.study_events (
 id bigint generated always as identity primary key, run_id text not null references public.study_runs(id),
 user_id text not null references public.users(id), request_key text not null, event jsonb not null,
 result jsonb not null, created_at timestamptz not null default now(), unique(run_id,request_key)
);
create table public.study_card_states (
 user_id text not null references public.users(id), card_id text not null, content_version integer not null,
 schedule jsonb not null, revision integer not null default 0, lapse_count integer not null default 0, introduced_day text not null,
 scheduler_version text not null, updated_at timestamptz not null default now(),
 primary key(user_id,card_id)
);
alter table public.study_preferences enable row level security;
alter table public.study_units enable row level security;
alter table public.study_cards enable row level security;
alter table public.study_runs enable row level security;
alter table public.study_events enable row level security;
alter table public.study_card_states enable row level security;
revoke all on public.study_preferences,public.study_units,public.study_cards,public.study_runs,public.study_events,public.study_card_states from public,anon,authenticated;
grant select,insert,update on public.study_preferences,public.study_units,public.study_cards,public.study_runs,public.study_card_states to service_role;
grant select,insert on public.study_events to service_role;
grant usage,select on sequence public.study_events_id_seq to service_role;

create function public.start_study_run(p_row jsonb,p_states jsonb,p_day text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_runs%rowtype; s jsonb; item jsonb; used integer; unseen integer; overdue integer;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into r from public.study_runs where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then
   if r.request <> p_row->'request' then raise exception 'idempotency conflict'; end if;
   return to_jsonb(r);
 end if;
 -- Resume the same mode before creating a competing queue in another tab.
 select * into r from public.study_runs where user_id=p_row->>'user_id' and mode=p_row->>'mode' and projection->>'state'='active' order by created_at limit 1;
 if found then return to_jsonb(r); end if;
 for item in select value from jsonb_array_elements(p_row->'content'->'units') loop
   if not exists(select 1 from public.study_units where id=item->>'id' and version=(item->>'version')::integer and publication_state='published' and content_hash=item->>'contentHash') then raise exception 'content changed'; end if;
 end loop;
 -- Never expose a family reserved by a formal recovery episode.
 for item in select value from jsonb_array_elements(p_row->'content'->'items') loop
   if p_row->>'mode'='recall' and not exists(select 1 from public.study_cards c where c.id=item->>'id' and c.version=(item->>'version')::integer and c.content_hash=item->>'contentHash') then raise exception 'card content changed'; end if;
   if exists(select 1 from public.learning_episodes e, lateral jsonb_array_elements(coalesce(e.pathway->'checks','[]'::jsonb)) c where c->>'familyId'=item->>'familyId') then raise exception 'reserved assessment family'; end if;
 end loop;
 if p_row->>'mode'='recall' then
   select count(*) into used from public.study_card_states where user_id=p_row->>'user_id' and introduced_day=p_day;
   select count(*) into unseen from jsonb_array_elements(p_states) x where not exists(select 1 from public.study_card_states where user_id=p_row->>'user_id' and card_id=x->>'card_id' and content_version=(x->>'content_version')::integer);
   select count(*) into overdue from public.study_card_states where user_id=p_row->>'user_id' and (schedule->>'due')::timestamptz < now()-interval '1 day';
   if used+unseen>5 or (overdue>20 and unseen>0) then raise exception 'daily new card conflict'; end if;
 end if;
 insert into public.study_runs(id,user_id,request_key,request,mode,content,projection)
 values(p_row->>'id',p_row->>'user_id',p_row->>'request_key',p_row->'request',p_row->>'mode',p_row->'content',p_row->'projection') returning * into r;
 for s in select value from jsonb_array_elements(p_states) loop
   insert into public.study_card_states(user_id,card_id,content_version,schedule,introduced_day,scheduler_version)
   values(r.user_id,s->>'card_id',(s->>'content_version')::integer,s->'schedule',p_day,s->>'scheduler_version') on conflict(user_id,card_id) do update set content_version=excluded.content_version,schedule=excluded.schedule,revision=public.study_card_states.revision+1,lapse_count=0,introduced_day=excluded.introduced_day,scheduler_version=excluded.scheduler_version where public.study_card_states.content_version<>excluded.content_version;
 end loop;
 for item in select value from jsonb_array_elements(p_row->'content'->'items') loop
   insert into public.learning_family_exposure(user_id,family_id,reference) values(r.user_id,item->>'familyId',r.id) on conflict do nothing;
 end loop;
 return to_jsonb(r);
end $$;

create function public.advance_study_run(p_user text,p_id text,p_key text,p_event jsonb,p_revision integer,p_projection jsonb,p_result jsonb,p_schedule jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_runs%rowtype; old public.study_events%rowtype; item jsonb;
begin
 -- Consistent lock order with start, preference writes and other card reviews.
 perform 1 from public.users where id=p_user for update;
 select * into r from public.study_runs where id=p_id and user_id=p_user for update;
 if not found then raise exception 'run not found'; end if;
 select * into old from public.study_events where run_id=p_id and request_key=p_key;
 if found then
   if old.event<>p_event then raise exception 'idempotency conflict'; end if;
   return old.result;
 end if;
 if r.revision<>p_revision or (p_projection->>'revision')::integer<>p_revision+1 then raise exception 'revision conflict'; end if;
 for item in select value from jsonb_array_elements(r.content->'units') loop
   if not exists(select 1 from public.study_units where id=item->>'id' and version=(item->>'version')::integer and publication_state='published' and content_hash=item->>'contentHash') then raise exception 'content changed'; end if;
 end loop;
 if r.mode='recall' then
   for item in select value from jsonb_array_elements(r.content->'items') loop
     if not exists(select 1 from public.study_cards c where c.id=item->>'id' and c.version=(item->>'version')::integer and c.content_hash=item->>'contentHash') then raise exception 'card content changed'; end if;
   end loop;
 end if;
 if p_schedule is not null then
   update public.study_card_states set schedule=p_schedule->'schedule',revision=revision+1,lapse_count=lapse_count+case when p_schedule->'log'->>'rating'='1' then 1 else 0 end,updated_at=now(),scheduler_version=p_schedule->>'schedulerVersion'
   where user_id=p_user and card_id=p_schedule->>'cardId' and content_version=(p_schedule->>'contentVersion')::integer and revision=(p_schedule->>'expectedRevision')::integer;
   if not found then raise exception 'card revision conflict'; end if;
 end if;
 update public.study_runs set projection=p_projection,revision=p_revision+1,updated_at=now() where id=p_id;
 insert into public.study_events(run_id,user_id,request_key,event,result) values(p_id,p_user,p_key,p_event,p_result);
 return p_result;
end $$;

create function public.save_study_preferences(p_user text,p_revision integer,p_preferences jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.study_preferences%rowtype;
begin
 perform 1 from public.users where id=p_user for update;
 if not found then raise exception 'user not found'; end if;
 select * into r from public.study_preferences where user_id=p_user;
 if coalesce(r.revision,0)<>p_revision then raise exception 'revision conflict'; end if;
 insert into public.study_preferences(user_id,preferences,revision) values(p_user,p_preferences,p_revision+1)
 on conflict(user_id) do update set preferences=excluded.preferences,revision=excluded.revision,updated_at=now();
 return p_preferences;
end $$;
revoke all on function public.start_study_run(jsonb,jsonb,text),public.advance_study_run(text,text,text,jsonb,integer,jsonb,jsonb,jsonb),public.save_study_preferences(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.start_study_run(jsonb,jsonb,text),public.advance_study_run(text,text,text,jsonb,integer,jsonb,jsonb,jsonb),public.save_study_preferences(text,integer,jsonb) to service_role;

create function public.record_study_exposure(p_user text,p_unit text,p_version integer,p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare u public.study_units%rowtype; item jsonb; family text;
begin
 perform 1 from public.users where id=p_user for update;
 if not found then raise exception 'user not found'; end if;
 select * into u from public.study_units where id=p_unit and version=p_version and content_hash=p_hash and publication_state='published';
 if not found then raise exception 'content changed'; end if;
 family='study:'||p_unit||':teaching:v'||p_version;
 if exists(select 1 from public.learning_episodes e,lateral jsonb_array_elements(coalesce(e.pathway->'checks','[]'::jsonb)) c where c->>'familyId'=family) then raise exception 'reserved assessment family'; end if;
 insert into public.learning_family_exposure(user_id,family_id,reference) values(p_user,family,p_unit||'@'||p_version) on conflict do nothing;
 return true;
end $$;
revoke all on function public.record_study_exposure(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.record_study_exposure(text,text,integer,text) to service_role;

-- Corrections withdraw affected active and completed claims, while keeping immutable history.
create function study_private.invalidate_study_content() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.study_runs%rowtype; reason text; identifier text;
begin
 if tg_table_name='study_units' and new.content_hash=old.content_hash and new.publication_state=old.publication_state then return new; end if;
 if tg_table_name='study_cards' and new.content_hash=old.content_hash then return new; end if;
 reason='content_corrected'; identifier=old.id||'@'||old.version;
 for r in select * from public.study_runs where projection->>'state'<>'invalidated' and (
   (tg_table_name='study_units' and exists(select 1 from jsonb_array_elements(content->'units') i where i->>'id'=old.id and (i->>'version')::integer=old.version))
   or (tg_table_name='study_cards' and exists(select 1 from jsonb_array_elements(content->'items') i where i->>'id'=old.id and (i->>'version')::integer=old.version))
 ) for update loop
   update public.study_runs set projection=jsonb_set(jsonb_set(projection,'{state}','"invalidated"'::jsonb),'{revision}',to_jsonb(revision+1)),revision=revision+1,updated_at=now() where id=r.id;
   insert into public.study_events(run_id,user_id,request_key,event,result) values(r.id,r.user_id,'system:'||identifier||':'||(r.revision+1),jsonb_build_object('type',reason,'content',identifier),jsonb_build_object('state','invalidated','reason',reason));
 end loop;
 return new;
end $$;
revoke all on function study_private.invalidate_study_content() from public,anon,authenticated;
create trigger study_unit_correction after update of content_hash,publication_state on public.study_units for each row execute function study_private.invalidate_study_content();
create trigger study_card_correction after update of content_hash on public.study_cards for each row execute function study_private.invalidate_study_content();

create function public.study_progress_summary(p_user text) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('lessonsRead',(select count(distinct u.id) from public.study_units u where u.publication_state='published' and exists(
   select 1 from public.study_runs r,lateral jsonb_array_elements(r.content->'units') i where r.user_id=p_user and r.mode='learn' and r.projection->>'state'='complete' and i->>'id'=u.id and (i->>'version')::integer=u.version and i->>'contentHash'=u.content_hash
 )), 'completedUnits',(select coalesce(jsonb_agg(distinct i),'[]'::jsonb) from public.study_runs r,lateral jsonb_array_elements(r.content->'units') i where r.user_id=p_user and r.mode='learn' and r.projection->>'state'='complete'),
 'recallReviews',(select count(*) from public.study_events e where e.user_id=p_user and e.result->>'mode'='recall' and e.event->>'type' in ('answer','rate')))
$$;
revoke all on function public.study_progress_summary(text) from public,anon,authenticated;
grant execute on function public.study_progress_summary(text) to service_role;
