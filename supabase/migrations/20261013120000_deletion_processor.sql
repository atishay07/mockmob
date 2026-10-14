-- MockMob: account deletion processor (Google Play requires deletion requests to be fulfilled).
-- NOT APPLIED to any remote database. Save, review and run on staging first.
-- Additive and idempotent. Service-role only.
--
-- One function does the whole per-user job in a single transaction (a plpgsql function body is
-- atomic, so any error rolls every earlier step back). The step list is data, built and owned by
-- src/lib/server/accountDeletion.js, so the plan the operator reviews in dry run and the rows
-- changed on apply come from the same code path.
--
-- Step shape: {table, action: delete|anonymise|keep, match: [{column} | {column, parent_table,
--   parent_key, parent_user}], set: [{column, value}]}
--   match with parent_*: the row belongs to the user through a parent row (attempt_id -> attempts).
--   set values: 'null' (null if nullable, else the column default), 'default', 'now',
--   'tombstone_email', 'tombstone_username', 'tombstone_id', {literal: text}, {json: text},
--   {scrub_json: [keys]} (keep only those keys of a jsonb column).
-- Tables or columns that do not exist are reported as absent and skipped (older databases).
-- Safety net: any other public table with a user_id column that still holds rows for the user
-- makes the apply raise 'unclassified_user_data', so new tables fail closed until classified.

alter table public.users add column if not exists deleted_at timestamptz;

create or replace function public.account_deletion_run(
  p_request_id bigint,
  p_user_id text,
  p_steps jsonb,
  p_apply boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_req public.account_deletion_requests%rowtype;
  v_step jsonb;
  v_item jsonb;
  v_tbl text;
  v_action text;
  v_where text[];
  v_cond text;
  v_sets text[];
  v_skipped text[];
  v_col text;
  v_val jsonb;
  v_dtype text;
  v_nullable text;
  v_default text;
  v_present boolean;
  v_rows bigint;
  v_results jsonb := '[]'::jsonb;
  v_known text[] := array['account_deletion_requests'];
  v_unclassified jsonb := '[]'::jsonb;
  v_t record;
  v_n bigint;
  v_lhs text;
begin
  if p_user_id is null or length(p_user_id) = 0 then raise exception 'user_id_required'; end if;
  if jsonb_typeof(p_steps) is distinct from 'array' then raise exception 'steps_must_be_array'; end if;

  if p_apply then
    select * into v_req from public.account_deletion_requests where id = p_request_id and user_id = p_user_id for update;
  else
    select * into v_req from public.account_deletion_requests where id = p_request_id and user_id = p_user_id;
  end if;
  if not found then raise exception 'deletion_request_not_found'; end if;
  if v_req.status <> 'pending' then raise exception 'deletion_request_not_pending'; end if;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_known := v_known || (v_step->>'table');
  end loop;

  -- Fail closed: user rows in a table nobody classified.
  for v_t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
       and c.table_name <> all (v_known)
     order by c.table_name
  loop
    execute format('select count(*) from public.%I where user_id::text = $1', v_t.table_name) into v_n using p_user_id;
    if v_n > 0 then
      v_unclassified := v_unclassified || jsonb_build_object('table', v_t.table_name, 'rows', v_n);
    end if;
  end loop;
  if p_apply and jsonb_array_length(v_unclassified) > 0 then
    raise exception 'unclassified_user_data: %', (select string_agg(e->>'table', ',') from jsonb_array_elements(v_unclassified) e);
  end if;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    v_tbl := v_step->>'table';
    v_action := v_step->>'action';
    if v_action not in ('delete', 'anonymise', 'keep') then raise exception 'bad_action: %', v_action; end if;
    v_present := to_regclass(format('public.%I', v_tbl)) is not null;
    v_where := '{}';
    v_skipped := '{}';
    v_rows := 0;

    if v_present then
      for v_item in select * from jsonb_array_elements(v_step->'match') loop
        v_col := v_item->>'column';
        if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tbl and column_name = v_col) then
          continue;
        end if;
        select data_type into v_dtype from information_schema.columns where table_schema = 'public' and table_name = v_tbl and column_name = v_col;
        v_lhs := case when v_dtype = 'text' then format('%I', v_col) else format('%I::text', v_col) end;
        if v_item ? 'parent_table' then
          if to_regclass(format('public.%I', v_item->>'parent_table')) is null then continue; end if;
          if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_item->>'parent_table' and column_name = v_item->>'parent_user') then continue; end if;
          v_where := v_where || format('%s in (select %I::text from public.%I where %I::text = $1)',
            v_lhs, v_item->>'parent_key', v_item->>'parent_table', v_item->>'parent_user');
        else
          v_where := v_where || format('%s = $1', v_lhs);
        end if;
      end loop;
      if coalesce(array_length(v_where, 1), 0) = 0 then v_present := false; end if;
    end if;

    if v_present then
      v_cond := array_to_string(v_where, ' or ');
      execute format('select count(*) from public.%I where %s', v_tbl, v_cond) into v_rows using p_user_id;

      if p_apply and v_rows > 0 and v_action = 'delete' then
        execute format('delete from public.%I where %s', v_tbl, v_cond) using p_user_id;
      elsif v_action = 'anonymise' and (v_rows > 0 or not p_apply) then
        v_sets := '{}';
        for v_item in select * from jsonb_array_elements(coalesce(v_step->'set', '[]'::jsonb)) loop
          v_col := v_item->>'column';
          v_val := v_item->'value';
          select data_type, is_nullable, column_default into v_dtype, v_nullable, v_default
            from information_schema.columns where table_schema = 'public' and table_name = v_tbl and column_name = v_col;
          if not found then continue; end if;
          if v_val = '"null"'::jsonb then
            if v_nullable = 'YES' then v_sets := v_sets || format('%I = null', v_col);
            elsif v_default is not null then v_sets := v_sets || format('%I = default', v_col);
            else v_skipped := v_skipped || v_col; end if;
          elsif v_val = '"default"'::jsonb then
            if v_nullable = 'YES' or v_default is not null then v_sets := v_sets || format('%I = default', v_col);
            else v_skipped := v_skipped || v_col; end if;
          elsif v_val = '"now"'::jsonb then v_sets := v_sets || format('%I = now()', v_col);
          elsif v_val = '"tombstone_email"'::jsonb then v_sets := v_sets || format('%I = %L || md5($1) || %L', v_col, 'deleted+', '@deleted.invalid');
          elsif v_val = '"tombstone_username"'::jsonb then v_sets := v_sets || format('%I = %L || left(md5($1), 12)', v_col, 'deleted_');
          elsif v_val = '"tombstone_id"'::jsonb then v_sets := v_sets || format('%I = %L || md5($1)', v_col, 'deleted:');
          elsif jsonb_typeof(v_val) = 'object' and v_val ? 'literal' then v_sets := v_sets || format('%I = %L', v_col, v_val->>'literal');
          elsif jsonb_typeof(v_val) = 'object' and v_val ? 'json' then v_sets := v_sets || format('%I = %L::jsonb', v_col, v_val->>'json');
          elsif jsonb_typeof(v_val) = 'object' and v_val ? 'scrub_json' then
            if v_dtype <> 'jsonb' then v_skipped := v_skipped || v_col;
            else
              v_sets := v_sets || format(
                '%1$I = (select coalesce(jsonb_object_agg(k, v), %3$L::jsonb) from jsonb_each(coalesce(%1$I, %3$L::jsonb)) as t(k, v) where k = any(%2$L::text[]))',
                v_col, (select array_agg(x) from jsonb_array_elements_text(v_val->'scrub_json') x), '{}');
            end if;
          else raise exception 'bad_set_value for %.%', v_tbl, v_col;
          end if;
        end loop;
        if p_apply and coalesce(array_length(v_sets, 1), 0) > 0 then
          execute format('update public.%I set %s where %s', v_tbl, array_to_string(v_sets, ', '), v_cond) using p_user_id;
        end if;
      end if;
    end if;

    v_results := v_results || jsonb_build_object(
      'table', v_tbl, 'action', v_action, 'rows', v_rows, 'present', v_present,
      'skippedColumns', to_jsonb(v_skipped));
  end loop;

  if p_apply then
    update public.account_deletion_requests set status = 'completed', completed_at = now() where id = p_request_id;
  end if;

  return jsonb_build_object('requestId', p_request_id, 'userId', p_user_id, 'applied', p_apply,
    'steps', v_results, 'unclassified', v_unclassified);
end $$;

revoke all on function public.account_deletion_run(bigint, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.account_deletion_run(bigint, text, jsonb, boolean) to service_role;
