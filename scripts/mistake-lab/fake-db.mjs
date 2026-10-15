// A tiny in-memory stand-in for the Supabase client, enough for src/lib/server/revise.js, src/lib/server/trapAtlas.js and
// src/lib/server/keyQuality.js under node:test and the fixture builder. It supports exactly the calls those files make:
//   from(table).select(cols).eq(col, v).in(col, list).not(col, 'is', null).order(col, { ascending }).limit(n)
//   from(table).update(patch).eq(...)...select(cols)        returns the changed rows only when .select() follows
//   from(table).upsert(rows, { onConflict: 'a,b' })         merges the given columns into the matching row, else inserts
//   from(table).maybeSingle()
//   rpc('record_trap_atlas', { p_qid, p_option_hash, p_trap_type })   the same rule as the SQL function
// Never used by the product; no network.
class Query {
  constructor(db, table) {
    this.db = db; this.table = table; this.filters = []; this.op = 'select'; this.patch = null; this.rows = null; this.onConflict = null;
    this.sort = null; this.max = null; this.returning = false; this.single = false;
  }
  select() { if (this.op !== 'select') this.returning = true; return this; }
  eq(col, value) { this.filters.push((r) => r[col] === value); return this; }
  in(col, list) { this.filters.push((r) => list.includes(r[col])); return this; }
  not(col, kind, value) { if (kind === 'is' && value === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined); return this; }
  order(col, { ascending = true } = {}) { this.sort = { col, ascending }; return this; }
  limit(n) { this.max = n; return this; }
  update(patch) { this.op = 'update'; this.patch = patch; return this; }
  upsert(rows, { onConflict } = {}) { this.op = 'upsert'; this.rows = Array.isArray(rows) ? rows : [rows]; this.onConflict = String(onConflict || '').split(',').filter(Boolean); return this; }
  maybeSingle() { this.single = true; return this; }
  run() {
    this.db.calls.push({ table: this.table, op: this.op });
    const failure = this.db.failures[`${this.table}:${this.op}`];
    if (failure) return { data: null, error: failure };
    const store = this.db.tables[this.table];
    if (!store) return { data: null, error: { code: '42P01', message: `relation "public.${this.table}" does not exist` } };
    const match = (r) => this.filters.every((f) => f(r));
    if (this.op === 'update') {
      const hit = store.filter(match);
      for (const r of hit) Object.assign(r, this.patch);
      return { data: this.returning ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    if (this.op === 'upsert') {
      for (const row of this.rows) {
        const existing = store.find((r) => this.onConflict.every((k) => r[k] === row[k]));
        if (existing) Object.assign(existing, row); else store.push({ ...row });
      }
      return { data: null, error: null };
    }
    let out = store.filter(match).map((r) => ({ ...r }));
    if (this.sort) {
      const { col, ascending } = this.sort;
      out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1));
    }
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.single) return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  }
  then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }
}

export function fakeDb({ questions = [], progress = [], cards = [], atlas = null, failures = {} } = {}) {
  const db = {
    calls: [], failures,
    tables: { questions, user_question_progress: progress, revise_cards: cards, ...(atlas ? { trap_atlas: atlas } : {}) },
    from(table) { return new Query(db, table); },
    async rpc(name, args) {
      db.calls.push({ rpc: name });
      if (name !== 'record_trap_atlas' || !db.tables.trap_atlas) return { data: null, error: { code: '42883', message: `function public.${name} does not exist` } };
      const rows = db.tables.trap_atlas;
      const row = rows.find((r) => r.qid === args.p_qid && r.option_hash === args.p_option_hash);
      if (!row) {
        const fresh = { qid: args.p_qid, option_hash: args.p_option_hash, trap_type: args.p_trap_type, repairs_agreeing: 1, repairs_disagreeing: 0, source: 'repair' };
        rows.push(fresh);
        return { data: { ...fresh }, error: null };
      }
      if (row.trap_type === args.p_trap_type) row.repairs_agreeing += 1; else row.repairs_disagreeing += 1;
      return { data: { ...row }, error: null };
    },
  };
  return db;
}
