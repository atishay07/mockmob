// An in-memory database for the practice start tests: it understands exactly the query shapes the practice
// start, the repair candidates and the verdict build use (column lists with json-path aliases such as
// `ev_sig:evidence->>signature`, eq / in / gte / not / is, the two `or` filters, multi-column order, range,
// limit, upsert, delete), and it counts the bytes of every response the way the network would carry them, so a
// test can say how many bytes a start reads and in how many requests. No network.
import { PRACTICE_MANAGED_FILTER } from '../practice_pick.js';
import { VISIBLE_QUESTION_FILTER } from '../practice_source.js';

const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value));

function pathValue(row, path) {
  const [column, ...rest] = path.split(/->>?/);
  let node = row[column] === undefined ? null : row[column];
  for (const key of rest) node = node && typeof node === 'object' ? (node[key] ?? null) : null;
  if (/->>[^>]*$/.test(path) && node !== null && typeof node === 'object') return JSON.stringify(node);
  if (/->>[^>]*$/.test(path) && node !== null) return String(node);
  return node;
}

function projector(columns) {
  if (!columns || columns === '*') return (row) => row;
  const items = columns.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const alias = item.includes(':') ? item.slice(0, item.indexOf(':')) : null;
    const path = alias ? item.slice(item.indexOf(':') + 1) : item;
    return { name: alias || path, path };
  });
  return (row) => Object.fromEntries(items.map(({ name, path }) => [name, pathValue(row, path)]));
}

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) { parts.push(current); current = ''; } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function termPredicate(term) {
  if (term.startsWith('and(') && term.endsWith(')')) {
    const inner = splitTop(term.slice(4, -1)).map(termPredicate);
    return (row) => inner.every((predicate) => predicate(row));
  }
  const first = term.indexOf('.');
  const column = term.slice(0, first);
  const rest = term.slice(first + 1);
  if (rest === 'not.is.null') return (row) => (row[column] ?? null) !== null;
  if (rest === 'is.null') return (row) => (row[column] ?? null) === null;
  if (rest.startsWith('eq.')) return (row) => String(row[column]) === rest.slice(3);
  throw new Error(`fake db: unsupported or-term ${term}`);
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * tables: { name: rows[] }. missing: table names that answer "does not exist" (PGRST205).
 * db.calls: one entry per request { table, op, columns, bytes, rows }.
 */
export function practiceFakeDb(tables, { missing = [] } = {}) {
  const calls = [];
  const from = (table) => {
    const filters = [];
    const orders = [];
    let columns = '*';
    let range = null;
    let max = null;
    let op = 'select';
    let payload = null;
    const query = {
      select(value) { if (op === 'select') columns = value; return query; },
      eq(column, value) { filters.push((row) => row[column] === value); return query; },
      is(column, value) { filters.push((row) => (row[column] ?? null) === value); return query; },
      not(column, operator, value) {
        if (operator !== 'is' || value !== null) throw new Error('fake db: unsupported not()');
        filters.push((row) => (row[column] ?? null) !== null);
        return query;
      },
      gte(column, value) { filters.push((row) => Number(row[column]) >= value); return query; },
      in(column, values) { filters.push((row) => values.includes(row[column])); return query; },
      or(expression) {
        if (expression !== PRACTICE_MANAGED_FILTER && expression !== VISIBLE_QUESTION_FILTER) throw new Error(`fake db: unexpected or(${expression})`);
        const predicates = splitTop(expression).map(termPredicate);
        filters.push((row) => predicates.some((predicate) => predicate(row)));
        return query;
      },
      order(column, { ascending = true } = {}) { orders.push({ column, ascending }); return query; },
      limit(n) { max = n; return query; },
      range(from, to) { range = [from, to]; return query; },
      upsert(rows) { op = 'upsert'; payload = rows; return query; },
      delete() { op = 'delete'; return query; },
      then(resolve, reject) {
        const done = (value) => Promise.resolve(value).then(resolve, reject);
        if (missing.includes(table)) { calls.push({ table, op, columns, bytes: 0, rows: 0, error: 'missing' }); return done({ data: null, error: { code: 'PGRST205', message: `no ${table}` } }); }
        tables[table] ||= [];
        if (op === 'upsert') {
          for (const row of payload) {
            const at = tables[table].findIndex((existing) => existing.question_id === row.question_id);
            if (at >= 0) tables[table][at] = { ...row }; else tables[table].push({ ...row });
          }
          calls.push({ table, op, columns: null, bytes: bytesOf(payload), rows: payload.length });
          return done({ data: null, error: null });
        }
        if (op === 'delete') {
          const hit = tables[table].filter((row) => filters.every((filter) => filter(row)));
          tables[table] = tables[table].filter((row) => !hit.includes(row));
          calls.push({ table, op, columns: null, bytes: 0, rows: hit.length });
          return done({ data: null, error: null });
        }
        let data = tables[table].filter((row) => filters.every((filter) => filter(row)));
        if (orders.length) {
          data = [...data].sort((a, b) => {
            for (const { column, ascending } of orders) {
              const x = a[column] ?? null; const y = b[column] ?? null;
              if (x === y) continue;
              // Postgres: nulls last ascending, first descending.
              const order = x === null ? 1 : y === null ? -1 : compare(x, y);
              return ascending ? order : -order;
            }
            return 0;
          });
        }
        if (range) data = data.slice(range[0], range[1] + 1);
        if (max !== null) data = data.slice(0, max);
        const project = projector(columns);
        data = structuredClone(data.map(project));
        calls.push({ table, op, columns, bytes: bytesOf(data), rows: data.length });
        return done({ data, error: null });
      },
    };
    return query;
  };
  return {
    calls, tables, from,
    reset() { calls.length = 0; },
    bytes: (predicate = () => true) => calls.filter(predicate).reduce((sum, call) => sum + call.bytes, 0),
    requests: (predicate = () => true) => calls.filter(predicate).length,
  };
}
