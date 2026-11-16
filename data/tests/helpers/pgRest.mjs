// Tests only: the part of the Supabase (PostgREST) client the class league store and the Sunday store use, run as real SQL
// on PGlite, so a test exercises the migration's own constraints, the partial unique index and jsonb containment instead of a
// copy of them. Each call becomes one parameterised statement:
//   select(cols, { count, head })  'a,b,alias:col->key' (-> and ->> both)    eq, neq, is(null), in, gte, lte, gt, lt
//   contains(col, obj)              col @> obj::jsonb                          not(col, 'cs', json)  not (col @> json)
//   order(col, { ascending }), limit(n), range(a, b), maybeSingle(), single()
//   insert(row | rows), update(patch), delete(), then .select(cols) to return the rows
// Errors come back as { error: { code, message } } with Postgres's SQLSTATE, as supabase-js gives them.
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw new Error(`pgRest: not a plain column name: ${s}`);
  return `"${s}"`;
};

function selectList(cols) {
  if (!cols || cols.trim() === '*') return '*';
  return cols.split(',').map((raw) => {
    const part = raw.trim();
    const [alias, expr] = part.includes(':') ? part.split(':') : [null, part];
    const m = /^([a-z_][a-z0-9_]*)(?:(->>?)([a-zA-Z_][a-zA-Z0-9_]*))?$/.exec(expr.trim());
    if (!m) throw new Error(`pgRest: unsupported select ${part}`);
    const [, col, arrow, key] = m;
    const sql = arrow ? `${ident(col)}${arrow}'${key}'` : ident(col);
    const name = alias || (arrow ? key : col);
    return `${sql} as "${name}"`;
  }).join(', ');
}

// PostgREST sends JSON: a timestamp is an ISO string and a bigint a number, never a Date or a BigInt.
const plain = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? Number(v) : v]));

export function pgRest(pg) {
  class Q {
    constructor(table) { this.table = table; this.op = 'select'; this.where = []; this.params = []; this.orders = []; this.cols = '*'; }
    p(v) { this.params.push(v); return `$${this.params.length}`; }
    select(cols = '*', opts = {}) {
      if (this.op === 'select') { this.cols = cols; this.count = opts.count || null; this.head = opts.head === true; } else { this.returning = cols; }
      return this;
    }
    eq(k, v) { this.where.push(`${ident(k)} = ${this.p(v)}`); return this; }
    neq(k, v) { this.where.push(`${ident(k)} <> ${this.p(v)}`); return this; }
    gt(k, v) { this.where.push(`${ident(k)} > ${this.p(v)}`); return this; }
    gte(k, v) { this.where.push(`${ident(k)} >= ${this.p(v)}`); return this; }
    lt(k, v) { this.where.push(`${ident(k)} < ${this.p(v)}`); return this; }
    lte(k, v) { this.where.push(`${ident(k)} <= ${this.p(v)}`); return this; }
    is(k, v) { this.where.push(v === null ? `${ident(k)} is null` : `${ident(k)} is ${v ? 'true' : 'false'}`); return this; }
    in(k, list) { this.where.push(`${ident(k)} = any(${this.p(list)})`); return this; }
    contains(k, v) { this.where.push(`${ident(k)} @> ${this.p(typeof v === 'string' ? v : JSON.stringify(v))}::jsonb`); return this; }
    not(k, op, v) {
      if (op !== 'cs') throw new Error(`pgRest: .not(${op}) is not supported`);
      this.where.push(`not (${ident(k)} @> ${this.p(typeof v === 'string' ? v : JSON.stringify(v))}::jsonb)`);
      return this;
    }
    order(k, o = {}) { this.orders.push(`${ident(k)} ${o.ascending === false ? 'desc' : 'asc'}`); return this; }
    limit(n) { this.max = n; return this; }
    range(a, b) { this.from = a; this.to = b; return this; }
    maybeSingle() { this.single = 'maybe'; return this; }
    insert(rows) { this.op = 'insert'; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    delete() { this.op = 'delete'; return this; }
    then(res, rej) { return this.run().then(res, rej); }
    sql() {
      const t = `public.${ident(this.table)}`;
      const where = this.where.length ? ` where ${this.where.join(' and ')}` : '';
      if (this.op === 'insert') {
        const cols = [...new Set(this.rows.flatMap((r) => Object.keys(r)))];
        const values = this.rows.map((r) => `(${cols.map((c) => (r[c] === undefined ? 'default' : this.p(r[c]))).join(', ')})`).join(', ');
        return `insert into ${t} (${cols.map(ident).join(', ')}) values ${values}${this.returning ? ` returning ${selectList(this.returning)}` : ''}`;
      }
      if (this.op === 'update') {
        const sets = Object.entries(this.patch).map(([k, v]) => `${ident(k)} = ${this.p(v)}`).join(', ');
        return `update ${t} set ${sets}${where}${this.returning ? ` returning ${selectList(this.returning)}` : ''}`;
      }
      if (this.op === 'delete') return `delete from ${t}${where}${this.returning ? ` returning ${selectList(this.returning)}` : ''}`;
      const order = this.orders.length ? ` order by ${this.orders.join(', ')}` : '';
      const limit = this.from !== undefined ? ` limit ${this.to - this.from + 1} offset ${this.from}` : this.max ? ` limit ${Math.trunc(this.max)}` : '';
      return `select ${selectList(this.cols)} from ${t}${where}${order}${limit}`;
    }
    async run() {
      try {
        if (this.op === 'select' && this.count) {
          const where = this.where.length ? ` where ${this.where.join(' and ')}` : '';
          const n = (await pg.query(`select count(*)::int as n from public.${ident(this.table)}${where}`, this.params)).rows[0].n;
          if (this.head) return { data: null, error: null, count: n };
          const params = [...this.params];
          const rows = (await pg.query(this.sql(), params)).rows.map(plain);
          return { data: rows, error: null, count: n };
        }
        const rows = (await pg.query(this.sql(), this.params)).rows.map(plain);
        if (this.op !== 'select' && !this.returning) return { data: null, error: null };
        if (this.single) {
          if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
          return { data: rows[0] || null, error: null };
        }
        return { data: rows, error: null };
      } catch (e) {
        return { data: null, error: { code: e.code || 'XX000', message: e.message } };
      }
    }
  }
  return { from: (table) => new Q(table) };
}
