// An in-memory database for the practice start tests (adapted from the egress-practice work in progress,
// a15bac4f, minus its verdict-table parts): it understands exactly the query shapes the practice start uses
// (column lists with json-path aliases such as `ev_policy:evidence->record->>policy_version`, eq / in / gte /
// not / is, the visible-rows `or` filter, multi-column order, range, limit), and it counts the bytes of every
// response the way the network would carry them, so a test can say how many bytes a start reads and in how
// many requests. `failOn` makes one request shape answer with an error. No network.
import { VISIBLE_QUESTION_FILTER } from '../../practice_source.js';

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
 * tables: { name: rows[] }. failOn(call) may return an error object to answer that request with, where call is
 * { table, columns, filters } (filters: the names of the gte / eq / in / not columns used).
 * db.calls: one entry per request { table, columns, bytes, rows, filters }.
 */
export function practiceFakeDb(tables, { failOn = null } = {}) {
  const calls = [];
  const from = (table) => {
    const rowFilters = [];
    const used = [];
    const orders = [];
    let columns = '*';
    let range = null;
    let max = null;
    const add = (name, predicate) => { used.push(name); rowFilters.push(predicate); };
    const query = {
      select(value) { columns = value; return query; },
      eq(column, value) { add(`eq:${column}`, (row) => row[column] === value); return query; },
      is(column, value) { add(`is:${column}`, (row) => (row[column] ?? null) === value); return query; },
      not(column, operator, value) {
        if (operator !== 'is' || value !== null) throw new Error('fake db: unsupported not()');
        add(`not:${column}`, (row) => (row[column] ?? null) !== null);
        return query;
      },
      gte(column, value) { add(`gte:${column}`, (row) => Number(row[column]) >= value); return query; },
      in(column, values) { add(`in:${column}`, (row) => values.includes(row[column])); return query; },
      or(expression) {
        if (expression !== VISIBLE_QUESTION_FILTER) throw new Error(`fake db: unexpected or(${expression})`);
        const predicates = splitTop(expression).map(termPredicate);
        add('or:visible', (row) => predicates.some((predicate) => predicate(row)));
        return query;
      },
      order(column, { ascending = true } = {}) { orders.push({ column, ascending }); return query; },
      limit(n) { max = n; return query; },
      range(start, end) { range = [start, end]; return query; },
      then(resolve, reject) {
        const done = (value) => Promise.resolve(value).then(resolve, reject);
        const failure = failOn?.({ table, columns, filters: [...used] });
        if (failure) { calls.push({ table, columns, bytes: 0, rows: 0, filters: [...used], error: failure.code }); return done({ data: null, error: failure }); }
        let data = (tables[table] || []).filter((row) => rowFilters.every((filter) => filter(row)));
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
        calls.push({ table, columns, bytes: bytesOf(data), rows: data.length, filters: [...used] });
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
