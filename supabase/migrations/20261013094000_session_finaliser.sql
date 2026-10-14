-- B11: finalise a durable session after its deadline plus the 2 minute upload grace.
-- Service-role only. Called with a result scored by the server from acknowledged events.
-- Idempotent: an already submitted session is returned unchanged, and the attempt id equals
-- the session id, so a concurrent submit can never create a second attempt or progress row.
create or replace function public.finalise_expired_recovery_session(p_id text, p_result jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; d jsonb; q jsonb;
begin
 select * into s from public.recovery_sessions where id=p_id for update;
 if not found then raise exception 'session not found'; end if;
 if s.state='submitted' then return jsonb_build_object('id',s.id,'finalised',false); end if;
 if now()<=s.expires_at+interval '2 minutes' then raise exception 'session not expired'; end if;
 if p_result->>'expected_event_count' is null or (p_result->>'expected_event_count')::int<>jsonb_array_length(s.events) then raise exception 'event conflict'; end if;
 if exists(select 1 from public.attempts where id=s.id) then
   update public.recovery_sessions set state='submitted' where id=s.id;
   return jsonb_build_object('id',s.id,'finalised',false);
 end if;
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
 return jsonb_build_object('id',s.id,'finalised',true);
end $$;
revoke all on function public.finalise_expired_recovery_session(text,jsonb) from public,anon,authenticated;
grant execute on function public.finalise_expired_recovery_session(text,jsonb) to service_role;

-- Poison-pill guard: count a failed finalisation; at p_max failures close the session without an attempt
-- (state submitted, selection_meta.finalisedBy='unscorable') so it cannot starve newer sessions in the queue.
create or replace function public.quarantine_recovery_session(p_id text, p_reason text, p_max int)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.recovery_sessions%rowtype; n int;
begin
 select * into s from public.recovery_sessions where id=p_id for update;
 if not found or s.state<>'active' then return jsonb_build_object('id',p_id,'failures',0,'closed',false); end if;
 if now()<=s.expires_at+interval '2 minutes' then raise exception 'session not expired'; end if;
 n:=coalesce((s.selection_meta->>'finaliseFailures')::int,0)+1;
 if n>=greatest(coalesce(p_max,1),1) then
   update public.recovery_sessions set state='submitted',
     selection_meta=coalesce(selection_meta,'{}'::jsonb)||jsonb_build_object('finaliseFailures',n,'finalisedBy','unscorable','finaliseFailure',left(coalesce(p_reason,''),60))
     where id=s.id;
   return jsonb_build_object('id',s.id,'failures',n,'closed',true);
 end if;
 update public.recovery_sessions set selection_meta=coalesce(selection_meta,'{}'::jsonb)||jsonb_build_object('finaliseFailures',n,'finaliseFailure',left(coalesce(p_reason,''),60)) where id=s.id;
 return jsonb_build_object('id',s.id,'failures',n,'closed',false);
end $$;
revoke all on function public.quarantine_recovery_session(text,text,int) from public,anon,authenticated;
grant execute on function public.quarantine_recovery_session(text,text,int) to service_role;
