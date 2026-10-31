// Learn v2: the Explore feed v2 (docs/brain/learn-1031/FEED-2.md). The pure rules of data/learn/feed.js (checkpoint cadence,
// the checkpoint number, Free's one feed a day, the covers order and line, the feed's order shape), then the preview routes end
// to end: the real feed order, Keep's real return day, the end screen's keys and Free's second feed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKPOINT_LINE, FEED_RULES, FREE_FEED_DONE, checkpointNumber, coverLine, coverOrder, feedOrderProblems, feedSlots, feedsOnDay, freeFeed } from '../learn/feed.js';
import { orderProblems } from '../learn/compose.js';
import { istDay } from '../keycards.js';
import { previewAnswer } from '../../src/lib/server/keycardsPreview.js';

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i + 1}`, type: i % 3 === 2 ? 'question' : 'card' }));

test('checkpoints: one after every 8 items, never after the last item, never two in a row', () => {
  assert.equal(FEED_RULES.checkpointEvery, 8);
  const s21 = feedSlots(items(21));
  assert.deepEqual(s21.filter((s) => s.type === 'checkpoint').map((s) => s.after), [8, 16]);
  assert.equal(s21.length, 23);
  assert.equal(s21[8].type, 'checkpoint');
  assert.equal(s21[s21.length - 1].type, 'item');
  assert.deepEqual(feedSlots(items(16)).filter((s) => s.type === 'checkpoint').map((s) => s.after), [8], 'none closes a feed of 16');
  assert.deepEqual(feedSlots(items(8)).filter((s) => s.type === 'checkpoint'), [], 'none closes a feed of 8');
  assert.deepEqual(feedSlots(items(9)).filter((s) => s.type === 'checkpoint').map((s) => s.after), [8]);
  assert.deepEqual(feedSlots([]), []);
  const s = feedSlots(items(30));
  for (let i = 1; i < s.length; i += 1) assert.ok(!(s[i].type === 'checkpoint' && s[i - 1].type === 'checkpoint'));
  assert.deepEqual(s.filter((x) => x.type === 'item').map((x) => x.n), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('the checkpoint number: questions once one is answered, else the cards', () => {
  assert.equal(checkpointNumber({ answered: 6, right: 5, seen: 10, kept: 2 }), '5 of 6 right');
  assert.equal(checkpointNumber({ answered: 0, seen: 6, kept: 2 }), '6 cards seen, 2 kept');
  assert.equal(checkpointNumber({ seen: 1, kept: 0 }), '1 card seen, 0 kept');
  assert.equal(CHECKPOINT_LINE, 'Keep going, or stop here and save what you kept.');
});

test('Free plays one feed a day: the end of it says so in place of the lead, and a second does not start', () => {
  assert.deepEqual(freeFeed({ isPro: true, startedToday: 9 }), { canStart: true, endLine: null, left: null });
  assert.deepEqual(freeFeed({ isPro: false, startedToday: 0 }), { canStart: true, endLine: null, left: 1 });
  assert.deepEqual(freeFeed({ isPro: false, startedToday: 1 }), { canStart: false, endLine: FREE_FEED_DONE, left: 0 });
  assert.equal(FREE_FEED_DONE, 'Your free feed for today is done. Pro has as many as you like.');
  // Feeds counted by India day: 11:50 pm and 12:10 am IST are two days.
  const t1 = Date.parse('2026-11-01T23:50:00+05:30');
  const t2 = Date.parse('2026-11-02T00:10:00+05:30');
  assert.equal(feedsOnDay([t1], t2, istDay), 0);
  assert.equal(feedsOnDay([t1, t2], t2, istDay), 1);
});

test('covers: the suggested chapter first (due cards or open mistakes), then book order; nothing to play is left out', () => {
  const chapters = [
    { key: 'a', title: 'A', order: 0, cards: 16, questions: 5, due: 0, mistakes: 0 },
    { key: 'b', title: 'B', order: 1, cards: 0, questions: 0, due: 0, mistakes: 0 },
    { key: 'c', title: 'C', order: 2, cards: 8, questions: 7, due: 3, mistakes: 3 },
    { key: 'd', title: 'D', order: 3, cards: 30, questions: 0, due: 1, mistakes: 0 },
  ];
  const out = coverOrder(chapters);
  assert.deepEqual(out.map((c) => c.key), ['c', 'a', 'd']);
  assert.deepEqual(out.map((c) => c.forYou), [true, false, false]);
  const fresh = coverOrder(chapters.map((c) => ({ ...c, due: 0, mistakes: 0 })));
  assert.equal(fresh[0].key, 'a', 'a new student starts at the first chapter in book order');
  assert.equal(coverOrder(chapters, 2).length, 2);
  assert.deepEqual(coverOrder([]), []);
  assert.equal(coverLine(10, { cards: 16, questions: 5 }), '10 minutes, 16 Key cards and 5 questions');
  assert.equal(coverLine(5, { cards: 1, questions: 0 }), '5 minutes, 1 Key card');
  assert.equal(coverLine(1, { cards: 0, questions: 1 }), '1 minute, 1 question');
});

test('the feed order check: a card first, no two questions back to back while cards are left, about two cards a question', () => {
  const c = { type: 'card' };
  const q = { type: 'question' };
  assert.deepEqual(feedOrderProblems([c, c, q, c, c, q, c, q]), []);
  assert.deepEqual(feedOrderProblems([q, c, c, q]).map((p) => p.rule), ['first']);
  assert.deepEqual(feedOrderProblems([c, q, q, c, c, c]).map((p) => p.rule), ['adjacent']);
  assert.deepEqual(feedOrderProblems([c, c, c, c, c, q]).map((p) => p.rule), ['ratio']);
  assert.deepEqual(feedOrderProblems([c, c, q, q]), [], 'two questions at the end are fine when no card is left');
});

// ---------------------------------------------------------------- the preview routes

let n = 0;
function student(plan, who = 'commerce') {
  const session = `learn-feed-${plan}-${who}-${(n += 1)}`;
  return async (to, { method = 'GET', body = null, query = {} } = {}) => {
    const u = new URL('http://localhost/preview/arena/realdeck');
    for (const [k, v] of Object.entries({ _to: to, _plan: plan, _student: who, _s: session, ...query })) u.searchParams.set(k, v);
    return previewAnswer(new Request(u, { method, body: body ? JSON.stringify(body) : undefined }));
  };
}
const PF = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const toA3 = (list) => list.map((i) => (i.type === 'card' ? { type: 'card', cardId: i.card.id } : { type: 'question', questionId: i.question.id, origin: i.origin, links: [] }));

test('preview: the Pro feed keeps its shape, no answer key before an answer, Keep stamps the real return day', async () => {
  const call = student('pro');
  const { http, body } = await call('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed' } });
  assert.equal(http, 200);
  assert.equal(body.kind, 'feed');
  assert.equal(body.chapter.title, 'Admission of a Partner');
  assert.ok(body.items.every((i) => i.type === 'card' || i.type === 'question'), 'a feed never plays a lesson');
  assert.deepEqual(feedOrderProblems(body.items), []);
  assert.deepEqual(orderProblems(toA3(body.items)).filter((p) => p.rule === 'first'), []);
  assert.equal(body.items[0].type, 'card');
  for (const q of body.items.filter((i) => i.type === 'question')) {
    assert.deepEqual(Object.keys(q.question).sort(), ['body', 'id', 'options']);
    assert.ok(!('correct' in q) && !('key' in q));
  }
  const cards = body.items.filter((i) => i.type === 'card');
  const keep = (await call(`/api/learn/runs/${body.id}/rate`, { method: 'POST', body: { itemId: cards[0].id, keep: true } })).body;
  assert.equal(keep.kept, true);
  // BUILD-1101 1.1: Keep puts a card not in Revise there as a new card; no return day is scheduled yet.
  assert.deepEqual([keep.stamp, keep.line], ['In Revise', 'In Revise']);
  // A swipe past without Keep schedules nothing: the second card has no state.
  const end = (await call(`/api/learn/runs/${body.id}/end`)).body;
  assert.equal(end.feed.title, '10 minutes on Admission of a Partner');
  assert.equal(end.feed.kept.count, 1);
  assert.equal(end.feed.kept.cards[0].id, cards[0].card.id);
  assert.equal(end.feed.kept.stamp, keep.stamp);
  // BUILD-1101 1.3: "Another 10 minutes" sends fresh, so it never resumes the feed just played.
  assert.deepEqual(end.feed.lead, { label: 'Another 10 minutes', run: { kind: 'feed', chapterKey: AOP, minutes: 10, fresh: true } });
  assert.equal(end.feed.kept.line, '1 kept. They are first in Revise.');
  assert.equal(end.feed.free, null);
  assert.match(end.feed.next.label, /^Next chapter: Retirement and Death of a Partner$/);
  assert.equal(end.feed.next.run.kind, 'feed');
  const again = await call('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed' } });
  assert.equal(again.http, 200, 'Pro plays as many feeds as it likes');
});

// BUILD-1101 1.6 (LK15): Free's one Learn session a day is claimed at the first answered question (a feed opened and left
// costs nothing), the line names the session, and the 402 code is FREE_SESSION_USED.
const SESSION_DONE = 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.';
test('preview: Free plays one Learn session a day; its end says so and a second feed does not start', async () => {
  const call = student('free');
  const first = await call('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed' } });
  assert.equal(first.http, 200);
  const q = first.body.items.find((i) => i.type === 'question');
  assert.equal((await call(`/api/learn/runs/${first.body.id}/answer`, { method: 'POST', body: { itemId: q.id, choice: 'A' } })).http, 200);
  const end = (await call(`/api/learn/runs/${first.body.id}/end`)).body;
  assert.equal(end.feed.lead, null);
  assert.deepEqual(end.feed.free, { text: SESSION_DONE });
  assert.equal(end.feed.next.run, null, 'the next chapter opens its chapter page, not a second feed');
  const second = await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 10, kind: 'feed' } });
  assert.equal(second.http, 402);
  assert.deepEqual([second.body.error, second.body.line], ['FREE_SESSION_USED', SESSION_DONE]);
  const covers = (await call('/api/learn/covers', { query: { subject: 'accountancy' } })).body;
  assert.deepEqual(covers.free, { text: SESSION_DONE, maxMinutes: 10 });
});

test('preview: the covers row is the suggested chapter first with the real counts at 5, 10 and 20 minutes', async () => {
  const call = student('pro');
  const { http, body } = await call('/api/learn/covers', { query: { subject: 'accountancy' } });
  assert.equal(http, 200);
  assert.deepEqual(body.lengths, [5, 10, 20]);
  // BUILD-1101 1.8 R12: every playable chapter (no cap of 8); For you = most old mistakes, with its reason and one true line.
  assert.ok(body.covers.length > FEED_RULES.maxCovers);
  assert.equal(body.covers[0].key, PF);
  assert.equal(body.covers[0].forYou, true);
  assert.equal(body.covers[0].reason, '3 old mistakes to fix');
  assert.equal(body.covers[0].studentLine, '3 due, 3 old mistakes');
  assert.equal(body.covers[0].hook.mustKnow, true);
  assert.equal(body.covers[1].key, 'accountancy.profit-and-loss-appropriation-account', 'then book order from the chapter after it');
  assert.ok(body.covers.slice(1).every((c) => !c.forYou));
  const aop = body.covers.find((c) => c.key === AOP);
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed' } })).body;
  assert.equal(aop.counts[10].cards, run.items.filter((i) => i.type === 'card').length, 'the cover counts are the feed it plays');
  assert.equal(aop.counts[10].questions, run.items.filter((i) => i.type === 'question').length);
  for (const c of body.covers) assert.ok(c.counts[5].cards <= c.counts[10].cards && c.counts[10].cards <= c.counts[20].cards);
});
