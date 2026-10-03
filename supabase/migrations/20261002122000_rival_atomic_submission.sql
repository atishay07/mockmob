-- Requires the existing rival tables. Save/apply separately after schema dry run.
create function public.submit_rival_battle(p_id uuid,p_user text,p_answers jsonb,p_update jsonb,p_response jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b record;a jsonb;
begin
 select * into b from public.rival_battles where id=p_id and user_id=p_user for update;
 if not found then raise exception 'battle not found'; end if;
 if b.status='submitted' then
   if b.metadata->'submittedAnswers' is distinct from p_answers then raise exception 'submission conflict'; end if;
   return b.metadata->'submissionResponse';
 end if;
 if (select count(*) from jsonb_array_elements(p_answers))<>(select count(distinct value->>'question_id') from jsonb_array_elements(p_answers)) then raise exception 'duplicate question ids'; end if;
 for a in select value from jsonb_array_elements(p_answers) loop
   insert into public.rival_battle_answers(battle_id,user_id,question_id,selected_answer,is_correct,time_spent_seconds)
   values(p_id,p_user,a->>'question_id',(a->>'selected_answer')::int,(a->>'is_correct')::boolean,(a->>'time_spent_seconds')::numeric);
 end loop;
 update public.rival_battles set status='submitted',user_score=(p_update->>'user_score')::int,
 user_accuracy=(p_update->>'user_accuracy')::numeric,user_time_seconds=(p_update->>'user_time_seconds')::numeric,
 result=p_update->>'result',submitted_at=now(),metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object('shareCard',p_response->'shareCard','nextMoveHint',p_response->'nextMoveHint','submittedAnswers',p_answers,'submissionResponse',p_response)
 where id=p_id;
 return p_response;
end $$;
revoke all on function public.submit_rival_battle(uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_rival_battle(uuid,text,jsonb,jsonb,jsonb) to service_role;
