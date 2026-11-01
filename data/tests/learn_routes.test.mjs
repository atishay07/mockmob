// Learn v2 production handlers (src/lib/server/learn.js, docs/brain/learn-1031/BUILD-1101.md Parts 1 and 2) over the in-memory
// client with the migration's keys and the Learn functions (keycardsMemoryDb.js, packet S2b's mirrors of
// learn_start_run and learn_record_event). Decks and a question index are built here, as keycards_routes.test.mjs does. One test per behaviour of
// A6 section 9 item 1, BUILD-1101 Part 1 and A5 section 4 that lives at handler level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeycards } from '../../src/lib/server/keycards.js';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { createLearn, clientKeyOf, FREE_SESSION_DONE, FREE_END_LINE, FREE_CAPPED, FREE_CARDS_ONLY, keyLetter, servedOptions, mistakeText } from '../../src/lib/server/learn.js';
import { toState } from '../../src/lib/server/learnStore.js';
import { istDay, schedule, tasteIds } from '../keycards.js';

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
    options: servedOptions(r.options), words: r.question.split(/\s+/).length, difficulty: r.difficulty, cards: LINKS[r.id] || [], chash: r.content_hash, managed: false,
  })),
});

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
const runOf = (tables, id) => tables.learn_runs.find((r) => r.id === id);
const wrongMistake = (qid, at) => ({ user_id: 'u1', question_id: qid, subject: 'business_studies', chapter: 'Planning', attempt_count: 1, last_correct: false, last_selected_key: 'C', last_attempted_at: new Date(at).toISOString() });
const noKeys = (body) => {
  for (const item of body.items.filter((i) => i.type === 'question')) {
    assert.deepEqual(Object.keys(item.question).sort(), ['body', 'id', 'options']);
    assert.ok(!('key' in item) && !('correct' in item) && !('explanation' in item));
  }
  assert.ok(!JSON.stringify(body).includes('correct_answer'));
};

// ---------------------------------------------------------------- pure helpers

test('helpers: the served options strip a repeated letter, the key is the live row\'s, the review key is per item', () => {
  const opts = servedOptions(['A. One', 'B. Two', 'C. Three', 'D. Four']);
  assert.deepEqual(opts.map((o) => o.text), ['One', 'Two', 'Three', 'Four']);
  assert.equal(keyLetter({ correct_answer: 'C', options: ['x', 'y', 'z', 'w'] }), 'C');
  assert.equal(keyLetter({ correct_index: 1, options: ['x', 'y', 'z', 'w'] }), 'B');
  assert.equal(servedOptions('["p","q"]').length, 2);
  assert.match(clientKeyOf('lr_x', 'lr_x-i1'), /^learn:[0-9a-f]{40}$/);
  assert.notEqual(clientKeyOf('lr_x', 'lr_x-i1'), clientKeyOf('lr_x', 'lr_x-i2'));
  assert.equal(mistakeText('Mock 4', Date.parse('2026-10-24T10:00:00+05:30'), T0), 'You missed this in Mock 4 on 24 Oct');
  assert.equal(mistakeText('Learn', T0 - DAY, T0), 'You missed this yesterday');
  const stub = toState({ card_id: 'c', reps: 1, due_at: 'x', st: 3.2, lr: '2026-10-30T00:00:00Z', sst: 2, sdue: '2026-11-03T00:00:00Z' });
  assert.deepEqual(stub.schedule, { stability: 3.2, last_review: '2026-10-30T00:00:00Z', state: 2, due: '2026-11-03T00:00:00Z' });
});

// ---------------------------------------------------------------- subject

test('subject: a new Free student, counts true to the tables, a held question not counted, a failed read is 503', async () => {
  const { learn, db } = setup();
  const { http, body } = await learn.subject('u1', P({ subject: 'business_studies' }));
  assert.equal(http, 200);
  assert.equal(body.plan, 'free');
  assert.equal(body.student.isNew, true);
  assert.equal(body.free, null, 'no Free line before the day is claimed');
  const rows = body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters));
  const pl = rows.find((r) => r.key === PL);
  assert.deepEqual([pl.cards, pl.questions, pl.mistakes, pl.due], [14, 12, 0, 0], 'q-held is not counted');
  assert.equal(body.suggestions.length, 3);
  assert.equal((await learn.subject('u1', P({ subject: 'physics_nope' }))).http, 404);
  db.failures.user_question_progress = () => true;
  await assert.rejects(() => learn.subject('u1', P({ subject: 'business_studies' })), /LEARN_UNAVAILABLE/, 'unknown is never a zero');
});

test('subject: an old mistake is open; one from today rests a day (R10.1)', async () => {
  const tables = { user_question_progress: [wrongMistake('q-p3', T0 - 3 * DAY), wrongMistake('q-p4', T0 - HOUR)] };
  const { learn } = setup({ tables, isPro: true });
  const body = (await learn.subject('u1', P({ subject: 'business_studies' }))).body;
  const pl = body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).find((r) => r.key === PL);
  assert.equal(pl.mistakes, 1);
  assert.equal(pl.meta, '1 open mistake');
});

// ---------------------------------------------------------------- preview

test('preview: Free at 20 is composed at 10 with the capped line; Pro at 20 is 20', async () => {
  const free = (await setup().learn.preview('u1', { chapterKey: PL, minutes: 20, leaveOut: [] })).body;
  assert.deepEqual(free.capped, { asked: 20, text: FREE_CAPPED });
  assert.equal(free.minutes, 10);
  assert.equal(free.freeSession.used, false);
  const free10 = (await setup().learn.preview('u1', { chapterKey: PL, minutes: 10, leaveOut: [] })).body;
  assert.equal(free10.capped, null, 'the line shows only past the limit');
  const pro = (await setup({ isPro: true }).learn.preview('u1', { chapterKey: PL, minutes: 20, leaveOut: [] })).body;
  assert.equal(pro.minutes, 20);
  assert.equal(pro.capped, null);
  assert.equal((await setup().learn.preview('u1', { chapterKey: 'business_studies.nope', minutes: 10 })).http, 404);
});

// ---------------------------------------------------------------- start

test('start: a replayed request key is the same run, one row; no keys in the body; exposure rows written', async () => {
  const { learn, tables } = setup({ isPro: true });
  const a = await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'tap-0001-abc' });
  assert.equal(a.http, 200);
  noKeys(a.body);
  assert.equal(a.body.asked, 10);
  assert.ok(a.body.items.every((i) => Number.isFinite(i.seconds) && i.seconds > 0), 'every item carries seconds');
  const b = await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'tap-0001-abc' });
  assert.equal(b.body.id, a.body.id);
  assert.equal(tables.learn_runs.length, 1);
  const qids = a.body.items.filter((i) => i.type === 'question').map((i) => i.question.id);
  assert.ok(qids.length > 0);
  assert.deepEqual(tables.learning_question_exposure.map((e) => e.question_id).sort(), [...qids].sort());
  assert.ok(!qids.includes('q-held'), 'a held Mob question is never served');
  assert.equal((await learn.start('u1', { chapterKey: PL, kind: 'mix', requestKey: 'bad key!' })).http, 422);
  assert.equal((await learn.start('u1', { kind: 'mix' })).http, 422);
  assert.equal((await learn.start('u1', { chapterKey: ST, kind: 'feed', requestKey: 'tap-0001-abc' })).http, 409, 'a key reused for another chapter');
});

test('start: a held-question read that fails serves no question (fail closed)', async () => {
  const { learn } = setup({ isPro: true, held: new Error('attempts unread') });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'tap-held-0001' })).body;
  assert.ok(run.items.length > 0 && run.items.every((i) => i.type === 'card'));
});

test('start: the same chapter and kind on the same India day resumes; fresh starts another; a resume id resumes', async () => {
  const { learn, tables } = setup({ isPro: true });
  const first = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'feed', requestKey: 'feed-0001-aa' })).body;
  const again = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'feed', requestKey: 'feed-0002-aa' })).body;
  assert.equal(again.id, first.id);
  assert.deepEqual(again.resumed, { done: 0, of: first.items.length });
  const fresh = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'feed', requestKey: 'feed-0003-aa', fresh: true })).body;
  assert.notEqual(fresh.id, first.id);
  assert.equal(tables.learn_runs.length, 2);
  const byId = (await learn.start('u1', { resume: first.id, requestKey: 'feed-0004-aa' })).body;
  assert.equal(byId.id, first.id);
});

// ---------------------------------------------------------------- LK15

test('LK15: the claim is at the first answered question; then a feed is 402, a chapter run is Key cards only; a refresh resumes', async () => {
  const s = setup();
  const { learn, tables } = s;
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'free-feed-0001' })).body;
  assert.equal(tables.learning_allowances.filter((r) => r.kind === 'learn_session').length, 0, 'opening a feed costs nothing');
  const q = feed.items.find((i) => i.type === 'question');
  const ans = await learn.answer('u1', feed.id, { itemId: q.id, choice: 'A' });
  assert.equal(ans.http, 200);
  const rows = tables.learning_allowances.filter((r) => r.kind === 'learn_session');
  assert.deepEqual(rows.map((r) => [r.period, r.reference]), [[`${istDay(T0)}:1`, feed.id]]);
  assert.equal(runOf(tables, feed.id).session_claimed, true);
  // A refresh of the claimed feed resumes it (200, never 402).
  const back = await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'free-feed-0002' });
  assert.equal(back.http, 200);
  assert.equal(back.body.id, feed.id);
  // Another feed: 402 with the line and the ways that still work today.
  const other = await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'feed', requestKey: 'free-feed-0003' });
  assert.equal(other.http, 402);
  assert.deepEqual([other.body.error, other.body.reason, other.body.line], ['FREE_SESSION_USED', 'learn_session', FREE_SESSION_DONE]);
  // R3 ruling F: the refusal's Or rows in order (due cards when there are any, then Explore's single questions), and today's
  // own unfinished feed to continue.
  assert.equal(other.body.options.at(-1).label, 'Answer single questions');
  assert.equal(other.body.options.at(-1).go, 'explore');
  assert.equal(other.body.resume.id, feed.id);
  assert.match(other.body.resume.label, /^Continue · \d+ min$/);
  // A chapter run: Key cards only, with the line.
  const mix = await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'mix', requestKey: 'free-mix-00001' });
  assert.equal(mix.http, 200);
  assert.ok(mix.body.items.every((i) => i.type === 'card'));
  assert.deepEqual(mix.body.free, { text: FREE_CARDS_ONLY });
  // Not counted: cards, recap and level start as usual.
  for (const kind of ['cards', 'recap', 'level']) assert.equal((await learn.start('u1', { chapterKey: ST, minutes: 5, kind, requestKey: `free-${kind}-00001` })).http, 200, kind);
  // Covers and Learn home show the line now (only at the real limit).
  assert.deepEqual((await learn.covers('u1', P({ subject: 'business_studies' }))).body.free, { text: FREE_SESSION_DONE, maxMinutes: 10 });
  assert.deepEqual((await learn.subject('u1', P({ subject: 'business_studies' }))).body.free, { text: FREE_SESSION_DONE, maxMinutes: 10 });
});

test('LK15: an answer in a second tab\'s run is 402 and writes nothing; 11:50 pm and 12:10 am are two days; Pro is never limited', async () => {
  const clock = { t: Date.parse('2026-11-02T23:40:00+05:30') };
  const { learn, tables } = setup({ clock });
  const a = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'mix', requestKey: 'tab-one-00001' })).body;
  const b = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'mix', requestKey: 'tab-two-00001' })).body;
  clock.t = Date.parse('2026-11-02T23:50:00+05:30');
  assert.equal((await learn.answer('u1', a.id, { itemId: a.items.find((i) => i.type === 'question').id, choice: 'A' })).http, 200);
  const before = tables.learn_run_events.length;
  const second = await learn.answer('u1', b.id, { itemId: b.items.find((i) => i.type === 'question').id, choice: 'A' });
  assert.equal(second.http, 402);
  assert.equal(second.body.line, FREE_SESSION_DONE);
  assert.equal(tables.learn_run_events.length, before, 'nothing written');
  clock.t = Date.parse('2026-11-03T00:10:00+05:30');
  const c = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'mix', requestKey: 'next-day-00001' })).body;
  assert.ok(c.items.some((i) => i.type === 'question'), 'a new India day, a new session');
  assert.equal((await learn.answer('u1', c.id, { itemId: c.items.find((i) => i.type === 'question').id, choice: 'A' })).http, 200);
  const pro = setup({ isPro: true });
  for (let k = 0; k < 3; k += 1) {
    const r = (await pro.learn.start('u1', { chapterKey: PL, minutes: 20, kind: 'feed', requestKey: `pro-feed-000${k}`, fresh: true })).body;
    assert.equal((await pro.learn.answer('u1', r.id, { itemId: r.items.find((i) => i.type === 'question').id, choice: 'A' })).http, 200);
  }
  assert.equal(pro.tables.learning_allowances.filter((r) => r.kind === 'learn_session').length, 0, 'Pro: no row');
});

// ---------------------------------------------------------------- getRun

test('GET runs/:id: the own run with only the undone items; another student\'s is 404; an ended run is 409 RUN_ENDED', async () => {
  const { learn } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'mix', requestKey: 'get-run-00001' })).body;
  await learn.rate('u1', run.id, { itemId: run.items[0].id, rating: 3 });
  const got = await learn.getRun('u1', run.id);
  assert.equal(got.http, 200);
  assert.deepEqual(got.body.resumed, { done: 1, of: run.items.length });
  assert.equal(got.body.items.length, run.items.length - 1);
  assert.equal((await learn.getRun('u2', run.id)).http, 404);
  await learn.end('u1', run.id);
  const ended = await learn.getRun('u1', run.id);
  assert.equal(ended.http, 409);
  assert.equal(ended.body.error, 'RUN_ENDED');
  assert.match(ended.body.endHref, /^\/learn\/run\?run=/);
});

// ---------------------------------------------------------------- answer

test('answer: graded on the server; a replay is identical and counts nothing twice; the interaction is flow_context learn', async () => {
  const { learn, tables } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'answer-00001' })).body;
  const q = run.items.find((i) => i.type === 'question');
  const wrong = await learn.answer('u1', run.id, { itemId: q.id, choice: 'B' });
  assert.equal(wrong.http, 200);
  assert.deepEqual([wrong.body.correct, wrong.body.key], [false, 'A']);
  assert.ok(wrong.body.explanation.startsWith('Because'));
  const again = await learn.answer('u1', run.id, { itemId: q.id, choice: 'A' });
  assert.deepEqual(again.body, wrong.body, 'graded once');
  const prog = tables.user_question_progress.filter((r) => r.question_id === q.question.id);
  assert.equal(prog.length, 1);
  assert.deepEqual([prog[0].attempt_count, prog[0].last_selected_key, prog[0].last_correct], [1, 'B', false]);
  assert.deepEqual(tables.question_interactions.map((r) => [r.flow_context, r.session_id, r.metadata.selected_key]), [['learn', run.id, 'B']]);
  assert.equal((await learn.answer('u1', run.id, { itemId: run.items.find((i) => i.type === 'card').id, choice: 'A' })).http, 422);
  assert.equal((await learn.answer('u1', run.id, { itemId: run.items.filter((i) => i.type === 'question')[1].id, choice: 'Z' })).http, 422);
  assert.equal((await learn.answer('u2', run.id, { itemId: q.id, choice: 'A' })).http, 404);
});

test('answer: a changed or held question is 409 and writes nothing; an expired run is 409 RUN_EXPIRED', async () => {
  const clock = { t: T0 };
  const s = setup({ isPro: true, clock });
  const run = (await s.learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'answer-00002' })).body;
  const [q1, q2] = run.items.filter((i) => i.type === 'question');
  s.tables.questions.find((r) => r.id === q1.question.id).content_hash = 'edited';
  assert.deepEqual([(await s.learn.answer('u1', run.id, { itemId: q1.id, choice: 'A' })).body.error], ['QUESTION_CHANGED']);
  s.tables.questions.find((r) => r.id === q2.question.id).verification_state = 'disputed';
  assert.deepEqual((await s.learn.answer('u1', run.id, { itemId: q2.id, choice: 'A' })).body.error, 'QUESTION_CHANGED', 'a disputed row is not graded');
  assert.equal(s.tables.learn_run_events.length, 0);
  assert.equal((s.tables.user_question_progress || []).length, 0);
  const held = setup({ isPro: true, held: new Set() });
  const r2 = (await held.learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'answer-00003' })).body;
  const hq = r2.items.find((i) => i.type === 'question');
  const heldNow = setup({ isPro: true, held: new Set([hq.question.id]), tables: held.tables });
  assert.equal((await heldNow.learn.answer('u1', r2.id, { itemId: hq.id, choice: 'A' })).body.error, 'QUESTION_HELD');
  clock.t = T0 + 49 * HOUR;
  const q3 = run.items.filter((i) => i.type === 'question')[2];
  assert.equal((await s.learn.answer('u1', run.id, { itemId: q3.id, choice: 'A' })).body.error, 'RUN_EXPIRED');
});

test('answer: a retried mistake is graded as Revise grades it (right: back to check it held), and moves no progress', async () => {
  const tables = { user_question_progress: [wrongMistake('q-p3', Date.parse('2026-10-24T10:40:00+05:30'))] };
  const { learn, tables: db } = setup({ isPro: true, tables, places: async () => new Map([['q-p3', 'Mock 4']]) });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'mistake-0001' })).body;
  const m = run.items.find((i) => i.type === 'question' && i.origin === 'mistake');
  assert.deepEqual(m.mistake, { where: 'Mock 4', when: '24 Oct', label: 'You missed this in Mock 4 on 24 Oct' });
  const right = (await learn.answer('u1', run.id, { itemId: m.id, choice: 'A' })).body;
  assert.equal(right.fixed, true);
  assert.equal(right.retired, false);
  assert.match(right.fixedText, /^Right this time\. Back (on (Mon|Tue|Wed|Thu|Fri|Sat|Sun)|tomorrow) to check it held\.$/);
  const card = db.revise_cards.find((c) => c.question_id === 'q-p3');
  assert.deepEqual([card.box, card.state], [2, 'active']);
  assert.deepEqual([db.user_question_progress[0].attempt_count, db.user_question_progress[0].last_correct], [1, false], 'a retry moves no accuracy');
  const after = (await learn.subject('u1', P({ subject: 'business_studies' }))).body;
  assert.equal(after.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).find((r) => r.key === PL).mistakes, 0, 'not due again until it is checked');
});

test('answer: the line\'s card still ahead moves closer, no copy (R7); a card already shown comes back once, tagged', async () => {
  const { learn, tables } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 20, kind: 'mix', requestKey: 'reinsert-0001' })).body;
  const items = run.items;
  const linked = items.findIndex((i) => i.type === 'question' && i.question.id === 'q-p1');
  if (linked >= 0) {
    const ahead = items.findIndex((i) => i.type === 'card' && i.card.id === PLANNING[0].id) > linked;
    const out = (await learn.answer('u1', run.id, { itemId: items[linked].id, choice: 'B' })).body;
    assert.ok(out.line?.card?.id === PLANNING[0].id);
    const ids = runOf(tables, run.id).items.filter((i) => i.type === 'card').map((i) => i.cardId);
    if (ahead) {
      assert.equal(new Set(ids).size, ids.length, 'a card still ahead is moved, never copied');
      assert.equal(out.reinsert.moved, true);
      assert.ok(out.reinsert.at <= linked + 3);
    } else {
      assert.equal(ids.filter((id) => id === PLANNING[0].id).length, 2, 'shown before: one copy');
      assert.equal(out.reinsert.item.reason, 'earlier');
    }
  }
  // A question whose card is not in the run: the line's card is put in, tagged "line".
  const q2 = items.find((i) => i.type === 'question' && i.question.id === 'q-p2');
  if (q2 && !items.some((i) => i.type === 'card' && i.card.id === PLANNING[9].id)) {
    const out = (await learn.answer('u1', run.id, { itemId: q2.id, choice: 'B' })).body;
    assert.equal(out.reinsert.item.reason, 'line');
    assert.equal(out.reinsert.item.card.id, PLANNING[9].id);
  }
});

test('answer on Free: a line whose card is not open takes a keycard_line slot (R14), else the locked line', async () => {
  const { learn, tables } = setup();
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'free-line-001' })).body;
  const q2 = run.items.find((i) => i.type === 'question' && i.question.id === 'q-p2');
  if (!q2) return; // the composer did not pick it at this length
  const out = (await learn.answer('u1', run.id, { itemId: q2.id, choice: 'B' })).body;
  assert.equal(out.line.card.id, PLANNING[9].id, 'a Good-to-know card shown through the line allowance');
  assert.equal(out.reinsert, null, 'a card that is not open is never put in the run');
  assert.equal(tables.learning_allowances.filter((r) => r.kind === 'keycard_line').length, 1);
});

// ---------------------------------------------------------------- rate and keep

test('rate: Got it stamps a real date; Missed comes back once; its re-rating is a last look with the first stamp; withToday false', async () => {
  const { learn, tables, calls } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'cards', requestKey: 'rate-000001' })).body;
  const got = (await learn.rate('u1', run.id, { itemId: run.items[0].id, rating: 3 })).body;
  assert.match(got.stamp, /^Back (tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun|in \d+ days|later today)$/);
  assert.equal(got.revisePile.count, 1);
  const missed = (await learn.rate('u1', run.id, { itemId: run.items[1].id, rating: 1 })).body;
  assert.equal(missed.stamp, 'Back later in this run');
  assert.equal(missed.reinsert.at, 4);
  assert.equal(missed.reinsert.item.stage, 'again');
  const replay = (await learn.rate('u1', run.id, { itemId: run.items[1].id, rating: 3 })).body;
  assert.equal(replay.replay, true);
  const reviews = () => tables.key_card_reviews.filter((r) => r.card_id === run.items[1].card.id);
  assert.equal(reviews().length, 1, 'a retried rating rates once');
  const back = (await learn.rate('u1', run.id, { itemId: missed.reinsert.itemId, rating: 3 })).body;
  assert.equal(back.again, true);
  assert.equal(reviews().length, 2);
  assert.equal(reviews()[1].mode, 'last_look', 'no second schedule move');
  assert.ok(calls.filter((c) => c.fn === 'review').every((c) => c.opts.withToday === false && /^learn:/.test(c.opts.clientKey)));
  const end = (await learn.end('u1', run.id)).body;
  assert.equal(end.numbers.cards, 2, 'distinct cards');
  assert.equal(end.numbers.detail.cards, '1 got it, 1 missed', 'first ratings');
});

test('keep: an add (manual, reps 0), no review and no allowance; a card already in Revise writes nothing; a replay', async () => {
  const at = T0 - 2 * DAY;
  const s = schedule(null, 3, at);
  const held = { user_id: 'u1', card_id: PLANNING[2].id, subject: 'business_studies', chapter_key: PL, schedule: s.schedule, reps: 1, lapses: 0, due_at: s.due_at, last_review_at: new Date(at).toISOString(), last_rating: 3, added_from: 'chapter', added_at: new Date(at).toISOString(), suspended: false };
  const { learn, tables } = setup({ isPro: true, tables: { key_card_states: [held] } });
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'keep-000001' })).body;
  const card = feed.items.find((i) => i.type === 'card' && i.card.id !== PLANNING[2].id);
  const kept = (await learn.rate('u1', feed.id, { itemId: card.id, keep: true })).body;
  assert.deepEqual([kept.kept, kept.stamp, kept.line], [true, 'In Revise', 'In Revise']);
  const row = tables.key_card_states.find((r) => r.card_id === card.card.id);
  assert.deepEqual([row.added_from, row.reps], ['manual', 0]);
  assert.equal((tables.key_card_reviews || []).length, 0);
  assert.equal((tables.learning_allowances || []).length, 0);
  assert.equal((await learn.rate('u1', feed.id, { itemId: card.id, keep: true })).body.replay, true);
  const heldItem = feed.items.find((i) => i.type === 'card' && i.card.id === PLANNING[2].id);
  if (heldItem) {
    const k2 = (await learn.rate('u1', feed.id, { itemId: heldItem.id, keep: true })).body;
    assert.match(k2.stamp, /^Back /);
    assert.match(k2.line, /^In Revise, back /);
  }
  const end = (await learn.end('u1', feed.id)).body;
  assert.equal(end.feed.kept.line, `${end.feed.kept.count} kept. They are first in Revise.`);
  assert.equal(end.feed.lead.run.fresh, true, '"Another 10 minutes" starts a new feed');
});

test('the feed never serves a due card, and moves forward: two feeds in a row share no card while the chapter has unshown cards', async () => {
  const at = T0 - 6 * DAY;
  const due = PLANNING.slice(0, 2).map((c) => { const s = schedule(null, 3, at); return { user_id: 'u1', card_id: c.id, subject: 'business_studies', chapter_key: PL, schedule: s.schedule, reps: 1, lapses: 0, due_at: s.due_at, last_review_at: new Date(at).toISOString(), last_rating: 3, added_from: 'chapter', added_at: new Date(at).toISOString(), suspended: false }; });
  const { learn } = setup({ isPro: true, tables: { key_card_states: due } });
  const a = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'feed', requestKey: 'fwd-000001' })).body;
  const cardsA = a.items.filter((i) => i.type === 'card').map((i) => i.card.id);
  for (const id of due.map((d) => d.card_id)) assert.ok(!cardsA.includes(id) || a.items.find((i) => i.card?.id === id)?.look, 'a due card stays Revise\'s');
  // Act on the last item so every card before it counts as shown.
  const last = a.items[a.items.length - 1];
  if (last.type === 'question') await learn.answer('u1', a.id, { itemId: last.id, choice: 'A' });
  else await learn.rate('u1', a.id, { itemId: last.id, keep: true });
  await learn.end('u1', a.id);
  const b = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'feed', requestKey: 'fwd-000002', fresh: true })).body;
  const cardsB = b.items.filter((i) => i.type === 'card').map((i) => i.card.id);
  const unshown = PLANNING.filter((c) => !cardsA.includes(c.id) && !due.some((d) => d.card_id === c.id)).map((c) => c.id);
  // The cards not shown come first (BUILD-1101 1.2): all in the second feed, and only they while there are enough of them.
  if (unshown.length >= cardsB.length) assert.deepEqual(cardsB.filter((id) => cardsA.includes(id)), [], 'the second feed moves forward');
  else assert.deepEqual(unshown.filter((id) => !cardsB.includes(id)), [], 'every unshown card is in the second feed');
  assert.ok(b.items.every((i) => i.type !== 'card' || !due.some((d) => d.card_id === i.card.id)), 'never a due card');
});

// ---------------------------------------------------------------- end

test('end: numbers, ended_at once, and Free after the claim leads with the line and offers nothing that serves questions', async () => {
  const { learn, tables } = setup();
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'end-000001' })).body;
  const qs = run.items.filter((i) => i.type === 'question');
  await learn.answer('u1', run.id, { itemId: qs[0].id, choice: 'A' });
  await learn.answer('u1', run.id, { itemId: qs[1].id, choice: 'B' });
  const end = (await learn.end('u1', run.id)).body;
  assert.equal(end.numbers.questions, 2);
  assert.equal(end.lines.find((l) => l.label === 'Questions').text, '1 of 2 right');
  assert.equal(end.title, '10 minutes on Planning');
  // R3 ruling F: one line; the session had cards, so the main key is Quick recap and See Pro is the quiet link.
  assert.equal(end.lead.line, FREE_END_LINE);
  assert.deepEqual([end.lead.kind, end.lead.run.kind], ['recap', 'recap']);
  assert.match(end.lead.label, /^Quick recap · \d+ min$/);
  assert.deepEqual(end.options.map((o) => [o.label, o.href]), [['See Pro', '/pricing']]);
  assert.ok([end.lead, ...end.options].every((o) => !(o.run && ['mix', 'feed'].includes(o.run.kind))), 'no key serves questions');
  // Every key is accepted by the server for this student: the recap starts (not counted).
  assert.equal((await learn.start('u1', { ...end.lead.run, requestKey: 'end-recap-001' })).http, 200);
  const endedAt = runOf(tables, run.id).ended_at;
  assert.ok(endedAt);
  const twice = (await learn.end('u1', run.id)).body;
  assert.deepEqual(twice.numbers, end.numbers);
  assert.equal(runOf(tables, run.id).ended_at, endedAt, 'ended once');
  assert.equal((await learn.end('u1', 'lr_nope')).http, 404);
});

test('R2 ruling 6: a run stopped part way stays open to pick up today; its end still reads, and a later full end closes it', async () => {
  const { learn, tables } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'stop-0000001' })).body;
  const first = run.items.find((i) => i.type === 'card');
  await learn.rate('u1', run.id, { itemId: first.id, rating: 3 });
  const stopped = await learn.end('u1', run.id, { stop: true });
  assert.equal(stopped.http, 200);
  assert.equal(stopped.body.stopped, true);
  assert.equal(runOf(tables, run.id).ended_at ?? null, null, 'not ended');
  assert.ok(stopped.body.options.length <= 1, 'one quiet key at most');
  assert.ok(stopped.body.progress && stopped.body.progress.seen >= 1 && stopped.body.progress.before <= stopped.body.progress.seen);
  const again = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'stop-0000002' })).body;
  assert.equal(again.id, run.id, 'a start of the same chapter today picks it up');
  assert.ok(again.resumed && again.resumed.done >= 1);
  const ended = await learn.end('u1', run.id);
  assert.equal(ended.body.stopped, false);
  assert.ok(runOf(tables, run.id).ended_at, 'a full end closes it');
});

test('R3 L5 (C2-1): stop, then the end\'s fix key starts a NEW mistakes-only run and its main key resumes the stopped run', async () => {
  const tables = { user_question_progress: [wrongMistake('q-p3', T0 - 3 * DAY), wrongMistake('q-p5', T0 - 4 * DAY)] };
  const { learn, tables: t } = setup({ isPro: true, tables });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'c21-stop-0001' })).body;
  const items = run.items;
  // Three items done, then "Stop here".
  for (const item of items.slice(0, 3)) {
    if (item.type === 'card') await learn.rate('u1', run.id, { itemId: item.id, rating: 3 });
    else await learn.answer('u1', run.id, { itemId: item.id, choice: 'A' });
  }
  const end = (await learn.end('u1', run.id, { stop: true })).body;
  assert.equal(end.stopped, true);
  assert.deepEqual([end.lead.kind, end.lead.run.resume, end.lead.run.kind], ['continue', run.id, 'mix']);
  assert.match(end.lead.label, /^Continue · \d+ min$/);
  assert.equal(end.options.length, 1);
  const fix = end.options[0];
  assert.match(fix.label, /^Fix 2 open mistakes · \d+ min$/);
  assert.deepEqual([fix.run.kind, fix.run.fresh, fix.run.leaveOut], ['mix', true, ['questions', 'cards', 'lesson']]);
  // The fix key: a new run of the open mistakes only, never the stopped run at item 4.
  const fixed = (await learn.start('u1', { ...fix.run, requestKey: 'c21-fix-00001' })).body;
  assert.notEqual(fixed.id, run.id, 'a new run');
  assert.equal(fixed.resumed, null);
  assert.ok(fixed.items.length > 0 && fixed.items.every((i) => i.type === 'question' && i.origin === 'mistake'), 'mistakes only');
  // Even without `fresh`, a mistakes-only start never resumes a stopped full run (start()'s resume branch).
  const plain = (await learn.start('u1', { chapterKey: PL, minutes: fix.run.minutes, kind: 'mix', leaveOut: ['questions', 'cards', 'lesson'], requestKey: 'c21-fix-00002' })).body;
  assert.notEqual(plain.id, run.id);
  assert.ok(plain.items.every((i) => i.origin === 'mistake'));
  // The main key: the stopped run, picked up after its 3 done items.
  const back = (await learn.start('u1', { ...end.lead.run, requestKey: 'c21-cont-0001' })).body;
  assert.equal(back.id, run.id);
  assert.equal(back.resumed.done, 3);
  assert.equal(back.items[0].id, items[3].id, 'it goes on at item 4');
  assert.equal(runOf(t, run.id).ended_at ?? null, null);
  // A plain start of the same chapter (a full mix) still picks the stopped run up.
  assert.equal((await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'c21-again-001' })).body.id, run.id);
});

test('R3 ruling F: every key a Free end and the feed refusal offer is accepted by the server for that student', async () => {
  const s = setup();
  const { learn } = s;
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'f-keys-feed01' })).body;
  await learn.answer('u1', feed.id, { itemId: feed.items.find((i) => i.type === 'question').id, choice: 'A' });
  // The feed refusal: Continue (today's own feed), the Or rows.
  const refused = await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'feed', requestKey: 'f-keys-feed02' });
  assert.equal(refused.http, 402);
  const { resume, options } = refused.body;
  assert.equal((await learn.start('u1', { resume: resume.id, kind: resume.kind, chapterKey: resume.chapterKey, requestKey: 'f-keys-cont01' })).body.id, feed.id, 'Continue resumes today\'s own run');
  for (const o of options.filter((x) => x.run)) assert.equal((await learn.start('u1', { ...o.run, requestKey: `f-keys-${o.kind}-01` })).http, 200, o.label);
  assert.ok(options.every((o) => o.run || o.href === '/explore' || o.href.startsWith('/explore?')));
  // A Free run end after the session: Quick recap (not counted) is accepted; a stopped run's Continue resumes it.
  const mix = (await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'mix', requestKey: 'f-keys-mix-01' })).body;
  await learn.rate('u1', mix.id, { itemId: mix.items[0].id, rating: 3 });
  const stopped = (await learn.end('u1', mix.id, { stop: true })).body;
  assert.equal(stopped.lead.kind, 'continue');
  assert.deepEqual(stopped.options, [], 'no fix key on Free\'s used day');
  assert.equal((await learn.start('u1', { ...stopped.lead.run, requestKey: 'f-keys-cont02' })).body.id, mix.id);
  const done = (await learn.end('u1', feed.id)).body;
  assert.equal(done.lead.line, FREE_END_LINE);
  if (done.lead.run) assert.equal((await learn.start('u1', { ...done.lead.run, requestKey: 'f-keys-recap1' })).http, 200);
  else assert.equal(done.lead.href, '/pricing');
});

// ---------------------------------------------------------------- cards, shelves, search, covers

test('cards: the four filters, the locked line on Free, and the subject-wide read equals the per-chapter reads', async () => {
  const { learn } = setup();
  const pl = (await learn.cards('u1', P({ chapter: PL, filter: 'all' }))).body;
  assert.deepEqual([pl.counts.total, pl.counts.all], [14, 5]);
  assert.equal(pl.lockedLine, '9 more cards in this chapter. Pro opens every card in every chapter and keeps them on a schedule.');
  const all = (await learn.cards('u1', P({ subject: 'business_studies', filter: 'all' }))).body;
  const st = (await learn.cards('u1', P({ chapter: ST, filter: 'all' }))).body;
  assert.deepEqual(all.chapters.map((c) => c.key), [PL, ST]);
  assert.deepEqual(all.chapters[0].cards.map((c) => c.id), pl.sections.flatMap((s) => s.cards).map((c) => c.id));
  assert.deepEqual(all.chapters[1].cards.map((c) => c.id), st.sections.flatMap((s) => s.cards).map((c) => c.id));
  assert.equal(all.lockedCount, pl.lockedCount + st.lockedCount);
  for (const filter of ['must', 'revise', 'missed']) assert.equal((await learn.cards('u1', P({ chapter: PL, filter }))).http, 200);
});

test('shelves: the all-subject due count is the Key cards service\'s own (E2)', async () => {
  const at = T0 - 6 * DAY;
  const s = schedule(null, 3, at);
  const due = { user_id: 'u1', card_id: PLANNING[0].id, subject: 'business_studies', chapter_key: PL, schedule: s.schedule, reps: 1, lapses: 0, due_at: s.due_at, last_review_at: new Date(at).toISOString(), last_rating: 1, added_from: 'chapter', added_at: new Date(at).toISOString(), suspended: false };
  const { learn, kc } = setup({ tables: { key_card_states: [due] } });
  const body = (await learn.shelves('u1', P({ subject: 'business_studies' }))).body;
  assert.equal(body.due.all, await kc.dueCount('u1'));
  assert.equal(body.due.count, 1);
  assert.equal(body.missed.count, 1);
});

test('search: Free stubs never carry locked words', async () => {
  const { learn } = setup();
  const out = (await learn.search('u1', P({ subject: 'business_studies', q: 'planning objectives' }))).body;
  assert.ok(out.cards.length > 0);
  for (const r of out.cards.filter((x) => x.locked)) assert.equal(r.card.front, undefined);
});

test('covers: every playable chapter, For you first with its reason, the hook, one true line, counts at 5, 10 and 20', async () => {
  const tables = { user_question_progress: [wrongMistake('q-s1', T0 - 3 * DAY)] };
  tables.user_question_progress[0].chapter = 'Staffing';
  const { learn } = setup({ tables });
  const body = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
  assert.deepEqual(body.lengths, [5, 10, 20]);
  assert.deepEqual(body.covers.map((c) => c.key), [ST, PL], 'For you, then book order from the next chapter, wrapping');
  const st = body.covers[0];
  assert.deepEqual([st.forYou, st.reason, st.studentLine, st.mistakes], [true, '1 open mistake to fix', '1 open mistake to fix', 1]);
  assert.deepEqual(Object.keys(st.hook).sort(), ['front', 'id', 'kind', 'mustKnow']);
  assert.equal(st.ref, null);
  assert.equal(st.art, null);
  const pl = body.covers[1];
  assert.deepEqual([pl.forYou, pl.reason, pl.studentLine], [false, null, 'New to you']);
  for (const c of body.covers) {
    assert.ok(c.counts[5].cards <= c.counts[10].cards);
    assert.deepEqual({ ...c.counts[20], capped: undefined }, { ...c.counts[10], capped: undefined }, 'Free: 20 is composed as 10');
  }
  assert.equal(body.free, null);
});

// ---------------------------------------------------------------- BUILD-1101 B7: the server fields the UI needs (packet S3)

const dueStates = (cards, at) => cards.map((c) => { const s = schedule(null, 3, at); return { user_id: 'u1', card_id: c.id, subject: 'business_studies', chapter_key: PL, schedule: s.schedule, reps: 1, lapses: 0, due_at: s.due_at, last_review_at: new Date(at).toISOString(), last_rating: 3, added_from: 'chapter', added_at: new Date(at).toISOString(), suspended: false }; });
const actOn = async (learn, run, item) => (item.type === 'question'
  ? learn.answer('u1', run.id, { itemId: item.id, choice: 'A' })
  : learn.rate('u1', run.id, { itemId: item.id, keep: true }));

test('B7 4: a cover shows the card its feed serves first (hook.id), its name and ref line, and a start from it is kept in start_state', async () => {
  const { learn, tables } = setup({ isPro: true });
  const body = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
  assert.equal(body.history, false, 'nothing studied yet');
  assert.deepEqual([body.covers[0].forYou, body.covers[0].reason], [true, 'First in the syllabus']);
  assert.ok(body.covers.every((c) => typeof c.name === 'string' && 'refLine' in c && 'resume' in c && c.resume === null));
  assert.ok(body.covers.every((c) => c.studentLine === 'New to you'));
  for (const [i, c] of body.covers.entries()) {
    const run = (await learn.start('u1', { chapterKey: c.key, minutes: 10, kind: 'feed', requestKey: `hook-${i}-000001`, source: 'explore_cover', forYou: c.forYou, position: i })).body;
    assert.equal(run.items[0].type, 'card');
    assert.equal(run.items[0].card.id, c.hook.id, 'a feed started right after reading the covers opens with the hook');
    const state = runOf(tables, run.id).start_state;
    assert.deepEqual([state.source, state.forYou, state.position], ['explore_cover', c.forYou, i]);
  }
  // Anything else in these fields is dropped, never stored.
  const odd = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'mix', requestKey: 'hook-odd-000001', source: 'somewhere', forYou: 'yes', position: 'x' })).body;
  assert.ok(!('source' in runOf(tables, odd.id).start_state));
});

test('B7 4: an unfinished feed is the cover\'s resume and hook; a feed finished today is not offered again while another qualifies', async () => {
  const { learn } = setup({ isPro: true });
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'resume-000001' })).body;
  await actOn(learn, feed, feed.items[0]);
  const body = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
  const pl = body.covers.find((c) => c.key === PL);
  assert.deepEqual([body.covers[0].key, body.covers[0].reason], [PL, 'Pick up where you stopped']);
  assert.deepEqual(pl.resume, { runId: feed.id, done: 1, of: feed.items.length, minutesLeft: pl.resume.minutesLeft });
  assert.ok(pl.resume.minutesLeft >= 1);
  assert.equal(pl.studentLine, `You stopped at 1 of ${feed.items.length}`);
  const back = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'resume-000002' })).body;
  assert.equal(back.id, feed.id);
  assert.equal(pl.hook.id, back.items.find((i) => i.type === 'card').card.id, 'Play resumes the feed, so the hook is its next card');
  // Finish it: act on the last item and end. The lead moves on to the other chapter.
  await actOn(learn, feed, feed.items[feed.items.length - 1]);
  await learn.end('u1', feed.id);
  const after = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
  assert.deepEqual([after.covers[0].key, after.covers[0].forYou, after.covers[0].reason], [ST, true, 'Next after Planning']);
  assert.equal(after.covers.find((c) => c.key === PL).forYou, false);
  assert.equal(after.covers.length, 2, 'the finished chapter keeps its cover');
});

test('B7 2: the feed end says how far it got and how long it took (first event to last, at least 1 minute)', async () => {
  const { learn, tables } = setup({ isPro: true });
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'done-0000001' })).body;
  await actOn(learn, feed, feed.items[1]);
  const first = (await learn.end('u1', feed.id)).body.feed.done;
  assert.deepEqual(first, { reached: 2, of: feed.items.length, minutes: 1 });
  const feed2 = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'feed', requestKey: 'done-0000002' })).body;
  await actOn(learn, feed2, feed2.items[0]);
  await actOn(learn, feed2, feed2.items[feed2.items.length - 1]);
  const events = tables.learn_run_events.filter((e) => e.run_id === feed2.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  events[0].created_at = '2026-11-02T12:00:00.000Z';
  events[1].created_at = '2026-11-02T12:04:20.000Z';
  assert.deepEqual((await learn.end('u1', feed2.id)).body.feed.done, { reached: feed2.items.length, of: feed2.items.length, minutes: 4 });
  const none = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'feed', requestKey: 'done-0000003', fresh: true })).body;
  assert.deepEqual((await learn.end('u1', none.id)).body.feed.done, { reached: 0, of: none.items.length, minutes: 1 });
});

test('B7 3: an answer echoes the choice, and a replay echoes the first one', async () => {
  const { learn } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'echo-0000001' })).body;
  const q = run.items.find((i) => i.type === 'question');
  const a = (await learn.answer('u1', run.id, { itemId: q.id, choice: 'b' })).body;
  assert.deepEqual([a.choice, a.correct], ['B', false]);
  const again = (await learn.answer('u1', run.id, { itemId: q.id, choice: 'A' })).body;
  assert.equal(again.choice, 'B', 'the first answer stands');
});

test('B7 7: filter=due lists exactly the chapter\'s due cards, per chapter and over the subject', async () => {
  const states = dueStates(PLANNING.slice(0, 2), T0 - 6 * DAY);
  const { learn } = setup({ isPro: true, tables: { key_card_states: states } });
  const one = (await learn.cards('u1', P({ chapter: PL, filter: 'due' }))).body;
  assert.equal(one.counts.due, 2);
  assert.deepEqual(one.sections.flatMap((s) => s.cards.map((c) => c.id)).sort(), states.map((s) => s.card_id).sort());
  const all = (await learn.cards('u1', P({ subject: 'business_studies', filter: 'due' }))).body;
  assert.equal(all.filter, 'due');
  assert.deepEqual(all.chapters.map((c) => [c.key, c.cards.length]), [[PL, 2], [ST, 0]]);
});

test('B7 9: a missing chapter is 404 CHAPTER_NOT_FOUND on a start, a dry run and the cards, and api.js names it', async () => {
  const { learn } = setup({ isPro: true });
  for (const out of [
    await learn.start('u1', { chapterKey: 'business_studies.nope', minutes: 10, kind: 'feed', requestKey: 'nope-0000001' }),
    await learn.preview('u1', { chapterKey: 'business_studies.nope', minutes: 10 }),
    await learn.cards('u1', P({ chapter: 'business_studies.nope' })),
  ]) assert.deepEqual([out.http, out.body.error], [404, 'CHAPTER_NOT_FOUND']);
  const api = await import('../../src/components/learn2/api.js');
  const error = new api.LearnError(404, { error: 'CHAPTER_NOT_FOUND' });
  assert.equal(error.kind, 'chapter_not_found');
  assert.equal(api.isChapterMissing(error), true);
  assert.equal(api.isChapterMissing(new api.LearnError(404, { error: 'RUN_NOT_FOUND' })), false);
});

test('B7 6: the run end names the cards it sent to Revise (at most 4, run order) and every key says what it is', async () => {
  const { learn } = setup({ isPro: true });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'revise-000001' })).body;
  const cards = run.items.filter((i) => i.type === 'card');
  assert.ok(cards.length >= 5);
  for (const [i, c] of cards.slice(0, 5).entries()) await learn.rate('u1', run.id, { itemId: c.id, rating: i === 1 ? 4 : 3 });
  const end = (await learn.end('u1', run.id)).body;
  assert.deepEqual(end.reviseCards.map((c) => c.id), cards.slice(0, 4).map((c) => c.card.id), 'the first four, in run order');
  assert.deepEqual(Object.keys(end.reviseCards[0]).sort(), ['front', 'id', 'kind', 'mustKnow']);
  assert.equal(end.reviseCards[0].front, cards[0].card.front);
  const KINDS = ['next', 'here', 'fix', 'revise', 'recap', 'mock', 'explore'];
  for (const o of [end.lead, ...end.options]) {
    assert.ok(KINDS.includes(o.kind), `kind ${o.kind}`);
    assert.equal(typeof o.title, 'string');
    assert.ok(o.minutes === null || Number.isInteger(o.minutes));
  }
  const none = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'mix', requestKey: 'revise-000002' })).body;
  assert.deepEqual((await learn.end('u1', none.id)).body.reviseCards, [], 'nothing sent to Revise');
});

test('B7 6: after the Free session is used, the end\'s options still carry kind, title and minutes', async () => {
  const { learn } = setup();
  const a = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'freeend-00001' })).body;
  await learn.answer('u1', a.id, { itemId: a.items.find((i) => i.type === 'question').id, choice: 'A' });
  const end = (await learn.end('u1', a.id)).body;
  assert.match(end.lead.label, /^Quick recap · \d+ min$/);
  assert.equal(end.lead.line, FREE_END_LINE);
  for (const o of [end.lead, ...end.options]) assert.deepEqual([typeof o.kind, typeof o.title, o.minutes === null || Number.isInteger(o.minutes)], ['string', 'string', true]);
  assert.ok(end.options.some((o) => o.kind === 'pro' && o.minutes === null));
});

// ---------------------------------------------------------------- Learn v2 fix round F4: the server tells the truth

const heldStates = (cards, { due = false, user = 'u1' } = {}) => cards.map((c) => {
  const at = T0 - (due ? 6 : 0) * DAY;
  const s = schedule(null, 3, at);
  return { user_id: user, card_id: c.id, subject: 'business_studies', chapter_key: c.chapterKey, schedule: s.schedule, reps: 1, lapses: 0, due_at: due ? new Date(T0 - 2 * DAY).toISOString() : new Date(T0 + 5 * DAY).toISOString(), last_review_at: new Date(at).toISOString(), last_rating: 3, added_from: 'chapter', added_at: new Date(at).toISOString(), suspended: false };
});
const openCardsOf = (cards) => [...tasteIds(cards)].map((id) => cards.find((c) => c.id === id));
const variants = {
  'Pro, new': { isPro: true, states: () => [] },
  'Pro, returning': { isPro: true, states: () => heldStates(PLANNING.slice(0, 3)) },
  'Free, new': { isPro: false, states: () => [] },
  'Free, returning': { isPro: false, states: () => heldStates(openCardsOf(PLANNING).slice(0, 2)) },
};

test('F4 1: counts[m].hook is the first card of that length\'s feed, null with no card; the top-level hook is counts[10].hook', async () => {
  for (const [name, v] of Object.entries(variants)) {
    for (const m of [5, 10, 20]) {
      const { learn } = setup({ isPro: v.isPro, tables: { key_card_states: v.states() } });
      const body = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
      for (const [i, c] of body.covers.entries()) {
        assert.deepEqual(c.hook, c.counts[10].hook, `${name}: the top-level hook is the 10-minute one`);
        for (const len of [5, 10, 20]) assert.ok('hook' in c.counts[len], `${name} ${len}: the key is always there`);
        const run = (await learn.start('u1', { chapterKey: c.key, minutes: m, kind: 'feed', requestKey: `hk-${m}-${i}-00001` })).body;
        const first = run.items.find((x) => x.type === 'card');
        if (c.counts[m].hook) {
          assert.equal(run.items[0].type, 'card', `${name} ${m} ${c.key}: a card first`);
          assert.equal(run.items[0].card.id, c.counts[m].hook.id, `${name} ${m} ${c.key}: the feed opens on counts[m].hook`);
          assert.deepEqual(Object.keys(c.counts[m].hook).sort(), ['front', 'id', 'kind', 'mustKnow']);
        } else assert.equal(first, undefined, `${name} ${m} ${c.key}: no hook, no card in that feed`);
      }
    }
  }
});

test('F4 1: a Pro chapter whose cards are all due has no card in its feed, so its hook is null (never a card the feed will not show)', async () => {
  const { learn } = setup({ isPro: true, tables: { key_card_states: heldStates(PLANNING, { due: true }) } });
  const body = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
  const pl = body.covers.find((c) => c.key === PL);
  for (const m of [5, 10, 20]) assert.deepEqual([pl.counts[m].cards, pl.counts[m].hook], [0, null]);
  assert.equal(pl.hook, null);
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'hk-due-000001' })).body;
  assert.ok(!run.items.some((i) => i.type === 'card'));
});

test('F4 2: counts[m].shrink says why a length was cut; capped is true only when Free\'s clamp really cut the length', async () => {
  const pro = (await setup({ isPro: true }).learn.covers('u1', P({ subject: 'business_studies' }))).body;
  const st = pro.covers.find((c) => c.key === ST);
  assert.deepEqual(st.counts[20].shrink, { reason: 'pool' }, 'Staffing holds 4 cards and 4 questions: 20 minutes is cut by the pool');
  assert.ok(st.counts[20].minutes < 20);
  assert.ok(!('capped' in st.counts[20]), 'Pro has no cap');
  for (const c of pro.covers) for (const m of [5, 10, 20]) assert.ok(!c.counts[m].shrink || ['pool', 'cap', 'mistakes'].includes(c.counts[m].shrink.reason));
  const free = (await setup().learn.covers('u1', P({ subject: 'business_studies' }))).body;
  const fp = free.covers.find((c) => c.key === PL);
  assert.equal(fp.counts[20].capped, true, 'Planning at 20 holds more than at 10: the clamp cut it');
  const fs = free.covers.find((c) => c.key === ST);
  assert.ok(!('capped' in fs.counts[20]), 'Staffing is the same at 20 and at 10: nothing was cut, so no capped');
  assert.ok(!('capped' in fs.counts[10]) && !('capped' in fs.counts[5]));
});

test('F4 3: every run kind\'s end carries done { reached, of, minutes }, and the feed end carries the same', async () => {
  const { learn, tables } = setup({ isPro: true });
  const starts = [
    { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'dn-mix-000001' },
    { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'dn-feed-00001' },
    { chapterKey: PL, kind: 'recap', minutes: 5, requestKey: 'dn-recap-0001' },
    { chapterKey: PL, kind: 'cards', minutes: 5, cardIds: PLANNING.slice(0, 3).map((c) => c.id), requestKey: 'dn-cards-0001' },
    { chapterKey: PL, kind: 'level', minutes: 6, requestKey: 'dn-level-0001' },
  ];
  for (const s of starts) {
    const run = (await learn.start('u1', s)).body;
    assert.ok(run.items.length > 1, s.kind);
    const act = await actOn(learn, run, run.items[1]);
    assert.equal(act.http, 200, `${s.kind} act`);
    const end = (await learn.end('u1', run.id)).body;
    assert.deepEqual(end.done, { reached: 2, of: run.items.length, minutes: 1 }, `${s.kind}: stopped at 2 of ${run.items.length}`);
    if (s.kind === 'feed') assert.deepEqual(end.feed.done, end.done);
    else assert.equal(end.feed, null);
  }
  // Nothing done: reached 0 and one minute; first event to last, rounded, when something took a while.
  const none = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'mix', requestKey: 'dn-none-000001' })).body;
  assert.deepEqual((await learn.end('u1', none.id)).body.done, { reached: 0, of: none.items.length, minutes: 1 });
  const slow = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'recap', requestKey: 'dn-slow-000001', fresh: true })).body;
  await actOn(learn, slow, slow.items[0]);
  await actOn(learn, slow, slow.items[slow.items.length - 1]);
  const events = tables.learn_run_events.filter((e) => e.run_id === slow.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  events[0].created_at = '2026-11-02T12:00:00.000Z';
  events[1].created_at = '2026-11-02T12:09:10.000Z';
  assert.deepEqual((await learn.end('u1', slow.id)).body.done, { reached: slow.items.length, of: slow.items.length, minutes: 9 });
});

test('F4 5: a Free student whose open cards are all in Revise (due) still gets cards in a feed, as looks that schedule nothing', async () => {
  const open = openCardsOf(PLANNING);
  assert.equal(open.length, 5);
  const { learn, calls, tables } = setup({ tables: { key_card_states: heldStates(open, { due: true }) } });
  const body = (await learn.covers('u1', P({ subject: 'business_studies' }))).body;
  const pl = body.covers.find((c) => c.key === PL);
  assert.ok(pl.counts[10].cards > 0 && pl.counts[10].cards <= open.length, 'cards come back, never more than the open cards');
  assert.ok(pl.hook && open.some((c) => c.id === pl.hook.id), 'the hook is one of his open cards');
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'fr-000000001' })).body;
  const cards = run.items.filter((i) => i.type === 'card');
  assert.equal(cards.length, pl.counts[10].cards);
  assert.equal(run.items[0].card.id, pl.hook.id);
  assert.ok(cards.every((c) => c.look === true && open.some((o) => o.id === c.card.id)), 'every one a look, every one open');
  const before = JSON.stringify(tables.key_card_states);
  const first = (await learn.rate('u1', run.id, { itemId: cards[0].id, rating: 3 })).body;
  assert.deepEqual([first.look, first.saved], [true, false]);
  const kept = (await learn.rate('u1', run.id, { itemId: cards[1].id, keep: true })).body;
  assert.equal(kept.kept, true);
  assert.equal(calls.filter((c) => c.fn === 'review' || c.fn === 'add').length, 0, 'no review and no add was written');
  assert.equal(JSON.stringify(tables.key_card_states), before, 'nothing scheduled, nothing changed');
});

test('F4 5: the due-look rule is Free\'s and only when no fresh card is left: Pro never serves a due card, a Free student with a fresh card is unchanged', async () => {
  const open = openCardsOf(PLANNING);
  const pro = setup({ isPro: true, tables: { key_card_states: heldStates(PLANNING, { due: true }) } });
  const proRun = (await pro.learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'fr-pro-000001' })).body;
  assert.ok(!proRun.items.some((i) => i.type === 'card'), 'Pro: all due, no card');
  // Free, 4 of 5 open cards in Revise and due, one fresh: the feed is the fresh card (a new card, not a look) and nothing more.
  const free = setup({ tables: { key_card_states: heldStates(open.slice(0, 4), { due: true }) } });
  const run = (await free.learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'fr-free-000001' })).body;
  const cards = run.items.filter((i) => i.type === 'card');
  assert.deepEqual(cards.map((c) => [c.card.id, Boolean(c.look)]), [[open[4].id, false]]);
});

test('F4 4: the body cap is 16,000 characters: the 100 longest real card ids fit in a start body', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../src/lib/server/learnHttp.js', import.meta.url), 'utf8');
  const cap = Number(/export const BODY_MAX = ([\d_]+);/.exec(src)?.[1].replace(/_/g, ''));
  assert.equal(cap, 16000);
  const { loadDecks } = await import('../../src/lib/server/keycards.js');
  const real = loadDecks({ log: () => {} });
  const ids = [...real.byId.keys()].sort((a, b) => b.length - a.length).slice(0, 100);
  assert.equal(ids.length, 100);
  const body = JSON.stringify({ chapterKey: real.byId.get(ids[0]).chapterKey, cardIds: ids, minutes: 10, leaveOut: [], kind: 'cards', requestKey: `lk_${'a'.repeat(24)}`, source: 'explore_cover', forYou: true, position: 500 });
  assert.ok(body.length > 8000, `a start naming 100 real ids is over the old cap (${body.length})`);
  assert.ok(body.length < cap, `and under the new one (${body.length})`);
});

test('F4 1: with an unfinished feed in the chapter every length\'s hook is the feed\'s next card (any start resumes it)', async () => {
  const { learn } = setup({ isPro: true });
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'hk-resume-0001' })).body;
  await actOn(learn, feed, feed.items[0]);
  const pl = (await learn.covers('u1', P({ subject: 'business_studies' }))).body.covers.find((c) => c.key === PL);
  for (const m of [5, 10, 20]) {
    const back = (await learn.start('u1', { chapterKey: PL, minutes: m, kind: 'feed', requestKey: `hk-resume-m${m}-01` })).body;
    assert.equal(back.id, feed.id);
    assert.equal(pl.counts[m].hook.id, back.items.find((i) => i.type === 'card').card.id, `${m}: the next card of the resumed feed`);
  }
  assert.deepEqual(pl.hook, pl.counts[10].hook);
});
