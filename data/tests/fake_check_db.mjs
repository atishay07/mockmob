// A fake of the slice of the Supabase client the store uses: chainable filters over in-memory tables, with errors injected
// per table. Every call is logged, so a test can see what was read and what was written. A plain column list is honoured
// (a row comes back with only the columns that were selected, like the real client), and each select logs how many rows it
// returned and the size of what it returned, so a test can measure what a read costs.
export function fakeDb(tables, { errors = {} } = {}) {
  const log = [];
  const project = (rows, cols) => {
    if (typeof cols !== 'string' || /[*:()>]/.test(cols)) return rows;
    const names = cols.split(',').map((c) => c.trim()).filter(Boolean);
    return rows.map((r) => Object.fromEntries(names.map((n) => [n, r[n]])));
  };
  const value = (row, path) => (path.includes('->') ? path.split(/->>?/).reduce((o, k) => (o == null ? undefined : o[k]), row) : row[path]);
  const like = (text, pattern) => new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(String(text ?? ''));
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.opts = {}; }
    select(cols) { this.cols = cols; return this; }
    eq(k, v) { this.filters.push([`eq ${k}`, (r) => value(r, k) === v, k, v]); return this; }
    in(k, list) { this.filters.push([`in ${k}`, (r) => list.includes(value(r, k)), k, list]); return this; }
    like(k, p) { this.filters.push([`like ${k}`, (r) => like(value(r, k), p), k, p]); return this; }
    gt(k, v) { this.filters.push([`gt ${k}`, (r) => String(value(r, k) ?? '') > String(v), k, v]); return this; }
    gte(k, v) { this.filters.push([`gte ${k}`, (r) => Number(value(r, k) ?? 0) >= v, k, v]); return this; }
    or(expr) { this.orExpr = expr; return this; }
    is(k, v) { this.filters.push([`is ${k}`, (r) => (v === null ? value(r, k) == null : value(r, k) === v), k, v]); return this; }
    order(k, opts) { if (!this.sortKey) { this.sortKey = k; this.sortDesc = opts?.ascending === false; } return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    limit(n) { this.max = n; return this; }
    range(a, b) { this.from = a; this.to = b; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    upsert(rows, opts) { this.op = 'upsert'; this.rows = rows; this.opts = opts || {}; return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }
    run() {
      const entry = { cols: this.cols, table: this.table, op: this.op, filters: this.filters.map((f) => [f[0], f[3]]), orExpr: this.orExpr, patch: this.patch, rows: this.rows, opts: this.opts, row: this.row, limit: this.max };
      log.push(entry);
      if (errors[this.table] && (errors[this.table].ops || ['select', 'update', 'upsert']).includes(this.op)) return { data: null, error: errors[this.table].error };
      const all = tables[this.table] || (tables[this.table] = []);
      if (this.op === 'insert') { all.push({ ...this.row }); return { data: null, error: null }; }
      if (this.op === 'upsert') {
        const key = this.opts.onConflict.split(',');
        for (const row of this.rows) {
          const at = all.findIndex((r) => key.every((k) => r[k] === row[k]));
          if (at < 0) all.push({ ...row });
          else if (!this.opts.ignoreDuplicates) all[at] = { ...all[at], ...row };
        }
        return { data: null, error: null };
      }
      let rows = all.filter((r) => this.filters.every((f) => f[1](r)));
      if (this.sortKey && this.op === 'select') rows = [...rows].sort((a, b) => { const x = String(value(a, this.sortKey) ?? ''); const y = String(value(b, this.sortKey) ?? ''); return (x < y ? -1 : x > y ? 1 : 0) * (this.sortDesc ? -1 : 1); });
      if (this.op === 'update') {
        if (this.beforeUpdate) this.beforeUpdate();
        for (const r of rows) Object.assign(r, this.patch);
        return { data: rows.map((r) => ({ operation_key: r.operation_key })), error: null };
      }
      if (this.from !== undefined) rows = rows.slice(this.from, this.to + 1);
      if (this.max) rows = rows.slice(0, this.max);
      rows = project(rows, this.cols);
      entry.returned = rows.length;
      entry.bytes = JSON.stringify(rows).length;
      return this.single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
    }
  }
  return { log, from: (table) => new Query(table), tables };
}

