// Development and tests only: an in-memory Supabase client with the keys of the Key cards migration
// (supabase/migrations/20261031140000_key_cards.sql) and the Learn runs migration (20261101150000_learn_runs.sql), so races
// and replays behave as in Postgres. Used by the route tests (data/tests/keycards_routes.test.mjs, learn_*), the PGlite parity
// test (data/tests/learn_db.test.mjs) and the dev-only real-deck preview (./keycardsPreview.js); production never imports it.
// It follows PostgREST: a select without .order() promises no order (rows come back reversed to show it), a range when given,
// never more than max-rows (1,000). key_card_review(), learn_start_run() and learn_record_event() mirror the migrations'
// functions statement for statement (all or nothing: nothing is written until every check passed); attempt_question_ids()
// mirrors 20261020150100.
export const KEYS = {
  key_card_states: ['user_id', 'card_id'],
  key_card_reports: ['user_id', 'card_id'],
  student_subject_options: ['user_id', 'subject'],
  learning_allowances: ['user_id', 'kind', 'period'],
  key_card_reviews: ['user_id', 'card_id', 'client_key'], // the partial unique index (client key not null)
  learn_runs: ['id'],
  learn_run_events: ['run_id', 'item_id'],
  user_question_progress: ['user_id', 'question_id'],
  learning_question_exposure: ['user_id', 'question_id'],
};
/** Further unique constraints (the primary key is KEYS). */
export const UNIQUE = {
  learn_runs: [['user_id', 'request_key']],
};
export const MAX_ROWS = 1000; // PostgREST's max-rows: a select past it is cut, as on Supabase
export const FLOW_CONTEXTS = Object.freeze(['mock', 'review', 'explore', 'shadow', 'learn']);
export const LEARN_RUN_KINDS = Object.freeze(['mix', 'cards', 'recap', 'feed', 'level']);
export const LEARN_EVENT_KINDS = Object.freeze(['answer', 'rate', 'look', 'recap', 'keep', 'lesson']);

const len = (v) => [...String(v ?? '')].length;
const within = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// The tables' CHECK constraints (and NOT NULL columns) the mirrors and plain inserts must keep.
const CHECKS = {
  question_interactions: (r) => r.question_id != null && r.user_id != null && r.interaction_type != null
    && (r.flow_context == null || FLOW_CONTEXTS.includes(r.flow_context)),
  learn_runs: (r) => within(len(r.id), 1, 60) && r.user_id != null && within(len(r.request_key), 8, 100) && LEARN_RUN_KINDS.includes(r.kind)
    && r.subject != null && within(r.asked_minutes, 0, 240) && within(r.minutes, 0, 240) && Array.isArray(r.items)
    && (r.limit_line == null || len(r.limit_line) <= 300),
  learn_run_events: (r) => r.run_id != null && within(len(r.item_id), 1, 120) && r.user_id != null && LEARN_EVENT_KINDS.includes(r.kind)
    && (r.choice == null || len(r.choice) <= 2) && (r.origin == null || ['mistake', 'linked', 'chapter'].includes(r.origin))
    && (r.rating == null || [1, 3, 4].includes(r.rating)),
};

/** A Postgres-style error, thrown inside a mirror and answered as the rpc's { error }. */
const raise = (code, message) => Object.assign(new Error(message), { code });
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
/** p->>'k' : the text of a JSON value (null stays null). */
const text = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** (p->>'k')::boolean */
const bool = (v) => {
  if (v == null) return null;
  const t = String(v).trim().toLowerCase();
  if (['true', 't', 'yes', 'y', 'on', '1'].includes(t)) return true;
  if (['false', 'f', 'no', 'n', 'off', '0'].includes(t)) return false;
  throw raise('22P02', `invalid input syntax for type boolean: "${v}"`);
};
/** (p->>'k')::int */
const int = (v) => {
  if (v == null) return null;
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw raise('22P02', `invalid input syntax for type integer: "${v}"`);
  return Number(t);
};
/** (p->>'k')::timestamptz, kept as an ISO string. */
const stamp = (v) => {
  if (v == null) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) throw raise('22007', `invalid input syntax for type timestamp with time zone: "${v}"`);
  return new Date(ms).toISOString();
};
/** A comparison as Postgres makes it: null never matches; numbers as numbers, timestamps as times, else text. */
const compare = (a, b) => {
  if (a == null || b == null) return null;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a);
    const y = Number(b);
    if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a === true || a === 'true') - Number(b === true || b === 'true');
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const isTime = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}[T ]/.test(s);
  if (isTime(a) && isTime(b) && Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};
const sameValue = (a, b) => (a === b) || (a != null && b != null && compare(a, b) === 0 && typeof a === typeof b);
/** PostgREST's list syntax "(a,b)" or an array. */
const listOf = (v) => (Array.isArray(v) ? v : String(v ?? '').replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')));

export function fakeDb(tables = {}, { now = () => Date.now() } = {}) {
  const log = [];
  const failures = {}; // table -> (query) => true to answer that read with an error
  const nowIso = () => new Date(now()).toISOString();
  // The migration's view key_card_suspended: cards with 3 or more reports.
  const VIEWS = {
    key_card_suspended: () => {
      const n = new Map();
      for (const r of tables.key_card_reports || []) n.set(r.card_id, (n.get(r.card_id) || 0) + 1);
      return [...n].filter(([, c]) => c >= 3).map(([card_id, reports]) => ({ card_id, reports }));
    },
  };
  // Column defaults the tables give a plain insert.
  const DEFAULTS = {
    question_interactions: () => ({ id: `qi_${ids += 1}`, created_at: nowIso(), session_id: null, flow_context: null, dwell_ms: null, metadata: {} }),
    learning_allowances: () => ({ created_at: nowIso() }),
    learning_question_exposure: () => ({ created_at: nowIso() }),
  };
  let ids = 0;
  const table = (name) => tables[name] || (tables[name] = []);
  const like = (v, p) => new RegExp(`^${String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(String(v ?? ''));
  const clash = (t, row, rows = tables[t] || []) => {
    const key = KEYS[t];
    const keys = [...(key ? [key] : []), ...(UNIQUE[t] || [])];
    if (t === 'key_card_reviews' && row.client_key == null) return false;
    return keys.some((k) => rows.some((r) => k.every((c) => r[c] === row[c])));
  };
  const checked = (t, row) => {
    if (CHECKS[t] && !CHECKS[t](row)) throw raise('23514', `new row for relation "${t}" violates check constraint`);
    return row;
  };
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.eqs = {}; this.orders = []; }
    select(cols, opts) {
      if (this.op === 'select') { this.cols = cols; this.countMode = opts?.count || null; this.head = opts?.head === true; } else this.returning = true;
      return this;
    }
    eq(k, v) { this.eqs[k] = v; this.f.push((r) => r[k] === v); return this; }
    neq(k, v) { this.f.push((r) => r[k] != null && r[k] !== v); return this; }
    in(k, l) { this.f.push((r) => l.includes(r[k])); return this; }
    like(k, p) { this.f.push((r) => like(r[k], p)); return this; }
    // gt with a number keeps its first behaviour (Number(column) > v); other values compare as Postgres does.
    gt(k, v) { this.f.push(typeof v === 'number' ? (r) => Number(r[k]) > v : (r) => compare(r[k], v) > 0); return this; }
    gte(k, v) { this.f.push((r) => compare(r[k], v) >= 0); return this; }
    lt(k, v) { this.f.push((r) => compare(r[k], v) < 0); return this; }
    lte(k, v) { this.f.push((r) => compare(r[k], v) <= 0); return this; }
    /** .is(k, null | true | false) */
    is(k, v) { this.f.push((r) => (v === null ? r[k] == null : r[k] === v)); return this; }
    /** .not(k, 'is' | 'eq' | 'in', v), PostgREST's negation. */
    not(k, op, v) {
      const test = op === 'is' ? (r) => (v === null || v === 'null' ? r[k] == null : r[k] === v)
        : op === 'in' ? (r) => listOf(v).some((x) => sameValue(r[k], x) || String(r[k]) === String(x))
          : op === 'eq' ? (r) => r[k] === v || (r[k] != null && String(r[k]) === String(v))
            : null;
      if (!test) throw new Error(`fakeDb: .not(${op}) is not mirrored`);
      // Postgres: NOT (null = v) is null, so a null column never matches a negated eq or in.
      this.f.push((r) => (op === 'is' ? !test(r) : r[k] != null && !test(r)));
      return this;
    }
    limit(n) { this.max = n; return this; }
    order(k, opts = {}) { this.orders.push({ k, asc: opts.ascending !== false, nullsFirst: opts.nullsFirst }); return this; }
    range(a, b) { this.from = a; this.to = b; return this; }
    maybeSingle() { this.single_ = 'maybe'; return this; }
    single() { this.single_ = 'one'; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    update(p) { this.op = 'update'; this.patch = p; return this; }
    upsert(rows, o) { this.op = 'upsert'; this.rows = rows; this.o = o || {}; return this; }
    delete() { this.op = 'delete'; return this; }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
    sorted(rows) {
      // PostgREST: rows in no promised order unless asked.
      if (!this.orders.length) return [...rows].reverse();
      return [...rows].sort((a, b) => {
        for (const { k, asc, nullsFirst } of this.orders) {
          const x = a[k];
          const y = b[k];
          if (x == null || y == null) {
            if (x == null && y == null) continue;
            const first = nullsFirst ?? !asc; // Postgres: nulls last ascending, first descending
            return (x == null) === first ? -1 : 1;
          }
          const c = (typeof x === 'string' && typeof y === 'string') ? x.localeCompare(y) : compare(x, y);
          if (c) return asc ? c : -c;
        }
        return 0;
      });
    }
    shaped(rows) {
      if (this.single_) {
        if (rows.length > 1 || (this.single_ === 'one' && rows.length === 0)) {
          return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
        }
        return { data: rows[0] ? { ...rows[0] } : null, error: null };
      }
      return { data: rows.map((r) => ({ ...r })), error: null };
    }
    run() {
      log.push({ table: this.t, op: this.op, cols: this.cols, eqs: this.eqs, range: this.from === undefined ? null : [this.from, this.to] });
      if (failures[this.t]?.(this)) return { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
      const all = VIEWS[this.t] ? VIEWS[this.t]() : table(this.t);
      try {
        if (this.op === 'insert') {
          const list = (Array.isArray(this.row) ? this.row : [this.row]).map((row) => checked(this.t, { ...(DEFAULTS[this.t]?.() || {}), ...row }));
          // All or nothing, as one statement: a clash with the table or within the list writes no row.
          const seen = [];
          for (const row of list) {
            if (clash(this.t, row) || clash(this.t, row, seen)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
            seen.push(row);
          }
          for (const row of list) all.push({ ...(this.t === 'key_card_reviews' ? { id: ++ids } : {}), ...row });
          return this.returning ? this.shaped(list) : { data: null, error: null };
        }
        if (this.op === 'upsert') {
          const key = KEYS[this.t];
          for (const row of this.rows) {
            const at = key ? all.findIndex((r) => key.every((k) => r[k] === row[k])) : -1;
            if (at < 0) all.push(checked(this.t, { ...(DEFAULTS[this.t]?.() || {}), ...row }));
            else if (!this.o.ignoreDuplicates) all[at] = checked(this.t, { ...all[at], ...row });
          }
          return { data: null, error: null };
        }
      } catch (error) {
        return { data: null, error: { code: error.code, message: error.message } };
      }
      let rows = all.filter((r) => this.f.every((f) => f(r)));
      if (this.op === 'update') {
        for (const r of rows) Object.assign(r, this.patch);
        return this.returning ? this.shaped(rows) : { data: rows.map((r) => ({ card_id: r.card_id })), error: null };
      }
      if (this.op === 'delete') {
        const gone = new Set(rows);
        for (let i = all.length - 1; i >= 0; i -= 1) if (gone.has(all[i])) all.splice(i, 1);
        return this.returning ? this.shaped(rows) : { data: null, error: null };
      }
      const count = this.countMode ? rows.length : undefined;
      // PostgREST: a range when given, and never more than max-rows (1,000).
      rows = this.sorted(rows);
      if (this.from !== undefined) rows = rows.slice(this.from, this.to + 1);
      rows = rows.slice(0, Math.min(this.max || MAX_ROWS, MAX_ROWS));
      if (this.head) return { data: null, error: null, count };
      const out = this.shaped(rows);
      return count === undefined ? out : { ...out, count };
    }
  }

  // key_card_review() of the migration, statement for statement: all or nothing (nothing is written until every check passed).
  function keyCardReview(a) {
    const reviews = table('key_card_reviews');
    const states = table('key_card_states');
    const allow = table('learning_allowances');
    if (a.p_client_key != null && reviews.some((r) => r.user_id === a.p_user_id && r.card_id === a.p_card_id && r.client_key === a.p_client_key)) return { status: 'replay' };
    const row = {
      user_id: a.p_user_id, card_id: a.p_card_id, card_v: a.p_card_v, rating: a.p_rating, mode: a.p_mode, reviewed_at: a.p_reviewed_at,
      client_reviewed_at: a.p_client_reviewed_at, client_key: a.p_client_key, scheduled_days: a.p_move ? a.p_scheduled_days : null, elapsed_days: a.p_move ? a.p_elapsed_days : null,
    };
    if (!a.p_move) { reviews.push({ id: ++ids, ...row }); return { status: 'logged' }; }
    const st = states.find((s) => s.user_id === a.p_user_id && s.card_id === a.p_card_id);
    if (st?.suspended) return { status: 'suspended' };
    if (Boolean(st) !== (a.p_expected_reps != null) || (st && Number(st.reps) !== a.p_expected_reps)) return { status: 'conflict' };
    const claims = [];
    const claim = (kind, limit, reference) => {
      const taken = allow.filter((r) => r.user_id === a.p_user_id && r.kind === kind && like(r.period, `${a.p_day}:%`)).length;
      for (let slot = taken + 1; slot <= limit; slot += 1) {
        const period = `${a.p_day}:${slot}`;
        if (allow.some((r) => r.user_id === a.p_user_id && r.kind === kind && r.period === period)) continue;
        claims.push({ user_id: a.p_user_id, kind, period, reference: String(reference).slice(0, 200), created_at: a.p_reviewed_at });
        return true;
      }
      return false;
    };
    if (a.p_review_limit != null && !claim('keycard_review', a.p_review_limit, a.p_reference ?? a.p_card_id)) return { status: 'keycard_reviews' };
    if (a.p_new_limit != null && (!st || Number(st.reps) === 0) && !claim('keycard_new', a.p_new_limit, a.p_card_id)) return { status: 'keycard_new' };
    reviews.push({ id: ++ids, ...row });
    allow.push(...claims);
    const s = a.p_state;
    const move = { schedule: s.schedule, reps: s.reps, lapses: s.lapses, due_at: s.due_at, last_review_at: s.last_review_at, last_rating: a.p_rating };
    if (st) Object.assign(st, move);
    else states.push({ user_id: a.p_user_id, card_id: a.p_card_id, subject: s.subject, chapter_key: s.chapter_key, ...move, added_from: s.added_from, added_at: s.added_at, suspended: false });
    return { status: 'ok' };
  }

  /** The run's key mismatch: another chapter or kind under the same request key. */
  const otherRun = (run, row) => run.kind !== (row.kind ?? null) || (run.chapter_key ?? null) !== text(row.chapter_key);

  // learn_start_run(p_row, p_question_ids) of 20261101150000_learn_runs.sql, statement for statement. Claims nothing.
  function learnStartRun({ p_row: row, p_question_ids: questionIds }) {
    const runs = table('learn_runs');
    const exposure = table('learning_question_exposure');
    const user = text(row?.user_id);
    const items = row?.items;
    if (user == null || !text(row.id) || !text(row.request_key) || !Array.isArray(items)) throw raise('P0001', 'learn_start_run: bad input');
    const found = runs.find((r) => r.user_id === user && r.request_key === text(row.request_key));
    if (found) return otherRun(found, row) ? { status: 'key_conflict', id: found.id } : { status: 'replay', id: found.id };
    const at = row.created_at != null ? stamp(row.created_at) : nowIso();
    const summed = items.length ? items.reduce((n, x) => n + (int(x?.seconds) ?? 0), 0) : null;
    const run = checked('learn_runs', {
      id: text(row.id), user_id: user, request_key: text(row.request_key), kind: text(row.kind), subject: text(row.subject),
      chapter_key: text(row.chapter_key), asked_minutes: int(row.asked_minutes ?? row.minutes), minutes: int(row.minutes),
      leave_out: Array.isArray(row.leave_out) ? row.leave_out.map(text) : [],
      items: clone(items), item_count: items.length, done_count: 0,
      seconds_left: int(row.seconds_left) ?? int(row.seconds) ?? summed ?? 0,
      reinserted: [], extra: 0, start_state: clone(row.start_state) ?? null, added: clone(row.added) ?? null, looks: clone(row.looks) ?? null,
      limit_line: null, session_claimed: false, created_at: at, updated_at: at, ended_at: null,
    });
    if (runs.some((r) => r.id === run.id)) throw raise('23505', 'duplicate key value violates unique constraint "learn_runs_pkey"');
    runs.push(run);
    const qs = [...new Set((questionIds || []).map(text).filter((q) => q))];
    for (const q of qs) {
      if (!exposure.some((r) => r.user_id === user && r.question_id === q)) exposure.push({ user_id: user, question_id: q, reference: run.id, created_at: nowIso() });
    }
    return { status: 'ok', id: run.id };
  }

  // learn_record_event(...) of 20261101150000_learn_runs.sql, statement for statement: the run (its lock), the replay probe,
  // the item, Free's quota, the re-insert or move, the event, progress, interaction and counters. Everything is checked and
  // planned first, then written in the function's order, so a refusal or a failed check writes nothing.
  function learnRecordEvent(a) {
    const runs = table('learn_runs');
    const events = table('learn_run_events');
    const allow = table('learning_allowances');
    const user = text(a.p_user);
    const runId = text(a.p_run);
    const itemId = text(a.p_item);
    const run = runs.find((r) => r.id === runId && r.user_id === user);
    if (!run) return { status: 'not_found' };
    const prior = events.find((e) => e.run_id === runId && e.item_id === itemId);
    if (prior) return { status: 'replay', body: clone(prior.body) };
    const at = run.items.findIndex((x) => x && typeof x === 'object' && text(x.id) === itemId);
    if (at < 0) return { status: 'no_item' };
    const at_ = nowIso();
    const writes = [];

    let claimed = false;
    const quota = a.p_quota;
    if (quota != null) {
      const kind = text(quota.kind);
      const day = text(quota.day);
      if (kind == null || day == null) throw raise('P0001', 'learn_record_event: bad quota');
      const ofDay = (r) => r.user_id === user && r.kind === kind && like(r.period, `${day}:%`);
      if (!allow.some((r) => ofDay(r) && r.reference === runId)) {
        const limit = Math.max(int(quota.limit) ?? 0, 0);
        let slot = null;
        for (let n = 1; n <= limit; n += 1) {
          const period = `${day}:${n}`;
          if (!allow.some((r) => r.user_id === user && r.kind === kind && r.period === period)) { slot = { user_id: user, kind, period, reference: runId, created_at: at_ }; break; }
        }
        if (!slot) {
          const held = allow.filter(ofDay).sort((x, y) => (x.period < y.period ? -1 : x.period > y.period ? 1 : 0))[0];
          return { status: 'used', reference: held ? held.reference : null };
        }
        claimed = true;
        writes.push(() => { allow.push(slot); run.session_claimed = true; });
      }
    }

    let reinsert = null;
    const ri = a.p_reinsert;
    const card = ri == null ? null : text(ri.card_id);
    if (ri != null && card != null && !run.reinserted.includes(card)
      && !((bool(ri.unless_rated_well) ?? false) && events.some((e) => e.run_id === runId && e.card_id === card && e.kind === 'rate' && [3, 4].includes(e.rating)))) {
      const length = run.items.length;
      const gap = Math.max(int(ri.gap) ?? 3, 1);
      const from = ri.move_item != null ? run.items.findIndex((x, i) => i > at && x && typeof x === 'object' && text(x.id) === text(ri.move_item)) : -1;
      if (from >= 0) {
        // The card is still ahead: move it closer, never copy it (A5 R7).
        const pos = Math.min(from, at + gap);
        reinsert = { item_id: text(ri.move_item), at: pos, moved: true };
        writes.push(() => {
          if (from > pos) { const [x] = run.items.splice(from, 1); run.items.splice(pos, 0, x); }
          run.reinserted.push(card);
        });
      } else if (ri.item && typeof ri.item === 'object' && !Array.isArray(ri.item)) {
        const pos = Math.min(length, at + gap);
        const id = `${run.id}-r${run.extra + 1}`;
        const seconds = int(ri.seconds) ?? int(ri.item.seconds) ?? 0;
        reinsert = { item_id: id, at: pos };
        writes.push(() => {
          run.items.splice(pos, 0, { ...clone(ri.item), id });
          run.extra += 1;
          run.reinserted.push(card);
          run.item_count += 1;
          run.seconds_left += seconds;
        });
      }
    }

    const ev = a.p_event || {};
    const body = { ...(ev.body && typeof ev.body === 'object' ? clone(ev.body) : {}), ...(reinsert ? { reinsert } : {}) };
    const event = checked('learn_run_events', {
      run_id: runId, item_id: itemId, user_id: user, kind: text(ev.kind), question_id: text(ev.question_id), card_id: text(ev.card_id),
      choice: text(ev.choice), correct: bool(ev.correct), fixed: bool(ev.fixed), origin: text(ev.origin), rating: int(ev.rating),
      due_at: stamp(ev.due_at), body, created_at: at_,
    });
    writes.push(() => events.push(event));

    const pr = a.p_progress;
    if (pr != null) {
      const progress = table('user_question_progress');
      const qid = text(pr.question_id);
      if (qid == null) throw raise('23502', 'null value in column "question_id" of relation "user_question_progress"');
      const right = bool(pr.correct);
      writes.push(() => {
        const g = progress.find((r) => r.user_id === user && r.question_id === qid);
        if (g) {
          Object.assign(g, {
            seen_count: (Number(g.seen_count) || 0) + 1, attempt_count: (Number(g.attempt_count) || 0) + 1,
            correct_count: (Number(g.correct_count) || 0) + (right ? 1 : 0), last_selected_key: text(pr.selected_key), last_correct: right,
            last_seen_at: at_, last_attempted_at: at_, updated_at: at_,
          });
        } else {
          progress.push({
            user_id: user, question_id: qid, subject: text(pr.subject), chapter: text(pr.chapter), seen_count: 1, attempt_count: 1,
            correct_count: right ? 1 : 0, skip_count: 0, last_selected_key: text(pr.selected_key), last_correct: right,
            last_seen_at: at_, last_attempted_at: at_, updated_at: at_,
          });
        }
      });
    }
    const pi = a.p_interaction;
    if (pi != null) {
      const row = checked('question_interactions', {
        id: `qi_${ids += 1}`, question_id: text(pi.question_id), user_id: user, interaction_type: 'attempted', created_at: at_,
        session_id: runId, flow_context: 'learn', dwell_ms: null, metadata: pi.metadata == null ? {} : clone(pi.metadata),
      });
      writes.push(() => table('question_interactions').push(row));
    }
    const limitLine = text(a.p_limit_line);
    const spent = int(ev.seconds) ?? 0;
    writes.push(() => {
      run.done_count += 1;
      run.seconds_left = Math.max(0, run.seconds_left - spent);
      if (limitLine != null) run.limit_line = limitLine;
      run.updated_at = at_;
    });
    // The run's own checks (limit_line at most 300 characters) as the update would raise them.
    if (limitLine != null) checked('learn_runs', { ...run, limit_line: limitLine });

    for (const write of writes) write();
    const pile = new Set(events.filter((e) => e.run_id === runId && e.kind === 'rate' && [3, 4].includes(e.rating) && e.card_id != null).map((e) => e.card_id));
    return { status: 'ok', body: clone(body), reinsert, claimed, revise_pile: pile.size };
  }

  // attempt_question_ids() of 20261020150100: per attempt, its snapshot's question ids and family ids, newest first.
  function attemptQuestionIds({ p_user_id, p_subject = null, p_mode = null, p_limit = null }) {
    const familyOf = (q) => (q.familyId ? q.familyId : q.evidence?.record?.family_id || null);
    const rows = (tables.attempts || [])
      .filter((a) => a.user_id === p_user_id && (p_subject == null || a.subject === p_subject) && (p_mode == null || a.selection_meta?.mode === p_mode))
      .sort((x, y) => (compare(y.completed_at, x.completed_at) ?? 0) || String(x.id).localeCompare(String(y.id)))
      .map((a) => {
        const snap = Array.isArray(a.questions_snapshot) ? a.questions_snapshot.filter((q) => q && typeof q === 'object' && !Array.isArray(q)) : [];
        return {
          attempt_id: a.id,
          question_ids: snap.filter((q) => q.id != null && q.id !== '').map((q) => text(q.id)),
          family_ids: snap.map(familyOf).filter((f) => f != null && f !== ''),
        };
      });
    return p_limit == null ? rows : rows.slice(0, p_limit);
  }

  const FUNCTIONS = {
    key_card_review: keyCardReview,
    learn_start_run: learnStartRun,
    learn_record_event: learnRecordEvent,
    attempt_question_ids: attemptQuestionIds,
  };
  const rpc = (name, args) => {
    log.push({ rpc: name, args });
    if (failures[`rpc:${name}`]?.(args)) return Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
    const fn = FUNCTIONS[name];
    if (!fn) return Promise.resolve({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } });
    try {
      return Promise.resolve({ data: fn(args || {}), error: null });
    } catch (error) {
      return Promise.resolve({ data: null, error: { code: error.code || 'P0001', message: error.message } });
    }
  };
  return { from: (t) => new Q(t), rpc, tables, log, failures };
}
