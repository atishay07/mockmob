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
