// Learn v2 preview routes (src/lib/server/learnPreview.js through keycardsPreview.js): every /api/learn/ route answers the
// contract's shape for both plans, the seeded commerce history is what the spec says, answer keys stay on the server until
// an answer, and ratings go through the real Key cards service (FSRS stamps, the Free allowance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { previewAnswer } from '../../src/lib/server/keycardsPreview.js';

const KEYS = Object.fromEntries(JSON.parse(readFileSync(path.join(process.cwd(), 'data/fixtures/learn-preview-questions.json'), 'utf8')).questions.map((q) => [q.id, q.correct_answer]));
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
  assert.equal(body.subject.cards, 868);
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
  assert.equal(body.freeNote, 'Free opens 5 cards in every chapter. Pro opens all 868.');
  assert.deepEqual(body.suggestions.map((s) => s.kind), ['start', 'level', 'search']);
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
  assert.deepEqual(p20.piles.find((p) => p.id === 'lesson'), { id: 'lesson', count: 1, minutes: 7, label: 'Lesson', minutesLabel: '7 min', left: false });
  const free = student('free');
  const f20 = (await free('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: [] } })).body;
  assert.equal(f20.piles.find((p) => p.id === 'cards').count, 5);
  assert.ok(f20.shrink && f20.shrink.minutes < 20);
  assert.equal(f20.startLabel, `Start ${f20.shrink.minutes} minutes`);
  assert.equal(f20.shrink.addNext.key, 'accountancy.profit-and-loss-appropriation-account');
  assert.equal(f20.free.text, "Free opens 5 of this chapter's 46 cards.");
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
  assert.match(got.stamp, /^Back (Mon|Tue|Wed|Thu|Fri|Sat|Sun|tomorrow|later today|in \d+ days)$/);
  assert.equal(got.revisePile.count, 1);
  // Missed: back later in this run, 3 items on.
  const second = items.findIndex((i, k) => k > 0 && i.type === 'card');
  const missed = (await call(`/api/learn/runs/${run.id}/rate`, { method: 'POST', body: { itemId: items[second].id, rating: 1 } })).body;
  assert.equal(missed.stamp, 'Back later in this run');
  assert.equal(missed.reinsert.at, second + 3);
  assert.equal(missed.reinsert.item.stage, 'again');
  // The first mistake answered right: fixed, with the line collapsed under it.
  const right = (await call(`/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: mistakes[0].id, choice: KEYS[mistakes[0].question.id] } })).body;
  assert.deepEqual([right.correct, right.fixed, right.fixedText], [true, true, 'Fixed. You missed this in Mock 3 on 16 Oct.']);
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
  assert.equal(end.options.length, 3);
  // The fixed mistake is no longer open on the subject map.
  const subject = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const pf = subject.parts.flatMap((p) => p.units.flatMap((u) => u.chapters)).find((r) => r.key === PF);
  assert.equal(pf.mistakes, 2, '3 open, 1 fixed, the wrong retry stays open');
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
    assert.deepEqual(Object.keys(cards.counts), ['total', 'all', 'must', 'revise', 'missed']);
    assert.equal(cards.counts.total, 46);
    assert.ok(cards.sections.length >= 2 && cards.sections.every((s) => s.title && s.cards.length));
    for (const c of cards.sections.flatMap((s) => s.cards)) assert.deepEqual([typeof c.inRevise, typeof c.missedLately, c.locked], ['boolean', 'boolean', false]);
    if (plan === 'free') {
      assert.equal(cards.counts.all, 5);
      assert.equal(cards.lockedLine, '41 more cards in this chapter. Pro opens every card in every chapter and keeps them on a schedule.');
    } else {
      assert.equal(cards.counts.all, 46);
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
  const before = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: [] } })).body;
  assert.ok(before.shrink.addNext);
  const after = (await call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: [], addNext: true } })).body;
  assert.deepEqual(after.added, { key: before.shrink.addNext.key, title: before.shrink.addNext.title });
  assert.ok(after.piles.find((p) => p.id === 'cards').count > before.piles.find((p) => p.id === 'cards').count);
  const run = (await call('/api/learn/runs', { method: 'POST', body: { chapterKey: PF, minutes: 20, leaveOut: [], kind: 'mix', addNext: true } })).body;
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
    assert.equal(shelves.body.missed.days, 7);
  }
});

test('E1: Learn shows the re-tiered Must-know (about one card in four)', async () => {
  const call = student('pro');
  const cards = (await call('/api/learn/cards', { query: { chapter: PF, filter: 'all' } })).body;
  assert.deepEqual([cards.counts.total, cards.counts.must], [46, 12]);
  const shelves = (await call('/api/learn/shelves', { query: { subject: 'accountancy' } })).body;
  assert.deepEqual([shelves.must.count, shelves.must.chapters], [225, 14]);
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
