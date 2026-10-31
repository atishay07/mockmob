// Development and tests only: an in-memory Supabase client with the Key cards migration's keys
// (supabase/migrations/20261031140000_key_cards.sql), so races and replays behave as in Postgres. Used by the route tests
// (data/tests/keycards_routes.test.mjs) and the dev-only real-deck preview (./keycardsPreview.js); production never imports it.
// It follows PostgREST: a select without .order() promises no order (rows come back reversed to show it), a range when given,
// never more than max-rows (1,000); key_card_review() mirrors the migration's function statement for statement.
export const KEYS = {
  key_card_states: ['user_id', 'card_id'],
  key_card_reports: ['user_id', 'card_id'],
  student_subject_options: ['user_id', 'subject'],
  learning_allowances: ['user_id', 'kind', 'period'],
  key_card_reviews: ['user_id', 'card_id', 'client_key'], // the partial unique index (client key not null)
};
export const MAX_ROWS = 1000; // PostgREST's max-rows: a select past it is cut, as on Supabase
export function fakeDb(tables = {}) {
  const log = [];
  const failures = {}; // table -> (query) => true to answer that read with an error
  // The migration's view key_card_suspended: cards with 3 or more reports.
  const VIEWS = {
    key_card_suspended: () => {
      const n = new Map();
      for (const r of tables.key_card_reports || []) n.set(r.card_id, (n.get(r.card_id) || 0) + 1);
      return [...n].filter(([, c]) => c >= 3).map(([card_id, reports]) => ({ card_id, reports }));
    },
  };
  let ids = 0;
  const like = (v, p) => new RegExp(`^${String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(String(v ?? ''));
  const clash = (table, row) => {
    const key = KEYS[table];
    if (!key) return false;
    if (table === 'key_card_reviews' && row.client_key == null) return false;
    return (tables[table] || []).some((r) => key.every((k) => r[k] === row[k]));
  };
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.eqs = {}; }
    select(cols) { if (this.op === 'select') this.cols = cols; else this.returning = true; return this; }
    eq(k, v) { this.eqs[k] = v; this.f.push((r) => r[k] === v); return this; }
    in(k, l) { this.f.push((r) => l.includes(r[k])); return this; }
    like(k, p) { this.f.push((r) => like(r[k], p)); return this; }
    gt(k, v) { this.f.push((r) => Number(r[k]) > v); return this; }
    limit(n) { this.max = n; return this; }
    order(k) { this.by = k; return this; }
    range(a, b) { this.from = a; this.to = b; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    update(p) { this.op = 'update'; this.patch = p; return this; }
    upsert(rows, o) { this.op = 'upsert'; this.rows = rows; this.o = o || {}; return this; }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
    run() {
      log.push({ table: this.t, op: this.op, cols: this.cols, eqs: this.eqs, range: this.from === undefined ? null : [this.from, this.to] });
      if (failures[this.t]?.(this)) return { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
      const all = VIEWS[this.t] ? VIEWS[this.t]() : tables[this.t] || (tables[this.t] = []);
      if (this.op === 'insert') {
        if (clash(this.t, this.row)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        all.push({ ...(this.t === 'key_card_reviews' ? { id: ++ids } : {}), ...this.row });
        return { data: null, error: null };
      }
      if (this.op === 'upsert') {
        for (const row of this.rows) {
          const at = all.findIndex((r) => KEYS[this.t].every((k) => r[k] === row[k]));
          if (at < 0) all.push({ ...row }); else if (!this.o.ignoreDuplicates) all[at] = { ...all[at], ...row };
        }
        return { data: null, error: null };
      }
      let rows = all.filter((r) => this.f.every((f) => f(r)));
      if (this.op === 'update') { for (const r of rows) Object.assign(r, this.patch); return { data: rows.map((r) => ({ card_id: r.card_id })), error: null }; }
      // PostgREST: rows in no promised order unless asked, a range when given, and never more than max-rows (1,000).
      if (this.by) rows = [...rows].sort((a, b) => String(a[this.by]).localeCompare(String(b[this.by])));
      else rows = [...rows].reverse();
      if (this.from !== undefined) rows = rows.slice(this.from, this.to + 1);
      rows = rows.slice(0, Math.min(this.max || MAX_ROWS, MAX_ROWS));
      return { data: rows.map((r) => ({ ...r })), error: null };
    }
  }
  // key_card_review() of the migration, statement for statement: all or nothing (nothing is written until every check passed).
  function keyCardReview(a) {
    const reviews = tables.key_card_reviews || (tables.key_card_reviews = []);
    const states = tables.key_card_states || (tables.key_card_states = []);
    const allow = tables.learning_allowances || (tables.learning_allowances = []);
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
  const rpc = (name, args) => {
    log.push({ rpc: name, args });
    if (name === 'key_card_review') return Promise.resolve({ data: keyCardReview(args), error: null });
    return Promise.resolve({ data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } });
  };
  return { from: (t) => new Q(t), rpc, tables, log, failures };
}

