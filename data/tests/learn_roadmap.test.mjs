// Learn v2 round 2: the roadmap (data/learn/roadmap.js, R2-SPEC rulings 1 to 3 and 12) and its wiring in the service
// (GET /api/learn/subject and /home, the "Today's 10 minutes" start). Pure rules first, then the preview student over the real
// handlers. Pins: the exact start-offer copy per state, no zero is ever drawn as a lead, coverage never mastery, a student stays in
// a chapter until its cards are seen once, feed cards count as seen, due cards take at most 40 percent of today's minutes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROADMAP_RULES, coverageLine, coverageShare, hasZeroCount, offerLines, positionOf, roadmap, todayDue, verdictOf,
} from '../learn/roadmap.js';
import { budgetSeconds } from '../learn/compose.js';
import { previewAnswer } from '../../src/lib/server/keycardsPreview.js';

const ACC = { id: 'accountancy', name: 'Accountancy' };
const T = Date.parse('2026-11-01T10:00:00+05:30');
const ch = (i, extra = {}) => ({ key: `accountancy.c${i}`, title: `Chapter title ${i}`, of: 40, cards: 40, seen: 0, unseen: 40, questions: 10, tried: 0, learnAt: null, mistakes: 0, ...extra });
const BOOK = [1, 2, 3, 4, 5].map((i) => ch(i));

// ---------------------------------------------------------------- pure rules

test('coverage line: "31 of 46 cards seen · 4 of 10 questions tried"; a zero part says the total, never "0 of"', () => {
  assert.equal(coverageLine({ of: 46, seen: 31, questions: 10, tried: 4 }), '31 of 46 cards seen · 4 of 10 questions tried');
  assert.equal(coverageLine({ of: 46, seen: 0, questions: 10, tried: 0 }), '46 cards · 10 questions');
  assert.equal(coverageLine({ of: 46, seen: 12, questions: 0, tried: 0 }), '12 of 46 cards seen');
  assert.equal(coverageLine({ of: 0, seen: 0, questions: 7, tried: 2 }), '2 of 7 questions tried');
  assert.equal(coverageLine({ of: 1, seen: 1, questions: 1, tried: 1 }), '1 of 1 card seen · 1 of 1 question tried');
  assert.equal(coverageLine({ of: 5, seen: 3, questions: 4, tried: 0 }, { isPro: false }), '3 of 5 free cards seen · 4 questions');
  for (const seen of [0, 1, 20]) for (const tried of [0, 3]) assert.equal(hasZeroCount(coverageLine({ of: 20, seen, questions: 3, tried })), false);
  assert.equal(coverageShare({ of: 40, seen: 10 }), 0.25);
  assert.equal(coverageShare({ of: 0, seen: 0 }), 0);
  assert.doesNotMatch(coverageLine({ of: 40, seen: 40, questions: 10, tried: 10 }), /%|master/i, 'coverage, never mastery');
});

test('verdict: only "Needs work", only for a weak state (above its evidence floor); never Getting there, Holding, Too few answers', () => {
  assert.equal(verdictOf('needs_work'), 'Needs work');
  for (const key of ['none', 'thin', 'getting_there', 'holding', 'unknown', undefined]) assert.equal(verdictOf(key), null);
});

test('position: a student stays in a chapter until its open cards are seen once (3 or more unseen keep them)', () => {
  const at = (i, extra) => BOOK.map((c, j) => (j === i ? { ...c, ...extra } : c));
  // Chapter 1 has the latest activity and 30 unseen: stay.
  assert.equal(positionOf(at(0, { seen: 10, unseen: 30, learnAt: T })).key, 'accountancy.c1');
  // 2 unseen left: move to the next chapter in book order with unseen cards.
  assert.equal(positionOf(at(0, { seen: 38, unseen: 2, learnAt: T })).key, 'accountancy.c2');
  // The latest activity wins over an older one; the older chapter is not abandoned forever (it comes back when the later is done).
  const two = BOOK.map((c, j) => (j === 0 ? { ...c, seen: 5, unseen: 35, learnAt: T - 86_400_000 } : j === 2 ? { ...c, seen: 40, unseen: 0, learnAt: T } : c));
  assert.equal(positionOf(two).key, 'accountancy.c4', 'after a finished chapter 3: the next with unseen cards');
  const lastDone = BOOK.map((c, j) => (j === 4 ? { ...c, seen: 40, unseen: 0, learnAt: T } : c));
  assert.equal(positionOf(lastDone).key, 'accountancy.c1', 'none after it: the first with unseen cards');
  // Nothing done: chapter 1, or the level check's pick.
  assert.equal(positionOf(BOOK).key, 'accountancy.c1');
  assert.equal(positionOf(BOOK, { levelPick: 'accountancy.c3' }).key, 'accountancy.c3');
  // A chapter with nothing to play is never a position.
  assert.equal(positionOf([{ ...ch(1), of: 0, cards: 0, questions: 0 }, ch(2)]).key, 'accountancy.c2');
  assert.equal(positionOf([]), null);
});

test('today: due cards oldest first, at most 40 percent of the minutes, at least one', () => {
  const due = Array.from({ length: 30 }, (_, i) => ({ id: `d${String(i).padStart(2, '0')}`, dueAt: T - (30 - i) * 3_600_000, seconds: 12 }));
  const out = todayDue(due, 10);
  assert.ok(out.seconds <= budgetSeconds(10) * ROADMAP_RULES.dueShare + 1e-6);
  assert.equal(out.ids.length, Math.floor((budgetSeconds(10) * 0.4) / 12));
  assert.equal(out.ids[0], 'd00', 'the oldest due first');
  assert.deepEqual(todayDue([{ id: 'long', dueAt: T, seconds: 999 }], 10).ids, ['long'], 'one even when it alone is over the share');
  assert.deepEqual(todayDue([], 10).ids, []);
});

test('the start offer: the exact copy for each state (ruling 1)', () => {
  const fresh = roadmap({ subject: ACC, chapters: BOOK, level: { questions: 6, chapterKey: BOOK[0].key } });
  assert.equal(fresh.mode, 'new');
  assert.equal(fresh.headline, 'Start learning Accountancy');
  assert.equal(fresh.key.label, 'Start chapter 1 · 10 min');
  assert.equal(fresh.line, 'Chapter 1 of 5 · Chapter title 1');
  assert.deepEqual(fresh.key.run, { chapterKey: BOOK[0].key, minutes: 10, kind: 'mix', leaveOut: [] });
  assert.deepEqual(fresh.or.map((o) => o.label), ['Find your level', 'Play this chapter as a feed']);

  const run = { id: 'lr_1', chapterKey: BOOK[3].key, title: 'Admission of a Partner', done: 6, of: 16, minutesLeft: 6, kind: 'mix', leaveOut: [] };
  const pick = roadmap({ subject: ACC, chapters: BOOK.map((c) => ({ ...c, seen: 4, unseen: 36, learnAt: T })), run });
  assert.equal(pick.mode, 'pickup');
  assert.equal(pick.headline, 'Pick up Admission of a Partner');
  assert.equal(pick.key.label, 'Continue · 6 min');
  assert.equal(pick.key.run.resume, 'lr_1');
  assert.deepEqual(pick.progress, { done: 6, of: 16 });

  const returning = BOOK.map((c, i) => (i === 1 ? { ...c, seen: 10, unseen: 30, learnAt: T, mistakes: 2 } : c));
  const due = [{ id: 'a', dueAt: T - 1000, seconds: 12 }, { id: 'b', dueAt: T - 2000, seconds: 12 }];
  const today = roadmap({ subject: ACC, chapters: returning, due });
  assert.equal(today.mode, 'today');
  assert.equal(today.headline, "Today's 10 minutes in Accountancy");
  assert.equal(today.key.label, 'Start · 10 min');
  assert.deepEqual(today.key.run, { chapterKey: BOOK[1].key, minutes: 10, kind: 'mix', leaveOut: [], cardIds: ['b', 'a'] });
  assert.equal(today.sub, '2 due cards first, then new ones here');
  assert.equal(today.or[0].label, 'Fix 2 open mistakes');
  const noDue = roadmap({ subject: ACC, chapters: returning });
  assert.equal(noDue.sub, '30 new cards left here');
  assert.equal('cardIds' in noDue.key.run, false);

  const done = roadmap({ subject: ACC, chapters: returning, freeDone: true, isPro: false });
  assert.equal(done.mode, 'freeDone');
  assert.equal(done.headline, "That was today's free session.");
  assert.deepEqual([done.key.label, done.key.href], ['See Pro', '/pricing']);
  assert.deepEqual([done.quiet.label, done.quiet.href], ['Answer single questions', '/explore']);
  assert.deepEqual(done.or, []);
  // An open run is picked up first, even on Free with the day used (its pick-up is the same session).
  assert.equal(roadmap({ subject: ACC, chapters: returning, freeDone: true, run }).mode, 'pickup');
});

test('no zero is ever a lead: across states, every line of the offer is free of "0 due", "0 of", "0 kept"', () => {
  const cases = [];
  for (const seen of [0, 3, 40]) {
    for (const mistakes of [0, 1, 3]) {
      for (const dueN of [0, 1, 12]) {
        for (const freeDone of [false, true]) {
          const chapters = BOOK.map((c, i) => (i === 0 ? { ...c, seen, unseen: 40 - seen, learnAt: seen ? T : null, mistakes } : c));
          const due = Array.from({ length: dueN }, (_, i) => ({ id: `d${i}`, dueAt: T - i, seconds: 12 }));
          cases.push(roadmap({ subject: ACC, chapters, due, freeDone, level: { questions: 0 } }));
        }
      }
    }
  }
  for (const r of cases) {
    for (const line of offerLines(r)) assert.equal(hasZeroCount(line), false, `zero in "${line}"`);
    assert.ok(r.or.length <= ROADMAP_RULES.maxOr, 'at most two quiet rows');
    for (const line of offerLines(r)) assert.doesNotMatch(line, /master|%|marks|!|→/i, `product rules: "${line}"`);
  }
  assert.equal(hasZeroCount('0 due today'), true);
  assert.equal(hasZeroCount('0 of 2 fixed'), true);
  assert.equal(hasZeroCount('Start · 10 min'), false);
});

// ---------------------------------------------------------------- the service (the preview student over the real handlers)

let n = 0;
function student(plan, who = 'commerce') {
  const session = `roadmap-test-${plan}-${who}-${(n += 1)}`;
  return async (to, { method = 'GET', body = null, query = {} } = {}) => {
    const u = new URL('http://localhost/preview/arena/realdeck');
    for (const [k, v] of Object.entries({ _to: to, _plan: plan, _student: who, _s: session, ...query })) u.searchParams.set(k, v);
    return previewAnswer(new Request(u, { method, body: body ? JSON.stringify(body) : undefined }));
  };
}
const rowsOf = (body) => body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters));

test('service: a brand-new Free student is offered "Start learning Accountancy", chapter 1, and no row says a zero', async () => {
  const call = student('free', 'new');
  const { http, body } = await call('/api/learn/subject', { query: { subject: 'accountancy' } });
  assert.equal(http, 200);
  assert.equal(body.roadmap.mode, 'new');
  assert.equal(body.roadmap.headline, 'Start learning Accountancy');
  assert.equal(body.roadmap.key.label, 'Start chapter 1 · 10 min');
  assert.equal(body.roadmap.key.run.chapterKey, 'accountancy.partnership-fundamentals');
  for (const row of rowsOf(body)) {
    assert.equal(row.progress.seen, 0);
    assert.equal(row.verdict, null);
    assert.equal(hasZeroCount(coverageLine(row.progress, { isPro: false })), false);
  }
});

test('service: the returning Pro student picks up the unfinished run; once it ends, "Today\'s 10 minutes" folds due cards in (at most 40 percent)', async () => {
  const call = student('pro');
  const first = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  assert.equal(first.roadmap.mode, 'pickup');
  assert.equal(first.roadmap.headline, 'Pick up Admission of a Partner');
  assert.match(first.roadmap.key.label, /^Continue · \d+ min$/);
  const runId = first.roadmap.key.run.resume;
  assert.equal((await call(`/api/learn/runs/${runId}/end`)).http, 200);
  const after = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  assert.equal(after.roadmap.mode, 'today');
  assert.equal(after.roadmap.headline, "Today's 10 minutes in Accountancy");
  assert.equal(after.roadmap.key.label, 'Start · 10 min');
  const run = after.roadmap.key.run;
  assert.ok(run.cardIds.length > 0, 'the seeded due cards');
  for (const line of offerLines(after.roadmap)) assert.equal(hasZeroCount(line), false, line);
  // The start: a mix on the roadmap chapter, the due cards first, within 40 percent of the time.
  const started = await call('/api/learn/runs', { method: 'POST', body: { ...run, requestKey: 'roadmap-today-0001' } });
  assert.equal(started.http, 200);
  assert.equal(started.body.kind, 'mix');
  assert.equal(started.body.chapter.key, run.chapterKey);
  const lead = started.body.items.slice(0, run.cardIds.length);
  assert.ok(lead.every((i) => i.type === 'card' && run.cardIds.includes(i.card.id)), 'the due cards lead');
  const dueSecs = lead.reduce((s, i) => s + i.seconds, 0);
  assert.ok(dueSecs <= budgetSeconds(10) * 0.4 + 1e-6, `due ${dueSecs}s within 40 percent`);
  assert.ok(started.body.items.length > lead.length, 'then the chapter');
  assert.ok(started.body.items.filter((i) => i.type === 'question' && i.mistake).length <= 1, 'one open mistake at most');
  // A card that is not due is dropped whatever the link says.
  const forged = await call('/api/learn/runs', { method: 'POST', body: { ...run, cardIds: ['not-a-card', ...run.cardIds], requestKey: 'roadmap-today-0002', fresh: true } });
  assert.equal(forged.http, 200);
  assert.ok(forged.body.items.every((i) => i.type !== 'card' || i.card));
});

test('service: Free after the day\'s session is told so, with See Pro and single questions', async () => {
  const call = student('free');
  const first = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  assert.equal(first.roadmap.mode, 'pickup', 'the open run holds the session and is picked up first');
  await call(`/api/learn/runs/${first.roadmap.key.run.resume}/end`);
  // The day's one session is claimed by the first answer of a counted run; the run then ends.
  const today = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body.roadmap;
  const run = (await call('/api/learn/runs', { method: 'POST', body: { ...today.key.run, requestKey: 'roadmap-free-0001' } })).body;
  const q = run.items.find((i) => i.type === 'question');
  assert.ok(q, 'a question to answer');
  assert.equal((await call(`/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: q.id, choice: q.question.options[0].key } })).http, 200);
  await call(`/api/learn/runs/${run.id}/end`);
  const { body } = await call('/api/learn/subject', { query: { subject: 'accountancy' } });
  assert.equal(body.roadmap.mode, 'freeDone');
  assert.equal(body.roadmap.headline, "That was today's free session.");
  assert.equal(body.roadmap.key.label, 'See Pro');
  assert.equal(body.roadmap.quiet.label, 'Answer single questions');
});

test('service: /home is the subject body and the shelves from one snapshot; due.all is the sum over subjects', async () => {
  const call = student('pro');
  const home = (await call('/api/learn/home', { query: { subject: 'accountancy' } })).body;
  const subject = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const shelves = (await call('/api/learn/shelves', { query: { subject: 'accountancy' } })).body;
  assert.deepEqual(home.roadmap, subject.roadmap);
  assert.deepEqual(home.parts, subject.parts);
  assert.deepEqual(home.shelves.due.bySubject, shelves.due.bySubject);
  assert.equal(home.shelves.due.all, Object.values(home.shelves.due.bySubject).reduce((a, b) => a + b, 0));
  assert.deepEqual([home.shelves.missed, home.shelves.revise, home.shelves.must], [shelves.missed, shelves.revise, shelves.must]);
});

test('service: cards moved past in an Explore feed count as seen on the roadmap', async () => {
  const call = student('pro', 'new');
  const before = rowsOf((await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body).find((r) => r.key === 'accountancy.admission-of-partner');
  assert.equal(before.progress.seen, 0);
  const feed = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: 'accountancy.admission-of-partner', minutes: 10, kind: 'feed', leaveOut: ['lesson'], requestKey: 'roadmap-feed-0001' } })).body;
  const cards = feed.items.map((it, i) => ({ it, i })).filter(({ it }) => it.type === 'card');
  assert.ok(cards.length >= 2);
  // Keep the second card: every card before it was moved past.
  const kept = cards[1];
  assert.equal((await call(`/api/learn/runs/${feed.id}/rate`, { method: 'POST', body: { itemId: kept.it.id, keep: true } })).http, 200);
  const after = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const row = rowsOf(after).find((r) => r.key === 'accountancy.admission-of-partner');
  assert.ok(row.progress.seen >= 2, `seen ${row.progress.seen}`);
  assert.equal(after.roadmap.mode, 'today', 'a feed is learning: the student is no longer new');
  assert.equal(after.roadmap.position.chapterKey, 'accountancy.admission-of-partner', 'the roadmap moves to the chapter played in a feed');
});

test('the end screen stays in the chapter while 3 or more cards are unseen: "30 new cards left here", "Next 10 minutes here"', async () => {
  const { endOptions, STAY_UNSEEN } = await import('../learn/suggest.js');
  assert.equal(STAY_UNSEEN, ROADMAP_RULES.stayUnseen, 'one rule for home and the end');
  const base = { subject: 'accountancy', chapter: { key: 'accountancy.partnership-fundamentals', title: 'Accounting for Partnership: Basic Concepts' }, minutes: 10, next: { key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account' }, mustKnow: 12 };
  const stay = endOptions({ ...base, unseen: 30 });
  assert.deepEqual([stay.lead.kind, stay.lead.title, stay.lead.label], ['here', '30 new cards left here', 'Next 10 minutes here']);
  assert.deepEqual(stay.lead.run, { chapterKey: base.chapter.key, minutes: 10, leaveOut: [], kind: 'mix' });
  assert.equal(stay.options[0].title, 'Next chapter: Profit and Loss Appropriation Account');
  // Below 3 unseen, or not given: as before (the next chapter leads).
  assert.equal(endOptions({ ...base, unseen: 2 }).lead.kind, 'next');
  assert.equal(endOptions(base).lead.kind, 'next');
  // Free after the day's session: never a key the server will refuse.
  assert.equal(endOptions({ ...base, unseen: 30, freeSessionUsed: true }).lead.label, 'See Pro');
});
