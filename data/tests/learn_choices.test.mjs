// LK37 (R6 Web E): the student chooses what goes into a run. The chapter page's "What's in this run" switches are the server's
// `leaveOut` piles (cards, questions, mistakes, lesson) and Learn home's offer takes a length (GET /api/learn/home?minutes=).
// These checks pin the server side: every switch combination composes a valid run (at the pure composer and at the handlers), the
// last pile in cannot be switched off, and Free's rules (10 minutes at most, Key cards only after the day's session) do not move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createKeycards } from '../../src/lib/server/keycards.js';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { createLearn, FREE_CAPPED, FREE_CARDS_ONLY, learnServed } from '../../src/lib/server/learn.js';
import { composeRun, dryRun } from '../learn/compose.js';
import { schedule } from '../keycards.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.parse('2026-11-02T18:00:00+05:30');
const PL = 'business_studies.planning';
const ST = 'business_studies.staffing';

// ---------------------------------------------------------------- decks and questions built in the test
const mk = (slug, i, over = {}) => ({
  id: `kc.business_studies.${slug}.def-c${i}`, v: 1, subject: 'business_studies', chapterKey: `business_studies.${slug}`,
  chapter: slug, unit: slug, kind: 'definition', front: `What is ${slug} ${i}?`, back: `Line ${i} of ${slug}.`,
  quote: `Line ${i} of ${slug} about planning objectives and premises.`, blanks: [], importance: i <= 6 ? 'must' : 'good', asked: 0, tags: [], order: i * 10,
  source: { kind: 'ncert', book: 'Business Studies Part 1', code: 'lebs104', chapterNo: 4, page: 90 + i, section: i <= 4 ? 'Meaning' : 'Features' }, ...over,
});
const PLANNING = Array.from({ length: 14 }, (_, i) => mk('planning', i + 1));
const STAFFING = Array.from({ length: 4 }, (_, i) => mk('staffing', i + 1));
const CARDS = [...PLANNING, ...STAFFING];
const LINKS = { 'q-p1': [PLANNING[0].id], 'q-p2': [PLANNING[9].id], 'q-p3': [PLANNING[1].id] };
const decks = () => ({
  bySubject: new Map([['business_studies', { version: 1, cards: CARDS }]]),
  byId: new Map(CARDS.map((c) => [c.id, c])),
  links: new Map([['business_studies', LINKS]]),
  disabled: [],
});
const DIFF = ['easy', 'medium', 'hard'];
const QROWS = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `q-p${i + 1}`, chapter: 'Planning', difficulty: DIFF[i % 3] })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `q-s${i + 1}`, chapter: 'Staffing', difficulty: DIFF[i % 3] })),
  { id: 'q-held', chapter: 'Planning', difficulty: 'easy' },
].map((q) => ({
  ...q, subject: 'business_studies', question: `Which statement about ${q.chapter.toLowerCase()} is true (${q.id})?`,
  options: ['A. The right one', 'B. A wrong one', 'C. Another wrong one', 'D. The last wrong one'], correct_answer: 'A',
  explanation: `Because of the line in ${q.chapter}.`, status: 'live', is_deleted: false, verification_state: 'verified', content_hash: `h-${q.id}`, updated_at: '2026-10-01T00:00:00Z',
}));
const syllabus = syllabusFrom(null);
const index = (rows = QROWS) => ({
  list: rows.map((r) => ({
    id: r.id, subject: r.subject, chapter: r.chapter, chapterKey: syllabus.resolveChapter(r.subject, r.chapter).key, body: r.question,
    options: learnServed(r).options, order: learnServed(r).order, words: r.question.split(/\s+/).length, difficulty: r.difficulty, cards: LINKS[r.id] || [], chash: r.content_hash, managed: false,
  })),
});

// R5 Packet A: Learn serves the stable option order (data/option_order.js), so an answer is chosen by meaning. R: the served
// letter of the right option of an item (a public item or a stored one), W: of a wrong one, STORED: what is persisted for a letter.
const ROWS = new Map(QROWS.map((r) => [r.id, r]));
const qidOf = (item) => item?.questionId ?? item?.question?.id;
const R = (item) => learnServed(ROWS.get(qidOf(item))).key;
const W = (item) => learnServed(ROWS.get(qidOf(item))).options.find((o) => o.key !== R(item)).key;
const STORED = (item, letter) => 'ABCD'[learnServed(ROWS.get(qidOf(item))).order['ABCD'.indexOf(letter)]];

function setup({ isPro = false, tables = {}, held = new Set(['q-held']), clock = { t: T0 }, places = null } = {}) {
  const db = fakeDb({ questions: QROWS.map((r) => ({ ...r })), ...tables });
  const D = decks();
  const user = { isPremium: isPro, subjects: ['business_studies'] };
  const kc0 = createKeycards({ db, decks: D, syllabus, now: () => clock.t, getUser: async () => user });
  const calls = [];
  const kc = { ...kc0, review: async (u, body, opts) => { calls.push({ fn: 'review', body, opts }); return kc0.review(u, body, opts); }, add: async (u, body) => { calls.push({ fn: 'add', body }); return kc0.add(u, body); } };
  const learn = createLearn({
    db, kc, decks: D, syllabus, getUser: async () => user, questionIndex: async () => index(),
    heldQuestions: async () => (held instanceof Error ? Promise.reject(held) : held),
    mistakePlaces: places, now: () => clock.t, warn: () => {},
  });
  return { db, learn, kc, calls, clock, user, tables: db.tables };
}

const P = (o) => new URLSearchParams(o);
const wrongMistake = (qid, at) => ({ user_id: 'u1', question_id: qid, subject: 'business_studies', chapter: 'Planning', attempt_count: 1, last_correct: false, last_selected_key: 'C', last_attempted_at: new Date(at).toISOString() });
const PILES = ['cards', 'questions', 'mistakes', 'lesson'];
/** Every way of leaving piles out: the 16 subsets of the four piles. */
const SUBSETS = Array.from({ length: 16 }, (_, m) => PILES.filter((_, i) => m & (1 << i)));
const countOf = (items, pile) => items.filter((i) => (pile === 'cards' ? i.type === 'card' : pile === 'lesson' ? i.type === 'lesson' : pile === 'mistakes' ? i.type === 'question' && i.origin === 'mistake' : i.type === 'question' && i.origin !== 'mistake')).length;

// ---------------------------------------------------------------- the composer, over real deck chapters

const ROOT = process.cwd();
const json = (f) => JSON.parse(readFileSync(path.join(ROOT, f), 'utf8'));
const NOW = Date.parse('2026-10-31T10:00:00+05:30');
const FIX = json('data/fixtures/learn-preview-questions.json').questions;
const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
function realChapter(subject, key, name) {
  const cards = json(`data/keycards/decks/${subject}.json`).cards.filter((c) => c.chapterKey === key);
  const questions = FIX.filter((q) => q.subject === subject && q.chapter === name).map((q) => ({ id: q.id, difficulty: q.difficulty, cards: q.cards, seen: false, words: words(q.body) }));
  const states = new Map();
  cards.filter((c) => c.importance === 'must').slice(0, 3).forEach((c, i) => {
    const s = schedule(null, 3, NOW - 6 * DAY - i * 3_600_000);
    states.set(c.id, { card_id: c.id, reps: s.reps, due_at: s.due_at, schedule: s.schedule });
  });
  const mistakes = questions.filter((q) => q.difficulty === 'medium').slice(0, 3).map((q) => ({ id: q.id, where: 'Mock 3', when: '16 Oct' }));
  return { cards, questions, states, mistakes };
}
const CHAPTERS = [
  ['Admission of Partner', realChapter('accountancy', 'accountancy.admission-of-partner', 'Admission of Partner')],
  ['Partnership Fundamentals', realChapter('accountancy', 'accountancy.partnership-fundamentals', 'Partnership Fundamentals')],
];
const lesson = { id: 'accountancy-revaluation', title: 'Revaluation of assets and liabilities', minutes: 7, read: false };

test('LK37: every switch combination composes a valid run, at 5, 10, 20 and 45 minutes', () => {
  for (const [name, ch] of CHAPTERS) {
    for (const minutes of [5, 10, 20, 45]) {
      for (const out of SUBSETS) {
        const at = `${name}, ${minutes} min, out [${out}]`;
        const run = composeRun({ kind: 'mix', minutes, cards: ch.cards, states: ch.states, now: NOW, questions: ch.questions, mistakes: ch.mistakes, lesson, leaveOut: out });
        assert.ok(run.items.length > 0, `${at}: something is lined up`);
        const dry = dryRun({ run, isPro: true });
        assert.notEqual(dry.startLabel, 'Nothing to start yet', at);
        // The piles are the items: what the switches show is what plays.
        assert.equal(PILES.reduce((n, p) => n + run.piles[p].count, 0), run.items.length, `${at}: pile counts add up to the run`);
        for (const p of PILES) assert.equal(run.piles[p].count, countOf(run.items, p), `${at}: ${p}`);
        // A pile switched off plays nothing; at least one pile stays in; only the last pile in is ever kept for the student.
        const inPiles = PILES.filter((p) => !run.leaveOut.includes(p) && run.available[p]);
        assert.ok(inPiles.length >= 1, `${at}: at least one pile is in`);
        for (const p of run.leaveOut) assert.equal(run.piles[p].count, 0, `${at}: ${p} is out`);
        assert.ok(run.leaveOut.every((p) => out.includes(p)), at);
        const allOut = PILES.filter((p) => run.available[p]).every((p) => out.includes(p));
        assert.equal(run.kept !== null, allOut, `${at}: kept only when every pile was switched off`);
        // The piles' minutes add up to the run (what the page shows beside the switches).
        assert.ok(Math.abs(dry.piles.filter((p) => !p.left).reduce((n, p) => n + p.minutes, 0) - run.realMinutes) <= 1, `${at}: piles add up to the minutes (to the minute)`);
      }
    }
  }
});

test('LK37: each switch plays only what it says', () => {
  const [, ch] = CHAPTERS[0];
  const base = { kind: 'mix', minutes: 20, cards: ch.cards, states: ch.states, now: NOW, questions: ch.questions, mistakes: ch.mistakes, lesson };
  const all = composeRun({ ...base, leaveOut: [] });
  assert.ok(all.piles.cards.count > 0 && all.piles.questions.count > 0 && all.piles.mistakes.count > 0 && all.piles.lesson.count === 1, 'the chapter has all four');
  assert.equal(composeRun({ ...base, leaveOut: ['lesson'] }).items.some((i) => i.type === 'lesson'), false);
  const cardsAndLesson = composeRun({ ...base, leaveOut: ['questions', 'mistakes'] });
  assert.deepEqual([...new Set(cardsAndLesson.items.map((i) => i.type))].sort(), ['card', 'lesson']);
  const mistakesOnly = composeRun({ ...base, leaveOut: ['cards', 'questions', 'lesson'] });
  assert.ok(mistakesOnly.items.every((i) => i.type === 'question' && i.origin === 'mistake'));
});

// ---------------------------------------------------------------- the handlers

test('LK37: every combination previews and starts a valid run; the start plays what the page showed', async () => {
  const tables = { user_question_progress: [wrongMistake('q-p3', T0 - 3 * DAY), wrongMistake('q-p5', T0 - 3 * DAY), wrongMistake('q-p7', T0 - 3 * DAY)] };
  const { learn } = setup({ isPro: true, tables });
  let n = 0;
  for (const out of SUBSETS) {
    const at = `out [${out}]`;
    const pre = await learn.preview('u1', { chapterKey: PL, minutes: 10, leaveOut: out });
    assert.equal(pre.http, 200, at);
    assert.ok(pre.body.piles.some((p) => !p.left && p.count > 0), `${at}: a pile is in`);
    assert.notEqual(pre.body.startLabel, 'Nothing to start yet', at);
    n += 1;
    const run = await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', leaveOut: out, fresh: true, requestKey: `lk37-combo-${String(n).padStart(4, '0')}` });
    assert.equal(run.http, 200, at);
    assert.ok(run.body.items.length > 0, at);
    // What the page's switches showed is what plays: the counts of the dry run are the counts of the run.
    const shown = Object.fromEntries(pre.body.piles.map((p) => [p.id, p.count]));
    for (const p of ['cards', 'questions', 'mistakes']) assert.equal(countOf(run.body.items, p), shown[p] || 0, `${at}: ${p}`);
    for (const p of pre.body.leaveOut) assert.equal(countOf(run.body.items, p), 0, `${at}: ${p} is out`);
  }
});

test('LK37: the last pile in cannot be switched off; the server keeps the first one', async () => {
  const { learn } = setup({ isPro: true });
  const pre = (await learn.preview('u1', { chapterKey: PL, minutes: 10, leaveOut: ['cards', 'questions', 'mistakes', 'lesson'] })).body;
  assert.equal(pre.piles.filter((p) => !p.left && p.count > 0).length, 1);
  assert.ok(pre.leaveOut.length < 4);
});

test("LK37: Free's rules do not move; switching piles never gets past them", async () => {
  // 20 asked on Free is composed at 10 with the capped line, whatever is switched off.
  for (const out of SUBSETS) {
    const { learn } = setup();
    const pre = (await learn.preview('u1', { chapterKey: PL, minutes: 20, leaveOut: out })).body;
    assert.equal(pre.minutes, 10, `out [${out}]`);
    assert.deepEqual(pre.capped, { asked: 20, text: FREE_CAPPED });
  }
  // After today's session, a chapter run is Key cards only: questions and mistakes are held ("Tomorrow"), and no combination plays them.
  const tables = { user_question_progress: [wrongMistake('q-p3', T0 - 3 * DAY), wrongMistake('q-p5', T0 - 3 * DAY)] };
  const { learn } = setup({ tables });
  const first = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'lk37-free-0001' })).body;
  const q = first.items.find((i) => i.type === 'question');
  assert.equal((await learn.answer('u1', first.id, { itemId: q.id, choice: R(q) })).http, 200, 'the first answer claims the day');
  let n = 0;
  for (const out of SUBSETS) {
    const pre = (await learn.preview('u1', { chapterKey: ST, minutes: 10, leaveOut: out })).body;
    assert.ok(pre.piles.filter((p) => p.id === 'questions' || p.id === 'mistakes').every((p) => p.held === 'free'), `out [${out}]: held on Free`);
    assert.deepEqual(pre.free, { text: FREE_CARDS_ONLY });
    n += 1;
    const run = await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'mix', leaveOut: out, fresh: true, requestKey: `lk37-free-c${String(n).padStart(4, '0')}` });
    assert.equal(run.http, 200, `out [${out}]`);
    assert.ok(run.body.items.length > 0 && run.body.items.every((i) => i.type === 'card'), `out [${out}]: Key cards only`);
  }
});

// ---------------------------------------------------------------- Learn home's offer length

test('LK37: Learn home answers for the length asked; Free is capped at 10 with the one line; a bad value is the default', async () => {
  const pro = setup({ isPro: true });
  const read = async (s, minutes) => (await s.learn.home('u1', P(minutes === undefined ? { subject: 'business_studies' } : { subject: 'business_studies', minutes: String(minutes) }))).body.roadmap;
  const def = await read(pro);
  assert.deepEqual([def.minutes, def.asked, def.capped], [10, 10, null]);
  assert.equal(def.key.run.minutes, 10);
  assert.match(def.key.label, /10 min/);
  for (const m of [5, 20, 35, 120]) {
    const r = await read(pro, m);
    assert.deepEqual([r.minutes, r.asked, r.capped], [m, m, null], String(m));
    assert.equal(r.key.run.minutes, m, 'the key starts that length');
    assert.match(r.key.label, new RegExp(`${m} min`));
    if (r.mode === 'today') assert.match(r.headline, new RegExp(`Today's ${m} minutes`));
  }
  for (const bad of [0, 3, 121, 'abc', '']) assert.equal((await read(pro, bad)).minutes, 10, String(bad));
  const free = setup();
  const f20 = await read(free, 20);
  assert.deepEqual([f20.minutes, f20.asked, f20.capped], [10, 20, { asked: 20, text: FREE_CAPPED }]);
  assert.equal(f20.key.run.minutes, 10, 'Free never gets a key longer than its session');
  const f5 = await read(free, 5);
  assert.deepEqual([f5.minutes, f5.capped], [5, null]);
  // The rest of the answer is the same whatever the length.
  assert.deepEqual((await pro.learn.home('u1', P({ subject: 'business_studies', minutes: '20' }))).body.parts, (await pro.learn.home('u1', P({ subject: 'business_studies' }))).body.parts);
});

test('LK37: the length asked for the offer starts a real run of that length (Pro)', async () => {
  const { learn } = setup({ isPro: true });
  for (const m of [5, 20]) {
    const key = (await learn.home('u1', P({ subject: 'business_studies', minutes: String(m) }))).body.roadmap.key;
    const run = await learn.start('u1', { ...key.run, fresh: true, requestKey: `lk37-offer-${String(m).padStart(4, '0')}` });
    assert.equal(run.http, 200, String(m));
    assert.ok(run.body.items.length > 0);
  }
});
