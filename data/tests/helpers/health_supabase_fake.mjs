// A small in-memory stand-in for the Supabase admin client, enough for data/db.js ensureUser / createUser and
// getLeaderboard. Tables are arrays on `tables`; `unique` lists the unique columns per table (a violation answers
// the same shape PostgREST gives: { error: { code: '23505' } }). Every call yields to the event loop first, so two
// concurrent callers really do interleave the way two serverless requests do.
export const tables = { users: [], attempts: [] };
export const unique = { users: ['id', 'email'] };
export const rpcs = {};
export const calls = [];

const tick = () => new Promise((resolve) => setTimeout(resolve, 2));
const dup = (table, column) => ({ code: '23505', message: `duplicate key value violates unique constraint "${table}_${column}_key"` });

class Query {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.orderBy = null; this.window = null; this.wantRows = false; }
  select() { this.wantRows = true; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  upsert(row, opts = {}) { this.op = 'upsert'; this.row = row; this.opts = opts; return this; }
  eq(column, value) { this.filters.push((r) => r[column] === value); return this; }
  in(column, values) { this.filters.push((r) => values.includes(r[column])); return this; }
  order(column, { ascending = true } = {}) { this.orderBy = { column, ascending }; return this; }
  range(from, to) { this.window = [from, to]; return this; }
  maybeSingle() { this.single = 'maybe'; return this; }
  single() { this.single = 'one'; return this; }
  then(resolve, reject) { return this.run().then(resolve, reject); }

  async run() {
    await tick();
    const rows = tables[this.table];
    calls.push([this.table, this.op]);
    let out;
    if (this.op === 'insert' || this.op === 'upsert') {
      const clash = (unique[this.table] || []).find((c) => this.row[c] != null && rows.some((r) => r[c] === this.row[c]));
      if (clash) {
        const onId = clash === 'id';
        if (this.op === 'upsert' && this.opts.ignoreDuplicates && onId && (this.opts.onConflict || 'id') === 'id') out = [];
        else return { data: null, error: dup(this.table, clash) };
      } else {
        const stored = { created_at: '2026-10-16T00:00:00Z', ...this.row };
        rows.push(stored);
        out = [stored];
      }
    } else {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        out = [...out].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1));
      }
      if (this.window) out = out.slice(this.window[0], this.window[1] + 1);
    }
    const copy = out.map((r) => ({ ...r }));
    if (this.single === 'one') return copy.length === 1 ? { data: copy[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no single row' } };
    if (this.single === 'maybe') return { data: copy[0] || null, error: null };
    return { data: copy, error: null };
  }
}

export const fakeClient = {
  from: (table) => new Query(table),
  rpc: async (name) => {
    await tick();
    calls.push(['rpc', name]);
    if (!rpcs[name]) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}() in the schema cache` } };
    return rpcs[name]();
  },
};

export function reset() {
  tables.users = []; tables.attempts = [];
  for (const key of Object.keys(rpcs)) delete rpcs[key];
  calls.length = 0;
}
