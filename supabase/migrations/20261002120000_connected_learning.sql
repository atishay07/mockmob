-- Saved only. Apply to staging explicitly after foundation migration and backup.
-- Service-only, owner-bound transactions; no production changes are implicit.
create table public.learning_allowances (
 user_id text not null references public.users(id), kind text not null, period text not null,
 reference text not null, created_at timestamptz not null default now(), primary key(user_id,kind,period)
);
create table public.learning_episodes (
 id text primary key, user_id text not null references public.users(id), request_key text not null,
 concept_id text not null, pathway jsonb not null, projection jsonb not null,
 revision int not null default 0, created_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index learning_episodes_owner on public.learning_episodes(user_id,created_at desc);
create table public.learning_observations (
 id bigint generated always as identity primary key, episode_id text not null references public.learning_episodes(id),
 user_id text not null references public.users(id), request_key text not null, response jsonb not null,
 projection jsonb not null, created_at timestamptz not null default now(), unique(episode_id,request_key)
);
create table public.learning_family_exposure (
 user_id text not null references public.users(id), family_id text not null,
 reference text not null, created_at timestamptz not null default now(), primary key(user_id,family_id)
);
create table public.learning_question_exposure (
 user_id text not null references public.users(id), question_id text not null,
 reference text not null, created_at timestamptz not null default now(), primary key(user_id,question_id)
);
create index recovery_sessions_owner_state on public.recovery_sessions(user_id,state,expires_at);
alter table public.learning_allowances enable row level security;
alter table public.learning_episodes enable row level security;
alter table public.learning_observations enable row level security;
alter table public.learning_family_exposure enable row level security;
alter table public.learning_question_exposure enable row level security;
revoke all on public.learning_allowances,public.learning_episodes,public.learning_observations,public.learning_family_exposure,public.learning_question_exposure from public,anon,authenticated;
grant all on public.learning_allowances,public.learning_episodes,public.learning_family_exposure,public.learning_question_exposure to service_role;
-- Append-only observations; no UPDATE/DELETE grant even to the application role.
grant select,insert on public.learning_observations to service_role;
grant usage,select on sequence public.learning_observations_id_seq to service_role;

create function public.start_learning_episode(p_row jsonb,p_free_period text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.learning_episodes%rowtype; i jsonb;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into e from public.learning_episodes where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(e); end if;
 select * into e from public.learning_episodes where user_id=p_row->>'user_id' and concept_id=p_row->>'concept_id'
 and projection->>'state' not in ('invalidated','maintained');
 if found then return to_jsonb(e); end if;
 for i in select value from jsonb_array_elements((p_row->'pathway'->'probes')||(p_row->'pathway'->'repair')||(p_row->'pathway'->'checks')) loop
   if exists(select 1 from public.learning_family_exposure where user_id=p_row->>'user_id' and family_id=i->>'familyId')
   or exists(select 1 from public.learning_question_exposure where user_id=p_row->>'user_id' and question_id=i->>'questionId')
   or exists(select 1 from public.attempts a,lateral jsonb_array_elements(coalesce(a.questions_snapshot,'[]')) q where a.user_id=p_row->>'user_id' and (q->>'id'=i->>'questionId' or coalesce(q->>'familyId',q->>'family_id')=i->>'familyId'))
   or exists(select 1 from public.questions q where (q.id=i->>'questionId' or coalesce(q.family_id,q.evidence->'record'->>'family_id')=i->>'familyId') and (
     coalesce(to_jsonb(q)->>'author_id',to_jsonb(q)->>'uploaded_by')=p_row->>'user_id'
     or exists(select 1 from public.question_bookmarks b where b.user_id=p_row->>'user_id' and b.question_id=q.id)
     or exists(select 1 from public.user_question_progress g where g.user_id=p_row->>'user_id' and g.question_id=q.id and (g.seen_count>0 or g.attempt_count>0))
     or exists(select 1 from public.question_interactions x where x.user_id=p_row->>'user_id' and x.question_id=q.id))) then raise exception 'insufficient fresh content'; end if;
 end loop;
 if p_free_period is not null then
   if exists(select 1 from public.learning_allowances where user_id=p_row->>'user_id' and kind='weekly_episode' and period=p_free_period) then raise exception 'weekly allowance used'; end if;
   insert into public.learning_allowances values(p_row->>'user_id','weekly_episode',p_free_period,p_row->>'id',now());
 end if;
 insert into public.learning_episodes(id,user_id,request_key,concept_id,pathway,projection)
 values(p_row->>'id',p_row->>'user_id',p_row->>'request_key',p_row->>'concept_id',p_row->'pathway',p_row->'projection') returning * into e;
 for i in select value from jsonb_array_elements((e.pathway->'probes')||(e.pathway->'repair')||(e.pathway->'checks')) loop
   insert into public.learning_family_exposure values(e.user_id,i->>'familyId',e.id,now()) on conflict do nothing;
   insert into public.learning_question_exposure values(e.user_id,i->>'questionId',e.id,now()) on conflict do nothing;
 end loop;
 return to_jsonb(e);
end $$;

create function public.advance_learning_episode(p_id text,p_user text,p_key text,p_response jsonb,p_revision int,p_projection jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.learning_episodes%rowtype; o public.learning_observations%rowtype;
begin
 select * into e from public.learning_episodes where id=p_id and user_id=p_user for update;
 if not found then raise exception 'episode not found'; end if;
 select * into o from public.learning_observations where episode_id=p_id and request_key=p_key;
 if found then
   if o.response is distinct from p_response then raise exception 'idempotency conflict'; end if;
   return o.projection;
 end if;
 if e.revision<>p_revision or (p_projection->>'revision')::int<>p_revision+1 then raise exception 'revision conflict'; end if;
 insert into public.learning_observations(episode_id,user_id,request_key,response,projection) values(p_id,p_user,p_key,p_response,p_projection);
 update public.learning_episodes set projection=p_projection,revision=p_revision+1 where id=p_id;
 return p_projection;
end $$;

create function public.start_learning_session(p_row jsonb,p_credit_action text,p_quota_kind text,p_period text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.recovery_sessions%rowtype; result jsonb; q jsonb; used boolean=false;
begin
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into s from public.recovery_sessions where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(s); end if;
 if p_quota_kind is not null then
   used=exists(select 1 from public.learning_allowances where user_id=p_row->>'user_id' and kind=p_quota_kind and period=p_period);
   if not used then insert into public.learning_allowances values(p_row->>'user_id',p_quota_kind,p_period,p_row->>'id',now()); end if;
 end if;
 result=public.start_recovery_session(p_row,case when p_quota_kind is not null and not used then null else p_credit_action end);
 for q in select value from jsonb_array_elements(p_row->'questions') loop
   insert into public.learning_question_exposure values(p_row->>'user_id',q->>'id',p_row->>'id',now()) on conflict do nothing;
   if q->>'familyId' is not null then insert into public.learning_family_exposure values(p_row->>'user_id',q->>'familyId',p_row->>'id',now()) on conflict do nothing; end if;
 end loop;
 return result;
end $$;
revoke all on function public.start_learning_episode(jsonb,text),public.advance_learning_episode(text,text,text,jsonb,int,jsonb),public.start_learning_session(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.start_learning_episode(jsonb,text),public.advance_learning_episode(text,text,text,jsonb,int,jsonb),public.start_learning_session(jsonb,text,text,text) to service_role;

-- Invalidate derived learning claims as soon as answer-bearing content changes.
create function public.invalidate_learning_evidence() returns trigger language plpgsql security definer set search_path='' as $$
declare eid text;
begin
 if to_jsonb(new) is distinct from to_jsonb(old) and (
 new.evidence is distinct from old.evidence or new.body is distinct from old.body
 or new.options is distinct from old.options or new.correct_answer is distinct from old.correct_answer
 or new.explanation is distinct from old.explanation or to_jsonb(new)->'correct_index' is distinct from to_jsonb(old)->'correct_index'
 or to_jsonb(new)->'status' is distinct from to_jsonb(old)->'status' or to_jsonb(new)->'verification_state' is distinct from to_jsonb(old)->'verification_state') then
   for eid in select distinct e.id from public.learning_episodes e,
     lateral jsonb_array_elements((e.pathway->'probes')||(e.pathway->'repair')||(e.pathway->'checks')) i
     where i->>'questionId'=new.id and e.projection->>'state'<>'invalidated' loop
     insert into public.learning_observations(episode_id,user_id,request_key,response,projection)
     select id,user_id,'invalidate:'||revision,jsonb_build_object('reason','content_changed','questionId',new.id),
       jsonb_set(jsonb_set(projection,'{state}','"invalidated"'),'{revision}',to_jsonb(revision+1)) from public.learning_episodes where id=eid for update;
     update public.learning_episodes set projection=jsonb_set(jsonb_set(projection,'{state}','"invalidated"'),'{revision}',to_jsonb(revision+1)),revision=revision+1 where id=eid;
   end loop;
 end if;
 return new;
end $$;
revoke all on function public.invalidate_learning_evidence() from public,anon,authenticated;
create trigger learning_evidence_change after update on public.questions for each row execute function public.invalidate_learning_evidence();

create function public.invalidate_held_learning_family() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.learning_episodes%rowtype;
begin
 for e in select * from public.learning_episodes where projection->>'state'<>'invalidated' and exists(
   select 1 from jsonb_array_elements((pathway->'probes')||(pathway->'repair')||(pathway->'checks')) i where i->>'familyId'=new.family_id) for update loop
   insert into public.learning_observations(episode_id,user_id,request_key,response,projection) values(e.id,e.user_id,'invalidate:'||e.revision,jsonb_build_object('reason','family_held','familyId',new.family_id),jsonb_set(jsonb_set(e.projection,'{state}','"invalidated"'),'{revision}',to_jsonb(e.revision+1)));
   update public.learning_episodes set projection=jsonb_set(jsonb_set(projection,'{state}','"invalidated"'),'{revision}',to_jsonb(revision+1)),revision=revision+1 where id=e.id;
 end loop;
 return new;
end $$;
revoke all on function public.invalidate_held_learning_family() from public,anon,authenticated;
create trigger held_family_learning after insert or update on public.recovery_family_holds for each row execute function public.invalidate_held_learning_family();
