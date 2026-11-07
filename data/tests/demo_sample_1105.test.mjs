// "Not your subject?" on the home page's sample card (round 4 H3, owner LK123, 5/6 Nov 2026): the route's rules, its
// egress and what leaves it, and the card's side. Software fixtures (data/tests/helpers/egress_fixtures.mjs: rows shaped
// like production, evidence signed against the shipped registry); they do not establish academic reliability.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBank, bytesOf, fakeDb, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { servedRow } from '../option_order.js';
import { readablePracticeQuestions } from '../practice_library.js';
import { SUBJECT_PAGES } from '../../src/lib/subjectPages.mjs';
import {
  DEMO_POOL_SIZE, DEMO_ROUTE, DEMO_SETS, DEMO_SET_SIZE, DEMO_SUBJECTS, acceptDemoSet, demoSetUrl, demoSubject, pickDemoSet,
} from '../../src/lib/demoSample.mjs';
import {
  DEMO_BATCH, DEMO_CHAPTER_CAP, DEMO_FULL_SELECT, DEMO_LIGHT_SELECT, DEMO_MAX_FULL_ROWS, DEMO_POOL_TTL_MS,
  createDemoSample, demoQuestionOut, demoSetFrom, demoShape, parseDemoQuery, readDemoPool,
} from '../../src/lib/server/demoSample.js';

const restore = setFixtureSecret();
after(restore);
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const q = (s) => parseDemoQuery(new URLSearchParams(s));

// A bank with a dozen chapters on the legacy rows (the managed rows keep theirs: their signed records cover the chapter).
function bank(seed = 11, opts = {}) {
  return buildBank(seed, { legacy: 360, managed: 40, ...opts }).map((row, i) => (row.id.startsWith('q-') ? { ...row, chapter: `Chapter ${i % 12}` } : row));
}
const tablesOf = (rows) => ({ questions: rows, recovery_family_holds: [] });

test('the picker offers the 15 subjects Practice offers, in the subject pages\' order, English first', () => {
  assert.deepEqual(DEMO_SUBJECTS.map((s) => [s.slug, s.name]), SUBJECT_PAGES.map((p) => [p.slug, p.name]));
  assert.equal(DEMO_SUBJECTS[0].slug, 'english');
  assert.equal(demoSubject('business-studies').name, 'Business Studies');
  assert.equal(demoSubject('gat'), null, 'only the public slug, never an internal id');
  assert.equal(DEMO_POOL_SIZE, DEMO_SETS * DEMO_SET_SIZE);
  assert.equal(demoSetUrl('general-test', 4), `${DEMO_ROUTE}?subject=general-test&set=4`);
});

test('a query names an offered subject and a set from 0 to 5, or it is refused before anything is read', () => {
  assert.deepEqual(q('subject=general-test&set=0'), { ok: true, slug: 'general-test', subjectId: 'gat', name: 'General Test', set: 0 });
  assert.equal(q('subject=accountancy&set=5').subjectId, 'accountancy');
  for (const bad of ['', 'subject=accountancy', 'subject=accountancy&set=6', 'subject=accountancy&set=-1', 'subject=accountancy&set=1.5',
    'subject=accountancy&set=01', 'subject=Accountancy&set=1', 'subject=gat&set=1', 'subject=hindi&set=1', 'subject=../x&set=1']) {
    assert.equal(q(bad).ok, false, bad);
  }
  const route = code(read('src/app/api/sample/route.js'));
  const at = (s) => route.indexOf(s);
  assert.ok(at('parseDemoQuery(') > 0 && at('parseDemoQuery(') < at('checkPersistentRateLimit(') && at('checkPersistentRateLimit(') < at('sample.get('),
    'the query is checked first, then the limit, then the database');
});

test('the window holds only what Practice serves, in the card\'s shape, 30 at most, spread over chapters, and the same every time', async () => {
  for (const seed of [3, 11, 29]) {
    const rows = bank(seed);
    const subject = rows.filter((r) => r.subject === 'accountancy');
    const served = new Map((await readablePracticeQuestions(subject.filter((r) => !r.is_deleted && (r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active'))), fakeDb(tablesOf(rows), { strict: false })))
      .map((r) => servedRow(r).row).filter(demoShape).map((r) => [JSON.stringify(demoQuestionOut(r, 'accountancy')), r]));
    const pool = await readDemoPool(fakeDb(tablesOf(rows)), 'accountancy');
    assert.equal(pool.length, DEMO_POOL_SIZE, `seed ${seed}`);
    for (const item of pool) assert.ok(served.has(JSON.stringify(item)), `seed ${seed}: every question is one Practice would serve, as the card shows it`);
    const perChapter = {};
    for (const item of pool) perChapter[item.chapter] = (perChapter[item.chapter] || 0) + 1;
    assert.ok(Object.values(perChapter).every((n) => n <= DEMO_CHAPTER_CAP), `seed ${seed}: ${JSON.stringify(perChapter)}`);
    assert.deepEqual(await readDemoPool(fakeDb(tablesOf(rows)), 'accountancy'), pool, 'the same window on every server');
  }
  // A subject with fewer chapters than the window needs still fills it (the cap spreads, it never empties a subject).
  const few = buildBank(5, { legacy: 360, managed: 0 });
  assert.equal((await readDemoPool(fakeDb(tablesOf(few)), 'physics')).length, DEMO_POOL_SIZE);
});

test('what does not read well on the card never enters the window: passages, formulas, lists, long text, odd option counts, no reason', async () => {
  const rows = bank(17);
  const legacy = rows.filter((r) => r.subject === 'history' && r.status === 'live' && !r.is_deleted);
  const spoil = [
    (r) => ({ ...r, passage_text: 'Read the passage. '.repeat(20) }),
    (r) => ({ ...r, passage_group_id: 'grp-x' }),
    (r) => ({ ...r, body: 'Find $x^{2}$ when x = 3.', question: 'Find $x^{2}$ when x = 3.' }),
    (r) => ({ ...r, body: `Match List-I with List-II\n(A) one (B) two`, question: 'Match List-I with List-II' }),
    (r) => ({ ...r, body: 'Long stem '.repeat(40), question: 'Long stem '.repeat(40) }),
    (r) => ({ ...r, options: [...r.options, 'A fifth option'] }),
    (r) => ({ ...r, options: [r.options[0], r.options[1], 'An option that runs on and on far past what one or two lines of the card can hold for a phone', r.options[3]] }),
    (r) => ({ ...r, explanation: null }),
    (r) => ({ ...r, explanation: 'x'.repeat(500) }),
  ];
  const spoiled = new Set();
  const mutated = rows.map((r) => {
    const i = legacy.indexOf(r);
    if (i < 0 || i >= spoil.length * 6) return r;
    spoiled.add(r.id);
    return spoil[i % spoil.length](r);
  });
  for (const fn of spoil) assert.equal(demoShape(fn(legacy[0])), false, String(fn));
  const pool = await readDemoPool(fakeDb(tablesOf(mutated), { strict: false }), 'history');
  const stems = new Set(mutated.filter((r) => spoiled.has(r.id)).map((r) => String(r.body).replace(/\s+/g, ' ').trim()));
  assert.ok(pool.length > 0);
  for (const item of pool) assert.ok(!stems.has(item.q) || !mutated.find((r) => spoiled.has(r.id) && r.body === item.q), item.q);
});

test('egress: one read of seven small columns, then full rows only by id, 40 at a time, stopping as soon as the window can fill', async () => {
  // A subject the size of a real one (about 800 rows here, 1,000 to 1,500 on production), 120 of them evidence-managed.
  const rows = bank(23, { legacy: 2400, managed: 120 });
  const db = fakeDb(tablesOf(rows)); // strict: reading any column outside a select throws
  const stats = {};
  await readDemoPool(db, 'accountancy', { stats });
  const reads = db.calls.filter((c) => c.table === 'questions');
  assert.equal(reads[0].select, DEMO_LIGHT_SELECT);
  assert.equal(DEMO_LIGHT_SELECT.split(',').length, 7);
  assert.doesNotMatch(DEMO_LIGHT_SELECT, /body|question\b|options|explanation|evidence|provenance/);
  assert.deepEqual(reads[0].filters, ['eq:subject', 'eq:is_deleted']);
  for (const call of reads.slice(1)) {
    assert.equal(call.select, DEMO_FULL_SELECT);
    assert.ok(call.filters.includes('in:id') && call.rows <= DEMO_BATCH, JSON.stringify(call));
  }
  assert.ok(stats.fullRowsRead <= DEMO_MAX_FULL_ROWS);
  assert.ok(reads.length - 1 <= Math.ceil(DEMO_POOL_SIZE / DEMO_BATCH) + 2, `${reads.length - 1} batches for a window of ${DEMO_POOL_SIZE}`);
  assert.doesNotMatch(DEMO_FULL_SELECT, /\*/);
  const used = reads.reduce((sum, c) => sum + c.bytes, 0);
  const whole = bytesOf(rows.filter((r) => r.subject === 'accountancy'));
  assert.ok(used < whole * 0.15, `the window costs ${used} bytes against ${whole} for the subject's rows`);
  // No select('*') anywhere on the path.
  for (const file of ['src/lib/server/demoSample.js', 'src/app/api/sample/route.js']) assert.doesNotMatch(code(read(file)), /select\(\s*['"]\*['"]\s*\)/, file);
});

test('the answer carries only what the card shows: no id, family, evidence, source or count', async () => {
  const rows = bank(31);
  const service = createDemoSample({ db: () => fakeDb(tablesOf(rows)) });
  for (let set = 0; set < DEMO_SETS; set += 1) {
    const answer = await service.get(q(`subject=accountancy&set=${set}`));
    assert.deepEqual(Object.keys(answer), ['subject', 'name', 'set', 'questions']);
    assert.equal(answer.questions.length, DEMO_SET_SIZE);
    for (const item of answer.questions) {
      assert.deepEqual(Object.keys(item), ['q', 'options', 'correct', 'why', 'chapter']);
      assert.equal(item.options.length, 4);
      assert.ok(Number.isInteger(item.correct) && item.correct >= 0 && item.correct <= 3);
    }
    const json = JSON.stringify(answer);
    assert.doesNotMatch(json, /"id"|family|evidence|provenance|signature|difficulty|score|source|"(?:q|m)-\d{4}"/);
    assert.ok(acceptDemoSet(answer, 'accountancy'), 'and the card accepts it as it is');
  }
});

test('sets: six disjoint fives of the window; a set past a short window wraps; under five is no answer', () => {
  const pool = Array.from({ length: DEMO_POOL_SIZE }, (_, i) => ({ q: `Q${i}`, options: ['a', 'b', 'c', 'd'], correct: i % 4, why: 'Because.', chapter: 'C' }));
  const seen = new Set();
  for (let set = 0; set < DEMO_SETS; set += 1) {
    const { set: at, questions } = demoSetFrom(pool, set);
    assert.equal(at, set);
    assert.equal(questions.length, DEMO_SET_SIZE);
    for (const item of questions) { assert.ok(!seen.has(item.q)); seen.add(item.q); }
  }
  assert.equal(seen.size, DEMO_POOL_SIZE);
  assert.deepEqual(demoSetFrom(pool.slice(0, 12), 5).set, 1, 'two sets in a window of 12: set 5 is set 1');
  assert.equal(demoSetFrom(pool.slice(0, 4), 0), null);
  assert.equal(demoSetFrom([], 0), null);
  const one = demoSetFrom(pool, 0);
  one.questions[0].options.push('x');
  assert.equal(pool[0].options.length, 4, 'an answer is a copy: the window is never changed by a caller');
});

test('a subject\'s window is read once per server for an hour, and once when visitors ask together; a failure is not remembered', async () => {
  // Review fix (6 Nov): an hour, not six, so a pulled question leaves a warm server within the hour of the CDN purge.
  assert.equal(DEMO_POOL_TTL_MS, 60 * 60 * 1000);
  const rows = bank(37);
  let t = 0;
  let made = 0;
  let fail = false;
  const service = createDemoSample({
    now: () => t,
    db: () => {
      made += 1;
      const db = fakeDb(tablesOf(rows));
      if (!fail) return db;
      return { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ or: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: 'down' } }) }) }) }) }) }) }) };
    },
  });
  const asks = await Promise.all([0, 1, 2, 3, 4, 5].map((set) => service.get(q(`subject=accountancy&set=${set}`))));
  assert.equal(made, 1, 'six visitors at once, one read');
  assert.equal(new Set(asks.map((a) => a.questions[0].q)).size, DEMO_SETS);
  t += DEMO_POOL_TTL_MS - 1;
  await service.get(q('subject=accountancy&set=2'));
  assert.equal(made, 1);
  t += 2;
  fail = true;
  await assert.rejects(service.get(q('subject=accountancy&set=2')), /DEMO_SAMPLE_UNAVAILABLE/);
  fail = false;
  await service.get(q('subject=accountancy&set=2'));
  assert.equal(made, 3, 'the failed read was not kept: the next visitor reads again');
  assert.equal(await createDemoSample({ db: () => fakeDb(tablesOf([])) }).get(q('subject=accountancy&set=0')), null, 'an empty subject is no answer');
});

test('the route: public and rate-limited; the CDN keeps an answer a day, tagged for a purge; a refusal, the limit, a thin subject or a failure is never cached', () => {
  const route = code(read('src/app/api/sample/route.js'));
  assert.match(route, /export async function GET\(request\)/);
  assert.doesNotMatch(route, /\bauth\(/, 'no sign-in: the sample is for guests');
  assert.match(route, /checkPersistentRateLimit\(request, \{ route: ROUTE, limit: SAMPLE_RATE_LIMIT, fallback: 'memory' \}\)/);
  assert.match(route, /const SAMPLE_RATE_LIMIT = 30;/);
  assert.match(route, /const CACHED = \{ 'Cache-Control': 'public, max-age=300', 'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' \};/);
  assert.match(route, /const NO_STORE = \{ 'Cache-Control': 'no-store' \};/);
  assert.equal((route.match(/CACHED/g) || []).length, 2, 'defined once, used once: on the 200 only');
  assert.match(route, /reply\(diagnostics, 200, answer, \{ \.\.\.CACHED, \.\.\.cacheTags\(query\.slug\) \}\)/);
  // Review fix (6 Nov): every answer carries a cache tag, so a pulled or frozen question can be purged from the CDN at once,
  // and the runbook line sits beside it.
  assert.match(route, /const cacheTags = \(slug\) => \(\{ 'Vercel-Cache-Tag': `demo-sample,demo-sample-\$\{slug\}` \}\);/);
  assert.equal((route.match(/\bcacheTags\b/g) || []).length, 2,'defined once, used once: tags only on the 200');
  assert.match(read('src/app/api/sample/route.js'), /after pulling or freezing a question, run\s*\/\/\s*`vercel cache dangerously-delete --tag demo-sample`/);
  for (const status of ['400', '429', '503']) assert.match(route, new RegExp(`reply\\(diagnostics, ${status}, [^\\n]*NO_STORE`), status);
  assert.match(route.slice(route.indexOf('} catch (error) {')), /status: 503, headers: NO_STORE/);
  assert.match(route, /createDemoSample\(\{ db: \(\) => supabaseAdmin\(\) \}\)/, 'the database client is made only when a read is needed');
});

test('the card: its own five first, a picked set accepted whole, the request only on a pick, one subject key on the last line', () => {
  const good = { subject: 'economics', name: 'Economics', set: 3, questions: Array.from({ length: 5 }, (_, i) => ({ q: `Stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: i % 4, why: 'Reason.', chapter: 'Money and Banking', id: 'leak' })) };
  const ok = acceptDemoSet(good, 'economics');
  assert.equal(ok.questions.length, 5);
  assert.deepEqual(Object.keys(ok.questions[0]), ['subject', 'q', 'options', 'correct', 'why', 'chapter'], 'extra fields are dropped');
  assert.equal(ok.questions[0].subject, 'Economics');
  assert.equal(ok.set, 3);
  const bad = (change) => acceptDemoSet({ ...good, ...change }, 'economics');
  assert.equal(bad({ questions: good.questions.slice(0, 4) }), null, 'four is not a set');
  assert.equal(bad({ questions: good.questions.map((x, i) => (i ? x : { ...x, correct: 4 })) }), null);
  assert.equal(bad({ questions: good.questions.map((x, i) => (i ? x : { ...x, options: ['a', 'b', 'c'] })) }), null);
  assert.equal(bad({ questions: good.questions.map((x, i) => (i ? x : { ...x, why: '' })) }), null, 'no reason, no set: the reveal needs it');
  assert.equal(bad({ subject: 'physics' }), null, 'the answer must be for the subject that was picked');
  assert.equal(acceptDemoSet(null, 'economics'), null);
  assert.equal(acceptDemoSet(good, 'nope'), null);
  // A second pick of the same subject never asks for the set it just played.
  const seq = [0, 0.2, 0.5, 0.99, 0.999999];
  for (let prev = 0; prev < DEMO_SETS; prev += 1) for (const r of seq) {
    const set = pickDemoSet(prev, () => r);
    assert.ok(set !== prev && set >= 0 && set < DEMO_SETS, `${prev} ${r} -> ${set}`);
  }
  assert.ok([0, 1, 2, 3, 4, 5].includes(pickDemoSet(null, () => 0.7)));

  const drill = code(read('src/components/landing/DemoDrill.jsx'));
  assert.match(drill, /const questions = live \? live\.questions : DRILL;/, 'the card opens on its own five');
  assert.equal((drill.match(/\bfetch\(/g) || []).length, 1, 'one request');
  assert.ok(drill.indexOf('fetch(') > drill.indexOf('async function chooseSubject('), 'and only when a subject is picked');
  assert.match(drill, /const next = acceptDemoSet\(response\.ok \? await response\.json\(\) : null, slug\);/);
  assert.match(drill, /className="mm-drill__switch"[^>]*>\s*Not your subject\?\s*<\/button>/);
  assert.match(drill, /aria-pressed=\{isCurrent \? 'true' : 'false'\}/, 'the subject playing now is marked, not by colour alone');
  // Review fixes (6 Nov). The lead says what the five are and what each brings, and no more: the window is a fixed 30 a
  // subject, so it never claims a random draw from the bank. Its two-line hold is at every size, so nothing moves.
  assert.match(drill, /'Five questions from the MockMob bank, each with its answer explained\.'/);
  assert.doesNotMatch(code(drill), /at random|randomly|random five|random 5/i);
  // The key being fetched carries its own state for a screen reader, not only the ring and the group's aria-busy.
  assert.match(drill, /aria-busy=\{isLoading \? 'true' : undefined\}/);
  assert.match(drill, /aria-describedby=\{speaks \? leadId : undefined\}/);
  assert.match(drill, /className="mm-drill__pick-lead" id=\{leadId\} aria-live="polite"/);
  assert.match(drill, /if \(event\.key === 'Escape'\)/);
  // R8 HERO-03 (8 Nov 2026): a new set gives Mobi a line that names the subject ("Physics it is. Your move.").
  assert.match(drill, /tellDesk\('live', 0, next\.name\);\s*focusNext\.current = 'options';\s*setLive\(next\);/, 'a new set gives Mobi its own line');
  assert.doesNotMatch(drill, /localStorage|sessionStorage/, 'nothing about a guest\'s pick is stored');
  const css = read('src/components/landing/demo-subject.css');
  assert.match(css, /\.mm-drill__switch \{[^}]*min-height: 44px;/);
  assert.match(css, /\.mm-drill__subject \{[^}]*min-height: 44px;/);
  assert.match(css, /\.mm-drill__close \{[^}]*width: 44px;\s*height: 44px;/);
  assert.match(css, /^\.mm\.lp \.lp-desk \.mm-drill__pick-lead \{ min-height: calc\(2 \* 1\.45em\); \}$/m, 'the lead holds two lines at every size');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*:root:not\(\[data-motion='reduced'\]\)/, 'motion only when it is welcome');
});

test('7 Nov 2026: bank rows keep correct_index empty; the window resolves the key from correct_answer and serves the stable order (LK44)', async () => {
  const rows = bank(11).map((r) => (r.subject === 'accountancy' ? { ...r, correct_index: null } : r));
  const pool = await readDemoPool(fakeDb(tablesOf(rows)), 'accountancy');
  assert.equal(pool.length, DEMO_POOL_SIZE, 'an empty correct_index no longer empties the window (it emptied every subject in production)');
  const byStem = new Map(rows.filter((r) => r.subject === 'accountancy').map((r) => [String(r.body || r.question).replace(/\s+/g, ' ').trim(), r]));
  for (const item of pool) {
    const stored = byStem.get(item.q);
    assert.ok(stored, 'every question comes from the bank');
    const key = String(stored.correct_answer).trim().toUpperCase();
    const storedText = (Array.isArray(stored.options) ? stored.options : []).map((o, i) => ({ key: o?.key || 'ABCD'[i], text: String(o?.text ?? o).replace(/\s+/g, ' ').trim() })).find((o) => o.key === key)?.text;
    if (storedText) assert.equal(item.options[item.correct], storedText.replace(/^[A-D][.)]\s*/, ''), 'the marked answer is the text of the stored key, wherever the order put it');
  }
  assert.match(code(read('src/lib/server/demoSample.js')), /servedRow\(stored\)\.row/);
});

