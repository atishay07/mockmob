// node --test src/components/landing/examPreviewParity.test.mjs
// LK72 / decision 17: every runner-facing string the home page's MockMob interface shows exists in the real runner
// (src/app/(app)/test/TestPageClient.jsx), so the preview can never promise a screen the student does not get. The NTA-style
// interface follows NTA's CBT guidelines in both places (D6, 5 Nov 2026), and since web-1105-runner the runner's NTA style draws
// the preview's NTA screen word for word, in NTA's own capitals (the runner read "Save & next" before, so this rule was
// case-insensitive; it is exact now). Strings the runner fills from data (the attempt label and the subject) are checked against
// that data. Our own five questions are content, not runner chrome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAM } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const RUNNER = read('../../app/(app)/test/TestPageClient.jsx');
const INTEGRITY = read('../arena/ExamIntegrityGuard.jsx');
const MODES = read('../../../data/test_modes.js');
const has = (text) => RUNNER.includes(text);
const leaves = (value, out = []) => {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => leaves(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => leaves(v, out));
  return out;
};

test('every string of the MockMob interface is a string of the runner', () => {
  const words = EXAM.mockmob;
  // Plain strings and the labels of the counters, chips and legend.
  const plain = leaves({ ...words, questionOf: undefined, answered: undefined, heading: undefined });
  assert.ok(plain.length > 25, 'the interface has many words to hold');
  for (const text of plain) assert.ok(has(text), `"${text}" is not in TestPageClient.jsx`);
  // The three templated lines, by their fixed fragments (the runner builds them from the question and the counts).
  assert.equal(words.questionOf(3, 15), 'Question 3 of 15');
  assert.ok(has('Question {idx + 1} of {questions.length}'));
  assert.equal(words.answered(6), '6 answered');
  assert.ok(has('{answered} answered'));
  assert.equal(words.heading(3), 'Question 3');
  assert.ok(has('`Question ${idx + 1}`'));
});

test('the saved note, the attempt label and the subject are the runner\'s', () => {
  assert.ok(has('Saved on this device. Stay online to submit.'));
  assert.ok(EXAM.saved && 'Saved on this device. Stay online to submit.'.startsWith(EXAM.saved), 'the home page shows the first sentence of the runner\'s own note');
  assert.ok(MODES.includes(`label: '${EXAM.attempt}'`), 'Quick practice is a real practice mode');
  assert.ok(has('mode.label') && has('displayLabel(subjectId)'), 'the runner fills both from the mode and the subject');
  assert.equal(EXAM.subject, 'Accountancy');
});

test('the strike-out note, the timer and the palette names are word for word', () => {
  assert.ok(has('Press and hold an option to cross it out.'));
  assert.ok(has('Time remaining: '));
  assert.ok(has('aria-label="Exit test"'));
  assert.ok(has('Review palette') && has('Close palette') && has('Question palette'));
  assert.ok(has('<div role="group" aria-label="Test interface">'), 'the interface switch group');
  assert.ok(has('>MockMob</button>') && has('NTA style</button>'));
});

test('the NTA-style keys are the runner\'s classic interface words, in NTA\'s capitals, and its address is one the runner reads', () => {
  const nta = EXAM.nta;
  // Word for word and case for case (web-1105-runner): the runner's NTA object holds each of the preview's three keys.
  for (const key of ['save', 'markNext', 'clearResponse']) assert.ok(has(`${key}: '${nta[key]}'`), `"${nta[key]}" is a key of the runner's NTA style, in NTA's capitals`);
  for (const old of ['Save & next', 'Mark for review & next', 'Clear response']) assert.ok(!has(old), `the runner no longer draws "${old}"`);
  assert.equal(nta.save, 'Save & Next');
  assert.equal(nta.markNext, 'Mark for Review & Next');
  assert.equal(nta.clearResponse, 'Clear Response');
  // The browser bar's address: the runner's own route and the parameters it reads (subject, mode, interface).
  const url = new URL(EXAM.address.nta, 'https://mockmob.in');
  assert.equal(url.pathname, '/test');
  for (const name of ['subject', 'mode', 'interface']) assert.ok(has(`searchParams.get('${name}')`), `the runner reads ${name}`);
  assert.equal(url.searchParams.get('interface'), 'nta');
  assert.equal(url.searchParams.get('mode'), 'nta');
  assert.match(MODES, /id: 'nta'/, 'NTA mode is a real test mode');
  assert.equal(new URL(EXAM.address.mockmob, 'https://mockmob.in').searchParams.get('mode'), 'quick');
});

test('the runner\'s NTA style is the preview\'s NTA screen: the same header, section summary, palette and question words (web-1105-runner)', () => {
  const nta = EXAM.nta;
  for (const key of ['exam', 'candidate', 'subjectName', 'remaining', 'questionPaper', 'submit', 'paletteTitle', 'hidePalette', 'showPalette']) {
    assert.ok(has(`${key}: '${nta[key]}'`), `the runner's NTA style says "${nta[key]}" (${key})`);
  }
  // The section summary: NTA's five symbols in NTA's order and words, the same list in both.
  const start = RUNNER.indexOf('const NTA_LEGEND = [');
  const runnerLegend = [...RUNNER.slice(start, RUNNER.indexOf('];', start)).matchAll(/\['([a-z-]+)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(runnerLegend, nta.legend.map(([state, label]) => [state, label]));
  // The question heading reads "Question 3:" in both.
  assert.equal(nta.question(3), 'Question 3:');
  assert.ok(has('question: (n) => `Question ${n}:`'));
  // The anatomy the preview shows, by the runner's own parts: the header with the Question Paper icon, the candidate block with
  // the Remaining Time and the profile image, the section bar, the grey circle arrows, the radios, the > fold and the palette's
  // section summary in NTA's symbols.
  for (const part of ['nta-n-head', 'nta-n-exam', 'nta-n-paper', 'nta-n-cand', 'nta-n-photo', 'nta-n-sections', 'nta-n-tab', 'nta-n-qhead', 'nta-n-arrow', 'nta-n-radio', 'nta-n-fold', 'nta-n-palette', 'nta-n-legend', 'nta-n-sym', 'nta-n-section']) {
    assert.ok(new RegExp(`className=(?:"|\\{\`)[^"\`]*\\b${part}\\b`).test(RUNNER), `the runner draws ${part}`);
  }
  assert.ok(has('aria-expanded={ntaPaletteOpen}'), 'the fold is a real disclosure in the runner too');
  assert.ok(has('if (selected) clearAnswer(question.id); else chooseAnswer(question.id, optionIndex);'), 'clicking the chosen option again clears it, as the preview promises');
});

test('the gate line is the integrity guard\'s own words', () => {
  assert.ok(INTEGRITY.includes(EXAM.gateTitle), 'Enter your exam space');
  assert.ok(INTEGRITY.includes(EXAM.gate), EXAM.gate);
  assert.ok(INTEGRITY.includes('Warnings {strikes}/{INTEGRITY_STRIKES}'));
  assert.equal(EXAM.warnings, 'Warnings 0/3');
  assert.match(read('../arena/ExamIntegrityGuard.jsx'), /INTEGRITY_STRIKES\s*=\s*3|from '[^']*'/);
});

test('the five questions are four-option Accountancy items with the runner\'s two chips', () => {
  for (const q of EXAM.questions) {
    assert.equal(q.options.length, 4);
    assert.match(q.difficulty, /^(Easy|Medium|Hard)$/);
    assert.ok(q.text.endsWith(':') || q.text.endsWith('?') || q.text.endsWith('.'));
  }
  assert.ok(has('<span>{q.chapter}</span>') && has('{q.difficulty && <span>{q.difficulty}</span>}'), 'the runner prints the chapter and the difficulty as two chips');
});

// R3-D6 (LK106, 5 Nov 2026): below 761 px the home page draws the runner as it is on a phone. Its anatomy is the runner's
// phone anatomy: a bar under the paper with Previous, the palette and Next (NTA style: its keys and the Question Palette),
// and a palette sheet with a close key, the counts, the palette and Submit. Its few new words are the runner's own.
test('the phone preview is the runner on a phone: its bar, its palette sheet and its words', () => {
  const JSX = read('ExamScreen.jsx');
  assert.ok(has('className="nta-mobile-actions"') && has('className="nta-mobile-sheet" role="dialog"'), 'the runner has a phone bar and a palette sheet');
  assert.ok(has('aria-label="Close palette"') && JSX.includes('aria-label="Close palette"'), 'the sheet\'s close key says what the runner\'s says');
  assert.ok(has('{answered}/{questions.length} answered') || has('{answered} answered'), 'the sheet counts the answers');
  // NTA style on a phone: the runner's five keys, the preview's five keys.
  for (const key of ['Previous', 'NTA.clearResponse', 'NTA.paletteTitle', 'NTA.markNext']) assert.ok(RUNNER.slice(RUNNER.indexOf('className="nta-mobile-actions"')).includes(key), `the runner's NTA phone bar has ${key}`);
  assert.equal(EXAM.mockmob.previous, 'Previous');
  assert.ok(has('Review') && has('Submit test'), 'Review and Submit test are the runner\'s');
});
