// Learn v2: the Explore feed v2 (docs/brain/learn-1031/FEED-2.md, BUILD-1101 1.2, 1.4, R12 and R16). The pure rules of
// data/learn/feed.js (checkpoint cadence, the checkpoint number, the covers order and line, the end rows, the feed's order
// shape) and the feed's card pool in data/learn/compose.js (A5 section 4 items 1, 2 and 7), then the preview routes end to end:
// the real feed order, Keep, the end screen's keys and Free's one Learn session a day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CHECKPOINT_LINE, FEED_RULES, FREE_FEED_DONE, checkpointNumber, coverLine, coverOrder, feedEndLines, feedOrderProblems, feedSlots, feedsOnDay, freeFeed, keptLine } from '../learn/feed.js';
import { composeRun, feedCardPool, isAnaphoric, orderProblems } from '../learn/compose.js';
import { FREE_SESSION_DONE } from '../learn/allowance.js';
import { istDay, schedule, tasteIds } from '../keycards.js';
import { previewAnswer } from '../../src/lib/server/keycardsPreview.js';

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i + 1}`, type: i % 3 === 2 ? 'question' : 'card' }));
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-01T10:00:00+05:30');
const DECK = JSON.parse(readFileSync(path.join(process.cwd(), 'data/keycards/decks/accountancy.json'), 'utf8')).cards;
const FIX = JSON.parse(readFileSync(path.join(process.cwd(), 'data/fixtures/learn-preview-questions.json'), 'utf8')).questions;
const PF_CARDS = DECK.filter((c) => c.chapterKey === 'accountancy.partnership-fundamentals');
const PF_QS = FIX.filter((q) => q.chapter === 'Partnership Fundamentals').map((q) => ({ id: q.id, difficulty: q.difficulty, cards: q.cards, seen: false, words: q.body.split(/\s+/).length }));
const held = (id, dueIn, reps = 1) => {
  const at = NOW - 3 * DAY;
  const s = schedule(null, 3, at);
  return [id, { card_id: id, reps, due_at: new Date(NOW + dueIn).toISOString(), schedule: s.schedule, suspended: false }];
};
const cardIds = (run) => run.items.filter((i) => i.type === 'card').map((i) => i.cardId);
/** "Shown" after a feed: every card of it, at the time the student acted on its last item (BUILD-1101 1.2). */
const shownAfter = (run, at, into = new Map()) => { for (const id of cardIds(run)) into.set(id, at); return into; };

test('checkpoints: after item 8, 16, ... only when 4 or more items follow; never two in a row; the line is R16\'s', () => {
  assert.equal(FEED_RULES.checkpointEvery, 8);
  const s21 = feedSlots(items(21));
  assert.deepEqual(s21.filter((s) => s.type === 'checkpoint').map((s) => s.after), [8, 16]);
  assert.equal(s21.length, 23);
  assert.equal(s21[8].type, 'checkpoint');
  assert.equal(s21[s21.length - 1].type, 'item');
  assert.deepEqual(feedSlots(items(16)).filter((s) => s.type === 'checkpoint').map((s) => s.after), [8]);
  assert.deepEqual(feedSlots(items(8)).filter((s) => s.type === 'checkpoint'), []);
  assert.deepEqual(feedSlots(items(9)).filter((s) => s.type === 'checkpoint'), [], 'one item after 8 is too few');
  assert.deepEqual(feedSlots(items(11)).filter((s) => s.type === 'checkpoint'), [], 'three after is too few');
  assert.deepEqual(feedSlots(items(12)).filter((s) => s.type === 'checkpoint').map((s) => s.after), [8], 'four after is enough');
  assert.deepEqual(feedSlots(items(33)).filter((s) => s.type === 'checkpoint').map((s) => s.after), [8, 16, 24], 'not after 32 of 33 (A5 F9)');
  assert.deepEqual(feedSlots([]), []);
  const s = feedSlots(items(30));
  for (let i = 1; i < s.length; i += 1) assert.ok(!(s[i].type === 'checkpoint' && s[i - 1].type === 'checkpoint'));
  assert.deepEqual(s.filter((x) => x.type === 'item').map((x) => x.n), Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(CHECKPOINT_LINE, 'Keep going, or end here. What you kept is already in Revise.');
});

// A5 section 4 item 7: no checkpoint with fewer than 4 items after it, over every composed feed.
test('checkpoints on real feeds: none has fewer than 4 items after it', () => {
  for (const minutes of [5, 10, 20, 30]) {
    const run = composeRun({ kind: 'feed', minutes, cards: PF_CARDS, states: new Map(), now: NOW, questions: PF_QS });
    for (const cp of feedSlots(run.items).filter((x) => x.type === 'checkpoint')) assert.ok(run.items.length - cp.after >= 4, `${minutes} min: checkpoint after ${cp.after} of ${run.items.length}`);
  }
});

test('the checkpoint number: questions once one is answered, else the cards', () => {
  assert.equal(checkpointNumber({ answered: 6, right: 5, seen: 10, kept: 2 }), '5 of 6 right');
  assert.equal(checkpointNumber({ answered: 0, seen: 6, kept: 2 }), '6 cards seen, 2 kept');
  assert.equal(checkpointNumber({ seen: 1, kept: 0 }), '1 card seen, 0 kept');
});

test('LK15 kept for older importers: the feed line is the session line; days are India days', () => {
  assert.equal(FREE_FEED_DONE, FREE_SESSION_DONE);
  assert.deepEqual(freeFeed({ isPro: true, startedToday: 9 }), { canStart: true, endLine: null, left: null });
  assert.deepEqual(freeFeed({ isPro: false, startedToday: 1 }), { canStart: false, endLine: FREE_SESSION_DONE, left: 0 });
  const t1 = Date.parse('2026-11-01T23:50:00+05:30');
  const t2 = Date.parse('2026-11-02T00:10:00+05:30');
  assert.equal(feedsOnDay([t1], t2, istDay), 0, '11:50 pm and 12:10 am IST are two days');
  assert.equal(feedsOnDay([t1, t2], t2, istDay), 1);
});

// A5 section 4 item 1: the feed moves forward.
test('the feed pool (BUILD 1.2): two feeds in a row share no card while the chapter has unshown cards; shown cards rest 3 days', () => {
  const a = composeRun({ kind: 'feed', minutes: 10, cards: PF_CARDS, states: new Map(), now: NOW, questions: PF_QS });
  const shown = shownAfter(a, NOW);
  const b = composeRun({ kind: 'feed', minutes: 10, cards: PF_CARDS, states: new Map(), now: NOW + 60_000, questions: PF_QS, shownAt: shown });
  assert.ok(PF_CARDS.length - cardIds(a).length >= cardIds(b).length, 'the chapter has enough unshown cards');
  assert.deepEqual(cardIds(b).filter((id) => cardIds(a).includes(id)), [], 'no card of the first feed');
  // When the unshown cards run out, the shown ones come back, the oldest shown first.
  const all = new Map(PF_CARDS.map((c, i) => [c.id, NOW - (i % 2 ? 1 : 2) * DAY]));
  const c = composeRun({ kind: 'feed', minutes: 5, cards: PF_CARDS, states: new Map(), now: NOW, questions: PF_QS, shownAt: all });
  assert.ok(cardIds(c).length > 0);
  assert.ok(cardIds(c).every((id) => all.get(id) === NOW - 2 * DAY), 'the oldest shown first');
  // After 3 days a shown card is rested and counts as unshown again (Must-know first, then book order).
  const rested = composeRun({ kind: 'feed', minutes: 5, cards: PF_CARDS, states: new Map(), now: NOW + 3 * DAY, questions: PF_QS, shownAt: shown });
  assert.ok(cardIds(rested).length > 0);
  const pool = feedCardPool(PF_CARDS, new Map(), shown, NOW + 60_000);
  const firstShown = pool.fresh.findIndex((x) => shown.has(x.card.id));
  assert.ok(pool.fresh.slice(firstShown).every((x) => shown.has(x.card.id)), 'the shown cards come after every unshown one');
});

// A5 section 4 item 2: never a due card; held cards that are not due only as looks, only when the fresh cards run out.
test('the feed never serves a due card; a card held in Revise (not due) only as a look, when the cards not in Revise run out', () => {
  const taste = tasteIds(PF_CARDS);
  const open = PF_CARDS.filter((c) => taste.has(c.id));
  const [a, b, c, d, e] = open.map((x) => x.id);
  const states = new Map([held(a, -DAY), held(b, -DAY), held(c, 2 * DAY), held(d, 4 * DAY)]);
  const run = composeRun({ kind: 'feed', minutes: 10, cards: open, states, now: NOW, questions: PF_QS, ratingsLeft: 10, newLeft: 5 });
  const cards = run.items.filter((i) => i.type === 'card');
  assert.ok(!cards.some((i) => i.cardId === a || i.cardId === b), 'never a due card');
  assert.deepEqual(cards.filter((i) => !i.look).map((i) => i.cardId), [e], 'the one card not held is a card');
  assert.deepEqual(cards.filter((i) => i.look).map((i) => i.cardId).sort(), [c, d].sort(), 'the held ones, not due, are looks');
  assert.ok(cards.filter((i) => i.look).every((i) => i.seconds === 10 || i.seconds === 18));
  assert.ok(cards.indexOf(cards.find((i) => i.cardId === e)) < cards.findIndex((i) => i.look), 'looks after the fresh cards');
  // With enough fresh cards a held card does not join at all.
  const pro = composeRun({ kind: 'feed', minutes: 5, cards: PF_CARDS, states, now: NOW, questions: PF_QS });
  assert.ok(pro.items.every((i) => i.type !== 'card' || (!i.look && ![a, b, c, d].includes(i.cardId))));
  // A kept card (in Revise, never reviewed) is neither fresh nor a look.
  const kept = composeRun({ kind: 'feed', minutes: 5, cards: open, states: new Map([[e, { card_id: e, reps: 0, due_at: new Date(NOW).toISOString(), suspended: false }]]), now: NOW, questions: [] });
  assert.ok(!cardIds(kept).includes(e));
  // Free's ratings never turn a feed card into a look (a feed card is never rated).
  const used = composeRun({ kind: 'feed', minutes: 5, cards: open, states: new Map(), now: NOW, questions: PF_QS, ratingsLeft: 0, newLeft: 0 });
  assert.ok(used.items.every((i) => i.type !== 'card' || !i.look));
});

test('the feed split: about 35 percent cards, the questions first; 10 minutes is about 12 cards and 6 questions', () => {
  const qs = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, difficulty: ['easy', 'medium', 'hard'][i % 3], cards: [], seen: false, words: 30 }));
  const cards = Array.from({ length: 60 }, (_, i) => ({ id: `c${i}`, order: i, importance: 'good', front: 'x', quote: 'y' }));
  for (const minutes of [5, 10, 20]) {
    const run = composeRun({ kind: 'feed', minutes, cards, states: new Map(), now: NOW, questions: qs });
    const share = run.piles.cards.seconds / run.seconds;
    assert.ok(share > 0.25 && share < 0.45, `${minutes} min: cards take ${share}`);
    assert.deepEqual(feedOrderProblems(run.items), [], `${minutes} min keeps the feed's shape`);
  }
  const ten = composeRun({ kind: 'feed', minutes: 10, cards, states: new Map(), now: NOW, questions: qs });
  assert.ok(Math.abs(ten.piles.cards.count - 11) <= 2 && Math.abs(ten.piles.questions.count - 6) <= 1, `${ten.piles.cards.count} cards, ${ten.piles.questions.count} questions`);
});

test('covers (R12): every playable chapter; For you first with its reason; then book order from the chapter after it, wrapping', () => {
  const ch = (key, order, o = {}) => ({ key, title: key.toUpperCase(), order, chapterNo: order + 1, cards: 5, questions: 3, mistakes: 0, lastActivityAt: null, hasNew: true, openFeed: false, ...o });
  const base = [ch('a', 0), ch('b', 1, { cards: 0, questions: 0 }), ch('c', 2), ch('d', 3), ch('e', 4)];
  const keys = (list) => list.map((c) => c.key);
  // 4. a new student: the first chapter with cards.
  const fresh = coverOrder(base);
  assert.deepEqual(keys(fresh), ['a', 'c', 'd', 'e'], 'a chapter with nothing to play is left out; no cap');
  assert.deepEqual([fresh[0].forYou, fresh[0].reason], [true, 'Chapter 1 of your book']);
  assert.ok(fresh.slice(1).every((c) => !c.forYou && c.reason === null));
  // 3. the chapter after the latest Learn activity that has new cards.
  const next = coverOrder(base.map((c) => (c.key === 'c' ? { ...c, lastActivityAt: 5 } : c.key === 'a' ? { ...c, lastActivityAt: 2 } : c.key === 'd' ? { ...c, hasNew: false } : c)));
  assert.deepEqual(keys(next), ['e', 'a', 'c', 'd'], 'For you, then book order from the next chapter, wrapping');
  assert.equal(next[0].reason, 'Next after C');
  // 2. the most old mistakes.
  const mistakes = coverOrder(base.map((c) => (c.key === 'd' ? { ...c, mistakes: 2 } : c.key === 'a' ? { ...c, mistakes: 1, lastActivityAt: 9 } : c)));
  assert.deepEqual([mistakes[0].key, mistakes[0].reason], ['d', '2 old mistakes to fix']);
  assert.deepEqual(keys(mistakes), ['d', 'e', 'a', 'c']);
  assert.equal(coverOrder(base.map((c) => (c.key === 'e' ? { ...c, mistakes: 1 } : c)))[0].reason, '1 old mistake to fix');
  // 1. today's unfinished feed.
  const pick = coverOrder(base.map((c) => (c.key === 'c' ? { ...c, openFeed: true } : c.key === 'd' ? { ...c, mistakes: 3 } : c)));
  assert.deepEqual([pick[0].key, pick[0].reason], ['c', 'Pick up where you stopped']);
  assert.equal(coverOrder(base, 2).length, 2);
  assert.deepEqual(coverOrder([]), []);
  assert.equal(coverLine(10, { cards: 16, questions: 5 }), '10 minutes, 16 Key cards and 5 questions');
  assert.equal(coverLine(5, { cards: 1, questions: 0 }), '5 minutes, 1 Key card');
  assert.equal(coverLine(1, { cards: 0, questions: 1 }), '1 minute, 1 question');
});

test('the feed end rows (R16): "Old mistakes: 1 still open" when none was fixed, never "Fixed: 0 of 1"; the kept line', () => {
  assert.deepEqual(feedEndLines({ answered: 6, right: 4, fixed: 0, mistakes: 1 }), [{ label: 'Questions', text: '4 of 6 right' }, { label: 'Old mistakes', text: '1 still open' }]);
  assert.deepEqual(feedEndLines({ fixed: 2, mistakes: 2 }), [{ label: 'Fixed', text: '2 old mistakes' }]);
  assert.deepEqual(feedEndLines({ fixed: 1, mistakes: 2 }), [{ label: 'Fixed', text: '1 of 2 old mistakes' }]);
  assert.deepEqual(feedEndLines({}), []);
  assert.equal(keptLine(6), '6 kept. They are first in Revise.');
  assert.equal(keptLine(0), null);
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
  assert.equal(body.covers[0].studentLine, '3 old mistakes to fix', 'B7 4: the student line carries no due counts');
  assert.equal(typeof body.covers[0].hook.id, 'string', 'B7 4: the hook is a real card of the feed, with its id');
  assert.equal(body.covers[1].key, 'accountancy.profit-and-loss-appropriation-account', 'then book order from the chapter after it');
  assert.ok(body.covers.slice(1).every((c) => !c.forYou));
  const aop = body.covers.find((c) => c.key === AOP);
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed' } })).body;
  assert.equal(aop.counts[10].cards, run.items.filter((i) => i.type === 'card').length, 'the cover counts are the feed it plays');
  assert.equal(aop.counts[10].questions, run.items.filter((i) => i.type === 'question').length);
  for (const c of body.covers) assert.ok(c.counts[5].cards <= c.counts[10].cards && c.counts[10].cards <= c.counts[20].cards);
});
// M4 (1 Nov final critic): the first card of a feed is read on its own, in the cover's art and as the stage's first item, so it never
// opens on an anaphor ("If this amount is paid ..."); a Definition is preferred; the cover's hook is that very card.
test('the feed opens on a card that makes sense alone: no anaphor first, in every chapter of every deck, at 5, 10 and 20 minutes', () => {
  assert.equal(isAnaphoric('If this amount is paid to the old partners directly (privately), ___ is passed'), true);
  assert.equal(isAnaphoric('These are called ___.'), true);
  assert.equal(isAnaphoric('What is the sacrificing ratio?'), false);
  assert.equal(isAnaphoric('Itemised statement of ___'), false, 'a word that merely starts with it is not an anaphor');
  let feeds = 0;
  for (const deck of ['accountancy', 'biology', 'business_studies', 'economics', 'english', 'political_science']) {
    const cards = JSON.parse(readFileSync(path.join(process.cwd(), `data/keycards/decks/${deck}.json`), 'utf8')).cards;
    for (const key of new Set(cards.map((c) => c.chapterKey))) {
      const chapter = cards.filter((c) => c.chapterKey === key && !c.locked);
      const alone = chapter.filter((c) => !isAnaphoric(c.front));
      for (const minutes of [5, 10, 20]) {
        const run = composeRun({ kind: 'feed', minutes, cards: chapter, states: new Map(), now: NOW, questions: [] });
        const first = run.items.find((i) => i.type === 'card');
        if (!first) continue;
        feeds += 1;
        const card = chapter.find((c) => c.id === first.cardId);
        if (alone.length > 6) assert.equal(isAnaphoric(card.front), false, `${key} at ${minutes}: opens on "${card.front.slice(0, 50)}"`);
        // A Definition is first when one of the opening stretch is not an anaphor.
        const stretch = run.items.filter((i) => i.type === 'card').slice(0, 6).map((i) => chapter.find((c) => c.id === i.cardId));
        if (stretch.some((c) => c.kind === 'definition' && !isAnaphoric(c.front))) assert.equal(card.kind, 'definition', `${key} at ${minutes}: a Definition opens`);
        assert.deepEqual(orderProblems(run.items).filter((p) => p.rule === 'first'), []);
      }
    }
  }
  assert.ok(feeds > 30, 'many feeds were checked');
});

test('preview: every cover hook is the first card of the feed it opens (Admission no longer opens on "this amount")', async () => {
  const call = student('pro');
  const { body } = await call('/api/learn/covers', { query: { subject: 'accountancy' } });
  const aop = body.covers.find((c) => c.key === AOP);
  assert.equal(isAnaphoric(aop.hook.front), false, 'the cover art of Admission reads on its own');
  for (const c of body.covers.filter((x) => x.hook?.id && !x.resume)) {
    const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: c.key, minutes: 10, kind: 'feed' } })).body;
    const first = run.items.find((i) => i.type === 'card');
    assert.equal(c.counts[10].hook.id, first.card.id, `${c.key}: the cover hook is the feed's first card`);
    assert.equal(c.hook.id, first.card.id);
    assert.equal(run.items[0].type, 'card');
    assert.equal(isAnaphoric(first.card.front), false, `${c.key}: the first card reads on its own`);
  }
});
