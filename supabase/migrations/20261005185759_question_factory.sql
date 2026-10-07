-- Saved only: deploy explicitly after local/staging dry runs. No existing data is promoted.
alter table public.questions add column if not exists provenance jsonb;
alter table public.questions add column if not exists legacy_screening jsonb;
create table public.question_factory_control (
  id integer primary key check(id=1), paused boolean not null default true,
  phase text not null default 'pilot' check(phase in ('pilot','1000','10000')),
  pilot_target integer not null default 800 check(pilot_target between 4 and 800 and pilot_target%4=0),
  worker_id text, lease_until timestamptz, updated_at timestamptz not null default now(),
  snapshot jsonb not null default '{}', publication_enabled boolean not null default false
);
insert into public.question_factory_control(id) values(1);
create table public.question_factory_jobs (
  id text primary key, subject text not null check(subject in ('english','accountancy','business_studies','economics')),
  chapter text not null, anchor_id text, kind text not null check(kind in ('authentic_pyq','pyq_adapted','original_practice')),
  generation_brief jsonb,
  state text not null default 'queued', stage text not null default 'authoring', attempt integer not null default 0,
  candidate jsonb, result jsonb, provider_batch_id text, budget_reservation_id text, passage_group_id text,
  lease_owner text,lease_until timestamptz,batch_key text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index question_factory_jobs_state on public.question_factory_jobs(state,created_at);
create table public.question_factory_publications (
  question_id text primary key references public.questions(id), fingerprint text not null unique,
  family_id text not null, subject text not null, chapter text not null, kind text not null check(kind in ('authentic_pyq','pyq_adapted','original_practice')),
  published_at timestamptz not null default now(), job_id text not null unique references public.question_factory_jobs(id)
);
create table public.question_content_disputes (
  id text primary key, question_id text not null references public.questions(id), content_hash text not null,
  state text not null default 'open', reason text not null, receipt jsonb not null,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.question_factory_control enable row level security;
alter table public.question_factory_jobs enable row level security;
alter table public.question_factory_publications enable row level security;
alter table public.question_content_disputes enable row level security;
revoke all on public.question_factory_control,public.question_factory_jobs,public.question_factory_publications,public.question_content_disputes from public,anon,authenticated;
grant all on public.question_factory_control,public.question_factory_jobs,public.question_factory_publications,public.question_content_disputes to service_role;

-- One host/ledger binds permanently. A second machine cannot create a fresh $50 ledger.
create function public.claim_question_factory(p_worker text) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update public.question_factory_control set worker_id=p_worker,lease_until=now()+interval '5 minutes'
 where id=1 and (worker_id is null or worker_id=p_worker) and (lease_until is null or lease_until<now() or worker_id=p_worker);
 get diagnostics changed=row_count; return changed=1;
end $$;
revoke all on function public.claim_question_factory(text) from public,anon,authenticated;
grant execute on function public.claim_question_factory(text) to service_role;

create function public.record_question_dispute(p_id text,p_question text,p_hash text,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.questions where id=p_question for update;
 if not found then return false; end if;
 insert into public.question_content_disputes(id,question_id,content_hash,reason,receipt)
 values(p_id,p_question,p_hash,'ai_key_dispute',p_receipt) on conflict(id) do nothing;
 -- Conservatively withhold even if content changed while the model was solving.
 update public.questions set status='pending',verification_state='disputed',exploration_state='pending_review',updated_at=now()
 where id=p_question and status is distinct from 'rejected';
 return true;
end $$;
revoke all on function public.record_question_dispute(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_question_dispute(text,text,text,jsonb) to service_role;

create function public.publish_factory_question(p_row jsonb,p_fingerprint text,p_job text)
returns text language plpgsql security invoker set search_path='' as $$
declare control public.question_factory_control; existing text; cols text; p_kind text; total integer; derived integer;
begin
 select * into control from public.question_factory_control where id=1 for update;
 if control.paused or not control.publication_enabled or control.phase='pilot' then raise exception 'factory publication paused'; end if;
 select question_id into existing from public.question_factory_publications where job_id=p_job;
 if existing is not null then return existing; end if;
 if p_row->'evidence'->'record'->>'policy_version' is distinct from 'cuet-llm-v3' or p_row->'evidence'->>'signature' is null
    or p_row->'evidence'->'record'->>'state' is distinct from 'published' then raise exception 'factory evidence required'; end if;
 p_kind=p_row->'provenance'->>'kind';
 select count(*),count(*) filter(where kind in ('authentic_pyq','pyq_adapted')) into total,derived from public.question_factory_publications;
 if total>=10000 or (control.phase='1000' and total>=1000) then raise exception 'factory checkpoint reached'; end if;
 -- Original source-backed practice has no mandatory PYQ share. Authentic labels
 -- retain their stricter application evidence/authentication contract.
 if (select count(*) from public.question_factory_publications where subject=p_row->>'subject')>=2500 then raise exception 'subject target reached'; end if;
 if not exists(select 1 from public.question_factory_jobs where id=p_job and id=p_row->>'id' and subject=p_row->>'subject') then raise exception 'factory job mismatch'; end if;
 if p_row->>'status' is distinct from 'live' or p_row->>'verification_state' is distinct from 'verified' then raise exception 'invalid publication state'; end if;
 if p_row->>'passage_group_id' is not null and current_setting('mockmob.factory_group',true) is distinct from p_row->>'passage_group_id' then raise exception 'complete passage group required'; end if;
 select string_agg(format('%I',key),',') into cols from jsonb_object_keys(p_row) key;
 execute format('insert into public.questions (%s) select %s from jsonb_populate_record(null::public.questions,$1)',cols,cols) using p_row;
 insert into public.question_factory_publications(question_id,fingerprint,family_id,subject,chapter,kind,job_id)
 values(p_row->>'id',p_fingerprint,p_row->>'family_id',p_row->>'subject',p_row->>'chapter',p_kind,p_job);
 update public.question_factory_jobs set state='published',stage='complete',updated_at=now() where id=p_job;
 return p_row->>'id';
end $$;
revoke all on function public.publish_factory_question(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.publish_factory_question(jsonb,text,text) to service_role;

create function public.publish_factory_passage_group(p_group jsonb,p_rows jsonb,p_fingerprints jsonb,p_jobs jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare i integer; n integer; gid text; existing integer;
begin
 gid=p_group->>'id'; n=jsonb_array_length(p_rows);
 if gid is null or n<2 or n>10 or jsonb_array_length(p_fingerprints)<>n or jsonb_array_length(p_jobs)<>n then raise exception 'complete passage group required'; end if;
 perform 1 from public.question_factory_control where id=1 for update;
 select count(*) into existing from public.question_factory_publications where job_id in(select jsonb_array_elements_text(p_jobs));
 if existing=n then return gid; end if;
 if existing<>0 then raise exception 'partial passage group forbidden'; end if;
 if (select count(*) from public.question_factory_jobs where passage_group_id=gid)<>n then raise exception 'passage jobs incomplete'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_rows))<>n then raise exception 'duplicate passage children'; end if;
 insert into public.passage_groups(id,subject,chapter,passage_text,title,passage_type,status,discoverable,source)
 values(gid,p_group->>'subject',p_group->>'chapter',p_group->>'passage_text',p_group->>'title',p_group->>'passage_type','live',true,p_group->>'source');
 perform set_config('mockmob.factory_group',gid,true);
 for i in 0..n-1 loop
   if p_rows->i->>'passage_group_id' is distinct from gid or p_rows->i->>'passage_text' is distinct from p_group->>'passage_text'
     or p_rows->i->>'subject' is distinct from p_group->>'subject' or p_rows->i->>'chapter' is distinct from p_group->>'chapter'
     or not exists(select 1 from public.question_factory_jobs where id=p_jobs->>i and passage_group_id=gid) then raise exception 'passage child mismatch'; end if;
   perform public.publish_factory_question(p_rows->i,p_fingerprints->>i,p_jobs->>i);
 end loop;
 perform set_config('mockmob.factory_group','',true);
 return gid;
end $$;
revoke all on function public.publish_factory_passage_group(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_factory_passage_group(jsonb,jsonb,jsonb,jsonb) to service_role;

create function public.apply_factory_screening(p_question text,p_expected jsonb,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare q public.questions; resolved_passage text;
begin
 select * into q from public.questions where id=p_question for update;
 if not found then raise exception 'screen snapshot stale'; end if;
 resolved_passage=q.passage_text;
 if coalesce(resolved_passage,'')='' and q.passage_group_id is not null then
   select passage_text into resolved_passage from public.passage_groups where id=q.passage_group_id for share;
 end if;
 if q.body is distinct from p_expected->>'body' or q.options is distinct from nullif(p_expected->'options','null'::jsonb)
    or q.correct_answer is distinct from p_expected->>'correct_answer' or q.explanation is distinct from p_expected->>'explanation'
    or q.subject is distinct from p_expected->>'subject' or q.chapter is distinct from p_expected->>'chapter'
    or q.family_id is distinct from p_expected->>'family_id' or resolved_passage is distinct from p_expected->>'passage_text'
    or q.verification_state is distinct from p_expected->>'verification_state' or q.status is distinct from p_expected->>'status'
    or q.concept_id is distinct from p_expected->>'concept_id' then raise exception 'screen snapshot stale'; end if;
 if q.evidence is not null or q.provenance is not null then raise exception 'evidence managed screening forbidden'; end if;
 if p_receipt->>'question_id' is distinct from p_question or p_receipt->>'review_version' is distinct from 'subscription-screen-v1'
    or coalesce(p_receipt->>'verdict','') not in ('no_issue_found','suspect','incomplete') then raise exception 'invalid screening receipt'; end if;
 update public.questions set legacy_screening=p_receipt where id=p_question;
 return true;
end $$;
revoke all on function public.apply_factory_screening(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_factory_screening(text,jsonb,jsonb) to service_role;
