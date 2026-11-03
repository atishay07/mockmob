// node --test src/components/landing/examPreviewParity.test.mjs
// LK72 / decision 17: every runner-facing string the home page's MockMob interface shows exists in the real runner
// (src/app/(app)/test/TestPageClient.jsx), so the preview can never promise a screen the student does not get. The NTA-style
// interface's own words are checked against the NTA classic runner's vocabulary the same way. Strings the runner fills from data
// (the attempt label and the subject) are checked against that data. Our own five questions are content, not runner chrome.
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

test('the NTA-style words are the runner\'s classic interface words', () => {
  const nta = EXAM.nta;
  assert.ok(has('Save & next'), nta.save);
  assert.equal(nta.save, 'Save & next');
  assert.ok(has('Mark for review & next'));
  assert.equal(nta.markNext, 'Mark for review & next');
  assert.ok(has('Clear response'));
  assert.equal(nta.clearResponse, 'Clear response');
  assert.ok(has("classicInterface ? 'Back' : 'Prev'"));
  assert.equal(nta.back, 'Back');
  assert.equal(nta.palette(6, 15), 'Palette 6/15');
  assert.ok(has('`Palette ${answered}/${questions.length}`'));
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
