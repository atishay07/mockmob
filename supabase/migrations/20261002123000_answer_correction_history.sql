-- Derived corrections never overwrite an original scored attempt/snapshot.
create table public.attempt_recalculation_queue (
 attempt_id text not null references public.attempts(id),question_id text not null,
 question_version bigint not null references public.question_version_history(id),state text not null default 'awaiting_revalidation',
 created_at timestamptz not null default now(),primary key(attempt_id,question_id,question_version)
);
create table public.attempt_score_revisions (
 id bigint generated always as identity primary key,attempt_id text not null references public.attempts(id),
 question_version bigint not null references public.question_version_history(id),result jsonb not null,
 evidence_state text not null,created_at timestamptz not null default now(),unique(attempt_id,question_version)
);
alter table public.attempt_recalculation_queue enable row level security;
alter table public.attempt_score_revisions enable row level security;
revoke all on public.attempt_recalculation_queue,public.attempt_score_revisions from public,anon,authenticated;
grant select,insert,update on public.attempt_recalculation_queue to service_role;
grant select,insert on public.attempt_score_revisions to service_role;
grant usage,select on sequence public.attempt_score_revisions_id_seq to service_role;
create function public.archive_answer_change() returns trigger language plpgsql security definer set search_path='' as $$
declare version_id bigint;
begin
 if old.body is distinct from new.body or old.options is distinct from new.options or old.correct_answer is distinct from new.correct_answer
 or old.explanation is distinct from new.explanation or to_jsonb(old)->'correct_index' is distinct from to_jsonb(new)->'correct_index' then
   insert into public.question_version_history(question_id,previous_row,reason) values(old.id,to_jsonb(old),'answer-bearing change; revalidation required') returning id into version_id;
   insert into public.attempt_recalculation_queue(attempt_id,question_id,question_version)
   select a.id,old.id,version_id from public.attempts a where exists(select 1 from jsonb_array_elements(a.questions_snapshot) q where q->>'id'=old.id);
 end if;
 return new;
end $$;
revoke all on function public.archive_answer_change() from public,anon,authenticated;
create trigger archive_answer_version before update on public.questions for each row execute function public.archive_answer_change();
