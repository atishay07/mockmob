// Learn v2 suggestions (data/learn/suggest.js, DESIGN-SPEC.md A7): always three, of three different kinds, each with one
// line of evidence and an action that starts at once; never a recap of an unseen chapter. Plus the session end's options.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SUGGESTION_KINDS, suggestions, endOptions, fixMinutes, cardRunMinutes, recapMinutes } from '../learn/suggest.js';

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

test('a returning Pro student: pick up, due, fix, each naming its reason', () => {
  const list = suggestions({ subject: ACC, chapters: RETURNING, run: PICKUP, level: { questions: 4 } });
  checkThree(list, 'returning', RETURNING);
  assert.deepEqual(list.map((s) => s.kind), ['pickup', 'due', 'fix']);
  assert.equal(list[0].evidence, 'You stopped at 6 of 16. About 4 minutes left.');
  assert.equal(list[0].action.label, 'Pick up, 4 minutes');
  assert.equal(list[0].action.run.resume, 'lr-1');
  assert.equal(list[1].chapterKey, 'accountancy.accounting-ratios', 'the chapter with the most due cards');
  assert.equal(list[1].title, '5 cards due in Accounting Ratios');
  assert.equal(list[1].action.run.kind, 'cards');
  assert.equal(list[1].action.run.minutes, cardRunMinutes(5));
  assert.equal(list[2].title, '3 open mistakes in Accounting for Partnership: Basic Concepts');
  assert.equal(list[2].evidence, 'From Mock 3 on 16 Oct, with the lines you needed.');
  assert.deepEqual(list[2].action.run.leaveOut, ['questions', 'lesson']);
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

test('fix lengths hold every open mistake; cards-only and recap minutes', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(fixMinutes), [5, 5, 10, 10, 20]);
  assert.equal(cardRunMinutes(3), 1);
  assert.equal(recapMinutes(12), 3);
});

test('session end: next chapter leads unless 3 or more cards were missed; then three named options', () => {
  const base = { subject: 'accountancy', chapter: { key: 'accountancy.partnership-fundamentals', title: 'Accounting for Partnership: Basic Concepts' }, minutes: 10, fresh: 3, next: { key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account' }, mustKnow: 12 };
  const calm = endOptions({ ...base, missed: 2, mistakeElsewhere: { key: 'accountancy.change-in-profit-sharing-ratio', title: 'Change in Profit Sharing Ratio', count: 1 } });
  assert.equal(calm.lead.label, 'Next: Profit and Loss Appropriation Account, 10 minutes');
  assert.equal(calm.options.length, 3);
  assert.equal(calm.options[0].label, 'Another 5 minutes here');
  assert.equal(calm.options[0].evidence, '2 missed cards, 3 new ones');
  assert.equal(calm.options[1].label, 'Fix your last open mistake');
  assert.equal(calm.options[1].evidence, 'Change in Profit Sharing Ratio, 5 min');
  assert.equal(calm.options[2].label, 'Test it in a full mock');
  assert.match(calm.options[2].href, /mode=full/);
  const shaky = endOptions({ ...base, missed: 4, due: { count: 6 } });
  assert.equal(shaky.lead.label, 'Another 5 minutes here');
  assert.equal(shaky.options[0].label, 'Next: Profit and Loss Appropriation Account, 10 minutes');
  assert.equal(shaky.options[1].label, 'Revise 6 due cards, 2 min');
  const quiet = endOptions({ ...base, missed: 0, fresh: 0 });
  assert.equal(quiet.options[1].label, 'Quick recap of this chapter, 3 min');
  for (const o of [calm.lead, ...calm.options, shaky.lead, ...shaky.options]) assert.ok(o.run || o.href);
});
