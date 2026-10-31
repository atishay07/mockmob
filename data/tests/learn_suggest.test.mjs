// Learn v2 suggestions (data/learn/suggest.js, DESIGN-SPEC.md A7, BUILD-1101 1.8 R9): always three, of three different kinds,
// each with one line of evidence and an action that starts at once; never a recap of an unseen chapter; they do what they say
// (A5 section 4 item 12). Plus the session end's options.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SUGGESTION_KINDS, CARDS_ONLY_TODAY, suggestions, endOptions, fixMinutes, cardRunMinutes, recapMinutes, levelMinutes } from '../learn/suggest.js';
import { composeRun, minutesFor } from '../learn/compose.js';
import { cardSeconds, cardWords } from '../learn/seconds.js';
import { schedule } from '../keycards.js';

const ACC = { id: 'accountancy', name: 'Accountancy', cards: 868 };
const row = (o) => ({ cards: 40, mustKnow: 12, due: 0, mistakes: 0, questions: 5, studied: false, lastActivityAt: null, book: 'Accountancy Part 1', ...o });
const BOOK = [
  row({ key: 'accountancy.partnership-fundamentals', title: 'Accounting for Partnership: Basic Concepts', chapterNo: 1, cards: 46, questions: 10 }),
  row({ key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account', chapterNo: 1, cards: 42, questions: 1 }),
  row({ key: 'accountancy.change-in-profit-sharing-ratio', title: 'Change in Profit Sharing Ratio', chapterNo: 2, cards: 8, questions: 7 }),
  row({ key: 'accountancy.admission-of-partner', title: 'Admission of a Partner', chapterNo: 2, cards: 53, questions: 10 }),
  row({ key: 'accountancy.accounting-ratios', title: 'Accounting Ratios', chapterNo: 5, book: 'Accountancy Part 2', cards: 164, questions: 0 }),
];
const RETURNING = BOOK.map((r) => ({
  ...r,
  ...(r.key === 'accountancy.partnership-fundamentals' ? { due: 3, mistakes: 3, studied: true, lastActivityAt: 2, mistakeWhere: 'Mock 3', mistakeWhen: '16 Oct' } : {}),
  ...(r.key === 'accountancy.admission-of-partner' ? { mistakes: 2, studied: true, lastActivityAt: 3 } : {}),
  ...(r.key === 'accountancy.accounting-ratios' ? { due: 5, studied: true, lastActivityAt: 1 } : {}),
}));
const PICKUP = { id: 'lr-1', chapterKey: 'accountancy.admission-of-partner', title: 'Admission of a Partner', done: 6, of: 16, minutesLeft: 4, kind: 'mix', leaveOut: [] };

function checkThree(list, label, rows) {
  assert.equal(list.length, 3, `${label}: three suggestions`);
  assert.equal(new Set(list.map((s) => s.kind)).size, 3, `${label}: three different kinds ${list.map((s) => s.kind)}`);
  for (const s of list) {
    assert.ok(SUGGESTION_KINDS.includes(s.kind), `${label}: kind ${s.kind}`);
    assert.ok(s.title && typeof s.title === 'string');
    assert.ok(s.evidence && !s.evidence.includes('\n'), `${label}: one evidence line`);
    assert.ok(s.action?.label);
    assert.ok(s.action.run || s.action.href, `${label}: ${s.kind} starts at once`);
    if (s.action.run) assert.ok(s.action.run.minutes >= 1 && ['mix', 'cards', 'recap', 'level', 'feed'].includes(s.action.run.kind));
    for (const text of [s.title, s.evidence, s.action.label]) assert.ok(!/·|!|→/.test(text), `${label}: copy rules in "${text}"`);
    if (s.kind === 'recap') assert.ok(rows.find((r) => r.key === s.chapterKey)?.studied, `${label}: recap of an unseen chapter`);
  }
}

test('a new student: Start with the first chapter, Find your level, Search any card (A7 copy)', () => {
  const list = suggestions({ subject: ACC, isNew: true, chapters: BOOK, level: { questions: 11 } });
  checkThree(list, 'new', BOOK);
  assert.deepEqual(list.map((s) => s.kind), ['start', 'level', 'search']);
  assert.equal(list[0].title, 'Start with Accounting for Partnership: Basic Concepts');
  assert.equal(list[0].evidence, 'Chapter 1 of your Accountancy book. 10 minutes of its Key cards and questions.');
  assert.equal(list[0].action.label, 'Start 10 minutes');
  assert.deepEqual(list[0].action.run, { chapterKey: 'accountancy.partnership-fundamentals', minutes: 10, leaveOut: [], kind: 'mix' });
  assert.equal(list[1].title, 'Find your level');
  assert.equal(list[1].evidence, '6 questions from your first chapters, about 6 minutes.');
  assert.equal(list[2].title, 'Search any card');
  assert.equal(list[2].evidence, '868 Accountancy cards, by term or line.');
  assert.equal(list[2].action.go, 'find');
});

test('a returning Pro student: pick up, due, fix, each naming its reason; due and fix runs hold only what they name (R9.2, R9.3)', () => {
  const rows = RETURNING.map((r) => (r.key === 'accountancy.accounting-ratios' ? { ...r, dueIds: ['d1', 'd2', 'd3', 'd4', 'd5'] } : r));
  const list = suggestions({ subject: ACC, chapters: rows, run: PICKUP, level: { questions: 4 } });
  checkThree(list, 'returning', rows);
  assert.deepEqual(list.map((s) => s.kind), ['pickup', 'due', 'fix']);
  assert.equal(list[0].evidence, 'You stopped at 6 of 16. About 4 minutes left.');
  assert.equal(list[0].action.label, 'Pick up, 4 minutes');
  assert.equal(list[0].action.run.resume, 'lr-1');
  assert.equal(list[1].chapterKey, 'accountancy.accounting-ratios', 'the chapter with the most due cards');
  assert.equal(list[1].title, '5 cards due in Accounting Ratios');
  assert.deepEqual(list[1].action.run, { chapterKey: 'accountancy.accounting-ratios', minutes: cardRunMinutes(5), leaveOut: ['questions', 'mistakes', 'lesson'], kind: 'cards', cardIds: ['d1', 'd2', 'd3', 'd4', 'd5'] }, 'only the due cards');
  assert.equal(list[1].evidence, `Due today, about ${cardRunMinutes(5)} minute${cardRunMinutes(5) === 1 ? '' : 's'}.`);
  assert.equal(list[2].title, '3 open mistakes in Accounting for Partnership: Basic Concepts');
  assert.equal(list[2].evidence, 'From Mock 3 on 16 Oct, with the lines you needed.');
  assert.deepEqual(list[2].action.run.leaveOut, ['questions', 'cards', 'lesson'], 'only the mistakes');
  assert.equal(list[2].action.label, `Fix them, about ${fixMinutes(3)} minutes`);
  assert.equal(list[2].action.run.minutes, fixMinutes(3));
});

test('R9.1: no chapter is named twice while another qualifies', () => {
  // Partnership Fundamentals and Accounting Ratios both have 3 due; only Partnership Fundamentals has mistakes.
  const rows = BOOK.map((r) => ({
    ...r,
    ...(r.key === 'accountancy.partnership-fundamentals' ? { due: 3, mistakes: 3, studied: true, lastActivityAt: 2 } : {}),
    ...(r.key === 'accountancy.accounting-ratios' ? { due: 3, studied: true, lastActivityAt: 1 } : {}),
  }));
  const list = suggestions({ subject: ACC, chapters: rows, run: PICKUP });
  const due = list.find((s) => s.kind === 'due');
  const fix = list.find((s) => s.kind === 'fix');
  assert.equal(fix.chapterKey, 'accountancy.partnership-fundamentals');
  assert.equal(due.chapterKey, 'accountancy.accounting-ratios', 'the due run goes to the other chapter');
  // Only one chapter qualifies for both: it may be named twice.
  const one = suggestions({ subject: ACC, chapters: rows.map((r) => (r.key === 'accountancy.accounting-ratios' ? { ...r, due: 0 } : r)), run: PICKUP });
  assert.equal(one.find((s) => s.kind === 'due').chapterKey, one.find((s) => s.kind === 'fix').chapterKey);
});

test('R9.4: "next" is the first unstarted chapter after the latest Learn activity, else the first unstarted one', () => {
  const rows = BOOK.map((r, i) => ({ ...r, state: i === 3 ? 'getting_there' : i === 0 ? 'thin' : 'none', studied: i === 0 || i === 3, lastActivityAt: i === 0 ? 9 : i === 3 ? 5 : null }));
  // Latest activity: chapter 1 (index 0) at 9; the first unstarted after it is index 1, not after the furthest studied one.
  assert.equal(suggestions({ subject: ACC, chapters: rows }).find((s) => s.kind === 'next').chapterKey, BOOK[1].key);
  const late = rows.map((r, i) => ({ ...r, lastActivityAt: i === 3 ? 20 : r.lastActivityAt }));
  assert.equal(suggestions({ subject: ACC, chapters: late }).find((s) => s.kind === 'next').chapterKey, BOOK[4].key);
  const lastStudied = late.map((r, i) => (i === 4 ? { ...r, state: 'thin', studied: true, lastActivityAt: 30 } : r));
  assert.equal(suggestions({ subject: ACC, chapters: lastStudied }).find((s) => s.kind === 'next').chapterKey, BOOK[1].key, 'none after it: the first unstarted');
});

test('R9.6: Free with today\'s session used: a suggestion that would serve questions says "Key cards only today"', () => {
  const list = suggestions({ subject: ACC, chapters: RETURNING, run: PICKUP, isPro: false, sessionUsed: true, sessionRunId: 'other' });
  for (const s of list) {
    const counted = s.action.run && ['mix', 'feed'].includes(s.action.run.kind);
    if (counted) assert.ok(s.evidence.startsWith(CARDS_ONLY_TODAY), `${s.kind}: ${s.evidence}`);
    else assert.ok(!s.evidence.includes(CARDS_ONLY_TODAY), s.kind);
  }
  const own = suggestions({ subject: ACC, chapters: RETURNING, run: PICKUP, isPro: false, sessionUsed: true, sessionRunId: 'lr-1' });
  assert.equal(own[0].evidence, 'You stopped at 6 of 16. About 4 minutes left.', 'the run holding the day is free to finish');
  const next = suggestions({ subject: ACC, chapters: RETURNING, isPro: false, sessionUsed: true });
  assert.equal(next[0].kind, 'next');
  assert.equal(next[0].evidence, `${CARDS_ONLY_TODAY} Chapter 1 of Accountancy Part 1.`);
  assert.deepEqual(suggestions({ subject: ACC, chapters: RETURNING, run: PICKUP, isPro: true, sessionUsed: true }).map((s) => s.evidence), suggestions({ subject: ACC, chapters: RETURNING, run: PICKUP }).map((s) => s.evidence), 'Pro: never');
});

// A5 section 4 item 12: one minutes figure on every screen.
test('one minutes function: a recap of 24 cards says the same minutes on Learn home and the chapter page; due and fix runs too', () => {
  const deck = JSON.parse(readFileSync(path.join(process.cwd(), 'data/keycards/decks/accountancy.json'), 'utf8')).cards;
  const must = deck.filter((c) => c.chapterKey === 'accountancy.admission-of-partner' && c.importance === 'must').slice(0, 24);
  assert.equal(must.length, 24);
  const recap = composeRun({ kind: 'recap', cards: must, now: 0 });
  const secs = must.reduce((s, c) => s + cardSeconds({ recap: true, words: cardWords(c) }), 0);
  assert.equal(recapMinutes(24, secs), recap.realMinutes);
  const row = { key: 'accountancy.admission-of-partner', title: 'Admission of a Partner', cards: 53, mustKnow: 24, questions: 10, studied: true, lastActivityAt: 1, recapSeconds: secs, due: 0, mistakes: 0 };
  const rc = suggestions({ subject: ACC, chapters: [row] }).find((s) => s.kind === 'recap');
  assert.equal(rc.action.run.minutes, recap.realMinutes);
  assert.match(rc.evidence, new RegExp(`about ${recap.realMinutes} minute`));
  // A due run: the minutes of the cards-only run it starts.
  const now = Date.parse('2026-11-01T10:00:00+05:30');
  const due = must.slice(0, 9);
  const states = new Map(due.map((c) => { const s = schedule(null, 3, now - 6 * 86_400_000); return [c.id, { card_id: c.id, reps: s.reps, due_at: s.due_at }]; }));
  const run = composeRun({ kind: 'cards', cardIds: due.map((c) => c.id), cards: must, states, now });
  const dueSecs = due.reduce((s, c) => s + cardSeconds({ stage: 'due', words: cardWords(c) }), 0);
  assert.equal(cardRunMinutes(9, dueSecs), run.realMinutes);
  assert.ok(run.items.every((i) => i.stage === 'due'));
  assert.equal(levelMinutes(6), 6);
});

test('returning with no unfinished run: the next chapter in book order leads', () => {
  const list = suggestions({ subject: ACC, chapters: RETURNING, level: { questions: 4 } });
  checkThree(list, 'no run', RETURNING);
  assert.equal(list[0].kind, 'next');
  assert.equal(list[0].chapterKey, 'accountancy.profit-and-loss-appropriation-account');
  assert.match(list[0].title, /^Next in the book: /);
});

test('Free returning: the same three kinds rule, never a recap of an unseen chapter', () => {
  const free = RETURNING.map((r) => ({ ...r, mustKnow: Math.min(5, r.mustKnow), due: Math.min(r.due, 2), mistakes: 0 }));
  const list = suggestions({ subject: ACC, chapters: free, level: { questions: 0 } });
  checkThree(list, 'free', free);
  assert.ok(list.some((s) => s.kind === 'recap'));
  const recap = list.find((s) => s.kind === 'recap');
  assert.equal(recap.evidence, `Its 5 Must-know lines, about ${recapMinutes(5)} minute${recapMinutes(5) === 1 ? '' : 's'}.`);
});

test('a thin subject (English, two chapters with cards, no questions) still gets three different kinds', () => {
  const english = [
    row({ key: 'english.correct-word-usage', title: 'Choosing the Correct Word', chapterNo: null, book: null, cards: 120, questions: 0 }),
    row({ key: 'english.vocabulary', title: 'Synonyms and Antonyms', chapterNo: null, book: null, cards: 229, questions: 0 }),
  ];
  const fresh = suggestions({ subject: { id: 'english', name: 'English', cards: 349 }, isNew: true, chapters: english, level: { questions: 0 } });
  checkThree(fresh, 'thin new', english);
  assert.equal(fresh[0].evidence, '10 minutes of its Key cards.');
  const studied = english.map((r, i) => ({ ...r, studied: i === 0 }));
  checkThree(suggestions({ subject: { id: 'english', name: 'English', cards: 349 }, chapters: studied, level: { questions: 0 } }), 'thin returning', studied);
  const one = [english[0]];
  checkThree(suggestions({ subject: { id: 'english', name: 'English', cards: 120 }, isNew: true, chapters: one }), 'one chapter', one);
});

test('every fixture gives three distinct kinds across lengths and plans', () => {
  for (const isNew of [true, false]) {
    for (const minutes of [5, 10, 20]) {
      for (const run of [null, PICKUP]) {
        for (const rows of [BOOK, RETURNING, RETURNING.slice(0, 1)]) {
          const list = suggestions({ subject: ACC, isNew, chapters: rows, run: isNew ? null : run, minutes, level: { questions: 6 } });
          checkThree(list, `${isNew}/${minutes}/${Boolean(run)}/${rows.length}`, rows);
        }
      }
    }
  }
});

test('the minutes helpers are compose.minutesFor over the items\' seconds', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => fixMinutes(n)), [1, 2, 3, 4, 6]);
  assert.equal(fixMinutes(3), minutesFor(180));
  assert.equal(fixMinutes(2, 200), minutesFor(200), 'the caller\'s own seconds win');
  assert.equal(cardRunMinutes(3), 1);
  assert.equal(cardRunMinutes(10), minutesFor(120));
  assert.equal(recapMinutes(12), 2);
});

test('session end: next chapter leads unless 3 or more cards were missed; "Another 5 minutes here" says the real 5-minute run', () => {
  const base = { subject: 'accountancy', chapter: { key: 'accountancy.partnership-fundamentals', title: 'Accounting for Partnership: Basic Concepts', name: 'Partnership Fundamentals' }, minutes: 10, fresh: 3, next: { key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account' }, mustKnow: 12 };
  const calm = endOptions({ ...base, missed: 2, here: { cards: 10, questions: 2 }, mistakeElsewhere: { key: 'accountancy.change-in-profit-sharing-ratio', title: 'Change in Profit Sharing Ratio', count: 1 } });
  assert.equal(calm.lead.label, 'Next: Profit and Loss Appropriation Account, 10 minutes');
  assert.equal(calm.options.length, 3);
  assert.equal(calm.options[0].label, 'Another 5 minutes here');
  assert.equal(calm.options[0].evidence, '10 Key cards and 2 questions');
  assert.equal(calm.options[1].label, 'Fix your last open mistake');
  assert.equal(calm.options[1].evidence, `Change in Profit Sharing Ratio, ${fixMinutes(1)} min`);
  assert.deepEqual(calm.options[1].run.leaveOut, ['questions', 'cards', 'lesson'], 'a fix run holds only mistakes');
  assert.equal(calm.options[2].label, 'Test it in a full mock');
  assert.match(calm.options[2].href, /mode=full/);
  const shaky = endOptions({ ...base, missed: 4, due: { count: 6 } });
  assert.equal(shaky.lead.label, 'Another 5 minutes here');
  assert.equal(shaky.lead.evidence, '4 missed cards, 3 new ones', 'without the dry run, the counts it knows');
  assert.equal(shaky.options[0].label, 'Next: Profit and Loss Appropriation Account, 10 minutes');
  assert.equal(shaky.options[1].label, `Revise 6 due cards, ${cardRunMinutes(6)} min`);
  const quiet = endOptions({ ...base, missed: 0, fresh: 0 });
  assert.equal(quiet.options[1].label, `Quick recap of this chapter, ${recapMinutes(12)} min`);
  for (const o of [calm.lead, ...calm.options, shaky.lead, ...shaky.options]) assert.ok(o.run || o.href);
  // Free after the day's session: the line leads with See Pro; nothing serves questions.
  const free = endOptions({ ...base, missed: 0, due: { count: 2 }, freeSessionUsed: true });
  assert.deepEqual([free.lead.label, free.lead.href], ['See Pro', '/pricing']);
  assert.match(free.lead.line, /^Your free Learn session for today is done\./);
  assert.ok(free.options.every((o) => !(o.run && ['mix', 'feed'].includes(o.run.kind))));
  assert.ok(free.options.some((o) => o.go === 'explore' && o.href.includes('chapter=Partnership+Fundamentals')));
});

// ---------------------------------------------------------------- parity through the routes (the preview runs createLearn)

test('routes: the seeded student\'s suggestions name three chapters, and each run does what its suggestion says', async () => {
  const { previewAnswer } = await import('../../src/lib/server/keycardsPreview.js');
  const session = `learn-suggest-parity-${Date.now()}`;
  const call = async (to, { method = 'GET', body = null, query = {} } = {}) => {
    const u = new URL('http://localhost/preview/arena/realdeck');
    for (const [k, v] of Object.entries({ _to: to, _plan: 'pro', _student: 'commerce', _s: session, ...query })) u.searchParams.set(k, v);
    return previewAnswer(new Request(u, { method, body: body ? JSON.stringify(body) : undefined }));
  };
  const home = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const keys = home.suggestions.map((s) => s.chapterKey).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, `no chapter named twice: ${keys}`);
  const due = home.suggestions.find((s) => s.kind === 'due');
  assert.ok(due, 'a due suggestion');
  const dueRun = (await call('/api/learn/runs', { method: 'POST', body: due.action.run })).body;
  assert.ok(dueRun.items.length > 0 && dueRun.items.every((i) => i.type === 'card' && i.stage === 'due'), 'a due run holds only due cards');
  assert.equal(dueRun.items.length, Number(due.title.match(/^(\d+)/)[1]));
  assert.match(due.evidence, new RegExp(`about ${minutesFor(dueRun.items.reduce((s, i) => s + i.seconds, 0))} minute`), 'one minutes figure');
  const fix = home.suggestions.find((s) => s.kind === 'fix');
  if (fix) {
    const fixRun = (await call('/api/learn/runs', { method: 'POST', body: fix.action.run })).body;
    assert.ok(fixRun.items.length > 0 && fixRun.items.every((i) => i.type === 'question' && i.origin === 'mistake'), 'a fix run holds only mistakes');
  }
});

test('routes: the level run\'s end names the chapter to start, the lowest score among its questions\' chapters (R16)', async () => {
  const { previewAnswer } = await import('../../src/lib/server/keycardsPreview.js');
  const session = `learn-suggest-level-${Date.now()}`;
  const call = async (to, { method = 'GET', body = null, query = {} } = {}) => {
    const u = new URL('http://localhost/preview/arena/realdeck');
    for (const [k, v] of Object.entries({ _to: to, _plan: 'pro', _student: 'new', _s: session, ...query })) u.searchParams.set(k, v);
    return previewAnswer(new Request(u, { method, body: body ? JSON.stringify(body) : undefined }));
  };
  const home = (await call('/api/learn/subject', { query: { subject: 'accountancy' } })).body;
  const level = home.suggestions.find((s) => s.kind === 'level');
  assert.ok(level);
  const run = (await call('/api/learn/runs', { method: 'POST', body: level.action.run })).body;
  assert.equal(run.items.length, 6);
  for (const item of run.items) assert.equal((await call(`/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: item.id, choice: 'A' } })).http, 200);
  const end = (await call(`/api/learn/runs/${run.id}/end`)).body;
  assert.ok(end.level?.chapterKey && end.level.title, 'the end names a chapter');
  assert.equal(end.lead.label, `Start with ${end.level.title}`);
  assert.deepEqual(end.lead.run, { kind: 'mix', chapterKey: end.level.chapterKey, minutes: 10, leaveOut: [] });
  assert.equal(end.lead.evidence, `Your lowest score here: ${end.level.right} of ${end.level.of} right.`);
});
