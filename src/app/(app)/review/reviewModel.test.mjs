// Run: node --test "src/app/(app)/review/reviewModel.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES, plural, shortDate, subjectName, conceptName, sessionsFrom, recordTotals, sessionLine, sessionTag,
  stageThread, threadCaption, repairLines, rightLine, evidenceNote, checkRow, strategyName, pageState,
} from './reviewModel.mjs';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const BANNED = [/—/, /!/, /\bfixed\b/i, /\bmastered\b/i, /certif/i, /calibration/i, /episode/i, /\bArena\b/, /·/];
const clean = (text, where) => { for (const re of BANNED) assert.ok(!re.test(text), `${where}: "${text}" matches ${re}`); };

test('stage words are the app vocabulary in order (D9)', () => {
  assert.deepEqual(STAGES, ['found', 'repaired', 'checked', 'holds']);
});

test('plural and dates', () => {
  assert.equal(plural(1, 'session'), '1 session');
  assert.equal(plural(0, 'session'), '0 sessions');
  assert.equal(plural(2, 'check'), '2 checks');
  assert.equal(shortDate('2026-10-03T20:00:00Z', NOW), '4 Oct'); // 1:30 AM on 4 Oct in India
  assert.equal(shortDate('2025-12-31T10:00:00Z', NOW), '31 Dec 2025');
  assert.equal(shortDate(null, NOW), '');
  assert.equal(shortDate('not a date', NOW), '');
  assert.equal(shortDate(Date.parse('2026-01-05T10:00:00Z'), NOW), '5 Jan');
});

test('names read as words', () => {
  assert.equal(subjectName('business_studies'), 'Business Studies');
  assert.equal(subjectName('legal_studies'), 'Legal studies');
  assert.equal(subjectName(''), 'Practice');
  assert.equal(conceptName('accountancy:partnership_admission'), 'Partnership admission');
  assert.equal(strategyName('two_pass'), 'Two passes through the paper');
  assert.equal(strategyName('something_new'), 'Something new');
});

test('sessions are newest first with safe numbers', () => {
  const s = sessionsFrom([
    { id: 'a', subject: 'economics', completedAt: '2026-10-01T10:00:00Z', correct: 8, total: 10, mistakes: 2 },
    { id: 'b', subject: 'accountancy', completedAt: '2026-10-08T10:00:00Z', correct: null, total: 'x', mistakes: -1 },
    null, { subject: 'no id' },
  ]);
  assert.deepEqual(s.map((x) => x.id), ['b', 'a']);
  assert.deepEqual([s[0].correct, s[0].total, s[0].open], [0, 0, 0]);
  const t = recordTotals(s);
  assert.deepEqual(t, { sessions: 2, found: 2, questions: 10, correct: 8, lastAt: '2026-10-08T10:00:00Z', withOpen: 1 });
  assert.equal(sessionLine(s[1], NOW), '1 Oct. 8 of 10 right.');
  assert.deepEqual(sessionTag(s[1]), { tone: 'open', text: '2 to look at' });
  assert.deepEqual(sessionTag({ total: 5, open: 0 }), { tone: 'good', text: 'Nothing missed' });
  assert.deepEqual(sessionTag({ total: 0, open: 0 }), { tone: 'quiet', text: 'No questions recorded' });
  assert.deepEqual(recordTotals([]), { sessions: 0, found: 0, questions: 0, correct: 0, lastAt: null, withOpen: 0 });
});

test('the thread never shows unknown as zero, and keeps Checked and Holds closed without a source', () => {
  const totals = { found: 7, withOpen: 2 };
  const loading = stageThread({ totals, repairs: undefined });
  assert.equal(loading[1].state, 'loading');
  assert.equal(loading[1].value, '');
  assert.equal(loading[1].note, 'Reading your repairs');
  const unknown = stageThread({ totals, repairs: null });
  assert.equal(unknown[1].note, 'Your repairs could not be read just now');
  assert.equal(unknown[1].state, 'unknown');
  assert.equal(unknown[1].value, '');
  assert.equal(unknown[2].state, 'unknown');
  assert.equal(unknown[2].value, '');
  assert.equal(loading[2].state, 'loading');
  assert.equal(unknown[3].state, 'closed');
  assert.ok(!/not open yet/i.test(threadCaption(unknown).split('Holds')[0]));
  assert.ok(!/Checked[^.]*not open/i.test(threadCaption(unknown)));

  const gateClosed = stageThread({ totals, repairs: [{ checkedState: 'not_available' }, { checkedState: 'not_available' }] });
  assert.deepEqual(gateClosed.map((s) => s.value), ['7', '2', '', '']);
  assert.equal(threadCaption(gateClosed), 'Each mistake moves from Found to Repaired. Checked and Holds come from fresh questions later, and are not open yet.');

  const gateOpen = stageThread({ totals, repairs: [{ checkedState: 'passed' }, { checkedState: 'pending' }] });
  assert.deepEqual(gateOpen.map((s) => s.state), ['count', 'count', 'count', 'closed']);
  assert.equal(gateOpen[2].value, '1');
  assert.equal(threadCaption(gateOpen), 'Each mistake moves from Found to Repaired, then Checked on a fresh question. Holds is not open yet.');

  const none = stageThread({ totals: { found: 0, withOpen: 0 }, repairs: [] });
  assert.deepEqual(none.map((s) => s.state), ['zero', 'zero', 'closed', 'closed']);
  assert.equal(none[1].value, '0');

  const full = stageThread({ totals, repairs: Array.from({ length: 100 }, () => ({ checkedState: 'not_available' })), repairLimit: 100 });
  assert.equal(full[1].value, '100+');
  for (const s of [...unknown, ...gateClosed, ...gateOpen, ...none]) { clean(s.note, s.key); clean(s.label, s.key); }
});

test('repair rows say when, where and what is next', () => {
  const r = repairLines({ chapter: 'Partnership: admission of a partner', subject: 'accountancy', foundAt: '2026-10-03T10:00:00Z', repairedAt: '2026-10-05T10:00:00Z', checkedState: 'not_available' }, NOW);
  assert.deepEqual(r, { title: 'Partnership: admission of a partner', found: 'Found 3 Oct in Accountancy.', repaired: 'Repaired 5 Oct.', checked: 'Fresh checks are not open yet.', stage: 'repaired' });
  assert.equal(repairLines({ subject: 'economics', checkedState: 'passed' }, NOW).stage, 'checked');
  assert.equal(repairLines({ subject: 'economics' }, NOW).title, 'Economics');
  for (const state of ['passed', 'not_passed', 'pending', 'not_available']) clean(repairLines({ checkedState: state }, NOW).checked, state);
});

test('answered right keeps its denominator and avoids false precision', () => {
  assert.deepEqual(rightLine({ questions: 0, correct: 0 }), { value: 'None yet', detail: 'Finish a session to start your record' });
  assert.deepEqual(rightLine({ questions: 8, correct: 6 }), { value: '6 of 8', detail: 'Too few questions for a percentage' });
  assert.deepEqual(rightLine({ questions: 40, correct: 30 }), { value: '30 of 40', detail: 'About 75%' });
});

test('the evidence note drops internal words', () => {
  assert.equal(evidenceNote({ note: 'Current question evidence is unavailable, so improvement claims are paused.' }), 'Question checks are unavailable right now, so improvement claims are paused.');
  const usual = (n) => `Fresh delayed checks provide concept evidence, not a causal score gain. ${n} checks with unavailable or changed question evidence are excluded.`;
  assert.equal(evidenceNote({ note: usual(0), invalidatedChecks: 0 }), '');
  assert.equal(evidenceNote({ note: usual(2), invalidatedChecks: 2 }), '2 older answers are left out because their questions were changed or withdrawn.');
  assert.equal(evidenceNote({ note: 'x', invalidatedChecks: 3 }), '3 older answers are left out because their questions were changed or withdrawn.');
  assert.equal(evidenceNote({ note: 'x', invalidatedChecks: 1 }), '1 older answer is left out because its question was changed or withdrawn.');
  assert.equal(evidenceNote({ note: 'x', invalidatedChecks: 0 }), '');
  assert.equal(evidenceNote(null), '');
});

test('concept check rows and page states', () => {
  assert.deepEqual(checkRow({ concept: 'Ratio analysis', sampleSize: 2, evidenceLabel: 'Held on 2 of 2' }), { title: 'Ratio analysis', detail: 'Held on 2 of 2', tag: '2 fresh checks' });
  assert.deepEqual(checkRow({}), { title: 'Concept', detail: 'Waiting for fresh questions', tag: 'No fresh check yet' });
  assert.equal(pageState({ data: null, error: null }), 'loading');
  assert.equal(pageState({ data: null, error: 'x', offline: true }), 'offline');
  assert.equal(pageState({ data: null, error: 'x', offline: false }), 'error');
  assert.equal(pageState({ data: {}, error: 'x' }), 'ready');
});
