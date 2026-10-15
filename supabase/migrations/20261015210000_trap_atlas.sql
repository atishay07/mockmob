-- Mistake Lab slice 4: the trap atlas (data/trap_atlas.js; spec tmp/mistake-lab-v4/SPEC.md 4.7 second part, 4.11).
-- One row names the trap on one wrong option of one question. It is filled by each committed v3 Mistake Repair (the
-- repair's own trap_type, on the option the student chose) and read by every later student for free. The option is
-- identified by a hash of its normalised text (first 16 hex of sha256, data/option_hash.js), never by its position, so a
-- shuffled NTA paper and a stored-order paper find the same row. No user id is stored: the table holds counts about a
-- question's options, nothing about a student.
-- repairs_agreeing counts repairs that named this type, repairs_disagreeing those that named another; a tag shows only
-- while repairs_disagreeing is 0. `source` is 'repair' (rows written by a repair) or 'format' (reserved: the question
-- format rules are computed on read and need no row).
-- Service-role access only. NOT APPLIED to any remote database by this change. Undo: supabase/undo/20261015210000_trap_atlas.undo.sql.
create table if not exists public.trap_atlas (
  qid text not null references public.questions (id) on delete cascade,
  option_hash text not null check (option_hash ~ '^[0-9a-f]{16}$'),
  trap_type text not null check (trap_type in (
    'partly_true', 'reversed', 'look_alike_term', 'missed_not_except', 'not_in_passage', 'calculation_slip',
    'wrong_rule', 'one_step_short', 'extreme_word', 'assertion_reason_link'
  )),
  repairs_agreeing integer not null default 1 check (repairs_agreeing >= 0),
  repairs_disagreeing integer not null default 0 check (repairs_disagreeing >= 0),
  source text not null default 'repair' check (source in ('repair', 'format')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (qid, option_hash)
);
create index if not exists trap_atlas_trap_type_idx on public.trap_atlas (trap_type);

alter table public.trap_atlas enable row level security;
revoke all on public.trap_atlas from public, anon, authenticated;
grant all on public.trap_atlas to service_role;

-- One committed repair adds its trap to the atlas in one statement, so two repairs at once never lose a count.
-- The first repair names the row's trap type; a later repair that names the same type adds to repairs_agreeing, one that
-- names another type adds to repairs_disagreeing and leaves the stored type as it was.
create or replace function public.record_trap_atlas(p_qid text, p_option_hash text, p_trap_type text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.trap_atlas%rowtype;
begin
  insert into public.trap_atlas as t (qid, option_hash, trap_type)
  values (p_qid, p_option_hash, p_trap_type)
  on conflict (qid, option_hash) do update set
    repairs_agreeing = t.repairs_agreeing + case when t.trap_type = excluded.trap_type then 1 else 0 end,
    repairs_disagreeing = t.repairs_disagreeing + case when t.trap_type = excluded.trap_type then 0 else 1 end,
    updated_at = now()
  returning * into v_row;
  return jsonb_build_object(
    'qid', v_row.qid, 'option_hash', v_row.option_hash, 'trap_type', v_row.trap_type,
    'repairs_agreeing', v_row.repairs_agreeing, 'repairs_disagreeing', v_row.repairs_disagreeing
  );
end
$$;
revoke all on function public.record_trap_atlas(text, text, text) from public, anon, authenticated;
grant execute on function public.record_trap_atlas(text, text, text) to service_role;
