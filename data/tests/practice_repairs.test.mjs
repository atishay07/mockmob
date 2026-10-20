// Practice's Repairs and Ask Mobi line (owner D5, 18 Oct): its counts agree with Your papers' "To repair" (the wrong answers,
// minus the ones holding a saved repair, F17; blanks apart, release 11), it follows the chosen subject, and Ask Mobi names the
// newest saved repair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { repairsFor, sessionsWord } from '../../src/app/(app)/dashboard/repairsLine.mjs';

const det = (spec) => spec.split('').map((c, i) => ({ qid: `q${i + 1}`, isCorrect: c === 'r' ? true : c === 'w' ? false : null, ...(c === 'w' ? { givenIndex: 0 } : {}) }));
const ATTEMPTS = [
  { id: 'a-old', subject: 'accountancy', correct: 8, total: 10, completedAt: '2026-10-10T10:00:00Z', details: det('rrrrrrrrww') },
  { id: 'a-new', subject: 'accountancy', correct: 7, total: 10, completedAt: '2026-10-17T10:00:00Z', details: det('rrwrwrrbrr') },
  { id: 'e-1', subject: 'economics', correct: 5, total: 10, completedAt: '2026-10-15T10:00:00Z', details: det('rwrwrbwrbr') },
];

test('counts follow Your papers: wrong answers, minus saved repairs, per subject; blanks apart', () => {
  const repairs = [{ attemptId: 'a-new', questionId: 'q5', subject: 'accountancy' }];
  const acc = repairsFor({ attempts: ATTEMPTS, repairs, subjectId: 'accountancy' });
  assert.equal(acc.sessions, 2);
  assert.equal(acc.open, 2 + 2 - 1); // a-old: two wrong; a-new: two wrong (and a blank, not a repair), one repaired
  assert.equal(acc.blanks, 1);
  assert.equal(acc.openElsewhere, 3);
  assert.equal(acc.saved, 1);
  assert.equal(acc.revisit.attemptId, 'a-new');
  const eco = repairsFor({ attempts: ATTEMPTS, repairs, subjectId: 'economics' });
  assert.equal(eco.open, 3);
  assert.equal(eco.blanks, 2);
  assert.equal(eco.openElsewhere, 3);
  assert.equal(acc.open + acc.openElsewhere, eco.open + eco.openElsewhere, 'both subjects add up to the same Review total');
});

test('Ask Mobi is handed only a saved repair (the panel says "the mistake you repaired"), the newest in the subject', () => {
  const none = repairsFor({ attempts: ATTEMPTS, repairs: [], subjectId: 'accountancy' });
  assert.equal(none.ask, null, 'nothing repaired yet: Ask Mobi opens on the record, never on a miss still waiting');
  const repairs = [
    { attemptId: 'a-new', questionId: 'q5', subject: 'accountancy', repairedAt: '2026-10-17T12:00:00Z' },
    { attemptId: 'e-1', questionId: 'q2', subject: 'economics', repairedAt: '2026-10-16T12:00:00Z' },
    { attemptId: 'a-old', questionId: 'q9', subject: 'accountancy', repairedAt: '2026-10-11T12:00:00Z' },
  ];
  const acc = repairsFor({ attempts: ATTEMPTS, repairs, subjectId: 'accountancy' });
  assert.deepEqual([acc.ask.ref, acc.ask.number], ['a-new:q5', 5]);
  assert.equal(acc.saved, 2);
  const eco = repairsFor({ attempts: ATTEMPTS, repairs, subjectId: 'economics' });
  assert.deepEqual([eco.ask.ref, eco.ask.number], ['e-1:q2', 2]);
  const unseen = repairsFor({ attempts: ATTEMPTS, repairs: [{ attemptId: 'gone', questionId: 'q1', subject: 'english' }], subjectId: 'english' });
  assert.deepEqual([unseen.ask.ref, unseen.ask.number], ['gone:q1', null], 'a paper outside the page still opens, without a number');
  const bad = repairsFor({ attempts: [], repairs: [{ attemptId: 'x y', questionId: 'q1', subject: 'english' }], subjectId: 'english' });
  assert.equal(bad.ask, null, 'a reference the panel would refuse is never sent');
});

test('unknown repairs (still loading or failed) never subtract, and missing details fall back to totals', () => {
  const r = repairsFor({ attempts: [{ id: 'x', subject: 'english', correct: 6, total: 10, completedAt: Date.now() }], repairs: null, subjectId: 'english' });
  assert.equal(r.open, 4);
  assert.equal(r.saved, 0);
  assert.equal(r.ask, null);
  assert.equal(repairsFor({ attempts: [], repairs: [], subjectId: 'english' }).sessions, 0);
});

test('session counts read as words up to ten', () => {
  assert.equal(sessionsWord(1), 'your one session');
  assert.equal(sessionsWord(3), 'your three sessions');
  assert.equal(sessionsWord(12), 'your 12 sessions');
});

test('Practice draws the line in the Your papers card under the setup, and its one Ask Mobi entry opens the panel about Practice', () => {
  const page = readFileSync(new URL('../../src/app/(app)/dashboard/DashboardPageClient.jsx', import.meta.url), 'utf8');
  const line = readFileSync(new URL('../../src/app/(app)/dashboard/PracticeRepairs.jsx', import.meta.url), 'utf8');
  // D126 (owner H6, 19 Oct): the ways to practise come straight after the subject; the line moved from between them into the
  // Your papers card (H7), which sits right under the setup, so it is still on the page on every visit (owner D5).
  const shelf = page.indexOf('className="pr-subjects"');
  const fix = page.indexOf('<PracticeRepairs ');
  const modes = page.indexOf('pr-step--modes');
  const papers = page.indexOf('className="pr-panel pr-door pr-door--papers"');
  assert.ok(shelf > 0 && modes > shelf && papers > modes && fix > papers, 'the modes follow the shelf; the line is in Your papers');
  assert.equal(page.match(/<PracticeRepairs /g).length, 1, 'drawn once');
  // ASK-MOBI-1018 (D5): the page's one Ask Mobi entry is this line's key, "Ask Mobi what to practise", with the record's weakest
  // chapter as its preview; the separate row the Ask Mobi branch drew under the shelf is not drawn, so there are never two.
  assert.match(line, /<AskMobiLink context=\{practiceContext\(insights\)\}/);
  assert.match(line, /\{ENTRY_LABELS\.practice\}/);
  assert.match(line, /practicePreview\(insights\)/);
  assert.doesNotMatch(line, /openAskMobi\(/, 'the entry is the shared AskMobiLink, not a second hand-rolled opener');
  assert.doesNotMatch(page, /PracticeAskRow/, 'no second Ask Mobi row on Practice');
  assert.equal(existsSync(new URL('../../src/components/ai/PracticeAskRow.jsx', import.meta.url)), false);
  assert.match(line, /\/api\/me\/repair-record\?limit=100/);
  assert.match(line, /href="\/review"|href: '\/review'/);
});
