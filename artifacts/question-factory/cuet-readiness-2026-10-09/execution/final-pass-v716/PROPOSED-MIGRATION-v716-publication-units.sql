-- PROPOSED ONLY (not in supabase/migrations; not applied anywhere). Requires owner approval and a staging dry run.
-- Server-side equivalent of scripts/pipeline/lib/publicationStoreV716Local.mjs writeAtomic/readReceipt:
-- one transaction per publication unit (a single question or a complete passage group), an inventory/holds
-- precondition, and an idempotent receipt so a crashed client recovers receipt-only.
create table if not exists public.question_publication_units_v716 (
  unit_key text primary key,
  content_hash text not null,
  payload_hash text not null,
  question_ids text[] not null,
  group_id text,
  receipt jsonb not null,
  committed_at timestamptz not null default now()
);
alter table public.question_publication_units_v716 enable row level security;
revoke all on public.question_publication_units_v716 from public, anon, authenticated;
grant all on public.question_publication_units_v716 to service_role;

-- Inventory version: identical inputs produce identical versions; any live-row, dispute or family-hold change alters it.
create or replace function public.v716_inventory_version() returns text language sql stable security invoker set search_path='' as $$
  select md5(coalesce((select string_agg(id::text||':'||coalesce(verification_state,'')||':'||coalesce(status,'')||':'||is_deleted::text, ',' order by id) from public.questions),'')
    ||'|'||coalesce((select string_agg(family_id, ',' order by family_id) from public.recovery_family_holds),'')
    ||'|'||coalesce((select string_agg(id||':'||state, ',' order by id) from public.question_content_disputes),''));
$$;

create or replace function public.publish_v716_unit(p_unit jsonb, p_rows jsonb, p_group jsonb, p_inventory_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; n integer; i integer; cols text; receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('publish_v716_unit'));
  select u.receipt into existing from public.question_publication_units_v716 u where u.unit_key = p_unit->>'unit_key';
  if existing is not null then return existing; end if;                       -- idempotent: committed unit returns its receipt
  if p_inventory_version is distinct from public.v716_inventory_version() then raise exception 'v716_publication_precondition_changed'; end if;
  n = jsonb_array_length(p_rows);
  if n < 1 or (p_group is null and n <> 1) or (p_group is not null and n < 2) then raise exception 'v716_atomic_unit_shape_invalid'; end if;
  if exists(select 1 from public.recovery_family_holds h where h.family_id in (select r->>'family_id' from jsonb_array_elements(p_rows) r)) then raise exception 'v716_family_hold_changed'; end if;
  if exists(select 1 from public.questions q where q.id::text in (select r->>'id' from jsonb_array_elements(p_rows) r)) then raise exception 'v716_question_id_already_present'; end if;
  for i in 0..n-1 loop
    if p_rows->i->'evidence'->'record'->>'verifier_version' is distinct from 'cuet-fit-validator-v7.16-report-policy'
       or p_rows->i->'evidence'->'record'->>'state' is distinct from 'published' or p_rows->i->'evidence'->>'signature' is null
       or p_rows->i->>'status' is distinct from 'live' or p_rows->i->>'verification_state' is distinct from 'verified' then raise exception 'v716_signed_published_row_required'; end if;
    if p_group is not null and (p_rows->i->>'passage_group_id' is distinct from p_group->>'id' or p_rows->i->>'passage_text' is distinct from p_group->>'passage_text') then raise exception 'v716_complete_passage_group_required'; end if;
  end loop;
  if p_group is not null then
    insert into public.passage_groups(id,subject,chapter,passage_text,title,passage_type,status,discoverable,source,difficulty,mode_visibility)
    values(p_group->>'id',p_group->>'subject',p_group->>'chapter',p_group->>'passage_text',p_group->>'title',p_group->>'passage_type','live',true,p_group->>'source',
           p_group->>'difficulty',array(select jsonb_array_elements_text(p_group->'mode_visibility')));
  end if;
  for i in 0..n-1 loop
    select string_agg(format('%I',key),',') into cols from jsonb_object_keys(p_rows->i) key;
    execute format('insert into public.questions (%s) select %s from jsonb_populate_record(null::public.questions,$1)',cols,cols) using p_rows->i;
  end loop;
  receipt = jsonb_build_object('committed',true,'unit_key',p_unit->>'unit_key','content_hash',p_unit->>'content_hash','payload_hash',p_unit->>'payload_hash',
    'question_ids',(select jsonb_agg(r->>'id') from jsonb_array_elements(p_rows) r),'group_id',p_group->>'id','committed_at',now());
  insert into public.question_publication_units_v716(unit_key,content_hash,payload_hash,question_ids,group_id,receipt)
  values(p_unit->>'unit_key',p_unit->>'content_hash',p_unit->>'payload_hash',array(select r->>'id' from jsonb_array_elements(p_rows) r),p_group->>'id',receipt);
  return receipt;
end $$;
revoke all on function public.publish_v716_unit(jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.publish_v716_unit(jsonb,jsonb,jsonb,text) to service_role;

-- Receipt-only recovery: absence is definitive under the same advisory lock (no concurrent writer can be mid-unit).
create or replace function public.read_v716_unit_receipt(p_unit_key text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('publish_v716_unit'));
  select u.receipt into r from public.question_publication_units_v716 u where u.unit_key = p_unit_key;
  return coalesce(r, jsonb_build_object('committed',false,'unit_key',p_unit_key,'definitive_absent',true));
end $$;
revoke all on function public.read_v716_unit_receipt(text) from public, anon, authenticated;
grant execute on function public.read_v716_unit_receipt(text) to service_role;
-- Notes for review: questions.id is UUID in 0005 but factory job ids are text; confirm the deployed column type before any
-- staging dry run. The existing record_question_dispute RPC already withholds disputed rows; V716 retrieval re-derives the
-- signed decision and treats status/verification_state/open disputes as invalidating, so no read-path change is needed for safety.
