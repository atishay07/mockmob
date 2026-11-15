// The Sunday Mock's weekly draw (src/lib/server/sunday/draw.js) over the REAL Full mock selector (data/practice_pick.js with
// data/practice_source.js) and a real-shaped in-memory bank (legacy rows and evidence-managed rows, the shipped registry):
// two Sundays draw different papers, a paper is not the no-history Full mock's top 50, the same Sunday draws the same paper,
// the last 8 Sunday papers are left out, the Full mock's shape holds, and every mode without the seed picks exactly as before.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectPracticeQuestions } from '../practice_pick.js';
import { createPracticeSource } from '../practice_source.js';
import { computeDifficultyTargets, getMode } from '../test_modes.js';
import { legacyRow, managedRows, rng, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { practiceFakeDb } from './helpers/practice_fake_db.mjs';
import { seededOrder } from '../mock_question_selector.js';
import { HISTORY_WEEKS, drawPaper, drawSeed, forgetDrawHistory, previousSundays } from '../../src/lib/server/sunday/draw.js';
import { addDays, claimPeriod } from '../../src/lib/sundayMock.mjs';

const restore = setFixtureSecret();
after(restore);
// Each test stores its own past papers; the draw keeps past papers per server, so it forgets them between tests.
beforeEach(() => forgetDrawHistory());

const SUBJECT = 'accountancy';
const SECRET = 'server-secret-for-tests';
const hooks = { attachPassages: async (rows) => rows, recentIds: async () => new Set(), userProgress: async () => new Map(), weakConcepts: async () => new Set() };

/** The bank the snapshot below was taken on (unchanged since before the seeded draw existed). */
function snapshotBank(seed = 21) {
  const rand = rng(seed);
  const rows = [];
  for (let n = 0; n < 700; n += 1) rows.push(legacyRow(rand, n, { subject: SUBJECT }));
  const pool = managedRows(rand, 1000, 150 * 8, { subject: SUBJECT });
  rows.push(...pool.filter((_, i) => i % 7 === 0 || i % 7 === 6).slice(0, 135), ...pool.filter((_, i) => [1, 2, 3, 4].includes(i % 7)).slice(0, 15));
  return rows;
}
/** A subject that can fill many Full mocks: the same rows with their concepts spread wide (the selector caps 2 a concept). */
function wideBank(seed = 33, legacy = 1400) {
  const rand = rng(seed);
  const rows = [];
  for (let n = 0; n < legacy; n += 1) rows.push({ ...legacyRow(rand, n, { subject: SUBJECT }), concept_id: `concept_${n % 400}` });
  const pool = managedRows(rand, 3000, 150 * 8, { subject: SUBJECT });
  rows.push(...pool.filter((_, i) => i % 7 === 0 || i % 7 === 6).slice(0, 135));
  return rows;
}

async function select(bank, { mode = 'full', count = 50, opts = {}, slim = true } = {}) {
  const db = practiceFakeDb({ questions: bank, recovery_family_holds: [] });
  const m = getMode(mode);
  const source = createPracticeSource({ db, subjectId: SUBJECT, mode: m, opts, targetCount: count, hooks, caches: { pools: new Map() } });
  return selectPracticeQuestions(source, { mode: m, targetCount: count, opts, stats: {}, warn: () => {} }, { slim });
}
const getQuestionsOver = (bank, calls = []) => async (subject, count, opts) => {
  calls.push(opts);
  return { questions: (await select(bank, { mode: 'full', count, opts })).selected };
};
const hashIds = (rows) => createHash('sha256').update(rows.map((r) => r.id).join(',')).digest('hex').slice(0, 16);

test('every mode without the seed picks exactly as before (snapshots taken before the seeded draw was added)', async () => {
  const bank = snapshotBank();
  const before = {
    'quick:10:slim': ['cd5343432a72be4a', 10], 'quick:20:full': ['2f6da28138603f67', 20], 'full:50:slim': ['8dccc36804737f65', 28],
    'full:50:full': ['8dccc36804737f65', 28], 'smart:15:slim': ['f36dbf5690954d68', 15],
  };
  for (const [key, [hash, length]] of Object.entries(before)) {
    const [mode, count, path] = key.split(':');
    const r = await select(bank, { mode, count: Number(count), opts: { generationKey: 'k-123456789012' }, slim: path === 'slim' });
    assert.equal(r.selected.length, length, key);
    assert.equal(hashIds(r.selected), hash, key);
  }
  // A seed too short to be the draw's (or none) is no seed at all.
  const plain = await select(bank, { opts: { generationKey: 'k-123456789012', seededDraw: { seed: 'short' } } });
  assert.equal(hashIds(plain.selected), '8dccc36804737f65');
});

test('the same Sunday and subject draw the same paper; two Sundays draw different ones; neither is the no-history top 50', async () => {
  const bank = wideBank();
  const papers = new Map();
  const readPaper = async (period) => papers.get(period) || null;
  const draw = (week, secret = SECRET) => drawPaper({ getQuestions: getQuestionsOver(bank), readPaper, secret, subject: SUBJECT, week });
  const a = await draw('2026-11-22');
  const again = await draw('2026-11-22');
  assert.equal(a.length, 50);
  assert.deepEqual(again, a, 'the same Sunday draws the same paper');
  // A brand-new account's Full mock (no seed, no history): the selector's own top 50.
  const top = (await select(bank, { opts: { generationKey: 'fresh-account-key-1' } })).selected.map((r) => String(r.id));
  assert.equal(top.length, 50);
  const overlapTop = a.filter((id) => top.includes(id)).length;
  assert.ok(overlapTop <= 15, `the Sunday paper shares ${overlapTop} of 50 with the no-history Full mock`);
  // Next Sunday, with this Sunday's paper stored: a different paper and none of these questions.
  papers.set(claimPeriod('2026-11-22', SUBJECT), a);
  const b = await draw('2026-11-29');
  assert.equal(b.length, 50);
  assert.equal(b.filter((id) => a.includes(id)).length, 0, 'last Sunday\'s questions are left out');
  // Another subject's seed, or another server secret, is another order.
  assert.notDeepEqual(await draw('2026-11-22', 'another-secret'), a);
  assert.notEqual(drawSeed(SECRET, '2026-11-22', 'accountancy'), drawSeed(SECRET, '2026-11-22', 'economics'));
  assert.match(drawSeed(SECRET, '2026-11-22', 'accountancy'), /^[0-9a-f]{64}$/);
});

test('the draw keeps the Full mock\'s shape: its difficulty mix, at most 2 a concept, one a family, only servable rows', async () => {
  const bank = wideBank();
  const ids = await drawPaper({ getQuestions: getQuestionsOver(bank), readPaper: async () => null, secret: SECRET, subject: SUBJECT, week: '2026-11-22' });
  const byId = new Map(bank.map((r) => [String(r.id), r]));
  const rows = ids.map((id) => byId.get(id));
  const targets = computeDifficultyTargets(50, getMode('full').difficulty);
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const r of rows) counts[r.difficulty] += 1;
  assert.deepEqual(counts, targets);
  const concepts = new Map();
  for (const r of rows) if (r.concept_id) concepts.set(r.concept_id, (concepts.get(r.concept_id) || 0) + 1);
  assert.ok([...concepts.values()].every((n) => n <= 2));
  const families = rows.map((r) => r.family_id || r.evidence?.record?.family_id).filter(Boolean);
  assert.equal(new Set(families).size, families.length);
  assert.ok(rows.every((r) => r.subject === SUBJECT && r.is_deleted === false && (r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active'))));
});

test('the last 8 Sunday papers are left out; a bank too thin for that lets the oldest weeks back in, never a short paper', async () => {
  const bank = wideBank(33, 700);
  const papers = new Map();
  const readPaper = async (period) => papers.get(period) || null;
  const calls = [];
  // Ten Sundays in a row: each leaves out the 8 papers before it while the bank can, and lets the oldest back in when not.
  assert.deepEqual(previousSundays('2026-11-22', 2), ['2026-11-15', '2026-11-08']);
  let week = '2026-11-22';
  const drawn = [];
  for (let i = 0; i < 10; i += 1) {
    const ids = await drawPaper({ getQuestions: getQuestionsOver(bank, calls), readPaper, secret: SECRET, subject: SUBJECT, week });
    assert.equal(ids.length, 50, `week ${week}`);
    papers.set(claimPeriod(week, SUBJECT), ids);
    drawn.push(ids);
    week = addDays(week, 7);
  }
  assert.equal(HISTORY_WEEKS, 8);
  // Week 2 shares nothing with week 1.
  assert.equal(drawn[1].filter((id) => drawn[0].includes(id)).length, 0);
  // The draw asked with the stored papers left out.
  assert.ok(calls.some((opts) => opts.seededDraw.excludeIds.length >= 50));
  assert.ok(calls.every((opts) => /^[0-9a-f]{64}$/.test(opts.seededDraw.seed)));
  // A replacement draw leaves the frozen paper's own questions out.
  const frozen = drawn[0];
  const more = await drawPaper({ getQuestions: getQuestionsOver(bank), readPaper, secret: SECRET, subject: SUBJECT, week: '2026-11-22', extraExclude: frozen });
  assert.equal(more.filter((id) => frozen.includes(id)).length, 0);
});

test('a withdrawn question\'s replacement asks for the missing count: one selector run, never last week\'s question while a fresh one exists', async () => {
  // A bank that fills two Sundays but not a third 50 with both left out: asking for 50 again ran the selector 5 times (every
  // exclusion step) and took its first replacement from the relaxed run, which holds last Sunday's questions.
  const bank = wideBank(33, 120);
  const papers = new Map();
  const readPaper = async (period) => papers.get(period) || null;
  const lastWeek = await drawPaper({ getQuestions: getQuestionsOver(bank), readPaper, secret: SECRET, subject: SUBJECT, week: '2026-11-22' });
  papers.set(claimPeriod('2026-11-22', SUBJECT), lastWeek);
  const frozen = await drawPaper({ getQuestions: getQuestionsOver(bank), readPaper, secret: SECRET, subject: SUBJECT, week: '2026-11-29' });
  assert.equal(frozen.length, 50);
  assert.equal(frozen.filter((id) => lastWeek.includes(id)).length, 0);
  const asWas = [];
  const whole = await drawPaper({ getQuestions: getQuestionsOver(bank, asWas), readPaper, secret: SECRET, subject: SUBJECT, week: '2026-11-29', extraExclude: frozen });
  assert.equal(asWas.length, 5, 'the 50 ask walks every exclusion step on this bank');
  assert.ok(lastWeek.includes(whole[0]), 'and its first id is one of last Sunday\'s');
  for (const missing of [1, 3]) {
    const calls = [];
    const ids = await drawPaper({ getQuestions: getQuestionsOver(bank, calls), readPaper, secret: SECRET, subject: SUBJECT, week: '2026-11-29', extraExclude: frozen, count: missing });
    assert.equal(ids.length, missing);
    assert.equal(calls.length, 1, `one selector run for ${missing}`);
    assert.ok(calls[0].seededDraw.excludeIds.length >= 100, 'last Sunday\'s paper and the frozen one both left out');
    assert.equal(ids.filter((id) => lastWeek.includes(id) || frozen.includes(id)).length, 0);
  }
});

test('the seeded draw prefers verified questions the way the Full mock does: best tier first, the seed\'s order inside a tier', async () => {
  const bank = wideBank();
  const verified = (rows) => rows.filter((r) => Number(r.selection_evidence_tier) >= 2).length;
  const full = (await select(bank, { opts: { generationKey: 'fresh-account-key-1' } })).selected;
  for (const slim of [true, false]) {
    const paper = (await select(bank, { opts: { generationKey: 'k', seededDraw: { seed: drawSeed(SECRET, '2026-11-22', SUBJECT), excludeIds: [] } }, slim })).selected;
    assert.equal(paper.length, 50);
    // Every verified question the Full mock's caps let in (one a family) is in the paper, as in the Full mock's own.
    assert.equal(verified(paper), verified(full), `slim=${slim}`);
    assert.ok(verified(paper) >= 20);
  }
  // Two seeds: the same tier order, different questions inside the tiers.
  const rows = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `legacy-${i}`, selection_evidence_tier: 1 })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `verified-${i}`, selection_evidence_tier: 2 })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `factory-${i}`, selection_evidence_tier: 3 })),
  ];
  const one = seededOrder(rows, 'a'.repeat(64)).map((r) => r.id);
  const two = seededOrder(rows, 'b'.repeat(64)).map((r) => r.id);
  for (const order of [one, two]) {
    assert.ok(order.slice(0, 5).every((id) => id.startsWith('factory-')));
    assert.ok(order.slice(5, 15).every((id) => id.startsWith('verified-')));
    assert.ok(order.slice(15).every((id) => id.startsWith('legacy-')));
  }
  assert.notDeepEqual(one.slice(15), two.slice(15), 'the seed decides the order inside a tier');
  assert.deepEqual(seededOrder(rows, 'a'.repeat(64)).map((r) => r.id), one, 'the same seed, the same order');
});
