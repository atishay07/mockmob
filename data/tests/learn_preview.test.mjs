// Learn v2 preview routes (src/lib/server/learnPreview.js through keycardsPreview.js): every /api/learn/ route answers the
// contract's shape for both plans, the seeded commerce history is what the spec says, answer keys stay on the server until
// an answer, and ratings go through the real Key cards service (FSRS stamps, the Free allowance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { previewAnswer } from '../../src/lib/server/keycardsPreview.js';
import { learnServed } from '../../src/lib/server/learn.js';

// The key letter as served (R5 Packet A: the stable option order of data/option_order.js), from the fixture's stored rows.
const KEYS = Object.fromEntries(JSON.parse(readFileSync(path.join(process.cwd(), 'data/fixtures/learn-preview-questions.json'), 'utf8')).questions
  .map((q) => [q.id, learnServed({ id: q.id, question: q.body, options: q.options, correct_answer: q.correct_answer, explanation: q.explanation || '' }).key]));
let n = 0;
function student(plan, who = 'commerce') {
  const session = `learn-test-${plan}-${who}-${(n += 1)}`;
  return async (to, { method = 'GET', body = null, query = {} } = {}) => {
    const u = new URL('http://localhost/preview/arena/realdeck');
    for (const [k, v] of Object.entries({ _to: to, _plan: plan, _student: who, _s: session, ...query })) u.searchParams.set(k, v);
    const out = await previewAnswer(new Request(u, { method, body: body ? JSON.stringify(body) : undefined }));
    return out;
  };
}
const PF = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const noKeys = (body) => {
  for (const item of body.items.filter((i) => i.type === 'question')) {
    assert.deepEqual(Object.keys(item.question).sort(), ['body', 'id', 'options'], 'no answer key before an answer');
    assert.ok(!('correct' in item) && !('key' in item) && !('explanation' in item));
    for (const o of item.question.options) assert.deepEqual(Object.keys(o).sort(), ['key', 'text']);
  }
};

test('subject: the seeded returning Pro student (A7 suggestions, parts, true row meta)', async () => {
  const call = student('pro');
  const { http, body } = await call('/api/learn/subject', { query: { subject: 'accountancy' } });
  assert.equal(http, 200);
  assert.equal(body.plan, 'pro');
  assert.equal(body.student.isNew, false);
  assert.equal(body.subject.cards, 920);
  assert.equal(body.freeNote, null);
  assert.equal(body.suggestions.length, 3);
  assert.equal(new Set(body.suggestions.map((s) => s.kind)).size, 3);
  assert.equal(body.suggestions[0].kind, 'pickup');
  assert.equal(body.suggestions[0].evidence.startsWith('You stopped at 6 of 16.'), true);
  const rows = body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters));
  const pf = rows.find((r) => r.key === PF);
  assert.deepEqual([pf.ref, pf.due, pf.mistakes, pf.state.key, pf.state.label], ['Ch 1', 3, 3, 'getting_there', 'Getting there']);
  assert.equal(pf.meta, '3 due, 3 open mistakes');
  const aop = rows.find((r) => r.key === AOP);
  assert.equal(aop.mistakes, 2);
  assert.equal(aop.lesson.title, 'Revaluation of assets and liabilities');
  assert.match(aop.meta, /^6 of 16 done today/);
  assert.equal(body.parts[0].title, 'Part 1, Partnership Accounts');
  assert.equal(body.parts[1].option.label, 'Your part');
  assert.ok(body.parts[1].units.some((u) => u.optionId === 'AFS') && body.parts[1].units.some((u) => u.optionId === 'CAS'));
  assert.ok(rows.filter((r) => r.due > 0).length >= 3, 'due cards in Partnership Fundamentals and two other chapters');
});

test('subject: a new Free student gets the first-run set and the Free line', async () => {
  const call = student('free', 'new');
  const { body } = await call('/api/learn/subject', { query: { subject: 'accountancy' } });
  assert.equal(body.student.isNew, true);
  assert.equal(body.freeNote, 'Free opens 5 cards in every chapter. Pro opens all 920.');
  assert.deepEqual(body.suggestions.map((s) => s.kind), ['start', 'level', 'feed']);
  assert.equal(body.suggestions[0].title, 'Start with Accounting for Partnership: Basic Concepts');
  const rows = body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters));
  assert.ok(rows.every((r) => r.state.key === 'none' && r.state.label === 'Not started'));
});

test('runs/preview: the piles of A1 for both plans, the lesson pile at 20 minutes, honest shrink on Free', async () => {
  const pro = student('pro');
  const p10 = (await pro('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [] } })).body;
  assert.equal(p10.startLabel, 'Start 10 minutes');
  assert.deepEqual(p10.piles.map((p) => p.id), ['cards', 'questions', 'mistakes']);
  assert.equal(p10.note, 'Ratings join Revise. Questions are free.');
  assert.match(p10.recap.label, /^Or a quick recap: the \d+ Must-know lines, about \d+ min$/);
  assert.equal(p10.chapter.partTitle, 'Part 1, Partnership Accounts');
  assert.deepEqual(p10.shelf.mistakes, { open: 3 });
  const p20 = (await pro('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: AOP, minutes: 20, leaveOut: [] } })).body;
  assert.deepEqual(p20.piles.find((p) => p.id === 'lesson'), { id: 'lesson', count: 1, minutes: 7, label: 'Lesson', minutesLabel: '7 min', left: false, held: null });
  const free = student('free');
  // BUILD-1101 1.5: a shrink only when the chapter has no more of what is in (here Questions is left out, so Free's 5 cards and 3 mistakes are all).
  const f20 = (await free('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: ['questions'] } })).body;
  assert.equal(f20.piles.find((p) => p.id === 'cards').count, 5);
  assert.ok(f20.shrink && f20.shrink.minutes < 20);
  assert.equal(f20.startLabel, `Start ${f20.shrink.minutes} minutes`);
  assert.equal(f20.shrink.addNext.key, 'accountancy.profit-and-loss-appropriation-account');
  assert.equal(f20.free.text, "Free opens 5 of this chapter's 45 cards.");
  assert.equal(f20.shelf.print.locked, true);
});

test('a run end to end: no keys before an answer, a fixed mistake, the line you needed, real stamps, the end screen', async () => {
  const call = student('pro');
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [], kind: 'mix' } })).body;
  noKeys(run);
  assert.equal(run.items[0].type, 'card');
  assert.equal(run.revisePile.count, 0);
  const items = [...run.items];
  const mistakes = items.filter((i) => i.type === 'question' && i.origin === 'mistake');
  assert.equal(mistakes.length, 2);
  assert.deepEqual(mistakes[0].mistake, { where: 'Mock 3', when: '16 Oct', label: 'You missed this in Mock 3 on 16 Oct' });
  // Got it on the first card: a real return day.
  const got = (await call(`/api/learn/runs/${run.id}/rate`, { method: 'POST', body: { itemId: items[0].id, rating: 3 } })).body;
  assert.equal(got.ok, true);
  assert.match(got.stamp, /^Back (tomorrow|in \d+ (days|weeks|months))$/);
  assert.equal(got.revisePile.count, 1);
  // Missed: back later in this run, 3 items on.
  const second = items.findIndex((i, k) => k > 0 && i.type === 'card');
  const missed = (await call(`/api/learn/runs/${run.id}/rate`, { method: 'POST', body: { itemId: items[second].id, rating: 1 } })).body;
  assert.equal(missed.stamp, 'Back in this run, then tomorrow');
  assert.equal(missed.reinsert.at, second + 3);
  assert.equal(missed.reinsert.item.stage, 'again');
  // The first mistake answered right: fixed, with the line collapsed under it.
  const right = (await call(`/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: mistakes[0].id, choice: KEYS[mistakes[0].question.id] } })).body;
  // BUILD-1101 1.8 R10: a right retry moves the Revise card on; "Fixed" is said only when Revise retires it.
  assert.equal(right.correct, true);
  assert.equal(right.fixed, true);
  assert.match(right.fixedText, /^Right this time\. Back (on (Mon|Tue|Wed|Thu|Fri|Sat|Sun)|tomorrow|in \d+ days) to check it held\.$/);
  assert.ok(right.line?.card?.id && right.line.collapsed === true);
  // The second answered wrong: the key, the explanation, the line open and its card coming back.
  const wrongChoice = ['A', 'B', 'C', 'D'].find((x) => x !== KEYS[mistakes[1].question.id]);
  const wrong = (await call(`/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: mistakes[1].id, choice: wrongChoice } })).body;
  assert.equal(wrong.correct, false);
  assert.equal(wrong.key, KEYS[mistakes[1].question.id]);
  assert.ok(wrong.explanation.length > 0);
  assert.ok(wrong.line.card.front);
  const again = (await call(`/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: mistakes[1].id, choice: wrongChoice } })).body;
  assert.deepEqual(again, wrong, 'an answer is graded once');
  const end = (await call(`/api/learn/runs/${run.id}/end`)).body;
  assert.equal(end.title, '10 minutes on Accounting for Partnership: Basic Concepts');
  // Mistakes are counted apart from questions (CRITIQUE-1 E5): 2 mistakes tried are not "2 questions answered".
  assert.deepEqual(end.numbers, { cards: 2, questions: 0, fixed: 1, mistakes: 2, detail: { cards: '1 got it, 1 missed', questions: null, fixed: '1 of 2, 1 still open' } });
  assert.deepEqual(end.lines.map((l) => l.label), ['Cards', 'Mistakes']);
  assert.equal(end.lines[1].text, '1 of 2 fixed, 1 still open');
  assert.ok(end.lines.every((l) => !l.text.endsWith('.')), 'no row ends with a full stop');
  assert.ok(end.revisePile.length >= 1);
  assert.ok(end.lead.run || end.lead.href);
  // R2 ruling 5: one main key and at most one quiet link.
  assert.equal(end.options.length, 1);
  // The fixed mistake is no longer open on the subject map.
  const subject = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const pf = subject.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).find((r) => r.key === PF);
  // R10.1: 3 open; the right one is back in a few days to check it held, the wrong retry rests a day: 1 open today.
  assert.equal(pf.mistakes, 1, '3 open, 1 right (checked later), 1 wrong again (rests a day)');
});

test('Free: the eleventh rating turns the rest of the run into looks, with one line and no error', async () => {
  const call = student('free', 'new');
  let rated = 0;
  let limit = null;
  const chapters = [PF, 'accountancy.profit-and-loss-appropriation-account', 'accountancy.change-in-profit-sharing-ratio', AOP];
  for (const chapterKey of chapters) {
    const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey, minutes: 5, kind: 'cards' } })).body;
    for (const item of run.items) {
      const r = await call(`/api/learn/runs/${run.id}/rate`, { method: 'POST', body: { itemId: item.id, rating: 3 } });
      assert.equal(r.http, 200);
      if (r.body.limit) { limit = r.body.limit; break; }
      if (r.body.stamp) rated += 1;
    }
    if (limit) break;
  }
  assert.ok(limit, 'a limit was reached');
  assert.ok(rated <= 10);
  assert.match(limit.text, /free (card ratings|cards) are used/);
});

test('recap, level, an explicit card set, the feed with Keep, and resume', async () => {
  const call = student('pro');
  // Pick up (a feed run is never offered as a pick-up): the seeded unfinished run resumes from item 7 of 16.
  const subject = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const pickup = subject.suggestions.find((s) => s.kind === 'pickup');
  const resumed = (await call('/api/learn/runs', { method: 'POST', body: pickup.action.run })).body;
  assert.deepEqual(resumed.resumed, { done: 6, of: 16 });
  assert.equal(resumed.items.length, 10);
  const recap = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 3, kind: 'recap' } })).body;
  assert.ok(recap.items.length > 0 && recap.items.every((i) => i.type === 'card' && i.recap && i.card.importance === 'must'));
  const r = (await call(`/api/learn/runs/${recap.id}/rate`, { method: 'POST', body: { itemId: recap.items[0].id, rating: 3 } })).body;
  assert.equal(r.stamp, null, 'nothing is scheduled in a recap');
  const level = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 6, kind: 'level' } })).body;
  assert.equal(level.items.length, 6);
  assert.ok(level.items.every((i) => i.type === 'question'));
  noKeys(level);
  const cards = (await call('/api/learn/cards', { query: { chapter: PF, filter: 'must' } })).body;
  const ids = cards.sections.flatMap((s) => s.cards).slice(0, 12).map((c) => c.id);
  const set = (await call('/api/learn/runs', { method: 'POST', body: { cardIds: ids, minutes: 3, kind: 'cards' } })).body;
  assert.deepEqual(set.items.map((i) => i.card.id).sort(), [...ids].sort());
  const feed = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed' } })).body;
  const card = feed.items.find((i) => i.type === 'card');
  const keep = (await call(`/api/learn/runs/${feed.id}/rate`, { method: 'POST', body: { itemId: card.id, keep: true } })).body;
  assert.deepEqual([keep.ok, keep.kept], [true, true]);
});

test('cards, shelves and search answer the contract for both plans', async () => {
  for (const plan of ['pro', 'free']) {
    const call = student(plan);
    const cards = (await call('/api/learn/cards', { query: { chapter: PF, filter: 'all' } })).body;
    assert.deepEqual(Object.keys(cards.counts), ['total', 'all', 'must', 'revise', 'missed', 'due']);
    assert.equal(cards.counts.total, 45);
    assert.ok(cards.sections.length >= 2 && cards.sections.every((s) => s.title && s.cards.length));
    for (const c of cards.sections.flatMap((s) => s.cards)) assert.deepEqual([typeof c.inRevise, typeof c.missedLately, c.locked], ['boolean', 'boolean', false]);
    if (plan === 'free') {
      assert.equal(cards.counts.all, 5);
      assert.equal(cards.lockedLine, '40 more cards in this chapter. Pro opens every card in every chapter and keeps them on a schedule.');
    } else {
      assert.equal(cards.counts.all, 45);
      assert.equal(cards.lockedLine, null);
    }
    const shelves = (await call('/api/learn/shelves', { query: { subject: 'accountancy' } })).body;
    assert.ok(shelves.due.count >= 3 && shelves.due.minutes >= 1);
    assert.ok(shelves.missed.count >= 1);
    const search = (await call('/api/learn/search', { query: { subject: 'accountancy', q: 'goodwill' } })).body;
    assert.ok(search.chapters.some((c) => c.key === 'accountancy.goodwill-valuation'));
    assert.ok(search.cards.length > 0);
    if (plan === 'free') assert.ok(search.cards.filter((r) => r.locked).every((r) => r.card.front === undefined));
  }
  const call = student('pro');
  assert.equal((await call('/api/learn/nope')).http, 404);
  assert.equal((await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: 'accountancy.nope', minutes: 10 } })).http, 404);
  assert.equal((await call('/api/learn/runs/none/end')).http, 404);
});

test('honest shrink: "Add the next chapter" fills the rest from the next chapter in book order', async () => {
  const call = student('free');
  const before = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: ['questions'] } })).body;
  assert.ok(before.shrink.addNext);
  const after = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: ['questions'], addNext: true } })).body;
  assert.deepEqual(after.added, { key: before.shrink.addNext.key, title: before.shrink.addNext.title, ref: before.shrink.addNext.ref, place: before.shrink.addNext.place });
  assert.deepEqual(after.added.place, { n: 2, of: 14 }, 'R4 ruling N: the place of the added chapter among the playable chapters');
  assert.ok(after.piles.find((p) => p.id === 'cards').count > before.piles.find((p) => p.id === 'cards').count);
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: ['questions'], kind: 'mix', addNext: true } })).body;
  assert.equal(run.added.key, before.shrink.addNext.key);
  assert.ok(run.items.some((i) => i.type === 'card' && i.card.chapterKey === before.shrink.addNext.key));
  noKeys(run);
});

// ---------------------------------------------------------------- CRITIQUE-1 (E1, E2, E5, C4, H4)

test('E2: one due count: the sidebar badge (Key cards overview) equals Find\'s due over every subject, whichever loads first', async () => {
  for (const plan of ['pro', 'free']) {
    const call = student(plan);
    // The sidebar and the page ask at the same moment on a brand-new student.
    const [overview, shelves] = await Promise.all([call('/api/keycards'), call('/api/learn/shelves', { query: { subject: 'accountancy' } })]);
    const badge = overview.body.today.due;
    assert.equal(shelves.body.due.all, badge, `${plan}: badge ${badge}, Find all ${shelves.body.due.all}`);
    const again = (await call('/api/keycards')).body.today.due;
    assert.equal(again, badge, `${plan}: the badge does not move after Learn is read`);
    // The chapter rows of every subject add up to the same number.
    let rows = 0;
    for (const subject of ['accountancy', 'business_studies', 'economics', 'english']) {
      const body = (await call('/api/learn/subject', { query: { subject } })).body;
      rows += body.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).reduce((s, r) => s + r.due, 0);
    }
    assert.equal(rows, badge, `${plan}: chapter rows ${rows}`);
    // M5: the subject rows' own due counts add up to the badge the shell draws under Learn v2, and the shelf's count is its own subject's.
    const by = shelves.body.due.bySubject;
    assert.deepEqual(Object.keys(by).sort(), ['accountancy', 'business_studies', 'economics', 'english'], `${plan}: every subject has a count`);
    assert.equal(Object.values(by).reduce((s, n) => s + n, 0), badge, `${plan}: subject rows ${JSON.stringify(by)} add up to the badge ${badge}`);
    assert.equal(by.accountancy, shelves.body.due.count);
    assert.equal(shelves.body.missed.days, 7);
  }
});

test('E1: Learn shows the re-tiered Must-know (about one card in four)', async () => {
  const call = student('pro');
  const cards = (await call('/api/learn/cards', { query: { chapter: PF, filter: 'all' } })).body;
  assert.deepEqual([cards.counts.total, cards.counts.must], [45, 12]);
  const shelves = (await call('/api/learn/shelves', { query: { subject: 'accountancy' } })).body;
  assert.deepEqual([shelves.must.count, shelves.must.chapters], [236, 14]); // data/keycards/tiers.json, as live
  const preview = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [] } })).body;
  assert.match(preview.recap.label, /^Or a quick recap: the 12 Must-know lines, about \d min$/);
  assert.equal(preview.shelf.cards.mustKnow, 12);
  const deck = (await call('/api/keycards/deck', { query: { chapter: PF } })).body;
  assert.equal(deck.counts.mustKnow, 12, 'Key cards marks the same quarter');
});

test('E5 and C4: the chapter page piles and title block', async () => {
  const call = student('pro');
  const p10 = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [] } })).body;
  const m = p10.piles.find((p) => p.id === 'mistakes');
  assert.deepEqual([m.count, m.of, m.minutesLabel], [2, 3, '2 of 3, about 2 min']);
  assert.equal(p10.chapter.title, 'Accounting for Partnership: Basic Concepts');
  assert.equal(p10.chapter.unitTitle, null, 'the unit repeats the start of the title');
  const aop = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: AOP, minutes: 10, leaveOut: [] } })).body;
  assert.ok(aop.chapter.unitTitle === null || !aop.chapter.title.toLowerCase().startsWith(aop.chapter.unitTitle.toLowerCase()));
  // The seeded mistakes are short questions (E3): none over 60 words.
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [], kind: 'mix' } })).body;
  for (const x of run.items.filter((i) => i.origin === 'mistake')) assert.ok(x.question.body.split(/\s+/).length <= 60);
});

test('H4: no slashes in subject or chapter names', async () => {
  const call = student('pro');
  const eco = (await call('/api/learn/subject', { query: { subject: 'economics' } })).body;
  assert.equal(eco.subject.name, 'Economics');
  assert.ok(eco.subjects.every((s) => !s.name.includes('/')));
  const acc = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const titles = acc.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).map((r) => r.title);
  assert.ok(titles.includes('Retirement and Death of a Partner'));
  assert.ok(titles.every((t) => !t.includes('/')));
});

// ---------------------------------------------------------------- BUILD-1101 B7: the server fields the UI needs (packet S3)

test('B7 1 and 9: a run body names its chapter whole (key, title, ref, partTitle, number); a missing chapter is 404 CHAPTER_NOT_FOUND', async () => {
  const call = student('pro');
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 5, kind: 'feed', requestKey: 'b7-preview-0001' } })).body;
  assert.deepEqual(run.chapter, { key: PF, title: 'Accounting for Partnership: Basic Concepts', ref: 'Ch 1', partTitle: 'Part 1, Partnership Accounts', number: 1, place: { n: 1, of: 14 } });
  const out = await call('/api/learn/runs', { method: 'POST', body: { chapterKey: 'accountancy.not-a-chapter', minutes: 5, kind: 'feed', requestKey: 'b7-preview-0002' } });
  assert.deepEqual([out.http, out.body.error], [404, 'CHAPTER_NOT_FOUND']);
});

test('B7 4: covers carry name, refLine, resume, studentLine without due counts, history and the first-in-the-syllabus reason', async () => {
  const pro = (await student('pro')('/api/learn/covers', { query: { subject: 'accountancy' } })).body;
  assert.equal(pro.history, true);
  const pf = pro.covers.find((c) => c.key === PF);
  assert.deepEqual([pf.name, pf.refLine, pf.number, pf.ref], ['Partnership Fundamentals', 'Part 1, Ch 1', 1, 'Ch 1']);
  assert.ok(pro.covers.every((c) => !/\bdue\b/.test(c.studentLine)), 'no due counts in the line');
  assert.ok(pro.covers.some((c) => c.refLine && /^Part 2, Ch \d+$/.test(c.refLine)));
  const fresh = (await student('pro', 'new')('/api/learn/covers', { query: { subject: 'accountancy' } })).body;
  assert.equal(fresh.history, false);
  assert.deepEqual([fresh.covers[0].forYou, fresh.covers[0].reason], [true, 'First in the syllabus']);
  assert.ok(fresh.covers.every((c) => c.studentLine === 'New to you'));
  // The hook is the first card of the 10-minute feed, so the feed that follows opens with it.
  const call = student('pro');
  const covers = (await call('/api/learn/covers', { query: { subject: 'accountancy' } })).body;
  const lead = covers.covers[0];
  const feed = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: lead.key, minutes: 10, kind: 'feed', requestKey: 'b7-preview-0003', source: 'explore_cover', forYou: true, position: 0 } })).body;
  assert.equal(feed.items[0].card.id, lead.hook.id);
});

test('B7 5: the chapter dry run says which chapter "add next" adds, which piles Free holds, the unfinished run and the first visit', async () => {
  const pro = student('pro');
  const aop = (await pro('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: AOP, minutes: 10, leaveOut: [] } })).body;
  assert.deepEqual([aop.resume.done, aop.resume.of, aop.resume.kind], [6, 16, 'mix']);
  assert.ok(aop.resume.runId && aop.resume.minutesLeft >= 1);
  assert.equal(aop.firstVisit, false);
  assert.ok(aop.piles.every((p) => p.held === null), 'Pro holds nothing back');
  const pf = (await pro('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [] } })).body;
  assert.equal(pf.resume, null);
  const newbie = (await student('pro', 'new')('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [] } })).body;
  assert.equal(newbie.firstVisit, true);
  // Free: the add-next row says its chapter; after the day's session is used, Questions and Mistakes are held for tomorrow.
  const free = student('free');
  const short = (await free('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: ['questions'] } })).body;
  assert.match(short.shrink.addNext.ref, /^Ch \d+$/);
  assert.deepEqual(short.piles.map((p) => p.held), short.piles.map(() => null));
  const feed = (await free('/api/learn/runs', { method: 'POST', body: { chapterKey: AOP, minutes: 10, kind: 'feed', requestKey: 'b7-preview-0004' } })).body;
  const q = feed.items.find((i) => i.type === 'question');
  assert.equal((await free(`/api/learn/runs/${feed.id}/answer`, { method: 'POST', body: { itemId: q.id, choice: 'A' } })).http, 200);
  const after = (await free('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 10, leaveOut: [] } })).body;
  const held = Object.fromEntries(after.piles.map((p) => [p.id, p.held]));
  assert.deepEqual([held.cards, held.questions, held.mistakes], [null, 'free', 'free']);
  assert.equal(after.free.text, "That was today's free session, so this one is Key cards only. Questions come back tomorrow.");
});

test('B7 8: a student with no history gets "Chapter 1 as a feed" as the third suggestion', async () => {
  const body = (await student('free', 'new')('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const third = body.suggestions[2];
  assert.deepEqual([third.kind, third.title, third.headline, third.evidence, third.action.label], ['feed', 'Chapter 1 as a feed', 'As a feed', 'One card or question at a time, 10 minutes.', 'Open the feed']);
  assert.equal(third.action.href, `/explore/run?chapter=${PF}&min=10`);
});

// ---------------------------------------------------------------- R4 ruling N on the real decks (owner-eye#2, ui-correctness#13)

test('R4 ruling N: every Accountancy chapter has one place, 1 to 14 in roadmap order; three chapters sharing NCERT "Ch 2" get three places', async () => {
  const call = student('pro', 'new');
  const home = (await call('/api/learn/home', { query: { subject: 'accountancy' } })).body;
  const rows = home.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).filter((r) => r.place);
  assert.equal(rows.length, home.subject.chapters, 'of is the playable count the subject line shows');
  assert.deepEqual(rows.map((r) => r.place), rows.map((_, i) => ({ n: i + 1, of: home.subject.chapters })));
  const ch2 = rows.filter((r) => r.ref === 'Ch 2');
  assert.ok(ch2.length >= 2, 'the NCERT number repeats across the two books');
  assert.equal(new Set(ch2.map((r) => r.place.n)).size, ch2.length, 'never one label for different chapters');
  assert.deepEqual(home.roadmap.chapter.place, rows.find((r) => r.key === home.roadmap.chapter.key).place, 'the offer and the rows agree');
  const covers = (await call('/api/learn/covers', { query: { subject: 'accountancy' } })).body.covers;
  for (const c of covers) assert.deepEqual(c.place, rows.find((r) => r.key === c.key).place, c.key);
  const preview = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: AOP, minutes: 10 } })).body;
  assert.deepEqual(preview.chapter.place, rows.find((r) => r.key === AOP).place);
  assert.equal(preview.chapter.ref, rows.find((r) => r.key === AOP).ref, 'ref stays, for source lines only');
});
