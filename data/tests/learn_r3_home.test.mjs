// Learn v2 round 3, packet R3-home (R3-SPEC rulings C1, C2, F on Learn home): the one due count behind both routes, the chapter count,
// and every key of Free's after-session block accepted by the server for that student. The harness is learn_routes.test.mjs's own,
// kept small (decks, a question index, the in-memory database); the pure words are pinned in learn_roadmap.test.mjs and the page's
// own rules in src/components/learn2/home/__tests__.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeycards } from '../../src/lib/server/keycards.js';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { createLearn, servedOptions } from '../../src/lib/server/learn.js';
import { schedule, tasteIds } from '../keycards.js';
import { FREE_DONE_HEADLINE, FREE_DONE_LINE, freeSession } from '../learn/allowance.js';
import { WORDS } from '../learn/words.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.parse('2026-11-02T18:00:00+05:30');
const PL = 'business_studies.planning';
const ST = 'business_studies.staffing';
const mk = (slug, i) => ({
  id: `kc.business_studies.${slug}.def-c${i}`, v: 1, subject: 'business_studies', chapterKey: `business_studies.${slug}`,
  chapter: slug, unit: slug, kind: 'definition', front: `What is ${slug} ${i}?`, back: `Line ${i} of ${slug}.`,
  quote: `Line ${i} of ${slug} about planning objectives and premises.`, blanks: [], importance: i <= 6 ? 'must' : 'good', asked: 0, tags: [], order: i * 10,
  source: { kind: 'ncert', book: 'Business Studies Part 1', code: 'lebs104', chapterNo: 4, page: 90 + i, section: i <= 4 ? 'Meaning' : 'Features' },
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
].map((q) => ({
  ...q, subject: 'business_studies', question: `Which statement about ${q.chapter.toLowerCase()} is true (${q.id})?`,
  options: ['A. The right one', 'B. A wrong one', 'C. Another wrong one', 'D. The last wrong one'], correct_answer: 'A',
  explanation: `Because of the line in ${q.chapter}.`, status: 'live', is_deleted: false, verification_state: 'verified', content_hash: `h-${q.id}`, updated_at: '2026-10-01T00:00:00Z',
}));
const syllabus = syllabusFrom(null);
const index = () => ({
  list: QROWS.map((r) => ({
    id: r.id, subject: r.subject, chapter: r.chapter, chapterKey: syllabus.resolveChapter(r.subject, r.chapter).key, body: r.question,
    options: servedOptions(r.options), words: r.question.split(/\s+/).length, difficulty: r.difficulty, cards: LINKS[r.id] || [], chash: r.content_hash, managed: false,
  })),
});
function setup({ isPro = false, tables = {}, clock = { t: T0 } } = {}) {
  const db = fakeDb({ questions: QROWS.map((r) => ({ ...r })), ...tables });
  const D = decks();
  const user = { isPremium: isPro, subjects: ['business_studies'] };
  const kc = createKeycards({ db, decks: D, syllabus, now: () => clock.t, getUser: async () => user });
  const learn = createLearn({ db, kc, decks: D, syllabus, getUser: async () => user, questionIndex: async () => index(), heldQuestions: async () => new Set(), now: () => clock.t, warn: () => {} });
  return { db, learn, kc, tables: db.tables, clock };
}
const P = (o) => new URLSearchParams(o);
const SUBJECT = { subject: 'business_studies' };
const dueRows = (cards, { user = 'u1' } = {}) => cards.map((c) => {
  const at = T0 - 6 * DAY;
  const s = schedule(null, 3, at);
  return { user_id: user, card_id: c.id, subject: 'business_studies', chapter_key: c.chapterKey, schedule: s.schedule, reps: 1, lapses: 0, due_at: new Date(T0 - 2 * DAY).toISOString(), last_review_at: new Date(at).toISOString(), last_rating: 3, added_from: 'chapter', added_at: new Date(at).toISOString(), suspended: false };
});
const openCards = () => { const taste = tasteIds(PLANNING); return PLANNING.filter((c) => taste.has(c.id)); };

test('C1: /api/learn/home and /api/learn/shelves give the same due.all and due.bySubject for the same fixture (Pro and Free)', async () => {
  for (const isPro of [true, false]) {
    const cards = isPro ? PLANNING.slice(0, 7) : openCards().slice(0, 3);
    const { learn } = setup({ isPro, tables: { key_card_states: dueRows(cards) } });
    const home = (await learn.home('u1', P(SUBJECT))).body.shelves.due;
    const shelves = (await learn.shelves('u1', P(SUBJECT))).body.due;
    assert.equal(home.all, shelves.all, `isPro ${isPro}: the same due.all`);
    assert.deepEqual(home.bySubject, shelves.bySubject);
    assert.equal(home.all, cards.length, 'true to the fixture');
    assert.equal(home.all, Object.values(home.bySubject).reduce((a, b) => a + b, 0), 'all is the sum of the subjects');
    assert.equal(home.count, home.bySubject.business_studies, 'this subject\'s own count is the same number');
  }
});

test('C1: the Learn home Revise row reads that same count and the shelves\' own minutes', async () => {
  const { learn } = setup({ isPro: true, tables: { key_card_states: dueRows(PLANNING.slice(0, 7)) } });
  // R4 owner-eye#9: with due cards the offer's line leads with them ("7 due cards first, then new cards from this chapter"), so no Revise row.
  const today = (await learn.home('u1', P(SUBJECT))).body.roadmap;
  assert.equal(today.mode, 'today');
  assert.equal(today.sub, '7 due cards first, then new cards from this chapter');
  assert.ok(!today.or.some((o) => o.kind === 'revise'), 'one of the two, never both');
  // A pick-up does not hold the due cards: the Revise row leads its Or rows.
  const run = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'mix', requestKey: 'r3-revise-st01' })).body;
  assert.equal((await learn.rate('u1', run.id, { itemId: run.items.find((i) => i.type === 'card').id, rating: 3 })).http, 200);
  await learn.end('u1', run.id, { stop: true });
  const body = (await learn.home('u1', P(SUBJECT))).body;
  assert.equal(body.roadmap.mode, 'pickup');
  const row = body.roadmap.or.find((o) => o.kind === 'revise');
  assert.ok(row, 'a Revise row');
  assert.equal(row.label, `Revise ${body.shelves.due.bySubject.business_studies} due cards · ${body.shelves.due.minutes} min`);
  assert.equal(row.run.kind, 'cards');
  assert.equal(row.run.cardIds.length, 7);
  assert.equal((await learn.start('u1', { ...row.run, requestKey: 'r3-revise-0001' })).http, 200, 'the server starts it');
});

test('C2: the subject line counts the playable chapters (those with cards), as the offer\'s "Chapter 1 of N" does', async () => {
  const { learn } = setup({ isPro: true });
  const body = (await learn.home('u1', P(SUBJECT))).body;
  const rows = body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters));
  const withCards = rows.filter((r) => r.cards > 0).length;
  assert.ok(withCards > 0);
  assert.equal(body.subject.chapters, withCards);
  assert.match(body.roadmap.line || '', new RegExp(`of ${withCards}\\b`));
});

test('F: Free after the day\'s session, every key of the home block is accepted for that student (Continue, Revise); the refused one is not offered', async () => {
  const { learn, tables } = setup({ tables: { key_card_states: dueRows(openCards().slice(0, 3)) } });
  // The day's one session is claimed by a feed's first answer; the feed is then left unfinished.
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'r3-free-feed-1' })).body;
  const q = feed.items.find((i) => i.type === 'question');
  assert.equal((await learn.answer('u1', feed.id, { itemId: q.id, choice: 'A' })).http, 200);
  assert.ok(tables.learning_allowances.some((r) => r.kind === 'learn_session'));
  const body = (await learn.home('u1', P(SUBJECT))).body;
  const road = body.roadmap;
  assert.equal(road.mode, 'freeDone');
  assert.equal(road.headline, FREE_DONE_HEADLINE);
  assert.equal(road.line, FREE_DONE_LINE);
  assert.equal(road.key.label, WORDS.seePro);
  assert.deepEqual(road.or.map((o) => o.kind), ['continue', 'revise'], 'ruling F order, at most two');
  assert.match(road.or[0].label, /^Continue · \d+ min$/);
  assert.match(road.or[1].label, /^Revise 3 due cards · \d+ min$/);
  // Continue: the stopped feed, by its id.
  const resumed = await learn.start('u1', { ...road.or[0].run, requestKey: 'r3-free-cont-1' });
  assert.equal(resumed.http, 200);
  assert.equal(resumed.body.id, feed.id, 'it resumes today\'s own run');
  // Revise: a cards run is not counted, so it is neither refused nor Key-cards-only text.
  const revise = await learn.start('u1', { ...road.or[1].run, requestKey: 'r3-free-rev-01' });
  assert.equal(revise.http, 200);
  assert.equal(revise.body.kind, 'cards');
  assert.equal(revise.body.items.length, 3);
  // The row that would be refused (a new feed) is not on the block, and the server does refuse it.
  assert.ok(!road.or.some((o) => o.kind === 'feed'));
  assert.equal((await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'feed', requestKey: 'r3-free-feed-2' })).http, 402);
  // The rule itself: cards, recap and level are never counted; a feed is refused; a mix is Key cards only.
  for (const kind of ['cards', 'recap', 'level']) assert.deepEqual(freeSession({ claimedByOther: true, kind }), { minutes: 10, capped: null, cardsOnly: false, refuse: false, line: null }, kind);
  assert.equal(freeSession({ claimedByOther: true, kind: 'feed' }).refuse, true);
  assert.equal(freeSession({ claimedByOther: true, kind: 'mix' }).cardsOnly, true);
});

test('F: a stopped chapter run is picked up first on Free too ("Continue · N min"), by its id', async () => {
  const { learn } = setup({ tables: { key_card_states: dueRows(openCards().slice(0, 3)) } });
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'mix', requestKey: 'r3-free-mix-1' })).body;
  const q = run.items.find((i) => i.type === 'question');
  assert.equal((await learn.answer('u1', run.id, { itemId: q.id, choice: 'A' })).http, 200);
  const road = (await learn.home('u1', P(SUBJECT))).body.roadmap;
  assert.equal(road.mode, 'pickup');
  assert.match(road.key.label, /^Continue · \d+ min$/);
  assert.equal(road.key.run.resume, run.id);
  assert.deepEqual(road.or.map((o) => o.kind), ['revise'], 'a fix run would be Key cards only after the claim, so it is not offered');
  assert.equal((await learn.start('u1', { ...road.key.run, requestKey: 'r3-free-mix-2' })).body.id, run.id);
});

// ---------------------------------------------------------------- R4-server (R4-SPEC: server-security#1 to #7, rulings N and V)

const PF = 'computer_science.database-concepts'; // Section A: common to both options
const B1 = 'computer_science.file-handling'; // Section B1
const B2 = 'computer_science.data-handling-using-pandas'; // Section B2
const OLD = 'computer_science.old-topic'; // a retired chapter (wrapped syllabus below)
const mkCs = (key, i) => ({
  id: `kc.${key}.def-c${i}`, v: 1, subject: 'computer_science', chapterKey: key, chapter: key.split('.')[1], unit: key.split('.')[1], kind: 'definition',
  front: `What is ${key} ${i}?`, back: `Line ${i}.`, quote: `Line ${i} of ${key}.`, blanks: [], importance: 'must', asked: 0, tags: [], order: i * 10,
  source: { kind: 'ncert', book: 'Computer Science', code: 'lecs1', chapterNo: 1, page: 10 + i, section: 'Meaning' },
});
const CS = [PF, B1, B2, OLD].flatMap((key) => Array.from({ length: 8 }, (_, i) => mkCs(key, i + 1)));
const csSyllabus = (() => {
  const base = syllabusFrom(null);
  return { ...base, chapterByKey: (key) => (key === OLD ? { retired: true, reason: 'not_in_cuet_2026', name: 'Old topic', subject: 'computer_science' } : base.chapterByKey(key)) };
})();
function setupCs({ isPro = true, option = 'B2', tables = {} } = {}) {
  const db = fakeDb({ questions: [], ...(option ? { student_subject_options: [{ user_id: 'u1', subject: 'computer_science', option }] } : {}), ...tables });
  const D = { bySubject: new Map([['computer_science', { version: 1, cards: CS }]]), byId: new Map(CS.map((c) => [c.id, c])), links: new Map(), disabled: [] };
  const user = { isPremium: isPro, subjects: ['computer_science'] };
  const kc = createKeycards({ db, decks: D, syllabus: csSyllabus, now: () => T0, getUser: async () => user });
  const learn = createLearn({ db, kc, decks: D, syllabus: csSyllabus, getUser: async () => user, questionIndex: async () => ({ list: [] }), heldQuestions: async () => new Set(), now: () => T0, warn: () => {} });
  return { learn, kc, tables: db.tables };
}
const csDue = (key, n) => dueRows(CS.filter((c) => c.chapterKey === key).slice(0, n)).map((r) => ({ ...r, subject: 'computer_science' }));
const CSQ = { subject: 'computer_science' };

test('server-security#2: due counts follow the part option (B2): home, shelves and the Key cards service agree, Revise count = its cardIds', async () => {
  const states = [...csDue(PF, 2), ...csDue(B1, 6), ...csDue(B2, 6)];
  const { learn, kc } = setupCs({ tables: { key_card_states: states } });
  const home = (await learn.home('u1', P(CSQ))).body;
  const shelves = (await learn.shelves('u1', P(CSQ))).body;
  assert.equal(home.shelves.due.all, 8, 'Section A and B2 only, never the B1 chapter\'s 6');
  assert.equal(home.shelves.due.all, await kc.dueCount('u1'), 'due.all === kc.dueCount');
  assert.equal(shelves.due.all, home.shelves.due.all);
  assert.equal(home.shelves.due.count, 8);
  // Today's Start key holds only allowed due cards; then a pick-up shows the Revise row: its count is its cardIds.length.
  assert.ok(home.roadmap.key.run.cardIds.every((id) => !id.includes('file-handling')));
  const run = (await learn.start('u1', { chapterKey: B2, minutes: 5, kind: 'mix', requestKey: 'r4-cs-b2-run1' })).body;
  const card = run.items.find((i) => i.type === 'card' && i.stage !== 'due') || run.items.find((i) => i.type === 'card');
  assert.equal((await learn.rate('u1', run.id, { itemId: card.id, rating: 3 })).http, 200);
  await learn.end('u1', run.id, { stop: true });
  const after = (await learn.home('u1', P(CSQ))).body;
  const row = after.roadmap.or.find((o) => o.kind === 'revise');
  assert.ok(row, 'the pick-up\'s Revise row');
  const n = after.shelves.due.count;
  assert.equal(n, await kc.dueCount('u1'));
  assert.equal(row.run.cardIds.length, n, 'the label\'s count is its cardIds.length');
  assert.match(row.label, new RegExp(`^Revise ${n} due cards? · \\d+ min$`));
  assert.ok(row.run.cardIds.every((id) => !id.includes('file-handling')), 'no card of a chapter outside the student\'s part');
  const started = await learn.start('u1', { ...row.run, requestKey: 'r4-cs-revise01' });
  assert.equal(started.http, 200);
  assert.equal(started.body.items.length, n, 'the run serves every card the label counts');
});

test('server-security#2: a retired chapter\'s due cards are never counted (home and shelves)', async () => {
  const { learn } = setupCs({ tables: { key_card_states: [...csDue(PF, 2), ...csDue(OLD, 5)] } });
  const home = (await learn.home('u1', P(CSQ))).body;
  assert.equal(home.shelves.due.all, 2);
  assert.equal((await learn.shelves('u1', P(CSQ))).body.due.all, 2);
  assert.ok(home.roadmap.key.run.cardIds.every((id) => !id.includes('old-topic')));
});

test('ruling N: place { n, of } counts the playable chapters of the student\'s part in roadmap order (B2: no B1 chapter)', async () => {
  const { learn } = setupCs({ isPro: true });
  const home = (await learn.home('u1', P(CSQ))).body;
  const rows = home.parts.flatMap((p) => p.units.flatMap((u) => u.chapters));
  const played = rows.filter((r) => r.cards > 0 && r.place);
  assert.deepEqual(played.map((r) => r.key), [PF, B2], 'the B1 chapter and the retired one have no place');
  assert.deepEqual(played.map((r) => r.place), [{ n: 1, of: 2 }, { n: 2, of: 2 }]);
  assert.equal(rows.find((r) => r.key === B1)?.place ?? null, null);
  assert.equal(home.subject.chapters, 2, 'the subject line\'s count is the same `of`');
  const preview = (await learn.preview('u1', { chapterKey: B2, minutes: 10 })).body;
  assert.deepEqual(preview.chapter.place, { n: 2, of: 2 });
  const covers = (await learn.covers('u1', P(CSQ))).body.covers;
  assert.deepEqual(Object.fromEntries(covers.map((c) => [c.key, c.place])), { [PF]: { n: 1, of: 2 }, [B2]: { n: 2, of: 2 } });
  // With no option saved, both parts show (the roadmap's rule): the B1 chapter takes its place in syllabus order.
  const both = (await setupCs({ option: null }).learn.home('u1', P(CSQ))).body;
  const all = both.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).filter((r) => r.place);
  assert.deepEqual(all.map((r) => [r.key, r.place.n, r.place.of]), [[PF, 1, 3], [B1, 2, 3], [B2, 3, 3]]);
});

test('ruling N: the run, feed, resume and end payloads carry place; ref stays for source lines', async () => {
  const { learn } = setup({ isPro: true });
  const rows = (await learn.home('u1', P(SUBJECT))).body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).filter((r) => r.place);
  const of = rows.length;
  assert.deepEqual(rows.map((r) => r.place.n), rows.map((_, i) => i + 1), 'one order, 1 to N, no repeats');
  const pl = rows.find((r) => r.key === PL).place;
  const st = rows.find((r) => r.key === ST).place;
  assert.ok(pl.n < st.n && st.of === of);
  const run = (await learn.start('u1', { chapterKey: PL, minutes: 5, kind: 'mix', requestKey: 'r4-place-run01' })).body;
  assert.deepEqual(run.chapter.place, pl);
  assert.ok('ref' in run.chapter, 'ref stays in the payload');
  const feed = (await learn.start('u1', { chapterKey: ST, minutes: 5, kind: 'feed', requestKey: 'r4-place-feed1' })).body;
  assert.deepEqual(feed.chapter.place, st);
  await learn.rate('u1', run.id, { itemId: run.items[0].id, rating: 3 });
  assert.deepEqual((await learn.getRun('u1', run.id)).body.chapter.place, pl, 'a resumed run body too');
  const end = (await learn.end('u1', run.id)).body;
  assert.deepEqual(end.chapter.place, pl);
  const feedEnd = (await learn.end('u1', feed.id)).body;
  assert.deepEqual(feedEnd.chapter.place, st);
  assert.deepEqual((await learn.cards('u1', P({ chapter: ST }))).body.chapter.place, st);
});

test('ruling V: needsWorkFrom says where a roadmap row\'s verdict comes from: "papers" without Learn activity, else "learn"', async () => {
  const papers = Array.from({ length: 6 }, (_, i) => ({ user_id: 'u1', question_id: `q-p${i + 1}`, subject: 'business_studies', chapter: 'Planning', attempt_count: 1, last_correct: false, last_selected_key: 'C', last_attempted_at: new Date(T0 - 5 * DAY).toISOString() }));
  const rowOf = async (tables) => (await setup({ isPro: true, tables }).learn.home('u1', P(SUBJECT))).body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).find((r) => r.key === PL);
  const fromPapers = await rowOf({ user_question_progress: papers });
  assert.equal(fromPapers.verdict, 'Needs work');
  assert.equal(fromPapers.needsWorkFrom, 'papers');
  const fromLearn = await rowOf({ user_question_progress: papers, key_card_states: dueRows(PLANNING.slice(0, 2)) });
  assert.equal(fromLearn.verdict, 'Needs work');
  assert.equal(fromLearn.needsWorkFrom, 'learn');
});

test('server-security#4 and first-timer#6: the 402 refusal\'s Revise option is Learn home\'s Revise row (subject-wide, same list)', async () => {
  const taste = (list) => { const t = tasteIds(list); return list.filter((c) => t.has(c.id)); };
  const { learn } = setup({ tables: { key_card_states: [...dueRows(taste(PLANNING).slice(0, 3)), ...dueRows(taste(STAFFING).slice(0, 2))] } });
  const feed = (await learn.start('u1', { chapterKey: PL, minutes: 10, kind: 'feed', requestKey: 'r4-ref-feed01' })).body;
  assert.equal((await learn.answer('u1', feed.id, { itemId: feed.items.find((i) => i.type === 'question').id, choice: 'A' })).http, 200);
  const refused = await learn.start('u1', { chapterKey: ST, minutes: 10, kind: 'feed', requestKey: 'r4-ref-feed02' });
  assert.equal(refused.http, 402);
  const opt = refused.body.options.find((o) => o.kind === 'revise');
  const home = (await learn.home('u1', P(SUBJECT))).body;
  const row = home.roadmap.or.find((o) => o.kind === 'revise');
  assert.equal(opt.label, row.label, 'the same words on both screens');
  assert.match(opt.label, /^Revise 5 due cards · \d+ min$/, 'the whole subject, never only the refused chapter\'s 2');
  assert.deepEqual(opt.run.cardIds, row.run.cardIds);
  assert.equal(opt.run.cardIds.length, home.shelves.due.count);
  const revise = await learn.start('u1', { ...opt.run, requestKey: 'r4-ref-revise1' });
  assert.equal(revise.http, 200);
  assert.equal(revise.body.items.length, 5);
});
