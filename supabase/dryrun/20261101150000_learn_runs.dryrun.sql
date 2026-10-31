-- DRY RUN of supabase/migrations/20261101150000_learn_runs.sql on production. It applies the migration inside ONE
-- transaction, checks every object and grant, then ROLLS BACK: nothing persists. Paste the whole file into the Supabase SQL
-- editor of project isrxrxzjocewrdureyhp and run it once. Success looks like the notice "dry run ok" and then a rollback.
-- Read-only pre-checks run on 1 Nov 2026 at 4:20 am IST matched the migration: the flow_context check has the four old
-- values, ids are text, learn_runs and learn_run_events do not exist, learning_allowances and learning_question_exposure
-- exist with the expected columns, key_card_states.added_from allows 'manual', and there are 0 learn_session rows.
begin;
-- SAVED ONLY, never applied by an agent. The owner applies it after the rolled-back production dry run (auto mode blocks
-- production writes), and only after the code with DELETION_STEPS listing both tables is deployed.
--
-- Learn v2 runs and the Explore chapter feed (docs/brain/learn-1031/BUILD-1101.md Part 2 and 2.1; the draft is
-- docs/brain/learn-1031/audit-1101/A6-wiring.md section 7.1). Two new tables, two functions and one widened check.
-- No existing row changes.
--   learn_runs           one composed run or feed: its items (ids only, never an answer key), counters and state
--   learn_run_events     one row per finished item; the primary key (run_id, item_id) is the idempotency lock
--   learn_start_run()    the run row and the question exposure rows in one transaction; a replayed request_key is the
--                        same run. It claims NOTHING (BUILD-1101 1.6: Free's day is claimed at the first answered question)
--   learn_record_event() one item's outcome in one transaction: Free's daily Learn session claim (p_quota, answers only),
--                        the re-inserted or moved card, the event, the progress upsert, the interaction row
--                        (flow_context 'learn') and the counters
--   question_interactions.flow_context also accepts 'learn' (server-only: the generic interact route still refuses it)
-- Security: RLS on with no policy (service role only); both functions SECURITY DEFINER with an empty search_path and
-- execute for service_role only.
-- Idempotent: tables and indexes "if not exists", functions "create or replace", the check dropped by its definition and
-- added again, so a second apply changes nothing.
-- Dry runs: data/tests/learn_db.test.mjs (PGlite), then a rolled-back production dry run (A6 7.3).
-- Mirror: src/lib/server/keycardsMemoryDb.js runs both functions statement for statement for the tests and the preview.
-- Undo: supabase/undo/20261101150000_learn_runs.undo.sql

create table if not exists public.learn_runs (
  id text primary key check (char_length(id) between 1 and 60),
  user_id text not null references public.users (id) on delete cascade,
  request_key text not null check (char_length(request_key) between 8 and 100),
  kind text not null check (kind in ('mix', 'cards', 'recap', 'feed', 'level')),
  subject text not null,
  chapter_key text,
  asked_minutes smallint not null check (asked_minutes between 0 and 240),
  minutes smallint not null check (minutes between 0 and 240),
  leave_out text[] not null default '{}',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  item_count smallint not null default 0,
  done_count smallint not null default 0,
  seconds_left integer not null default 0,
  reinserted text[] not null default '{}',
  extra smallint not null default 0,
  start_state jsonb,
  added jsonb,
  looks jsonb,
  limit_line text check (limit_line is null or char_length(limit_line) <= 300),
  session_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (user_id, request_key)
);
create index if not exists learn_runs_owner_recent on public.learn_runs (user_id, created_at desc);
create index if not exists learn_runs_open on public.learn_runs (user_id, created_at desc) where ended_at is null;

create table if not exists public.learn_run_events (
  run_id text not null references public.learn_runs (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 120),
  user_id text not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('answer', 'rate', 'look', 'recap', 'keep', 'lesson')),
  question_id text,
  card_id text,
  choice text check (choice is null or char_length(choice) <= 2),
  correct boolean,
  fixed boolean,
  origin text check (origin is null or origin in ('mistake', 'linked', 'chapter')),
  rating smallint check (rating is null or rating in (1, 3, 4)),
  due_at timestamptz,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, item_id)
);
create index if not exists learn_run_events_question on public.learn_run_events (user_id, question_id, created_at desc)
  where question_id is not null;

alter table public.learn_runs enable row level security;
alter table public.learn_run_events enable row level security;
revoke all on public.learn_runs, public.learn_run_events from public, anon, authenticated;
grant all on public.learn_runs, public.learn_run_events to service_role;

-- learn_start_run(p_row, p_question_ids) returns { status: 'ok' | 'replay' | 'key_conflict', id }.
-- p_row: { id, user_id, request_key, kind, subject, chapter_key?, asked_minutes?, minutes, leave_out?, items,
--          seconds_left? | seconds?, start_state?, added?, looks?, created_at? }
--   seconds_left defaults to `seconds`, then to the sum of the items' `seconds`; asked_minutes defaults to minutes;
--   created_at (optional) lets the service's clock stamp the row, otherwise now().
-- p_question_ids: the run's question ids, written to learning_question_exposure (a later recovery check never reuses them).
-- Claims nothing: Free's daily Learn session is claimed by learn_record_event at the first answered question.
create or replace function public.learn_start_run(p_row jsonb, p_question_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user text := p_row->>'user_id';
  v_run public.learn_runs%rowtype;
  v_items jsonb := p_row->'items';
begin
  if v_user is null or coalesce(p_row->>'id', '') = '' or coalesce(p_row->>'request_key', '') = ''
     or v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'learn_start_run: bad input';
  end if;
  -- The same request key again is the same run; the same key for another chapter or kind is a client bug.
  select * into v_run from public.learn_runs r where r.user_id = v_user and r.request_key = p_row->>'request_key';
  if found then
    if v_run.kind is distinct from p_row->>'kind' or v_run.chapter_key is distinct from p_row->>'chapter_key' then
      return jsonb_build_object('status', 'key_conflict', 'id', v_run.id);
    end if;
    return jsonb_build_object('status', 'replay', 'id', v_run.id);
  end if;
  insert into public.learn_runs (id, user_id, request_key, kind, subject, chapter_key, asked_minutes, minutes, leave_out,
      items, item_count, seconds_left, start_state, added, looks, created_at, updated_at)
    values (p_row->>'id', v_user, p_row->>'request_key', p_row->>'kind', p_row->>'subject', p_row->>'chapter_key',
      coalesce(p_row->>'asked_minutes', p_row->>'minutes')::smallint, (p_row->>'minutes')::smallint,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_row->'leave_out', '[]'::jsonb))), '{}'::text[]),
      v_items, jsonb_array_length(v_items),
      coalesce((p_row->>'seconds_left')::int, (p_row->>'seconds')::int,
        (select sum(coalesce((x->>'seconds')::int, 0))::int from jsonb_array_elements(v_items) as x), 0),
      p_row->'start_state', p_row->'added', p_row->'looks',
      coalesce((p_row->>'created_at')::timestamptz, now()), coalesce((p_row->>'created_at')::timestamptz, now()))
    on conflict (user_id, request_key) do nothing;
  if not found then
    -- A concurrent start with the same key won the insert: this one is its replay.
    select * into v_run from public.learn_runs r where r.user_id = v_user and r.request_key = p_row->>'request_key';
    if v_run.kind is distinct from p_row->>'kind' or v_run.chapter_key is distinct from p_row->>'chapter_key' then
      return jsonb_build_object('status', 'key_conflict', 'id', v_run.id);
    end if;
    return jsonb_build_object('status', 'replay', 'id', v_run.id);
  end if;
  insert into public.learning_question_exposure (user_id, question_id, reference)
    select distinct v_user, q, p_row->>'id' from unnest(coalesce(p_question_ids, '{}'::text[])) as q
    where coalesce(q, '') <> ''
    on conflict do nothing;
  return jsonb_build_object('status', 'ok', 'id', p_row->>'id');
end;
$$;

-- learn_record_event(...) returns
--   { status: 'ok' | 'replay' | 'not_found' | 'no_item' | 'used', body?, reinsert?: { item_id, at, moved? },
--     revise_pile?, reference?, claimed? }.
-- p_event: { kind, question_id?, card_id?, choice?, correct?, fixed?, origin?, rating?, due_at?, seconds?, body? }
-- p_progress: null | { question_id, subject, chapter, selected_key, correct }
-- p_interaction: null | { question_id, metadata }
-- p_reinsert: null | { card_id, gap?, seconds?, unless_rated_well?, item?, move_item? }
--   Once per card per run (learn_runs.reinserted), and, with unless_rated_well, never after the card was rated 3 or 4 in
--   this run. move_item (A5 R7): the id of the card's own item still ahead of this one; when it sits more than `gap`
--   after this item it is moved to this item + gap, when it is closer it stays, and nothing is copied. Without move_item
--   (or when that item is not ahead any more) `item` is inserted as a copy at this item + gap, id `<run id>-r<n>`.
-- p_limit_line: null | the Free limit line that turns the rest of the run into looks (kept once set).
-- p_quota: null | { kind: 'learn_session', day: 'YYYY-MM-DD', limit: 1 }, sent only for Free, a counted kind and an
--   answer event. A slot of that day already referencing this run goes on; else the first free slot
--   (p_user, kind, day || ':' || slot, p_run) is taken; when none can be taken the answer is
--   { status: 'used', reference: <the run holding it> } and nothing is written. A claim sets learn_runs.session_claimed
--   and answers claimed: true.
-- Order: lock the run, the replay probe, the item, the quota, then the re-insert, the event, progress, interaction and
-- counters. A replay never claims and never counts twice.
create or replace function public.learn_record_event(p_user text, p_run text, p_item text, p_event jsonb, p_progress jsonb,
  p_interaction jsonb, p_reinsert jsonb, p_limit_line text, p_quota jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.learn_runs%rowtype;
  v_body jsonb;
  v_at int;
  v_len int;
  v_gap int;
  v_pos int;
  v_from int;
  v_id text;
  v_reinsert jsonb := null;
  v_ref text;
  v_slot int;
  v_claimed boolean := false;
  v_kind text;
  v_day text;
begin
  select * into v_run from public.learn_runs r where r.id = p_run and r.user_id = p_user for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select e.body into v_body from public.learn_run_events e where e.run_id = p_run and e.item_id = p_item;
  if found then return jsonb_build_object('status', 'replay', 'body', v_body); end if;
  select (x.ord - 1)::int into v_at from jsonb_array_elements(v_run.items) with ordinality as x(item, ord)
    where x.item->>'id' = p_item;
  if v_at is null then return jsonb_build_object('status', 'no_item'); end if;

  -- Free's one Learn session a day: claimed by the first answered question, in this transaction, before anything is written.
  if p_quota is not null then
    v_kind := p_quota->>'kind';
    v_day := p_quota->>'day';
    if v_kind is null or v_day is null then raise exception 'learn_record_event: bad quota'; end if;
    if not exists (select 1 from public.learning_allowances a
        where a.user_id = p_user and a.kind = v_kind and a.period like v_day || ':%' and a.reference = p_run) then
      for v_slot in 1 .. greatest(coalesce((p_quota->>'limit')::int, 0), 0) loop
        insert into public.learning_allowances (user_id, kind, period, reference)
          values (p_user, v_kind, v_day || ':' || v_slot, p_run)
          on conflict do nothing;
        if found then v_claimed := true; exit; end if;
      end loop;
      if not v_claimed then
        select a.reference into v_ref from public.learning_allowances a
          where a.user_id = p_user and a.kind = v_kind and a.period like v_day || ':%'
          order by a.period limit 1;
        return jsonb_build_object('status', 'used', 'reference', v_ref);
      end if;
      update public.learn_runs set session_claimed = true where id = p_run;
    end if;
  end if;

  if p_reinsert is not null
     and not ((p_reinsert->>'card_id') = any (v_run.reinserted))
     and not (coalesce((p_reinsert->>'unless_rated_well')::boolean, false) and exists (
       select 1 from public.learn_run_events e
       where e.run_id = p_run and e.card_id = p_reinsert->>'card_id' and e.kind = 'rate' and e.rating in (3, 4))) then
    v_len := jsonb_array_length(v_run.items);
    v_gap := greatest(coalesce((p_reinsert->>'gap')::int, 3), 1);
    v_from := null;
    if p_reinsert->>'move_item' is not null then
      select (x.ord - 1)::int into v_from from jsonb_array_elements(v_run.items) with ordinality as x(item, ord)
        where x.item->>'id' = p_reinsert->>'move_item' and x.ord - 1 > v_at;
    end if;
    if v_from is not null then
      -- The card is still ahead: move it closer, never copy it (A5 R7).
      v_pos := least(v_from, v_at + v_gap);
      if v_from > v_pos then
        update public.learn_runs set
          items = jsonb_insert(items - v_from, array[v_pos::text], items->v_from, false)
          where id = p_run;
      end if;
      update public.learn_runs set reinserted = array_append(reinserted, p_reinsert->>'card_id') where id = p_run;
      v_reinsert := jsonb_build_object('item_id', p_reinsert->>'move_item', 'at', v_pos, 'moved', true);
    elsif p_reinsert->'item' is not null and jsonb_typeof(p_reinsert->'item') = 'object' then
      v_pos := least(v_len, v_at + v_gap);
      v_id := v_run.id || '-r' || (v_run.extra + 1);
      v_reinsert := jsonb_build_object('item_id', v_id, 'at', v_pos);
      update public.learn_runs set
        items = jsonb_insert(items, array[v_pos::text], (p_reinsert->'item') || jsonb_build_object('id', v_id), false),
        extra = extra + 1,
        reinserted = array_append(reinserted, p_reinsert->>'card_id'),
        item_count = item_count + 1,
        seconds_left = seconds_left + coalesce((p_reinsert->>'seconds')::int, (p_reinsert->'item'->>'seconds')::int, 0)
        where id = p_run;
    end if;
  end if;

  v_body := coalesce(p_event->'body', '{}'::jsonb)
    || case when v_reinsert is null then '{}'::jsonb else jsonb_build_object('reinsert', v_reinsert) end;
  insert into public.learn_run_events (run_id, item_id, user_id, kind, question_id, card_id, choice, correct, fixed, origin,
      rating, due_at, body)
    values (p_run, p_item, p_user, p_event->>'kind', p_event->>'question_id', p_event->>'card_id', p_event->>'choice',
      (p_event->>'correct')::boolean, (p_event->>'fixed')::boolean, p_event->>'origin', (p_event->>'rating')::smallint,
      (p_event->>'due_at')::timestamptz, v_body);

  if p_progress is not null then
    insert into public.user_question_progress as g (user_id, question_id, subject, chapter, seen_count, attempt_count,
        correct_count, skip_count, last_selected_key, last_correct, last_seen_at, last_attempted_at, updated_at)
      values (p_user, p_progress->>'question_id', p_progress->>'subject', p_progress->>'chapter', 1, 1,
        case when (p_progress->>'correct')::boolean then 1 else 0 end, 0, p_progress->>'selected_key',
        (p_progress->>'correct')::boolean, now(), now(), now())
      on conflict (user_id, question_id) do update set
        seen_count = g.seen_count + 1, attempt_count = g.attempt_count + 1, correct_count = g.correct_count + excluded.correct_count,
        last_selected_key = excluded.last_selected_key, last_correct = excluded.last_correct,
        last_seen_at = now(), last_attempted_at = now(), updated_at = now();
  end if;
  if p_interaction is not null then
    insert into public.question_interactions (question_id, user_id, interaction_type, session_id, flow_context, metadata)
      values (p_interaction->>'question_id', p_user, 'attempted', p_run, 'learn', coalesce(p_interaction->'metadata', '{}'::jsonb));
  end if;
  update public.learn_runs set
    done_count = done_count + 1,
    seconds_left = greatest(0, seconds_left - coalesce((p_event->>'seconds')::int, 0)),
    limit_line = coalesce(p_limit_line, limit_line),
    updated_at = now()
    where id = p_run;
  return jsonb_build_object('status', 'ok', 'body', v_body, 'reinsert', v_reinsert, 'claimed', v_claimed,
    'revise_pile', (select count(distinct e.card_id) from public.learn_run_events e
      where e.run_id = p_run and e.kind = 'rate' and e.rating in (3, 4)));
end;
$$;

revoke all on function public.learn_start_run(jsonb, text[]) from public, anon, authenticated;
grant execute on function public.learn_start_run(jsonb, text[]) to service_role;
revoke all on function public.learn_record_event(text, text, text, jsonb, jsonb, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.learn_record_event(text, text, text, jsonb, jsonb, jsonb, jsonb, text, jsonb) to service_role;

-- flow_context gains 'learn'. The repo holds two definitions of the old check (0007 chk_qi_flow_context, 0010 the inline
-- question_interactions_flow_context_check), so drop whichever exists by its definition. NOT VALID then VALIDATE: the scan
-- of an append-only table runs under SHARE UPDATE EXCLUSIVE, so writes go on; every existing row already passes.
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.question_interactions'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%flow_context%'
  loop
    execute format('alter table public.question_interactions drop constraint %I', c.conname);
  end loop;
end
$$;
alter table public.question_interactions add constraint question_interactions_flow_context_check
  check (flow_context is null or flow_context in ('mock', 'review', 'explore', 'shadow', 'learn')) not valid;
alter table public.question_interactions validate constraint question_interactions_flow_context_check;

do $$
declare
  v_def text;
begin
  if to_regclass('public.learn_runs') is null or to_regclass('public.learn_run_events') is null then
    raise exception 'dry run: a Learn table is missing';
  end if;
  if not exists (select 1 from pg_proc where proname = 'learn_start_run' and prosecdef) then
    raise exception 'dry run: learn_start_run missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc where proname = 'learn_record_event' and prosecdef) then
    raise exception 'dry run: learn_record_event missing or not security definer';
  end if;
  if has_function_privilege('anon', 'public.learn_record_event(text, text, text, jsonb, jsonb, jsonb, jsonb, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.learn_start_run(jsonb, text[])', 'execute') then
    raise exception 'dry run: a Learn function is callable by anon or authenticated';
  end if;
  if has_table_privilege('anon', 'public.learn_runs', 'select') or has_table_privilege('authenticated', 'public.learn_run_events', 'select') then
    raise exception 'dry run: a Learn table is readable by anon or authenticated';
  end if;
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
    where c.conrelid = 'public.question_interactions'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) ilike '%flow_context%';
  if v_def is null or v_def not ilike '%learn%' or v_def not ilike '%explore%' then
    raise exception 'dry run: flow_context check is %', v_def;
  end if;
  raise notice 'dry run ok: % ', v_def;
end
$$;

rollback;
