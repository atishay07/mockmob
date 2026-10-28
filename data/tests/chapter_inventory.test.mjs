// What the bank holds per chapter and how much of it a student has never seen (data/chapter_inventory.js, spec D.5-5),
// over fixtures shaped like the production rows: public.questions (id, subject, chapter, status, verification_state,
// exploration_state, is_deleted) and public.user_question_progress (user_id, question_id, subject, chapter, seen_count,
// attempt_count, correct_count, last_attempted_at), columns read from the production schema on 16 Oct 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readChapterInventory, VISIBLE_QUESTION_FILTER, INVENTORY_ID_CHUNK, INVENTORY_MAX_CHAPTERS } from '../chapter_inventory.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// A small stand-in for the supabase-js query builder: filters are applied to arrays, and every request is logged.
function fakeDb({ questions, progress, failOn = null }) {
  const log = [];
  const tables = { questions, user_question_progress: progress };
  const from = (table) => {
    const q = { table, filters: [], head: false, count: null, range: null, columns: null };
    const api = {
      select(columns, opts = {}) { q.columns = columns; q.head = opts.head === true; q.count = opts.count || null; return api; },
      eq(col, value) { q.filters.push((r) => r[col] === value); return api; },
      gt(col, value) { q.filters.push((r) => r[col] > value); return api; },
      in(col, values) { q.filters.push((r) => values.includes(r[col])); return api; },
      or(expr) {
        if (expr !== VISIBLE_QUESTION_FILTER) throw new Error(`unknown or() filter: ${expr}`);
        q.filters.push((r) => r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active'));
        return api;
      },
      order() { return api; },
      range(from, to) { q.range = [from, to]; return api; },
      then(resolve, reject) {
        log.push({ table, head: q.head, columns: q.columns, range: q.range });
        if (failOn && failOn(q, table)) return Promise.resolve({ data: null, count: null, error: { message: 'boom' } }).then(resolve, reject);
        const rows = tables[table].filter((r) => q.filters.every((f) => f(r)));
        if (q.head) return Promise.resolve({ data: null, count: rows.length, error: null }).then(resolve, reject);
        const page = q.range ? rows.slice(q.range[0], q.range[1] + 1) : rows;
        return Promise.resolve({ data: page.map((r) => ({ ...r })), count: null, error: null }).then(resolve, reject);
      },
    };
    return api;
  };
  return { from, log };
}

const question = (id, chapter, extra = {}) => ({ id, subject: 'accountancy', chapter, status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false, ...extra });
const seen = (userId, questionId, chapter, attempts = 1) => ({ user_id: userId, question_id: questionId, subject: 'accountancy', chapter, seen_count: attempts, attempt_count: attempts, correct_count: 0 });
const many = (chapter, n, prefix = chapter) => Array.from({ length: n }, (_, i) => question(`${prefix}-${i + 1}`, chapter));

test('bank and unseen are counted per chapter, from counts alone', async () => {
  const questions = [...many('Debentures', 9), ...many('Share Capital', 30), ...many('Cash Flow Statement', 4)];
  const progress = [
    ...['Debentures-1', 'Debentures-2', 'Debentures-3'].map((id) => seen('u1', id, 'Debentures')),
    // Rows with no attempt (seen on screen, never answered) are unseen, the same test the picker ranks on.
    seen('u1', 'Debentures-4', 'Debentures', 0),
    // Another student's progress is not this student's.
    seen('u2', 'Debentures-5', 'Debentures'),
    ...Array.from({ length: 30 }, (_, i) => seen('u1', `Share Capital-${i + 1}`, 'Share Capital')),
  ];
  const db = fakeDb({ questions, progress });
  const out = await readChapterInventory(db, { userId: 'u1', subject: 'accountancy', chapters: ['Debentures', 'Share Capital', 'Cash Flow Statement'] });
  assert.deepEqual(out, { Debentures: { bank: 9, unseen: 6 }, 'Share Capital': { bank: 30, unseen: 0 }, 'Cash Flow Statement': { bank: 4, unseen: 4 } });
  // Egress: every request to the bank is a head/count request, and no request reads more than the student's own rows.
  for (const call of db.log.filter((c) => c.table === 'questions')) assert.equal(call.head, true, 'the bank is only counted');
  for (const call of db.log.filter((c) => c.table === 'user_question_progress')) assert.equal(call.columns, 'question_id', 'ids alone');
});

test('a question that was deleted or is no longer visible is not subtracted from a chapter it no longer fills', async () => {
  const questions = [...many('Debentures', 8), question('Debentures-9', 'Debentures', { is_deleted: true }), question('Debentures-10', 'Debentures', { status: 'draft', verification_state: 'pending' })];
  const progress = ['Debentures-1', 'Debentures-9', 'Debentures-10'].map((id) => seen('u1', id, 'Debentures'));
  const out = await readChapterInventory(fakeDb({ questions, progress }), { userId: 'u1', subject: 'accountancy', chapters: ['Debentures'] });
  assert.deepEqual(out, { Debentures: { bank: 8, unseen: 7 } }, 'the student attempted 3 questions but only 1 is still in the bank');
});

test('a long history is counted back in chunks of ids, so no request carries an over-long id list', async () => {
  const n = INVENTORY_ID_CHUNK * 2 + 30;
  const questions = many('Share Capital', n + 12, 'sc');
  const progress = Array.from({ length: n }, (_, i) => seen('u1', `sc-${i + 1}`, 'Share Capital'));
  const db = fakeDb({ questions, progress });
  const out = await readChapterInventory(db, { userId: 'u1', subject: 'accountancy', chapters: ['Share Capital'] });
  assert.deepEqual(out, { 'Share Capital': { bank: n + 12, unseen: 12 } });
  // One bank count, one page of the student's ids, three counts back (100, 100 and 30 ids).
  assert.equal(db.log.filter((c) => c.table === 'questions').length, 1 + 3);
});

test('a chapter the student has not touched costs one count and one empty read', async () => {
  const db = fakeDb({ questions: many('Accounting Ratios', 12), progress: [] });
  const out = await readChapterInventory(db, { userId: 'u1', subject: 'accountancy', chapters: ['Accounting Ratios'] });
  assert.deepEqual(out, { 'Accounting Ratios': { bank: 12, unseen: 12 } });
  assert.equal(db.log.length, 2);
});

test('a chapter whose read fails is left out; the others still answer, and the failure is reported', async () => {
  const questions = [...many('Debentures', 9), ...many('Share Capital', 30)];
  const failures = [];
  const db = fakeDb({ questions, progress: [] });
  // Fail the Share Capital count by wrapping from(): the filter on the chapter name throws for it.
  const wrapped = { from: (table) => { const b = db.from(table); const eq = b.eq; b.eq = (col, value) => { if (col === 'chapter' && value === 'Share Capital' && table === 'questions') throw new Error('count failed'); return eq(col, value); }; return b; } };
  const out = await readChapterInventory(wrapped, { userId: 'u1', subject: 'accountancy', chapters: ['Debentures', 'Share Capital'], warn: (chapter, error) => failures.push([chapter, error.message]) });
  assert.deepEqual(out, { Debentures: { bank: 9, unseen: 9 } });
  assert.deepEqual(failures, [['Share Capital', 'count failed']]);
});

test('a count that errors is not read as zero', async () => {
  const db = fakeDb({ questions: many('Debentures', 9), progress: [], failOn: (q) => q.head });
  const warned = [];
  const out = await readChapterInventory(db, { userId: 'u1', subject: 'accountancy', chapters: ['Debentures'], warn: (c) => warned.push(c) });
  assert.deepEqual(out, {});
  assert.deepEqual(warned, ['Debentures']);
});

test('no student, no subject, no chapters or no client: nothing is read', async () => {
  const db = fakeDb({ questions: many('Debentures', 9), progress: [] });
  for (const input of [{ userId: '', subject: 'accountancy', chapters: ['Debentures'] }, { userId: 'u1', subject: '', chapters: ['Debentures'] }, { userId: 'u1', subject: 'accountancy', chapters: [] }, { userId: 'u1', subject: 'accountancy', chapters: 'Debentures' }, undefined]) {
    assert.deepEqual(await readChapterInventory(db, input), {});
  }
  assert.deepEqual(await readChapterInventory(null, { userId: 'u1', subject: 'accountancy', chapters: ['Debentures'] }), {});
  assert.equal(db.log.length, 0);
});

test('at most INVENTORY_MAX_CHAPTERS chapters are read, repeats once', async () => {
  const names = Array.from({ length: 12 }, (_, i) => `Chapter ${i + 1}`);
  const questions = names.flatMap((c) => many(c, 6));
  const db = fakeDb({ questions, progress: [] });
  const out = await readChapterInventory(db, { userId: 'u1', subject: 'accountancy', chapters: [names[0], names[0], ...names] });
  assert.equal(Object.keys(out).length, INVENTORY_MAX_CHAPTERS);
  assert.ok(names.slice(0, INVENTORY_MAX_CHAPTERS).every((c) => c in out));
});

test('the visible filter is the one the practice picker reads (data/db.js)', () => {
  const source = readFileSync(join(HERE, '..', 'db.js'), 'utf8');
  const match = source.match(/const VISIBLE_QUESTION_FILTER = '([^']+)';/);
  assert.ok(match, 'data/db.js still defines VISIBLE_QUESTION_FILTER');
  assert.equal(VISIBLE_QUESTION_FILTER, match[1]);
});
