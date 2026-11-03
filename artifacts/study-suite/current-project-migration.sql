-- Owner-authorized current-project rollout, 4 October 2026. Additive schema only.
begin isolation level repeatable read;
create temp table study_rollout_before on commit drop as select (select count(*) from public.questions) as question_count,(select md5(coalesce(string_agg(id||':'||coalesce(body,'')||':'||coalesce(correct_answer,'')||':'||coalesce(correct_index::text,'')||':'||coalesce(options::text,''),'|' order by id),'')) from public.questions) as question_hash,(select count(*) from public.attempts) as attempt_count,(select md5(coalesce(string_agg(id||':'||credit_balance||':'||coalesce(is_premium::text,'')||':'||coalesce(premium_until::text,''),'|' order by id),'')) from public.users) as entitlement_hash,(select count(*) from public.credit_transactions) as credit_receipt_count;
alter table study_rollout_before enable row level security;

-- 20261001105920_score_recovery_foundations.sql
-- Service-only APIs. No answer-bearing snapshots are exposed through the public client.
alter table public.questions add column if not exists evidence jsonb;
alter table public.questions add column if not exists family_id text;
alter table public.questions add column if not exists passage_text text;
create table public.recovery_family_holds(family_id text primary key,reason text not null,created_at timestamptz not null default now());
alter table public.recovery_family_holds enable row level security;
revoke all on public.recovery_family_holds from public,anon,authenticated;
grant all on public.recovery_family_holds to service_role;
alter table public.attempts add column if not exists selection_meta jsonb not null default '{}';
create table public.recovery_sessions (
 id text primary key, user_id text not null references public.users(id), request_key text not null,
 subject text not null, mode text not null, state text not null check(state in ('active','submitted')),
 questions jsonb not null, selection_meta jsonb not null default '{}', events jsonb not null default '[]',
 created_at timestamptz not null, expires_at timestamptz not null,
 unique(user_id, request_key)
);
create table public.recovery_review_queue (
 user_id text not null references public.users(id), question_id text not null,
 attempt_id text not null references public.attempts(id), due_at timestamptz not null,
 state text not null default 'pending', primary key(user_id, question_id, attempt_id)
);
create table public.question_version_history (
 id bigint generated always as identity primary key, question_id text not null,
 previous_row jsonb not null, reason text not null, created_at timestamptz not null default now()
);
create table public.recovery_playbook (
 id bigint generated always as identity primary key, user_id text not null references public.users(id),
 attempt_id text not null references public.attempts(id), strategy text not null,
 reflection text not null default '', evidence_state text not null default 'more_evidence_needed',
 created_at timestamptz not null default now(), unique(user_id,attempt_id,strategy)
);
alter table public.recovery_playbook enable row level security;
revoke all on public.recovery_playbook from anon,authenticated;
grant all on public.recovery_playbook to service_role;
grant usage,select on sequence public.recovery_playbook_id_seq to service_role;
alter table public.recovery_sessions enable row level security;
alter table public.recovery_review_queue enable row level security;
alter table public.question_version_history enable row level security;
revoke all on public.recovery_sessions, public.recovery_review_queue, public.question_version_history from anon, authenticated;
grant all on public.recovery_sessions, public.recovery_review_queue, public.question_version_history to service_role;
grant usage, select on sequence public.question_version_history_id_seq to service_role;

create function public.start_recovery_session(p_row jsonb, p_credit_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.recovery_sessions%rowtype;
begin
 -- Serialize starts for an owner before checking idempotency or charging.
 perform 1 from public.users where id=p_row->>'user_id' for update;
 if not found then raise exception 'user not found'; end if;
 select * into existing from public.recovery_sessions
 where user_id=p_row->>'user_id' and request_key=p_row->>'request_key';
 if found then return to_jsonb(existing); end if;
 if p_credit_action is not null and not public.spend_credits(p_row->>'user_id',p_credit_action,'recovery:'||(p_row->>'id'))
 then raise exception 'insufficient credits'; end if;
 insert into public.recovery_sessions select * from jsonb_populate_record(null::public.recovery_sessions,jsonb_set(p_row,'{events}',coalesce(p_row->'events','[]'::jsonb)))
 returning * into existing;
 return to_jsonb(existing);
end $$;

create function public.record_recovery_events(p_id text, p_user_id text, p_events jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; e jsonb; n int;
begin
 select * into s from public.recovery_sessions where id=p_id and user_id=p_user_id for update;
 if not found then raise exception 'session not found'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
   n=(e->>'seq')::int;
   if n<=jsonb_array_length(s.events) then
     if s.events->(n-1)<>e then raise exception 'event conflict'; end if;
     continue;
   end if;
   if s.state<>'active' or now()>s.expires_at then raise exception 'session expired'; end if;
   if n<>jsonb_array_length(s.events)+1 or n>5000 then raise exception 'event sequence gap'; end if;
   if jsonb_array_length(s.events)>0 and (e->>'at')::numeric<(s.events->-1->>'at')::numeric then raise exception 'event clock conflict'; end if;
   s.events=s.events||jsonb_build_array(e);
 end loop;
 update public.recovery_sessions set events=s.events where id=s.id;
 return s.events;
end $$;

create function public.finish_recovery_session(p_id text, p_user_id text, p_result jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; d jsonb; q jsonb;
begin
 select * into s from public.recovery_sessions where id=p_id and user_id=p_user_id for update;
 if not found then raise exception 'session not found'; end if;
 if s.state='submitted' then return s.id; end if;
 if p_result->>'expected_event_count' is null or (p_result->>'expected_event_count')::int<>jsonb_array_length(s.events) then raise exception 'event conflict'; end if;
 if now()>s.expires_at+interval '2 minutes' then raise exception 'session expired'; end if;
 insert into public.attempts(id,user_id,subject,score,correct,wrong,unattempted,total,details,questions_snapshot,selection_meta)
 values(s.id,s.user_id,s.subject,(p_result->>'score')::int,(p_result->>'correct')::int,
 (p_result->>'wrong')::int,(p_result->>'unattempted')::int,(p_result->>'total')::int,
 p_result->'details',s.questions,p_result->'selectionMeta');
 for d in select value from jsonb_array_elements(p_result->'details') loop
   select value into q from jsonb_array_elements(s.questions) where value->>'id'=d->>'qid';
   insert into public.user_question_progress(user_id,question_id,subject,chapter,seen_count,attempt_count,correct_count,skip_count,last_selected_key,last_correct,last_seen_at,last_attempted_at,updated_at)
   values(s.user_id,d->>'qid',s.subject,q->>'chapter',1,
     case when d->>'givenIndex' is null then 0 else 1 end,
     case when (d->>'isCorrect')::boolean is true then 1 else 0 end,
     case when d->>'givenIndex' is null then 1 else 0 end,
     substr('ABCD',coalesce((d->>'givenIndex')::int, -1)+1,1),(d->>'isCorrect')::boolean,now(),now(),now())
   on conflict(user_id,question_id) do update set
     seen_count=public.user_question_progress.seen_count+1,
     attempt_count=public.user_question_progress.attempt_count+excluded.attempt_count,
     correct_count=public.user_question_progress.correct_count+excluded.correct_count,
     skip_count=public.user_question_progress.skip_count+excluded.skip_count,
     last_selected_key=excluded.last_selected_key,last_correct=excluded.last_correct,last_seen_at=now(),last_attempted_at=now(),updated_at=now();
   if (d->>'isCorrect')::boolean is not true then
     insert into public.recovery_review_queue(user_id,question_id,attempt_id,due_at)
     values(s.user_id,d->>'qid',s.id,now()+interval '1 day') on conflict do nothing;
   end if;
 end loop;
 update public.recovery_sessions set state='submitted' where id=s.id;
 return s.id;
end $$;
revoke all on function public.start_recovery_session(jsonb,text), public.finish_recovery_session(text,text,jsonb), public.record_recovery_events(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.start_recovery_session(jsonb,text), public.finish_recovery_session(text,text,jsonb), public.record_recovery_events(text,text,jsonb) to service_role;

-- A quarantine changes eligibility only. Attempts and question IDs stay intact.
create function public.quarantine_recovery_questions(p_changes jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare c jsonb; r jsonb; expected jsonb; actual jsonb; n int=0; family text; dependent record;
begin
 for c in select value from jsonb_array_elements(p_changes) loop
   select to_jsonb(q) into r from public.questions q where id=c->>'id' for update;
   if r is null then raise exception 'audit item missing'; end if;
   expected=c->'expected_content';
   -- Match answer-bearing fields in the saved dry run. Passage lookup can attach text.
   actual=jsonb_build_object('subject',r->'subject','chapter',r->'chapter',
     'concept',coalesce(r->>'concept_id',r->>'concept',''),
     'body',coalesce(r->>'body',r->>'question_text',r->>'question',''),
     'explanation',coalesce(r->>'explanation',r->>'answer_explanation',''));
   if actual->>'subject'<>expected->>'subject' or actual->>'chapter'<>expected->>'chapter'
      or actual->>'concept'<>expected->>'concept' or actual->>'body'<>expected->>'body'
      or actual->>'explanation'<>expected->>'explanation'
      or r->'options' is distinct from c->'expected_options'
      or coalesce(r->>'correct_answer',r->>'correct_option',r->>'correct_index','') is distinct from c->>'expected_key'
   then raise exception 'audit snapshot stale'; end if;
   family=coalesce(r->>'family_id',r->'evidence'->'record'->>'family_id');
   if family is not null then
     insert into public.recovery_family_holds(family_id,reason) values(family,c->>'reason') on conflict(family_id) do update set reason=excluded.reason;
   end if;
   for dependent in select q.id,to_jsonb(q) as previous_row from public.questions q
     where q.id=c->>'id' or (family is not null and (q.family_id=family or q.evidence->'record'->>'family_id'=family)) for update loop
     insert into public.question_version_history(question_id,previous_row,reason)
       values(dependent.id,dependent.previous_row,c->>'reason');
     update public.questions set evidence=jsonb_build_object('record',jsonb_build_object('state','quarantined'),'reason',c->>'reason') where id=dependent.id;
     n=n+1;
   end loop;
 end loop;
 return n;
end $$;
create function public.restore_recovery_question(p_history_id bigint)
returns text language plpgsql security invoker set search_path='' as $$
declare h public.question_version_history%rowtype;
begin
 select * into h from public.question_version_history where id=p_history_id;
 if not found then raise exception 'history missing'; end if;
 update public.questions set evidence=h.previous_row->'evidence' where id=h.question_id and evidence->'record'->>'state'='quarantined';
 if not found then raise exception 'item is not quarantined'; end if;
 return h.question_id;
end $$;
revoke all on function public.quarantine_recovery_questions(jsonb),public.restore_recovery_question(bigint) from public,anon,authenticated;
grant execute on function public.quarantine_recovery_questions(jsonb),public.restore_recovery_question(bigint) to service_role;

-- Publish passage and all checked children in the same Postgres transaction.
-- Column names are quoted identifiers; values remain bound JSON parameters.
create function public.publish_recovery_passage(p_group jsonb,p_questions jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q jsonb; cols text; ids jsonb='[]';
begin
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<2 or jsonb_array_length(p_questions)>20 then raise exception 'complete passage unit required'; end if;
 if coalesce(p_group->>'id','')='' or coalesce(p_group->>'passage_text','')='' then raise exception 'invalid passage'; end if;
 select string_agg(format('%I',key),',') into cols from jsonb_object_keys(p_group) key;
 execute format('insert into public.passage_groups (%s) select %s from jsonb_populate_record(null::public.passage_groups,$1)',cols,cols) using p_group;
 for q in select value from jsonb_array_elements(p_questions) loop
   if q->>'passage_group_id' is distinct from p_group->>'id' or q->>'passage_text' is distinct from p_group->>'passage_text'
     or q->'evidence'->'record'->>'route' is distinct from 'passage'
     or not coalesce(q->'evidence'->'record'->>'state' in ('eligible','published'),false)
     or q->'evidence'->>'signature' is null then raise exception 'invalid passage child evidence'; end if;
   select string_agg(format('%I',key),',') into cols from jsonb_object_keys(q) key;
   execute format('insert into public.questions (%s) select %s from jsonb_populate_record(null::public.questions,$1)',cols,cols) using q;
   ids=ids||jsonb_build_array(q->>'id');
 end loop;
 return ids;
end $$;
revoke all on function public.publish_recovery_passage(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_recovery_passage(jsonb,jsonb) to service_role;


-- 20261002120000_connected_learning.sql
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


-- 20261004154217_connected_study_suite.sql
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


-- 20261004172214_study_review_backlog.sql
-- Current published content only. Withdrawn and superseded card versions cannot permanently block new study.
create or replace function public.start_study_run(p_row jsonb,p_states jsonb,p_day text)
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
   select count(*) into overdue from public.study_card_states s join public.study_cards c on c.id=s.card_id and c.version=s.content_version join public.study_units u on u.id=c.unit_id and u.version=c.unit_version where s.user_id=p_row->>'user_id' and u.publication_state='published' and (s.schedule->>'due')::timestamptz < now()-interval '1 day' and not exists(select 1 from public.study_units newer where newer.id=u.id and newer.publication_state='published' and newer.version>u.version) and not exists(select 1 from public.study_cards newer where newer.id=c.id and newer.unit_id=c.unit_id and newer.unit_version=c.unit_version and newer.version>c.version);
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


do $$ declare after_row record; before_row record; begin select * into before_row from study_rollout_before; select * into after_row from (select (select count(*) from public.questions) as question_count,(select md5(coalesce(string_agg(id||':'||coalesce(body,'')||':'||coalesce(correct_answer,'')||':'||coalesce(correct_index::text,'')||':'||coalesce(options::text,''),'|' order by id),'')) from public.questions) as question_hash,(select count(*) from public.attempts) as attempt_count,(select md5(coalesce(string_agg(id||':'||credit_balance||':'||coalesce(is_premium::text,'')||':'||coalesce(premium_until::text,''),'|' order by id),'')) from public.users) as entitlement_hash,(select count(*) from public.credit_transactions) as credit_receipt_count) s; if to_jsonb(after_row)<>to_jsonb(before_row) then raise exception 'Existing questions, attempts, credits or entitlements changed'; end if; end $$;
commit;
select 'Study schema applied; existing questions, attempts, credits and entitlements preserved' as status;
