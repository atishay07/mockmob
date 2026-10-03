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
