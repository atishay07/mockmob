// IA6: the Review hub and Ask Mobi (src/app/(app)/review, src/app/(app)/mentor, src/components/ai).
// The model counts from the record and never guesses; the copy follows the glossary; the badge count is the page count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHAPTERS_VISIBLE, CLEAR_COPY, EMPTY_COPY, ERROR_COPY, LATEST_REPAIRS, NOT_YET, NO_CHAPTER, OFFLINE_COPY, REPAIR_RECORD_LIMIT, REPAIR_WINDOW_DAYS,
  costLine, groupOpenMistakes, isMock, marksLine, minutesLine, mistakesHeadline, mistakesSection, modeName, oneFinding, paperTitle, pastResults,
  questionsLine, repairKey, repairLabel, repairRecordView, repairedKeys, sourceLabel, wrongAnswers,
} from '../../src/app/(app)/review/reviewModel.mjs';
import { repairFacts, repairedSet, REPAIR_WINDOW_DAYS as SERVER_WINDOW } from '../../src/lib/server/todayFacts.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';
import { reviewBadge } from '../../src/lib/navigation.js';
import { CAVEAT_PATTERNS, retiredHits, studentStrings } from '../glossary.mjs';
import { repairMinutes } from '../next_step_rules.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOW = Date.parse('2026-10-15T14:30:00.000Z');
const DAY = 86_400_000;
const USER = 'user-1';

const attempt = (id, answers, { subject = 'accountancy', mode = 'full', chapters = [], daysAgo = 1 } = {}) => ({
  id, subject, mode, completedAt: NOW - daysAgo * DAY,
  details: answers.map((isCorrect, i) => ({ qid: `${id}-q${i}`, isCorrect })),
  questionsSnapshot: answers.map((_, i) => ({ id: `${id}-q${i}`, chapter: chapters[i] ?? 'Partnership' })),
});
const row = (attemptId, qid, extra = {}) => ({ attemptId, questionId: qid, chapter: 'Partnership', subject: 'accountancy', foundAt: '2026-10-09T10:00:00.000Z', repairedAt: '2026-10-14T10:00:00.000Z', checkedState: 'not_available', ...extra });

// ---------------------------------------------------------------------------------------------
// 1. Mistakes to repair

test('groupOpenMistakes counts wrong answers only, minus the repaired, by chapter with paper numbers', () => {
  const a = attempt('a1', [false, true, false, null, false, false], { chapters: ['Partnership', 'Money and banking', 'Partnership', 'Controlling', 'Controlling', 'Partnership'] });
  const repaired = repairedKeys([row('a1', 'a1-q5')]);
  const g = groupOpenMistakes(a, repaired);
  assert.equal(g.count, 3, '4 wrong, 1 repaired; the blank is not a mistake');
  assert.deepEqual(g.chapters.map((c) => [c.chapter, c.count, c.numbers]), [['Partnership', 2, [1, 3]], ['Controlling', 1, [5]]]);
  const all = groupOpenMistakes(a);
  assert.equal(all.count, 4);
  assert.deepEqual(all.chapters.map((c) => [c.chapter, c.count]), [['Partnership', 3], ['Controlling', 1]], 'most open first, then name');
  assert.equal(all.chapters.reduce((n, c) => n + c.count, 0), all.count, 'the chapter counts add up to the headline');
});

test('groupOpenMistakes never invents a chapter or a number', () => {
  const a = { id: 'a9', details: [{ qid: 'x', isCorrect: false }, { qid: 'y', isCorrect: false }], questionsSnapshot: [{ id: 'y', chapter: '  ' }] };
  const g = groupOpenMistakes(a);
  assert.equal(g.count, 2);
  assert.equal(g.chapters.length, 1);
  assert.equal(g.chapters[0].chapter, NO_CHAPTER);
  assert.deepEqual(g.chapters[0].numbers, [1], 'only the question the paper lists has a number');
  assert.deepEqual(groupOpenMistakes(null), { attemptId: null, count: 0, chapters: [] });
});

test('the page count is the count Today and the Start sheet say (repairFacts)', () => {
  const rows = [attempt('a1', [false, false, true, false, null]), attempt('a0', [false], { subject: 'economics', daysAgo: 5 })];
  const reservations = [{ operation_key: `repair:${mistakeKey(USER, 'a1', 'a1-q1')}:r1`, updated_at: '2026-10-14T10:00:00.000Z', receipt: { repair: { ok: true } } }];
  const todays = repairFacts(rows, repairedSet({ userId: USER, reservations, attempts: rows }), NOW);
  const repairRows = [row('a1', 'a1-q1')];
  const g = groupOpenMistakes(rows[0], repairedKeys(repairRows));
  assert.equal(todays.attemptId, 'a1');
  assert.equal(g.count, todays.open, 'badge, hero and list agree');
  assert.equal(REPAIR_WINDOW_DAYS, SERVER_WINDOW);
});

test('mistakesSection: error, empty, clear, open, and open with the chapter list missing', () => {
  const paper = attempt('a1', [false, false, true]);
  const moveFacts = { repair: { attemptId: 'a1', subject: 'accountancy', mode: 'full', completedAt: '2026-10-14T10:00:00.000Z', open: 2 }, attempts: [{ id: 'a1', wrong: 2 }] };
  assert.equal(mistakesSection({ moveFacts: null, repairRows: [] }).state, 'error', 'no plan, no claim');
  assert.equal(mistakesSection({ moveFacts, repairRows: null }).state, 'error', 'an unreadable repair record is not "nothing to repair"');
  const open = mistakesSection({ moveFacts, repairRows: [], attempt: paper, attempts: moveFacts.attempts });
  assert.equal(open.state, 'open');
  assert.equal(open.count, 2);
  assert.equal(open.attemptId, 'a1');
  assert.equal(open.listFailed, false);
  const noList = mistakesSection({ moveFacts, repairRows: [], attemptFailed: true });
  assert.equal(noList.state, 'open');
  assert.equal(noList.count, 2, 'the plan still says how many');
  assert.equal(noList.listFailed, true);
  assert.deepEqual(noList.chapters, []);
  assert.equal(mistakesSection({ moveFacts, repairRows: [] }).state, 'loading-list');
  assert.equal(mistakesSection({ moveFacts: { repair: null, attempts: [{ id: 'a1', wrong: 3 }] }, repairRows: [], attempts: [{ id: 'a1', wrong: 3 }] }).state, 'clear');
  assert.equal(mistakesSection({ moveFacts: { repair: null, attempts: [] }, repairRows: [], attempts: [] }).state, 'empty');
  assert.equal(mistakesSection({ moveFacts: { repair: null, attempts: [{ id: 'a2', wrong: 0 }] }, repairRows: [], attempts: [{ id: 'a2', wrong: 0 }] }).state, 'empty', 'a perfect paper is not "all repaired"');
});

test('mistakesSection: repairs made since the plan was read fall through to clear, never to a zero-mistake card', () => {
  const paper = attempt('a1', [false]);
  const moveFacts = { repair: { attemptId: 'a1', open: 1 }, attempts: [{ id: 'a1', wrong: 1 }] };
  const section = mistakesSection({ moveFacts, repairRows: [row('a1', 'a1-q0')], attempt: paper, attempts: moveFacts.attempts });
  assert.equal(section.state, 'clear');
});

test('the Review badge is the page count, capped at 9+, and nothing at 0', () => {
  assert.equal(reviewBadge(0), null);
  assert.equal(reviewBadge(4), '4');
  assert.equal(reviewBadge(12), '9+');
  const paper = attempt('a1', Array(12).fill(false));
  const open = mistakesSection({ moveFacts: { repair: { attemptId: 'a1', open: 12 } }, repairRows: [], attempt: paper });
  assert.equal(open.count, 12, 'the page says 12 while the badge says 9+');
});

test('copy: keys, headlines and lines', () => {
  assert.equal(repairKey(1), 'Repair this one');
  assert.equal(repairKey(4), 'Repair these 4');
  assert.equal(mistakesHeadline(4, 3), '4 mistakes across 3 chapters');
  assert.equal(mistakesHeadline(1, 1), '1 mistake');
  assert.equal(mistakesHeadline(3, 1), '3 mistakes');
  assert.equal(minutesLine(4), `About ${repairMinutes(4)} minutes. You can stop after any one.`);
  assert.equal(costLine(9), '1 AI credit each. You have 9.');
  assert.equal(costLine(null), '1 AI credit each.', 'an unreadable balance is left out, never 0');
  assert.equal(costLine(0), '1 AI credit each. You have 0.', 'zero is a real balance');
  assert.equal(questionsLine([3]), 'Q3');
  assert.equal(questionsLine([3, 7]), 'Q3 and Q7');
  assert.equal(questionsLine([3, 7, 12]), 'Q3, Q7 and Q12');
  assert.equal(questionsLine([3, 7, 9, 12, 20]), 'Q3, Q7, Q9 and 2 more');
  assert.equal(questionsLine([]), '');
  assert.equal(repairLabel(new Date('2026-10-15T15:00:00.000Z')), "Tonight's repair", '8:30 PM in India');
  assert.equal(repairLabel(new Date('2026-10-15T06:00:00.000Z')), "Today's repair", '11:30 AM in India');
  assert.equal(CHAPTERS_VISIBLE, 4);
});

test('the state cards use the app words and name a way on', () => {
  assert.equal(EMPTY_COPY.title, 'Your mistakes gather here');
  assert.equal(CLEAR_COPY.title, 'Nothing waiting to repair');
  assert.match(CLEAR_COPY.body, new RegExp(`${REPAIR_WINDOW_DAYS} days`), 'the claim carries its window');
  assert.equal(ERROR_COPY.action, 'Try again');
  assert.equal(OFFLINE_COPY.title, 'You are offline');
  for (const c of [EMPTY_COPY, CLEAR_COPY, ERROR_COPY, OFFLINE_COPY]) {
    assert.ok(c.title && c.body && c.action);
    assert.doesNotMatch(`${c.title} ${c.body} ${c.action}`, /!|—/);
  }
});

// ---------------------------------------------------------------------------------------------
// 3. Past results

test('sourceLabel numbers mocks per subject, only when the list is complete', () => {
  const items = [
    { id: 'm3', subject: 'accountancy', mode: 'full', completedAt: NOW },
    { id: 'q1', subject: 'accountancy', mode: 'quick', completedAt: NOW - DAY },
    { id: 'm2', subject: 'accountancy', mode: 'nta', completedAt: NOW - 2 * DAY },
    { id: 'e1', subject: 'economics', mode: 'full', completedAt: NOW - 3 * DAY },
    { id: 'm1', subject: 'accountancy', mode: 'full', completedAt: NOW - 4 * DAY },
  ];
  assert.equal(sourceLabel(items[0], items), 'Mock 3');
  assert.equal(sourceLabel(items[2], items), 'Mock 2');
  assert.equal(sourceLabel(items[3], items), 'Mock 1', 'numbered within its own subject');
  assert.equal(sourceLabel(items[1], items), 'Quick practice');
  assert.equal(sourceLabel(items[0], items, { complete: false }), 'Full mock', 'older papers unread: no guessed number');
  assert.equal(sourceLabel(items[2], items, { complete: false }), 'NTA mode');
  assert.equal(modeName('smart'), 'Smart practice');
  assert.equal(modeName(null), 'Practice');
  assert.ok(isMock('full') && isMock('nta') && !isMock('quick'));
});

test('pastResults: one row per paper, with its marks out of the maximum and the wrong count', () => {
  const items = [
    { id: 'p1', subject: 'accountancy', mode: 'full', correct: 30, wrong: 6, unattempted: 14, total: 50, marks: 144, maxMarks: 250, completedAt: NOW - DAY },
    { id: 'p2', subject: 'economics', mode: 'quick', correct: 2, wrong: 8, unattempted: 0, total: 10, marks: -6, maxMarks: 50, completedAt: NOW - 2 * DAY },
    { id: 'p3', subject: 'english', mode: 'quick', correct: 10, wrong: 0, unattempted: 0, total: 10, marks: 50, maxMarks: 50, completedAt: NOW - 3 * DAY },
  ];
  const rows = pastResults(items);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].href, '/result/p1');
  assert.equal(rows[0].source, 'Mock 1');
  assert.equal(rows[0].subjectLabel, 'Accountancy');
  assert.equal(marksLine(rows[0]), '144 of 250');
  assert.equal(rows[0].wrongLine, '6 wrong');
  assert.equal(marksLine(rows[1]), '-6 of 50', 'a negative score keeps its sign');
  assert.equal(rows[2].wrongLine, 'No wrong answers');
  assert.match(rows[0].date, /^\d{1,2} \w{3}$/);
  assert.equal(marksLine({ marks: null, maxMarks: 50 }), '');
  assert.equal(pastResults(null).length, 0);
});

test('wrongAnswers sums only real counts', () => {
  assert.equal(wrongAnswers([{ wrong: 2 }, { wrong: '3' }, { wrong: null }, {}, { wrong: -4 }]), 5);
  assert.equal(wrongAnswers(undefined), 0);
});

test('paperTitle names the paper from the list, with its date', () => {
  const items = [{ id: 'a1', subject: 'accountancy', mode: 'full', completedAt: Date.parse('2026-10-14T10:00:00.000Z') }];
  const t = paperTitle({ attemptId: 'a1', subject: 'accountancy', mode: 'full', completedAt: '2026-10-14T10:00:00.000Z', open: 4 }, items);
  assert.deepEqual(t, { subject: 'Accountancy', source: 'Mock 1', date: '14 Oct' });
  const lone = paperTitle({ attemptId: 'zz', subject: 'economics', mode: 'quick', completedAt: '2026-10-12T10:00:00.000Z' }, []);
  assert.deepEqual(lone, { subject: 'Economics', source: 'Quick practice', date: '12 Oct' });
});

// ---------------------------------------------------------------------------------------------
// 5. Repair record

test('repairRecordView: Found, Repaired, with Checked and Holds not open yet', () => {
  const attempts = [{ id: 'a1', wrong: 5 }, { id: 'a2', wrong: 7 }];
  const rows = [row('a1', 'q1'), row('a1', 'q2'), row('a2', 'q9', { chapter: '' })];
  const v = repairRecordView({ rows, attempts, complete: true });
  assert.equal(v.found, 12);
  assert.equal(v.repaired, 3);
  assert.equal(v.repairedText, '3');
  assert.equal(v.checkedText, NOT_YET);
  assert.equal(v.holdsText, NOT_YET);
  assert.equal(v.progress, '3 of 12 repaired');
  assert.equal(v.ratio, 0.25);
  assert.equal(v.scope, 'across your 2 papers');
  assert.equal(v.latest[2].chapter, NO_CHAPTER);
  assert.match(v.latest[0].line, /^Found 9 Oct, repaired 14 Oct$/);
});

test('repairRecordView never claims a ratio it cannot back, and Checked fills only when a check exists', () => {
  const attempts = [{ id: 'a1', wrong: 2 }];
  const incomplete = repairRecordView({ rows: [row('a1', 'q1')], attempts, complete: false });
  assert.equal(incomplete.progress, null, 'older papers unread: no "x of y"');
  assert.equal(incomplete.scope, 'in your last 1 paper');
  const checked = repairRecordView({ rows: [row('a1', 'q1', { checkedState: 'passed' }), row('a1', 'q2', { checkedState: 'pending' })], attempts: [{ id: 'a1', wrong: 4 }] });
  assert.equal(checked.checked, 1);
  assert.equal(checked.checkedText, '1');
  assert.equal(checked.holdsText, NOT_YET, 'Holds has no storage yet');
  const capped = repairRecordView({ rows: Array.from({ length: REPAIR_RECORD_LIMIT }, (_, i) => row('a1', `q${i}`)), attempts: [{ id: 'a1', wrong: 400 }] });
  assert.equal(capped.repairedText, `${REPAIR_RECORD_LIMIT}+`);
  assert.equal(capped.progress, null);
  const more = repairRecordView({ rows: [row('old', 'q1'), row('old', 'q2')], attempts: [{ id: 'a1', wrong: 1 }] });
  assert.equal(more.ratio, null, 'more repaired than found in the window: say neither');
  assert.equal(repairRecordView({ rows: Array.from({ length: 9 }, (_, i) => row('a1', `q${i}`)), attempts: [{ id: 'a1', wrong: 20 }] }).latest.length, LATEST_REPAIRS);
});

test('oneFinding takes the first complete finding', () => {
  assert.equal(oneFinding([]), null);
  assert.equal(oneFinding(null), null);
  assert.deepEqual(oneFinding([{ id: 'x' }, { id: 'leak', headline: 'Partnership costs you most', detail: '6 wrong of 9 answered.', n: 9 }]), { id: 'leak', headline: 'Partnership costs you most', detail: '6 wrong of 9 answered.', n: 9 });
});

// ---------------------------------------------------------------------------------------------
// The source: words and structure

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${name}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const OWNED = [
  ...walk('src/app/(app)/review'), ...walk('src/app/(app)/mentor'), ...walk('src/app/(app)/saved'), ...walk('src/app/(app)/recovery'),
  'src/app/(app)/analytics/AnalyticsPageClient.jsx', 'src/components/RecoveryOverview.jsx', 'src/components/MistakeReplay.jsx',
  ...['MockMobAIHub', 'AssistantDrawer', 'AIMentorTerminal', 'RecordView', 'SessionReadout', 'AnswerSheet'].map((n) => `src/components/ai/${n}.jsx`),
  'src/components/ai/assistantKnowledge.js',
];

test('no retired name or caveat line in the Review and Ask Mobi sources', () => {
  const found = [];
  for (const path of OWNED) {
    const source = read(path);
    for (const hit of retiredHits(source, relative(ROOT, join(ROOT, path)).split(sep).join('/'))) found.push(`${path}: ${hit.id} | ${hit.text}`);
    for (const text of studentStrings(source)) if (CAVEAT_PATTERNS.some((p) => p.test(text))) found.push(`${path}: caveat | ${text.slice(0, 80)}`);
  }
  assert.deepEqual(found, []);
});

test('student-facing strings use no exclamation mark and no em dash', () => {
  const found = [];
  for (const path of OWNED) {
    for (const text of studentStrings(read(path))) {
      if (/—/.test(text)) found.push(`${path}: em dash | ${text.slice(0, 80)}`);
      if (/[A-Za-z]!(\s|$)/.test(text) && !/!==|!=|!\./.test(text)) found.push(`${path}: ! | ${text.slice(0, 80)}`);
    }
  }
  assert.deepEqual(found, []);
});

test('the hub publishes its count to the shell and links Ask Mobi and Your record', () => {
  const hub = read('src/app/(app)/review/ReviewHubClient.jsx');
  assert.match(hub, /publishTonightRepair/);
  assert.match(hub, /ASK_HREF/);
  assert.match(hub, /RECORD_HREF/);
  assert.equal((hub.match(/btn-volt/g) || []).length, 3, 'one filled key per state: repair, state card with a link, state card with a button (never together)');
  assert.doesNotMatch(hub, /LearningNextAction/, 'no duplicate next-step card on Review (plan 5.2)');
  assert.doesNotMatch(read('src/app/(app)/analytics/AnalyticsPageClient.jsx'), /LearningNextAction/, 'none on Your record either');
});
