// In-memory stand-in for the service-role Supabase client, used by the NTA end-to-end tests
// (data/tests/nta_e2e_*.mjs). It answers the same query-builder calls the website's server code
// makes (select / eq / in / is / or / order / range / limit / single / insert / upsert / update and
// the session RPCs) over plain arrays loaded from read-only production fixtures, so the real
// route handlers and the real Database layer run unchanged and nothing ever touches a database.
//
// It is deliberately strict where the real service is: a select with a column list returns only
// those columns, so code that reads an unselected column fails here as it would in production, and
// a table listed as missing answers with the PostgREST "relation does not exist" code.
import { randomUUID } from 'node:crypto';

export const store = {
  tables: new Map(),   // name -> row[]
  missing: new Set(),  // names that answer 42P01
  calls: { select: 0, write: 0, rpc: 0, writes: [] },
};

export function resetStore({ missing = [] } = {}) {
  store.tables = new Map();
  store.missing = new Set(missing);
  store.calls = { select: 0, write: 0, rpc: 0, writes: [] };
}
export function seed(name, rows) { store.tables.set(name, rows); }
export function table(name) { if (!store.tables.has(name)) store.tables.set(name, []); return store.tables.get(name); }

const clone = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const missingError = (name) => ({ code: '42P01', message: `relation "public.${name}" does not exist` });

function valueOf(row, column) {
  // Supports jsonb paths such as evidence->record or plain columns.
  return row?.[column];
}
function coerce(raw, sample) {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (typeof sample === 'number' && raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}
function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

// One filter: [column, operator, value] with PostgREST operators; negate for not.<op>.
function matches(row, [column, op, raw, negate]) {
  const actual = valueOf(row, column);
  let result;
  switch (op) {
    case 'eq': result = actual === coerce(String(raw), actual) || String(actual) === String(raw); break;
    case 'neq': result = !(actual === coerce(String(raw), actual) || String(actual) === String(raw)); break;
    case 'gt': result = actual !== null && actual !== undefined && Number(actual) > Number(raw); break;
    case 'gte': result = actual !== null && actual !== undefined && Number(actual) >= Number(raw); break;
    case 'lt': result = actual !== null && actual !== undefined && Number(actual) < Number(raw); break;
    case 'lte': result = actual !== null && actual !== undefined && Number(actual) <= Number(raw); break;
    case 'in': result = Array.isArray(raw) ? raw.some((entry) => String(entry) === String(actual)) : false; break;
    case 'is': result = raw === null || raw === 'null' ? (actual === null || actual === undefined) : actual === coerce(String(raw), actual); break;
    default: throw new Error(`fake supabase: operator ${op} is not implemented`);
  }
  return negate ? !result : result;
}

// or('a.eq.1,b.not.is.null,c.gt.0') -> predicate
function parseOr(expression) {
  const parts = expression.split(',').map((part) => part.trim()).filter(Boolean);
  const filters = parts.map((part) => {
    const [column, ...rest] = part.split('.');
    let negate = false;
    if (rest[0] === 'not') { negate = true; rest.shift(); }
    const op = rest.shift();
    const raw = rest.join('.');
    if (op === 'in') return [column, op, raw.replace(/^\(|\)$/g, '').split(','), negate];
    return [column, op, raw, negate];
  });
  return (row) => filters.some((filter) => matches(row, filter));
}

class Query {
  constructor(name) {
    this.name = name;
    this.op = 'select';
    this.columns = '*';
    this.filters = [];
    this.predicates = [];
    this.orders = [];
    this.limitTo = null;
    this.rangeTo = null;
    this.payload = null;
    this.options = {};
    this.returning = false;
    this.mode = 'many';
    this.signal = null;
  }
  select(columns = '*') { if (this.op === 'select') this.columns = columns; else this.returning = columns; return this; }
  insert(rows, options = {}) { this.op = 'insert'; this.payload = rows; this.options = options; return this; }
  upsert(rows, options = {}) { this.op = 'upsert'; this.payload = rows; this.options = options; return this; }
  update(values) { this.op = 'update'; this.payload = values; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(column, value) { this.filters.push([column, 'eq', value]); return this; }
  neq(column, value) { this.filters.push([column, 'neq', value]); return this; }
  gt(column, value) { this.filters.push([column, 'gt', value]); return this; }
  gte(column, value) { this.filters.push([column, 'gte', value]); return this; }
  lt(column, value) { this.filters.push([column, 'lt', value]); return this; }
  lte(column, value) { this.filters.push([column, 'lte', value]); return this; }
  in(column, values) { this.filters.push([column, 'in', values]); return this; }
  is(column, value) { this.filters.push([column, 'is', value]); return this; }
  not(column, op, value) { this.filters.push([column, op, value, true]); return this; }
  or(expression) { this.predicates.push(parseOr(expression)); return this; }
  order(column, { ascending = true } = {}) { this.orders.push([column, ascending]); return this; }
  limit(count) { this.limitTo = count; return this; }
  range(from, to) { this.rangeTo = [from, to]; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  abortSignal(signal) { this.signal = signal; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject); }

  project(row) {
    const columns = this.op === 'select' ? this.columns : this.returning;
    if (!columns || columns === '*') return clone(row);
    if (/[()]/.test(columns)) return clone(row);
    const out = {};
    for (const column of columns.split(',').map((entry) => entry.trim()).filter(Boolean)) out[column] = clone(row[column]);
    return out;
  }
  finish(rows) {
    if (this.mode === 'single') {
      if (rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
      return { data: rows[0], error: null };
    }
    if (this.mode === 'maybe') {
      if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
  run() {
    if (this.signal?.aborted) return { data: null, error: { code: '20', message: 'AbortError: request aborted' } };
    if (store.missing.has(this.name)) return { data: null, error: missingError(this.name) };
    const rows = table(this.name);
    const selected = rows.filter((row) => this.filters.every((filter) => matches(row, filter)) && this.predicates.every((predicate) => predicate(row)));
    if (this.op === 'select') {
      store.calls.select += 1;
      let out = selected;
      if (this.orders.length) out = [...out].sort((a, b) => { for (const [column, ascending] of this.orders) { const c = compare(a[column], b[column]); if (c) return ascending ? c : -c; } return 0; });
      if (this.rangeTo) out = out.slice(this.rangeTo[0], this.rangeTo[1] + 1);
      else if (this.limitTo !== null) out = out.slice(0, this.limitTo);
      return this.finish(out.map((row) => this.project(row)));
    }
    store.calls.write += 1;
    store.calls.writes.push({ table: this.name, op: this.op });
    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      const keyed = this.name === 'attempts' || this.name === 'recovery_sessions';
      for (const row of list) if (keyed && rows.some((existing) => existing.id === row.id)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      const created = list.map((row) => ({ ...(this.name === 'attempts' ? { completed_at: new Date().toISOString() } : {}), ...clone(row) }));
      rows.push(...created);
      return this.returning ? this.finish(created.map((row) => this.project(row))) : { data: null, error: null };
    }
    if (this.op === 'upsert') {
      const keys = String(this.options.onConflict || 'id').split(',');
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const row of list) {
        const at = rows.findIndex((existing) => keys.every((key) => existing[key] === row[key]));
        if (at >= 0) rows[at] = { ...rows[at], ...clone(row) }; else rows.push(clone(row));
      }
      return { data: null, error: null };
    }
    if (this.op === 'update') {
      for (const row of selected) Object.assign(row, clone(this.payload));
      return this.returning ? this.finish(selected.map((row) => this.project(row))) : { data: null, error: null };
    }
    if (this.op === 'delete') {
      for (const row of selected) rows.splice(rows.indexOf(row), 1);
      return { data: null, error: null };
    }
    throw new Error(`fake supabase: ${this.op} is not implemented`);
  }
}

// Session RPCs, following supabase/migrations/20261001105920_score_recovery_foundations.sql and
// 20261002120000_connected_learning.sql closely enough for start, events and finish.
const rpcHandlers = {
  spend_credits({ p_user_id, p_action }) {
    const user = table('users').find((row) => row.id === p_user_id);
    const cost = { attempt: 10, attempt_full: 50, generate: 10 }[p_action];
    if (!user || (user.credit_balance || 0) < cost) return { data: false, error: null };
    user.credit_balance -= cost;
    return { data: true, error: null };
  },
  start_recovery_session({ p_row, p_credit_action }) {
    const sessions = table('recovery_sessions');
    const existing = sessions.find((row) => row.user_id === p_row.user_id && row.request_key === p_row.request_key);
    if (existing) return { data: clone(existing), error: null };
    if (p_credit_action) {
      const spent = rpcHandlers.spend_credits({ p_user_id: p_row.user_id, p_action: p_credit_action });
      if (!spent.data) return { data: null, error: { message: 'insufficient credits' } };
    }
    const row = { events: [], ...clone(p_row) };
    sessions.push(row);
    return { data: clone(row), error: null };
  },
  start_learning_session({ p_row, p_credit_action }) {
    return rpcHandlers.start_recovery_session({ p_row, p_credit_action });
  },
  record_recovery_events({ p_id, p_user_id, p_events }) {
    const session = table('recovery_sessions').find((row) => row.id === p_id && row.user_id === p_user_id);
    if (!session) return { data: null, error: { message: 'session not found' } };
    for (const event of p_events) {
      const n = event.seq;
      if (n <= session.events.length) {
        if (JSON.stringify(session.events[n - 1]) !== JSON.stringify(event)) return { data: null, error: { message: 'event conflict' } };
        continue;
      }
      if (session.state !== 'active' || Date.now() > Date.parse(session.expires_at)) return { data: null, error: { message: 'session expired' } };
      if (n !== session.events.length + 1 || n > 5000) return { data: null, error: { message: 'event sequence gap' } };
      const last = session.events.at(-1);
      if (last && event.at < last.at) return { data: null, error: { message: 'event clock conflict' } };
      session.events.push(clone(event));
    }
    return { data: clone(session.events), error: null };
  },
  finish_recovery_session({ p_id, p_user_id, p_result }) {
    const session = table('recovery_sessions').find((row) => row.id === p_id && row.user_id === p_user_id);
    if (!session) return { data: null, error: { message: 'session not found' } };
    if (session.state === 'submitted') return { data: session.id, error: null };
    if (p_result.expected_event_count !== session.events.length) return { data: null, error: { message: 'event conflict' } };
    if (Date.now() > Date.parse(session.expires_at) + 120000) return { data: null, error: { message: 'session expired' } };
    table('attempts').push({ id: session.id, user_id: session.user_id, subject: session.subject, score: p_result.score, correct: p_result.correct,
      wrong: p_result.wrong, unattempted: p_result.unattempted, total: p_result.total, details: clone(p_result.details),
      questions_snapshot: clone(session.questions), selection_meta: clone(p_result.selectionMeta), completed_at: new Date().toISOString() });
    session.state = 'submitted';
    return { data: session.id, error: null };
  },
};

const client = {
  from: (name) => new Query(name),
  rpc: async (name, args) => {
    store.calls.rpc += 1;
    const handler = rpcHandlers[name];
    if (!handler) return { data: null, error: { code: '42883', message: `function ${name} does not exist` } };
    return handler(args);
  },
  auth: { getUser: async () => ({ data: { user: null }, error: { message: 'no auth in the fake' } }) },
};

export const supabaseAdmin = () => client;
export const supabase = client;
export const newId = () => randomUUID();
