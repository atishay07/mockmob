// Shared by the NTA index tests: an in-memory database that sorts, limits, upserts and deletes like the
// real one (so the query shapes are checked too), and small builders for a subject, its index rows and a
// bank where the newest question was published after the index was built. No network.
import { NTA_INDEX_VERSION, signNtaIndex } from '../nta_engine.js';
import { contentHash } from '../content_evidence.js';
import { FIXTURE_SECRET, makeBank } from './ntaEngineFixtures.mjs';

export const BUILT = '2026-10-13T12:00:00.000Z';
export const OLD = '2026-10-01T00:00:00.000Z';
export const PRODUCTION = { VERCEL_ENV: 'production' };

export function fakeDb(tables, { missing = [], failOn = null } = {}) {
  const calls = [];
  const builder = (table) => {
    const filters = [];
    let range = null;
    let columns = '*';
    let order = null;
    let max = null;
    let op = 'select';
    let payload = null;
    let head = false;
    const query = {
      select(value, options) { if (op === 'select') { columns = value; head = options?.head === true; calls.push(['select', table, value, ...(head ? ['head'] : [])]); } return query; },
      eq(column, value) { filters.push((row) => row[column] === value); return query; },
      is(column, value) { filters.push((row) => (row[column] ?? null) === value); return query; },
      gt(column, value) { filters.push((row) => Number(row[column]) > value); return query; },
      gte(column, value) { filters.push((row) => (typeof value === 'string' ? String(row[column] ?? '') >= value : Number(row[column]) >= value)); return query; },
      in(column, values) { filters.push((row) => values.includes(row[column])); return query; },
      or() { filters.push((row) => row.evidence != null || Number(row.quality_score) > 0); return query; },
      order(column, { ascending = true, nullsFirst } = {}) { order = { column, ascending, nullsFirst }; return query; },
      limit(n) { max = n; return query; },
      range(from, to) { range = [from, to]; return query; },
      abortSignal() { return query; },
      upsert(rows) { op = 'upsert'; payload = rows; calls.push(['upsert', table, rows.length]); return query; },
      delete() { op = 'delete'; calls.push(['delete', table]); return query; },
      then(resolve, reject) {
        if (missing.includes(table)) return Promise.resolve({ data: null, error: { code: '42P01', message: 'missing' } }).then(resolve, reject);
        if (failOn && failOn(table, op, columns)) return Promise.resolve({ data: null, error: { code: 'XX000', message: 'boom' } }).then(resolve, reject);
        tables[table] ||= [];
        if (op === 'upsert') {
          for (const row of payload) {
            const at = tables[table].findIndex((existing) => existing.question_id === row.question_id);
            if (at >= 0) tables[table][at] = { ...row }; else tables[table].push({ ...row });
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        if (op === 'delete') {
          const hit = tables[table].filter((row) => filters.every((filter) => filter(row)));
          tables[table] = tables[table].filter((row) => !hit.includes(row));
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        let data = tables[table].filter((row) => filters.every((filter) => filter(row)));
        if (head) return Promise.resolve({ data: null, count: data.length, error: null }).then(resolve, reject);
        if (order) {
          const { column, ascending } = order;
          // Nulls last either way, as nullsFirst:false asks.
          data = [...data].sort((a, b) => {
            const x = a[column] ?? null; const y = b[column] ?? null;
            if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
            return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
          });
        }
        if (range) data = data.slice(range[0], range[1] + 1);
        if (max !== null) data = data.slice(0, max);
        if (columns && columns !== '*') {
          const keep = columns.split(',').map((value) => value.trim());
          data = data.map((row) => Object.fromEntries(keep.filter((key) => key in row).map((key) => [key, row[key]])));
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { calls, tables, from: (table) => builder(table) };
}

export const sideTables = { passage_groups: [], question_content_disputes: [], recovery_family_holds: [], user_question_progress: [], attempts: [] };

export function indexRows(rows, subject, verifiedAt = BUILT) {
  return rows.map((row) => {
    const record = row.evidence.record;
    const entry = {
      question_id: row.id, subject, score: 8.5, luna: record.checks.exam_fit.item_quality_score, gemini: record.checks.independent_evaluation.item_quality_score,
      content_hash: contentHash(row), family_id: null, objective_tag: null, index_version: NTA_INDEX_VERSION, verified_at: verifiedAt,
    };
    return { ...entry, signature: signNtaIndex(entry, FIXTURE_SECRET) };
  });
}

// A subject whose bank holds `total` questions; the last one was published after the index was built.
export function setup({ published = '2026-10-14T09:00:00.000Z', column = 'created_at' } = {}) {
  const all = makeBank('chemistry').map((row) => ({ ...row, created_at: OLD, live_at: OLD }));
  const fresh = { ...all[all.length - 1], [column]: published };
  const questions = [...all.slice(0, -1), fresh];
  const indexed = all.slice(0, -1);
  return { questions, indexed, fresh, index: indexRows(indexed, 'chemistry') };
}
