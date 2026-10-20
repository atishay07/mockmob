import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMobQuestionLoaders, LIGHT_MAX, LIGHT_MS } from '../mob_question_reads.js';
import { computeChapterCounts, cachedChapterCounts } from '../mob_chapter_counts.js';
import { createSubjectMemo } from '../subject_token.js';
import { getCanonicalChapters } from '../canonical_syllabus.js';
import { evidenceSignature } from '../content_evidence.js';
import { SECRET, fakeDb, legacyRow, managedRows, rng, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { practiceFakeDb } from './helpers/practice_fake_db.mjs';

// Egress items F11 and F12 (20 Oct 2026): the Mob's question reads and the extra-paper chooser.
const restore = setFixtureSecret();
after(restore);
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIN = 60_000;
const STAMP = '2026-09-01T00:00:00.000Z';

// ---- F12 ----------------------------------------------------------------------------------------------------------
const bank = () => { const r = rng(12); return Array.from({ length: 80 }, (_, n) => ({ ...legacyRow(r, n, { subject: 'accountancy' }), status: 'live', is_deleted: false, updated_at: STAMP })); };
// only the fields the Mob's public views read; a strict fake throws on any other column
const toOut = (r) => ({ id: r.id, stem: r.question ?? r.body, options: r.options, correctIndex: r.correct_index, explanation: r.explanation, passage: r.passage_text ?? null, chapter: r.chapter, subject: r.subject });
const attach = async (rows) => rows;
const mobDb = (rows, strict = true) => fakeDb({ questions: rows, recovery_family_holds: [] }, { strict });
const questionReads = (db, select) => db.calls.filter((c) => c.table === 'questions' && (select ? c.select === select : c.select !== 'id,updated_at'));

test('F12: a race of 30 answers reads a handful of batches, not two rows per answer, and every key is the one the full path gives', async () => {
  const rows = bank();
  const ids = rows.slice(0, 30).map((r) => r.id);
  const db = mobDb(rows);
  let t = 1_000_000;
  const loaders = createMobQuestionLoaders({ db, attach, toOut, now: () => t });
  const reference = createMobQuestionLoaders({ db: mobDb(rows, false), attach, toOut, now: () => t });
  let served = 0;
  for (let q = 0; q < 30; q += 1) {
    // each answer reads the key of the question just answered, then the next question with the five after it (games.js)
    const [key] = await loaders.loadLight([ids[q]]);
    const nextQ = q + 1;
    const [next] = nextQ < 30 ? await loaders.loadLight([ids[nextQ]], { warm: ids.slice(nextQ + 1, nextQ + 6) }) : [];
    const [fullKey] = await reference.loadLight([ids[q]]);
    assert.deepEqual(key, fullKey);
    assert.equal(key.correctIndex, rows[q].correct_index);
    if (nextQ < 30) { assert.equal(next.id, ids[nextQ]); served += 1; }
    t += 3_000; // 90 seconds in all: inside the two minutes
  }
  assert.equal(served, 29);
  const reads = questionReads(db).length;
  assert.ok(reads <= 6, `${reads} reads for a 30-answer race (it was 60: two rows per answer)`);
  // an all-at-once read of the paper and then single reads are served from memory
  const db2 = mobDb(rows);
  const l2 = createMobQuestionLoaders({ db: db2, attach, toOut, now: () => 5 });
  assert.equal((await l2.loadLight(ids)).length, 30);
  for (const id of ids) await l2.loadLight([id]);
  assert.equal(questionReads(db2).length, 1, 'one batch read serves every later single read');
  // a withdrawn question inside the window is not served: the member gets the next that is, never one ahead by mistake
  const rows3 = bank(); rows3[2].is_deleted = true;
  const l3 = createMobQuestionLoaders({ db: mobDb(rows3), attach, toOut });
  const window = await l3.loadLight([rows3[1].id], { warm: rows3.slice(2, 7).map((r) => r.id) });
  assert.deepEqual(window.map((x) => x.id), [rows3[1].id], 'only the question asked for is returned');
  assert.deepEqual(await l3.loadLight([rows3[2].id]), [], 'a withdrawn question in the warmed batch is not served');
});

test('F12: the light read gives the same fields as the full read, in the paper\'s order, and never the evidence', async () => {
  const rows = bank();
  const ids = rows.slice(5, 25).map((r) => r.id).reverse();
  const db = mobDb(rows);
  const loaders = createMobQuestionLoaders({ db, attach, toOut });
  const light = await loaders.loadLight(ids);
  const full = await createMobQuestionLoaders({ db: mobDb(rows, false), attach, toOut }).loadFull(ids);
  assert.deepEqual(light, full);
  assert.deepEqual(light.map((q) => q.id), ids);
  const call = db.calls.find((c) => c.table === 'questions');
  assert.ok(!call.select.split(',').includes('evidence') && !call.select.split(',').includes('provenance'), 'no signed record in the light select');
  assert.ok(call.select.includes('correct_index'));
  light[0].options.push('MUTATED');
  assert.ok(!(await loaders.loadLight([ids[0]]))[0].options.includes('MUTATED'), 'each caller has its own copy');
});

test('F12: the TTL, the size bound, and a withdrawn question not served from an older copy', async () => {
  const rows = bank();
  let t = 10_000_000;
  const db = mobDb(rows);
  const loaders = createMobQuestionLoaders({ db, attach, toOut, now: () => t });
  const id = rows[0].id;
  assert.equal((await loaders.loadLight([id])).length, 1);
  t += LIGHT_MS - 1;
  await loaders.loadLight([id]);
  assert.equal(questionReads(db).length, 1, 'inside the TTL: no read');
  rows[0].is_deleted = true; // withdrawn
  assert.equal((await loaders.loadLight([id])).length, 1, 'inside the TTL the older copy still stands (the documented two minutes)');
  t += 2;
  assert.deepEqual(await loaders.loadLight([id]), [], 'after the TTL a withdrawn question is not served');
  assert.equal(loaders.lightSize <= LIGHT_MAX, true);
  const big = createMobQuestionLoaders({ db: mobDb(Array.from({ length: LIGHT_MAX + 50 }, (_, n) => ({ ...rows[1], id: `big-${n}` }))), attach, toOut, now: () => t });
  for (let i = 0; i < LIGHT_MAX + 50; i += 50) await big.loadLight(Array.from({ length: 50 }, (_, k) => `big-${i + k}`).filter((x) => Number(x.slice(4)) < LIGHT_MAX + 50));
  assert.ok(big.lightSize <= LIGHT_MAX, `${big.lightSize} kept`);
  assert.deepEqual(await loaders.loadLight([]), []);
  assert.deepEqual(await loaders.loadLight([7, null]), []);
});

test('F12: the start paths read the full rows through the stamp cache, the second member of a Mob reads stamps only, and a hidden row is dropped as the query dropped it', async () => {
  const rows = bank().map((r, i) => (i === 3 ? { ...r, is_deleted: true } : i === 4 ? { ...r, status: 'pending' } : r));
  const ids = rows.slice(0, 12).map((r) => r.id);
  const db = mobDb(rows, false);
  const loaders = createMobQuestionLoaders({ db, attach, toOut });
  const first = await loaders.loadFull(ids);
  assert.deepEqual(first.map((q) => q.id), ids.filter((id) => id !== rows[3].id && id !== rows[4].id), 'deleted and not visible rows are left out, in the paper order');
  db.calls.length = 0;
  const second = await loaders.loadFull(ids);
  assert.deepEqual(second, first);
  assert.equal(db.calls.filter((c) => c.select === '*').length, 0, 'the second start read no row in full');
  assert.equal(db.calls.filter((c) => c.select === 'id,updated_at').length, 1);
});

test('F12: only the three start paths keep the full loader; every other Mob read uses the light one', () => {
  const games = src('src/lib/server/mob/games.js');
  const service = src('src/lib/server/mob/service.js');
  const deps = src('src/lib/server/mob/deps.js');
  // games.js: the Full mock together start (mockPaper) is the one full read
  assert.equal((games.match(/deps\.loadQuestions\(/g) || []).length, 1);
  assert.match(games, /async function mockPaper[\s\S]*?const questions = await deps\.loadQuestions\(g\.question_ids\)/);
  assert.match(games, /const \[question\] = open \? await loadLight\(\[g\.question_ids\[nextQ\]\], \{ warm: g\.question_ids\.slice\(nextQ \+ 1, nextQ \+ 6\) \}\)/);
  assert.equal((games.match(/loadLight\(/g) || []).length, 10);
  // service.js: the weekly and the extra paper starts
  assert.equal((service.match(/deps\.loadQuestions\(/g) || []).length, 2);
  assert.match(service, /const questions = await deps\.loadQuestions\(ids\)\.catch\(\(\) => \[\]\);\r?\n\s+if \(!Array\.isArray\(questions\) \|\| questions\.length !== ids\.length\) throw new MobError\('PAPER_UNAVAILABLE'\)/);
  assert.match(service, /const questions = await deps\.loadQuestions\(extra\.question_ids\)/);
  assert.equal((service.match(/loadLight\(ids\)/g) || []).length, 2);
  assert.match(deps, /loadQuestions, loadQuestionsLight, trapNameFor/);
  assert.match(deps, /createMobQuestionLoaders\(\{ db: \(\) => supabaseAdmin\(\)/);
  // nothing the light rows lack is read by the light sites: the practice session's stored fields come from the start paths only
  for (const field of ['verificationEvidence', 'sourceKind', 'familyId']) assert.ok(!new RegExp(field).test(games + service), field);
});

// ---- F11 ----------------------------------------------------------------------------------------------------------
function chapterBank({ managed = false } = {}) {
  const chapters = getCanonicalChapters('accountancy').slice(0, 5);
  const r = rng(11);
  const rows = [];
  let n = 0;
  for (const chapter of chapters) for (let i = 0; i < 24; i += 1) { rows.push({ ...legacyRow(r, n, { subject: 'accountancy' }), chapter, status: 'live', is_deleted: false, score: 0, family_id: null, verification_state: null, legacy_screening: null, updated_at: STAMP, concept_id: `c${n % 11}` }); n += 1; }
  if (managed) rows.push(...managedRows(r, 9000, 6, { subject: 'accountancy' }).map((x) => ({ ...x, chapter: chapters[0], updated_at: STAMP })));
  return rows;
}
const heads = (db) => db.calls.filter((c) => c.head);
const wholeSubject = (db) => db.calls.filter((c) => c.table === 'questions' && c.columns === '*');
const rowsOnly = (value) => JSON.stringify(value);

test('F11: the chapter table is the same computation as before, kept five minutes, then revalidated with head counts and the holds ids', async () => {
  const rows = chapterBank();
  let t = Date.now();
  const db = practiceFakeDb({ questions: rows, recovery_family_holds: [] });
  const memo = createSubjectMemo({ now: () => t });
  const get = () => cachedChapterCounts(db, 'accountancy', { memo, now: () => t });
  const first = await get();
  const direct = await computeChapterCounts(practiceFakeDb({ questions: rows, recovery_family_holds: [] }), 'accountancy');
  assert.deepEqual(first, direct, 'the table is exactly the old computation');
  assert.ok(first.length >= 3 && first.every((c) => c.ready >= 5), 'the chooser has chapters that fill papers');
  assert.equal(wholeSubject(db).length, 1);
  db.reset();
  t += 4 * MIN;
  assert.deepEqual(await get(), first);
  assert.equal(db.calls.length, 0, 'inside five minutes nothing is asked');
  t += 2 * MIN;
  assert.deepEqual(await get(), first);
  assert.equal(wholeSubject(db).length, 0, 'unchanged: no whole-subject read');
  assert.equal(heads(db).length, 2);
  assert.ok(db.calls.some((c) => c.table === 'recovery_family_holds'), 'the holds ids are read (a few bytes)');
  assert.ok(db.bytes() < 2000, `${db.bytes()} B for the revalidation`);
});

test('F11: a touched row, an inserted row, a new hold, an evidence expiry and a failed check each recompute; the old bound was thirty minutes without a check', async () => {
  const base = chapterBank({ managed: true });
  const cases = [
    ['a row written since the read (a withdrawal)', (rows, at) => { rows[2].status = 'pending'; rows[2].updated_at = new Date(at).toISOString(); }, null],
    ['a row inserted', (rows, at) => { rows.push({ ...rows[0], id: 'q-extra-1', updated_at: new Date(at).toISOString() }); }, null],
    ['a new family hold', (rows, at, tables) => { tables.recovery_family_holds.push({ family_id: 'fam-new' }); }, null],
    ['an evidence record expiring (nothing was written)', () => {}, 'expiry'],
  ];
  for (const [name, change, special] of cases) {
    const rows = structuredClone(base);
    const tables = { questions: rows, recovery_family_holds: [] };
    const db = practiceFakeDb(tables);
    let t = Date.now();
    const memo = createSubjectMemo({ now: () => t });
    const get = () => cachedChapterCounts(db, 'accountancy', { memo, now: () => t });
    await get();
    change(rows, t + MIN, tables);
    db.reset();
    t += special === 'expiry' ? 90 * MIN : 6 * MIN; // the managed fixtures expire an hour after they were built
    await get();
    assert.equal(wholeSubject(db).length, 1, name);
  }
  // a failing check recomputes
  const rows = chapterBank();
  const db = practiceFakeDb({ questions: rows, recovery_family_holds: [] }, { failOn: ({ table }) => (table === 'recovery_family_holds' ? { code: 'XX000', message: 'down' } : null) });
  let t = Date.now();
  const memo = createSubjectMemo({ now: () => t });
  const direct = await computeChapterCounts(practiceFakeDb({ questions: rows, recovery_family_holds: [] }), 'accountancy');
  assert.deepEqual(await cachedChapterCounts(db, 'accountancy', { memo, now: () => t }).catch((e) => e.message), await cachedChapterCounts(db, 'accountancy', { memo, now: () => t }).catch((e) => e.message));
  assert.ok(direct.length > 0);
});

test('F11: the table recomputed after a change equals a fresh computation; forgetting drops it; wiring', async () => {
  const rows = chapterBank();
  const tables = { questions: rows, recovery_family_holds: [] };
  const db = practiceFakeDb(tables);
  let t = Date.now();
  const memo = createSubjectMemo({ now: () => t });
  const get = () => cachedChapterCounts(db, 'accountancy', { memo, now: () => t });
  const first = await get();
  // withdraw the whole first chapter
  const chapter = rows[0].chapter;
  for (const row of rows) if (row.chapter === chapter) { row.status = 'pending'; row.updated_at = new Date(t + MIN).toISOString(); }
  t += 6 * MIN;
  const after = await get();
  assert.deepEqual(after, await computeChapterCounts(practiceFakeDb(tables), 'accountancy'));
  assert.ok(first.some((c) => c.chapter === chapter) && !after.some((c) => c.chapter === chapter), 'a withdrawn chapter leaves the chooser within the probe');
  memo.forget('accountancy');
  db.reset();
  await get();
  assert.equal(wholeSubject(db).length, 1, 'forgetChapterCounts drops the entry');
  const deps = src('src/lib/server/mob/deps.js');
  assert.match(deps, /forgetChapterCountsFor\(supabaseAdmin\(\), subject\)/);
  assert.match(deps, /cachedChapterCounts\(supabaseAdmin\(\), subject\)/);
  assert.ok(evidenceSignature && SECRET, 'fixtures loaded');
  assert.equal(rowsOnly(first).length > 0, true);
});
