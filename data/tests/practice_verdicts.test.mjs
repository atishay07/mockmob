import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FALLBACK, PRACTICE_LIGHT_SELECT, slimRecordRow, PRACTICE_MANAGED_STUBS, PRACTICE_QUESTION_COLUMNS, pickFromFullPool, pickFromLightPool, selectPracticeQuestions } from '../practice_pick.js';
import { createPracticeSource } from '../practice_source.js';
import {
  PRACTICE_VERDICT_HASH_COLUMNS, PRACTICE_VERDICT_LOGIC_FILES, PRACTICE_VERDICT_LOGIC_VERSION, PRACTICE_VERDICT_VOLATILE_COLUMNS,
  attachPassageMetadata, describePracticeVerdictRun, practiceInputHash, practiceVerdictBasis, readManagedStubs, refreshAllPracticeVerdicts,
  refreshPracticeVerdicts, signPracticeVerdict, trustedPracticeVerdicts,
} from '../practice_verdicts.js';
import { publicationEligibility, sharedEligibilitySnapshot } from '../evidence_registry.js';
import { evidenceSignature } from '../content_evidence.js';
import { getMode } from '../test_modes.js';
import { ALL_COLUMNS, SECRET, buildSubject, rng } from './practiceFixtures.mjs';
import { practiceFakeDb } from './practiceFakeDb.mjs';

// Stored practice verdicts (16 Oct 2026): a practice start decides evidence-managed questions from signed,
// input-bound verdicts instead of reading their evidence records. These tests run the real queries
// (data/practice_source.js, data/practice_verdicts.js) over an in-memory database that counts response bytes,
// and compare every pick, its order, tier, usage meta and returned row with the whole-subject read.
// Software fixtures; they do not establish academic reliability.
const SUBJECT = 'accountancy';
const NOW = Date.now();

const world = (rows, { holds = [], groups = [], missing = [] } = {}) => practiceFakeDb({
  questions: structuredClone(rows),
  practice_verdict_index: [],
  passage_groups: groups,
  recovery_family_holds: holds.map((family_id) => ({ family_id })),
}, { missing });

const build = (db, options = {}) => refreshPracticeVerdicts(db, SUBJECT, { secret: SECRET, renewWithinMs: 0, ...options });

function startOf(db, { mode: modeId, count, opts = {}, recent = new Set(), progress = new Map(), weak = new Set(), caches, clock, slimRecords = false } = {}) {
  const mode = getMode(modeId);
  const source = createPracticeSource({
    db, subjectId: SUBJECT, mode, opts, targetCount: count, caches, clock,
    hooks: {
      attachPassages: (rows) => attachPassageMetadata(db, rows),
      recentIds: async () => recent,
      userProgress: async (ids) => new Map([...progress].filter(([id]) => ids.includes(id))),
      weakConcepts: async () => weak,
    },
  });
  const fetched = [];
  const loadFullRows = source.loadFullRows;
  source.loadFullRows = async (ids) => { fetched.push(...ids); return loadFullRows(ids); };
  const stats = {};
  return { source, ctx: { mode, targetCount: count, opts, stats, slimRecords, warn: () => {} }, fetched, stats };
}

const freshCaches = () => ({ pools: new Map(), verdicts: new Map() });

async function compareStart(rows, scenario) {
  const { holds, groups, mutate, ...rest } = scenario;
  const db = world(rows, { holds, groups });
  await build(db);
  if (mutate) mutate(db);
  db.reset();
  const full = startOf(db, { ...rest, caches: freshCaches() });
  const expected = await pickFromFullPool(full.source, full.ctx);
  db.reset();
  const slim = startOf(db, { ...rest, caches: freshCaches() });
  const actual = await pickFromLightPool(slim.source, slim.ctx);
  return { expected, actual, slim, db };
}

test('the logic version pins the code the verdict is a function of', () => {
  const hash = createHash('sha256');
  for (const file of PRACTICE_VERDICT_LOGIC_FILES) hash.update(`${file}\n${readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')}\n`);
  const sha = hash.digest('hex').slice(0, 8);
  assert.equal(PRACTICE_VERDICT_LOGIC_VERSION.endsWith(`.${sha}`), true,
    `one of ${PRACTICE_VERDICT_LOGIC_FILES.join(', ')} changed: set PRACTICE_VERDICT_LOGIC_VERSION in data/practice_verdicts.js to 'practice-verdict-<next number>.${sha}'`);
});

test('publication eligibility never reads the columns left out of the input hash, and every column it reads is in it', () => {
  const rows = buildSubject(7, { legacy: 0, managed: 42 });
  const snapshot = sharedEligibilitySnapshot();
  const read = new Set();
  for (const row of rows) {
    const proxy = new Proxy(row, { get(target, key) { if (typeof key === 'string') read.add(key); return target[key]; } });
    publicationEligibility(proxy, snapshot);
  }
  assert.ok(read.size > 8, `the probe saw the properties read: ${[...read].join(',')}`);
  const volatile = new Set(PRACTICE_VERDICT_VOLATILE_COLUMNS);
  assert.deepEqual([...read].filter((key) => volatile.has(key)), [], 'a column named volatile is read by the verdict logic');
  const hashed = new Set(PRACTICE_VERDICT_HASH_COLUMNS);
  const unhashed = [...read].filter((key) => PRACTICE_QUESTION_COLUMNS.includes(key) && !hashed.has(key));
  assert.deepEqual(unhashed, [], 'a plain column the verdict logic reads is missing from the hash');
  assert.ok(read.has('evidence') && read.has('provenance'));
  for (const column of PRACTICE_VERDICT_VOLATILE_COLUMNS) assert.ok(PRACTICE_QUESTION_COLUMNS.includes(column), `${column} is a real practice column`);
  assert.deepEqual([...PRACTICE_VERDICT_HASH_COLUMNS, ...PRACTICE_VERDICT_VOLATILE_COLUMNS].sort(), [...PRACTICE_QUESTION_COLUMNS].sort());
});

test('the input hash moves with content, evidence signature and provenance, and not with counters', () => {
  const [row] = buildSubject(3, { legacy: 0, managed: 3 });
  const base = practiceInputHash(row, row.evidence.signature, row.provenance);
  assert.equal(base, practiceInputHash(structuredClone(row), row.evidence.signature, row.provenance));
  for (const column of PRACTICE_VERDICT_VOLATILE_COLUMNS) assert.equal(practiceInputHash({ ...row, [column]: 12345 }, row.evidence.signature, row.provenance), base, `${column} is a counter`);
  for (const patch of [{ explanation: 'changed' }, { body: 'changed' }, { options: ['a', 'b', 'c', 'd'] }, { correct_answer: 'B' }, { status: 'quarantined' }, { family_id: 'other' }, { passage_text: 'attached passage' }, { verification_state: 'disputed' }, { chapter: 'Ratios' }]) {
    assert.notEqual(practiceInputHash({ ...row, ...patch }, row.evidence.signature, row.provenance), base, JSON.stringify(patch));
  }
  assert.notEqual(practiceInputHash(row, 'another-signature', row.provenance), base);
  assert.notEqual(practiceInputHash(row, row.evidence.signature, { kind: 'authentic_pyq' }), base);
  assert.equal(practiceInputHash(row, row.evidence.signature, row.provenance).length, 32);
});

test('a verdict is believed only while its signature, inputs, basis and expiry all check out', async () => {
  const rows = buildSubject(5, { legacy: 0, managed: 12, period: 40 });
  const db = world(rows);
  const result = await build(db);
  assert.equal(result.status, 'ok');
  assert.equal(result.managed, 12);
  const basis = practiceVerdictBasis();
  const verdictRows = structuredClone(db.tables.practice_verdict_index);
  assert.equal(verdictRows.length, 12);
  const stubs = (await readManagedStubs(db, SUBJECT)).map((row) => ({ ...rows.find((r) => r.id === row.id), ...row }));
  const stubOf = (row) => ({ ...row, ev_sig: row.evidence.signature, ev_prov: row.provenance });
  const rowsWith = stubs.map((row) => ({ ...row, ev_sig: row.ev_sig, ev_prov: row.ev_prov }));
  const trust = (over = {}) => trustedPracticeVerdicts({ rows: rowsWith, verdictRows, subject: SUBJECT, basis, secret: SECRET, now: NOW, ...over });
  const good = trust();
  assert.equal(good.size, 12);
  assert.ok([...good.values()].some((v) => v.eligible), 'eligible verdicts exist');
  // The verdict of every row equals publicationEligibility on its full row.
  const snapshot = sharedEligibilitySnapshot();
  for (const row of rows) {
    assert.equal(good.get(row.id).eligible, publicationEligibility(row, snapshot).eligible, row.id);
    assert.equal(good.get(row.id).expires_at, new Date(row.evidence.record.expires_at).toISOString());
  }
  assert.equal(stubOf(rows[0]).ev_sig, rowsWith[0].ev_sig);
  // Wrong or missing secret, basis, or MOCK_AI: nothing is believed.
  assert.equal(trust({ secret: 'another-secret' }).size, 0);
  assert.equal(trust({ secret: '' }).size, 0);
  assert.equal(trust({ basis: 'ffffffffffffffff' }).size, 0);
  assert.equal(trust({ basis: null }).size, 0);
  assert.equal(trust({ subject: 'economics' }).size, 0, 'the subject is signed');
  assert.equal(trust({ env: { MOCK_AI: 'true' } }).size, 0);
  // A forged flip of the verdict keeps its old signature and is dropped; so is a changed input hash or expiry.
  const flipped = verdictRows.map((v, i) => (i === 0 ? { ...v, eligible: !v.eligible } : v));
  assert.equal(trust({ verdictRows: flipped }).has(verdictRows[0].question_id), false);
  assert.equal(trust({ verdictRows: flipped }).size, 11);
  assert.equal(trust({ verdictRows: verdictRows.map((v, i) => (i === 1 ? { ...v, input_hash: 'x'.repeat(32) } : v)) }).size, 11);
  assert.equal(trust({ verdictRows: verdictRows.map((v, i) => (i === 2 ? { ...v, expires_at: '2099-01-01T00:00:00.000Z' } : v)) }).size, 11);
  // An edited question no longer matches its verdict; so does a replaced evidence signature or provenance.
  const edited = rowsWith.map((row, i) => (i === 3 ? { ...row, explanation: 'edited after the verdict' } : row));
  assert.equal(trust({ rows: edited }).has(rowsWith[3].id), false);
  assert.equal(trust({ rows: rowsWith.map((row, i) => (i === 4 ? { ...row, ev_sig: 'new-signature' } : row)) }).has(rowsWith[4].id), false);
  assert.equal(trust({ rows: rowsWith.map((row, i) => (i === 5 ? { ...row, ev_prov: { kind: 'authentic_pyq' } } : row)) }).has(rowsWith[5].id), false);
  // Counters move freely.
  assert.equal(trust({ rows: rowsWith.map((row) => ({ ...row, upvotes: 9, score: 3, exposure_used: 4, updated_at: '2030-01-01T00:00:00Z' })) }).size, 12);
  // An eligible verdict is not believed once the record's own expiry has passed; an ineligible one stays valid.
  const later = trust({ now: NOW + 2 * 3600_000 });
  assert.equal([...later.values()].filter((v) => v.eligible).length, 0, 'every eligible fixture record expires within an hour');
  assert.equal([...later.values()].filter((v) => !v.eligible).length, [...good.values()].filter((v) => !v.eligible).length);
  assert.equal(trust({ verdictRows: [] }).size, 0);
  assert.equal(signPracticeVerdict(verdictRows[0], SECRET).length, 32);
});

test('the build is incremental: a second run changes nothing and reads no evidence; an edit, a new question and a removal are picked up', async () => {
  const rows = buildSubject(9, { legacy: 30, managed: 21, period: 40 });
  const db = world(rows);
  const first = await build(db);
  assert.equal(first.rebuilt, 21);
  assert.equal(first.kept, 0);
  assert.ok(first.evidenceBytes > 21 * 30000);
  assert.equal(db.tables.practice_verdict_index.length, 21);
  const evidenceCalls = () => db.calls.filter((call) => call.table === 'questions' && String(call.columns) === 'id,evidence');
  db.reset();
  const second = await build(db);
  assert.deepEqual([second.kept, second.rebuilt, second.written, second.evidenceBytes], [21, 0, 0, 0]);
  assert.equal(evidenceCalls().length, 0, 'nothing was read from the evidence column');
  const scan = db.calls.find((call) => call.table === 'questions');
  assert.ok(scan.bytes < 21 * 4000, `the scan of managed rows is small: ${scan.bytes} bytes for 21 rows`);
  // Edit one managed question, add one, remove one.
  const target = db.tables.questions.find((row) => row.id === 'm-1003');
  target.explanation = 'Edited after the verdict was signed.';
  const added = { ...structuredClone(rows.find((row) => row.id === 'm-1005')), id: 'm-9999' };
  db.tables.questions.push(added);
  db.tables.questions.splice(db.tables.questions.findIndex((row) => row.id === 'm-1007'), 1);
  db.reset();
  const third = await build(db);
  assert.equal(third.rebuilt, 2, 'the edited and the new question');
  assert.equal(third.removed, 1, 'the verdict of the removed question');
  assert.equal(third.kept, 19);
  assert.equal(db.tables.practice_verdict_index.some((row) => row.question_id === 'm-1007'), false);
  assert.equal(db.tables.practice_verdict_index.some((row) => row.question_id === 'm-9999'), true);
  // An eligible verdict that expires soon is renewed, an ineligible one is not.
  const renewing = await refreshPracticeVerdicts(db, SUBJECT, { secret: SECRET, renewWithinMs: 2 * 3600_000 });
  assert.ok(renewing.rebuilt >= 1 && renewing.rebuilt < 21, `only the expiring eligible rows: ${renewing.rebuilt}`);
  // Dry run writes nothing.
  const before = JSON.stringify(db.tables.practice_verdict_index);
  target.explanation = 'Edited again.';
  const dry = await refreshPracticeVerdicts(db, SUBJECT, { secret: SECRET, renewWithinMs: 0, write: false });
  assert.equal(dry.rebuilt, 1);
  assert.equal(dry.written, 0);
  assert.equal(JSON.stringify(db.tables.practice_verdict_index), before);
});

test('a question edited between the two reads of a build is left for the next run, not signed from a mixed picture', async () => {
  const rows = buildSubject(10, { legacy: 0, managed: 6, period: 40 });
  const db = world(rows);
  const realFrom = db.from;
  let swapped = false;
  db.from = (table) => {
    const query = realFrom(table);
    const realThen = query.then;
    query.then = (resolve, reject) => {
      // After the scan of managed rows, replace one question's evidence before the evidence read.
      if (!swapped && table === 'questions') {
        const target = db.tables.questions.find((row) => row.id === 'm-1002');
        if (target.evidence.signature !== 'replaced') { swapped = true; query.__afterScan = true; }
      }
      return realThen.call(query, (value) => {
        if (query.__afterScan) { const target = db.tables.questions.find((row) => row.id === 'm-1002'); target.evidence = { ...target.evidence, signature: 'replaced' }; query.__afterScan = false; }
        return resolve(value);
      }, reject);
    };
    return query;
  };
  const result = await build(db);
  assert.equal(result.skippedChangedMeanwhile, 1);
  assert.equal(result.rebuilt, 5);
  assert.equal(db.tables.practice_verdict_index.some((row) => row.question_id === 'm-1002'), false);
});

test('a missing table is "no verdicts": the start reads evidence as before and the build refuses a real run', async () => {
  const rows = buildSubject(13, { legacy: 120, managed: 30, period: 40 });
  const db = world(rows, { missing: ['practice_verdict_index'] });
  assert.equal((await build(db)).reason, 'verdict_table_missing');
  assert.equal((await build(db, { write: false })).status, 'ok', 'a dry run may count a first build');
  assert.deepEqual(await refreshAllPracticeVerdicts(db, { secret: SECRET, subjects: [SUBJECT] }), { status: 'skipped', reason: 'verdict_table_missing', subjects: [] });
  const start = startOf(db, { mode: 'quick', count: 10, caches: freshCaches() });
  const expected = await pickFromFullPool(startOf(db, { mode: 'quick', count: 10, caches: freshCaches() }).source, start.ctx);
  const actual = await pickFromLightPool(start.source, start.ctx);
  assert.deepEqual(actual, expected);
  assert.ok(start.stats.fullRowsRead > 0);
  assert.equal(start.stats.decided, 0);
});

const MODES = [['quick', 10], ['quick', 25], ['smart', 15], ['full', 50]];

test('with stored verdicts, picks, order, tiers, meta and rows are identical to the whole-subject read, and no unverdicted record is read', async () => {
  let compared = 0;
  let fast = 0;
  for (const seed of [1, 2, 3]) {
    const rows = buildSubject(seed, { legacy: 200, managed: 49 });
    const rand = rng(seed * 77);
    const ids = rows.filter((row) => !row.is_deleted).map((row) => row.id);
    const sample = (n) => new Set(Array.from({ length: n }, () => ids[Math.floor(rand() * ids.length)]));
    const progress = new Map([...sample(90)].map((id) => [id, { question_id: id, attempt_count: 1 + Math.floor(rand() * 3), correct_count: 1, last_attempted_at: new Date(Date.UTC(2026, 8, 1 + Math.floor(rand() * 40))).toISOString() }]));
    const worlds = [
      {},
      { progress, recent: sample(50), weak: new Set(['concept_1', 'concept_5']) },
      { holds: rows.filter((row) => row.evidence).slice(0, 5).map((row) => row.family_id), progress },
    ];
    const optionSets = [{}, { userId: 'u1' }, { userId: 'u1', chapters: ['Partnership', 'Ratios'] }, { userId: 'u1', requireEvidence: true }, { difficulty: 'hard' }];
    for (const [mode, count] of MODES) {
      for (let k = 0; k < worlds.length; k += 1) {
        const opts = optionSets[(seed + k + count) % optionSets.length];
        const { holds, ...rest } = worlds[k];
        const out = await compareStart(rows, { mode, count, opts, holds, ...rest });
        compared += 1;
        if (out.actual === FALLBACK) continue;
        fast += 1;
        assert.deepEqual(out.actual, out.expected, `seed ${seed} ${mode} x${count} world ${k} ${JSON.stringify(opts)}`);
        // Only questions that were picked (or that no verdict covers) had their record read.
        const pickedManaged = new Set(out.actual.selected.map((row) => row.id).filter((id) => id.startsWith('m-')));
        const rejectedByVerdict = new Set(out.db.tables.practice_verdict_index.filter((v) => v.eligible === false).map((v) => v.question_id));
        assert.deepEqual(out.slim.fetched.filter((id) => rejectedByVerdict.has(id)), [], 'a question with an ineligible verdict is never read');
        assert.ok(out.slim.fetched.every((id) => pickedManaged.has(id) || out.slim.stats.rounds > 1), 'every record read was of a candidate pick');
        assert.ok(out.slim.stats.fullRowsRead <= pickedManaged.size + count, `x${count}: read ${out.slim.stats.fullRowsRead} records for ${pickedManaged.size} managed picks`);
      }
    }
  }
  assert.ok(compared >= 36 && fast / compared > 0.9, `fast path served ${fast} of ${compared}`);
});

test('a verdict that no longer matches never decides anything: edits, replaced evidence, other basis, forged rows, new holds', async () => {
  const rows = buildSubject(21, { legacy: 120, managed: 56 });
  const scenarios = {
    'explanation edited after the verdicts': (db) => { for (const row of db.tables.questions.filter((r) => /^m-100[0-9]$/.test(r.id))) row.explanation = `${row.explanation} (edited)`; },
    'evidence replaced after the verdicts': (db) => { for (const row of db.tables.questions.filter((r) => r.id.startsWith('m-') && r.evidence).slice(0, 10)) row.evidence = { ...row.evidence, signature: 'bad' }; },
    'evidence re-signed with a new record': (db) => {
      for (const row of db.tables.questions.filter((r) => r.id.startsWith('m-') && r.evidence).slice(0, 12)) {
        const record = { ...row.evidence.record, expires_at: new Date(Date.now() + 7200_000).toISOString() };
        row.evidence = { record, signature: evidenceSignature(record, SECRET) };
      }
    },
    'verdicts of another basis': (db) => { for (const v of db.tables.practice_verdict_index) v.basis = 'ffffffffffffffff'; },
    'every verdict flipped without re-signing': (db) => { for (const v of db.tables.practice_verdict_index) v.eligible = !v.eligible; },
    'verdicts signed with another key': (db) => { for (const v of db.tables.practice_verdict_index) v.signature = signPracticeVerdict(v, 'another-key'); },
    'provenance changed': (db) => { for (const row of db.tables.questions.filter((r) => r.provenance).slice(0, 15)) row.provenance = { ...row.provenance, adaptation_type: 'changed' }; },
    'a status change to quarantined': (db) => { for (const row of db.tables.questions.filter((r) => r.id.startsWith('m-')).slice(0, 8)) row.status = 'quarantined'; },
    'verdict rows missing': (db) => { db.tables.practice_verdict_index.splice(0, 25); },
    'a family hold placed afterwards': (db) => { for (const row of db.tables.questions.filter((r) => r.evidence).slice(0, 10)) db.tables.recovery_family_holds.push({ family_id: row.family_id }); },
  };
  let compared = 0;
  let fast = 0;
  for (const [name, mutate] of Object.entries(scenarios)) {
    for (const [mode, count] of [['quick', 10], ['quick', 25], ['full', 50]]) {
      const out = await compareStart(rows, { mode, count, opts: { userId: 'u1' }, mutate });
      compared += 1;
      if (out.actual === FALLBACK) continue;
      fast += 1;
      assert.deepEqual(out.actual, out.expected, `${name}: ${mode} x${count}`);
    }
  }
  assert.ok(fast >= compared * 0.8, `the slim path answered ${fast} of ${compared}`);
});

test('the verdict path also holds when most managed rows are ineligible and the pool is thin', async () => {
  const rows = buildSubject(31, { legacy: 25, managed: 90, period: 3 });
  for (const [mode, count] of [['quick', 10], ['full', 50], ['smart', 15]]) {
    const out = await compareStart(rows, { mode, count, opts: { userId: 'u9' }, recent: new Set(rows.slice(0, 20).map((row) => row.id)) });
    if (out.actual === FALLBACK) continue;
    assert.deepEqual(out.actual, out.expected, `${mode} x${count}`);
  }
});

test('the kill switch PRACTICE_SLIM_READ=off and a failing verdict read both give the whole-subject answer', async () => {
  const rows = buildSubject(41, { legacy: 100, managed: 28 });
  const db = world(rows);
  await build(db);
  const mode = 'quick';
  const reference = startOf(db, { mode, count: 10, caches: freshCaches() });
  const expected = await pickFromFullPool(reference.source, reference.ctx);
  const off = startOf(db, { mode, count: 10, caches: freshCaches() });
  assert.deepEqual(await selectPracticeQuestions(off.source, off.ctx, { slim: false }), expected);
  assert.equal(off.stats.rounds, undefined, 'the slim path did not run');
  const broken = startOf(db, { mode, count: 10, caches: freshCaches() });
  broken.source.loadVerdicts = async () => { throw new Error('verdict table unreadable'); };
  const warned = [];
  broken.ctx.warn = (info) => warned.push(info.reason);
  assert.deepEqual(await selectPracticeQuestions(broken.source, broken.ctx), expected);
  assert.deepEqual(warned, ['verdict_error'], 'a failing verdict read is reported and the start goes on without verdicts');
  const src = readFileSync(new URL('../db.js', import.meta.url), 'utf8');
  assert.match(src, /process\.env\.PRACTICE_SLIM_READ !== 'off'/);
  assert.match(src, /createPracticeSource\(/);
});

test('the pool, the managed scan and the verdicts are read once and then served from memory for five minutes', async () => {
  const rows = buildSubject(51, { legacy: 150, managed: 35, period: 40 });
  const db = world(rows);
  await build(db);
  const caches = freshCaches();
  let now = 1_000_000;
  const clock = () => now;
  const run = async () => { const start = startOf(db, { mode: 'quick', count: 10, caches, clock }); db.reset(); const out = await pickFromLightPool(start.source, start.ctx); return { out, calls: [...db.calls] }; };
  const first = await run();
  assert.ok(first.calls.some((call) => call.table === 'practice_verdict_index'));
  assert.equal(first.calls.filter((call) => call.table === 'questions' && call.columns === PRACTICE_MANAGED_STUBS).length, 1, 'one managed scan, not two id scans');
  assert.equal(first.calls.filter((call) => call.table === 'questions' && call.columns === 'id').length, 0, 'the id scans are gone');
  now += 60_000;
  const second = await run();
  assert.deepEqual(second.out, first.out);
  assert.equal(second.calls.some((call) => call.table === 'practice_verdict_index' || call.columns === PRACTICE_MANAGED_STUBS), false);
  now += 6 * 60_000;
  const third = await run();
  assert.ok(third.calls.some((call) => call.table === 'practice_verdict_index'), 'read again after five minutes');
});

// What a slim row carries in place of the record: only the evidence differs from the full read's row.
const digestOf = (full) => ({
  record: {
    candidate_id: full.evidence.record.candidate_id, content_hash: full.evidence.record.content_hash, family_id: full.evidence.record.family_id ?? null,
    policy_version: full.evidence.record.policy_version ?? null, state: full.evidence.record.state ?? null, expires_at: new Date(full.evidence.record.expires_at).toISOString(), slim: true,
  },
  signature: full.evidence.signature,
});

test('slim records: the picks, their order, tiers, meta and every field but the record are those of the whole-subject read, and no record is read', async () => {
  let compared = 0;
  let fast = 0;
  for (const seed of [4, 5]) {
    const rows = buildSubject(seed, { legacy: 220, managed: 56 });
    for (const [mode, count] of MODES) {
      for (const opts of [{}, { userId: 'u1' }]) {
        const db = world(rows);
        await build(db);
        db.reset();
        const full = startOf(db, { mode, count, opts, caches: freshCaches() });
        const expected = await pickFromFullPool(full.source, full.ctx);
        const slim = startOf(db, { mode, count, opts, caches: freshCaches(), slimRecords: true });
        const actual = await pickFromLightPool(slim.source, slim.ctx);
        compared += 1;
        if (actual === FALLBACK) continue;
        fast += 1;
        assert.deepEqual(actual.meta, expected.meta);
        assert.deepEqual(actual.selected.map((row) => row.id), expected.selected.map((row) => row.id));
        for (let i = 0; i < expected.selected.length; i += 1) {
          const want = expected.selected[i];
          const got = actual.selected[i];
          if (want.evidence) assert.deepEqual(got.evidence, digestOf(want), `${want.id} carries the digest`);
          assert.deepEqual({ ...got, evidence: null }, { ...want, evidence: null }, `${want.id}: every other field is the full read's`);
          assert.equal(got.selection_evidence_tier, want.selection_evidence_tier);
          assert.ok(!('ev_sig' in got) && !('ev_prov' in got) && !('ev_state' in got) && !('prov_kind' in got), 'no scan helper keys leak');
        }
        const managedPicks = expected.selected.filter((row) => row.id.startsWith('m-')).length;
        assert.deepEqual(slim.fetched.filter((id) => id.startsWith('m-')), [], `${mode} x${count}: no evidence record was read`);
        assert.equal(slim.stats.freshRows, managedPicks, 'each managed pick was re-read fresh, plain columns only');
      }
    }
  }
  assert.ok(compared >= 16 && fast / compared > 0.9, `served ${fast} of ${compared}`);
});

test('slim records never apply to a question whose verdict is missing or stale: that one is read in full, as before', async () => {
  const rows = buildSubject(6, { legacy: 120, managed: 49, period: 40 });
  const db = world(rows);
  await build(db);
  // Edit every third managed question after the verdicts: those lose their verdict.
  const edited = db.tables.questions.filter((row) => row.id.startsWith('m-')).filter((_, i) => i % 3 === 0);
  for (const row of edited) row.explanation = `${row.explanation} (edited)`;
  const full = startOf(db, { mode: 'full', count: 50, caches: freshCaches() });
  const expected = await pickFromFullPool(full.source, full.ctx);
  const slim = startOf(db, { mode: 'full', count: 50, caches: freshCaches(), slimRecords: true });
  const actual = await pickFromLightPool(slim.source, slim.ctx);
  assert.deepEqual(actual.selected.map((row) => row.id), expected.selected.map((row) => row.id));
  const editedIds = new Set(edited.map((row) => row.id));
  for (let i = 0; i < expected.selected.length; i += 1) {
    const want = expected.selected[i];
    const got = actual.selected[i];
    if (editedIds.has(want.id)) assert.deepEqual(got, want, 'an undecided pick is the full row');
    else if (want.evidence) assert.equal(got.evidence.record.slim, true);
  }
  const fetchedManaged = slim.fetched.filter((id) => id.startsWith('m-'));
  assert.ok(fetchedManaged.length > 0, 'the edited questions were read');
  assert.ok(fetchedManaged.every((id) => editedIds.has(id)), 'only questions without a current verdict were read');
});

test('a question quarantined, disputed or put on hold inside the five-minute pool window is not served, with or without slim records', async () => {
  const rows = buildSubject(12, { legacy: 120, managed: 49, period: 40 });
  let served = 0;
  for (const [label, change] of [
    ['quarantined', (db, id) => { db.tables.questions.find((row) => row.id === id).status = 'quarantined'; }],
    ['disputed', (db, id) => { db.tables.questions.find((row) => row.id === id).verification_state = 'disputed'; }],
    ['family held', (db, id) => { db.tables.recovery_family_holds.push({ family_id: db.tables.questions.find((row) => row.id === id).family_id }); }],
    ['deleted', (db, id) => { db.tables.questions.find((row) => row.id === id).is_deleted = true; }],
  ]) {
    for (const slimRecords of [false, true]) {
      const db = world(rows);
      await build(db);
      const caches = freshCaches();
      const first = startOf(db, { mode: 'quick', count: 10, caches, slimRecords });
      const before = await pickFromLightPool(first.source, first.ctx);
      const target = before.selected.find((row) => row.id.startsWith('m-')).id;
      change(db, target);
      const second = startOf(db, { mode: 'quick', count: 10, caches, slimRecords }); // same caches: the pool and verdicts are the old ones
      const after = await pickFromLightPool(second.source, second.ctx);
      const reference = startOf(db, { mode: 'quick', count: 10, caches: freshCaches() });
      const expected = await pickFromFullPool(reference.source, reference.ctx);
      if (after === FALLBACK) continue;
      served += 1;
      assert.equal(after.selected.some((row) => row.id === target), false, `${label} ${slimRecords ? 'slim' : 'full'}: the changed question is not served`);
      assert.deepEqual(after.selected.map((row) => row.id), expected.selected.map((row) => row.id), `${label} ${slimRecords ? 'slim' : 'full'}`);
    }
  }
  assert.ok(served >= 6, `the slim path answered ${served} of 8`);
});

test('the digest is exactly what the record gave: content hash, family, policy and state, with the stored signature', () => {
  const [row] = buildSubject(8, { legacy: 0, managed: 1 });
  const light = { ...Object.fromEntries(PRACTICE_QUESTION_COLUMNS.map((column) => [column, row[column]])), ev_policy: null, ev_family: row.evidence.record.family_id, ev_state: row.evidence.record.state, prov_kind: null, ev_sig: row.evidence.signature, ev_prov: null, selection_evidence_tier: 2 };
  const out = slimRecordRow(light, { eligible: true, expires_at: row.evidence.record.expires_at });
  assert.equal(out.evidence.record.content_hash, row.evidence.record.content_hash, 'the content hash recomputed from the row equals the signed record');
  assert.deepEqual(out.evidence, digestOf(row));
  assert.equal(out.provenance, null);
  assert.equal(out.selection_evidence_tier, 2);
  assert.equal(slimRecordRow(light, undefined).evidence.record.expires_at, null);
});

test('db.js wires the slim record switch: on by default, off with PRACTICE_SLIM_RECORD=off, never for requireEvidence sessions', () => {
  const src = readFileSync(new URL('../db.js', import.meta.url), 'utf8');
  assert.match(src, /slimRecords: process\.env\.PRACTICE_SLIM_RECORD !== 'off' && opts\.requireEvidence !== true/);
  assert.match(src, /process\.env\.PRACTICE_SLIM_READ !== 'off'/);
});

function legacyLightRead(db) {
  // The 15 Oct read: the three json-path stubs on every row, then one id scan per heavy column.
  return async () => {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('questions').select(PRACTICE_LIGHT_SELECT).eq('subject', SUBJECT).eq('is_deleted', false)
        .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)').gte('score', -2)
        .order('created_at', { ascending: false }).order('score', { ascending: false }).order('id').range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const managedIds = new Set();
    for (const column of ['evidence', 'provenance']) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.from('questions').select('id').eq('subject', SUBJECT).eq('is_deleted', false).not(column, 'is', null).order('id').range(offset, offset + 999);
        if (error) throw error;
        for (const row of data) managedIds.add(row.id);
        if (data.length < 1000) break;
      }
    }
    return { rows, managedIds };
  };
}

test('bytes and requests of one start: the 15 Oct read against the verdict read, on subjects sized like production', async () => {
  const lines = [];
  // Accountancy: 1,405 live rows and 141 evidence-managed (production, 16 Oct 2026). Two mixes of managed rows:
  // nearly all eligible (period 40) and about a third not (period 3 would be extreme, so period 7).
  for (const [label, shape] of [['accountancy, few ineligible', { legacy: 1264, managed: 141, period: 40 }], ['accountancy, 3 in 7 ineligible', { legacy: 1264, managed: 141, period: 7 }]]) {
    const rows = buildSubject(61, shape);
    for (const count of [10, 25, 50]) {
      const db = world(rows);
      await build(db);
      // before: the 15 Oct slim read (no verdicts, stubs on every row, two id scans)
      db.reset();
      const old = startOf(db, { mode: 'quick', count, caches: freshCaches() });
      old.source.loadLightPool = legacyLightRead(db);
      delete old.source.loadVerdicts;
      const oldOut = await pickFromLightPool(old.source, old.ctx);
      const oldBytes = db.bytes(); const oldRequests = db.requests();
      const oldRecords = db.bytes((call) => call.columns === '*' && call.rows <= 100 && call.table === 'questions');
      // after
      db.reset();
      const now = startOf(db, { mode: 'quick', count, caches: freshCaches() });
      const nowOut = await pickFromLightPool(now.source, now.ctx);
      const newBytes = db.bytes(); const newRequests = db.requests();
      const newRecords = db.bytes((call) => call.columns === '*' && call.rows <= 100 && call.table === 'questions');
      assert.deepEqual(nowOut, oldOut, `${label} x${count}: same picks`);
      // reference: the whole subject
      const ref = startOf(db, { mode: 'quick', count, caches: freshCaches() });
      assert.deepEqual(nowOut, await pickFromFullPool(ref.source, ref.ctx));
      const pickedManaged = nowOut.selected.filter((row) => row.id.startsWith('m-')).length;
      assert.equal(now.stats.fullRowsRead, pickedManaged, `${label} x${count}: records read are exactly the managed picks`);
      assert.ok(newBytes < oldBytes && newRecords < oldRecords, `${label} x${count}: ${newBytes} vs ${oldBytes}`);
      // after, with slim records: no record at all
      db.reset();
      const slim = startOf(db, { mode: 'quick', count, caches: freshCaches(), slimRecords: true });
      const slimOut = await pickFromLightPool(slim.source, slim.ctx);
      const slimBytes = db.bytes(); const slimRequests = db.requests();
      assert.deepEqual(slimOut.selected.map((row) => row.id), nowOut.selected.map((row) => row.id));
      assert.deepEqual(slim.fetched.filter((id) => id.startsWith('m-')), []);
      lines.push(`  [bytes] ${label} x${count} with slim records: ${slimBytes} B in ${slimRequests} requests, no record read`);
      lines.push(`  [bytes] ${label} x${count}: before ${oldBytes} B in ${oldRequests} requests (records ${oldRecords} B, ${old.stats.fullRowsRead} rows, ${old.stats.rounds} rounds), after ${newBytes} B in ${newRequests} requests (records ${newRecords} B, ${now.stats.fullRowsRead} rows, ${now.stats.rounds} rounds, ${now.stats.decided} decided by verdict)`);
    }
  }
  console.log(lines.join('\n'));
});

test('the daily pass: counts per subject, one failing subject does not stop the next, a spent deadline leaves the rest', async () => {
  const rows = buildSubject(71, { legacy: 20, managed: 10, period: 40 });
  const db = world(rows);
  const ok = await refreshAllPracticeVerdicts(db, { secret: SECRET, subjects: [SUBJECT, 'economics'] });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.subjects[0].rebuilt, 10);
  assert.equal(ok.subjects[1].managed, 0);
  assert.match(describePracticeVerdictRun(ok, { ms: 12 }), /^\[practice-verdicts\] daily refresh ok in 12 ms: accountancy kept 0 rebuilt 10, economics kept 0 rebuilt 0$/);
  assert.equal((await refreshAllPracticeVerdicts(db, { secret: '', subjects: [SUBJECT] })).reason, 'no_signing_key');
  // A read error in one subject is reported and the next subject still runs.
  const failing = world(rows);
  const realFrom = failing.from;
  failing.from = (table) => { if (table === 'practice_verdict_index') { const q = realFrom(table); const t = q.then; q.then = (res, rej) => (q.__subject === SUBJECT ? Promise.resolve({ data: null, error: { code: 'XX000', message: 'boom' } }).then(res, rej) : t.call(q, res, rej)); const eq = q.eq; q.eq = (c, v) => { if (c === 'subject') q.__subject = v; return eq.call(q, c, v); }; return q; } return realFrom(table); };
  const logged = [];
  const partial = await refreshAllPracticeVerdicts(failing, { secret: SECRET, subjects: [SUBJECT, 'economics'], log: (line) => logged.push(line) });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.subjects[0].status, 'error');
  assert.equal(partial.subjects[1].status, 'ok');
  assert.match(logged[0], /refresh of accountancy failed: boom/);
  assert.match(describePracticeVerdictRun(partial), /accountancy error: boom/);
  let t = 0;
  const late = await refreshAllPracticeVerdicts(world(rows), { secret: SECRET, subjects: [SUBJECT, 'economics'], deadlineMs: 1000, clock: () => (t += 900) });
  assert.deepEqual(late.subjects.map((entry) => entry.reason || entry.status), ['ok', 'out_of_time']);
});

test('the build refuses a signing key that is not the one evidence is verified with', async () => {
  const db = world(buildSubject(81, { legacy: 0, managed: 3 }));
  await assert.rejects(() => refreshPracticeVerdicts(db, SUBJECT, { secret: 'a-different-key' }), /signing key/);
  assert.equal((await refreshPracticeVerdicts(db, SUBJECT, { secret: '' })).reason, 'no_signing_key');
});

test('the migration, its undo and the script exist and agree with the module', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261016160000_practice_verdict_index.sql', import.meta.url), 'utf8');
  for (const column of ['question_id text primary key', 'subject text not null', 'eligible boolean not null', 'expires_at timestamptz', 'input_hash text not null', 'basis text not null', 'verified_at timestamptz not null', 'signature text not null']) assert.ok(sql.includes(column), column);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.practice_verdict_index from public, anon, authenticated/);
  assert.match(sql, /grant all on public\.practice_verdict_index to service_role/);
  const undo = readFileSync(new URL('../../supabase/undo/20261016160000_practice_verdict_index.undo.sql', import.meta.url), 'utf8');
  assert.match(undo, /drop table if exists public\.practice_verdict_index;/);
  const script = readFileSync(new URL('../../scripts/practice-verdict-build.mjs', import.meta.url), 'utf8');
  assert.match(script, /--allow-production/);
  assert.match(script, /refreshPracticeVerdicts/);
  const route = readFileSync(new URL('../../src/app/api/internal/refresh-inventory/route.js', import.meta.url), 'utf8');
  assert.match(route, /refreshAllPracticeVerdicts/);
  assert.match(route, /practiceVerdicts/);
  // The ALL_COLUMNS of the fixture world are the production columns; the verdict hash covers every one but the counters.
  assert.equal(ALL_COLUMNS.length, PRACTICE_QUESTION_COLUMNS.length + 2);
});
