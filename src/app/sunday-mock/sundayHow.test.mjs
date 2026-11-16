// node --test src/app/sunday-mock/sundayHow.test.mjs
// The Sunday Mock page's figures and timeline (sundayHow.mjs) say what the rule does (src/lib/sundayMock.mjs), in the site's
// own way of writing a time, with no wall of text: every step is a short title and one or two sentences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANSWERS_AT, LAST_START, OPENS, PAPER_FIGURES, SUNDAY_STEPS, clockWords } from './sundayHow.mjs';
import { PAPER_COUNT, PAPER_MINUTES, SHARE_FLOOR, sundayWindow } from '../../lib/sundayMock.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const IST = (ms) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(11, 16);

test('a time is written as the site writes it', () => {
  assert.equal(clockWords(10), '10:00 am');
  assert.equal(clockWords(22), '10:00 pm');
  assert.equal(clockWords(22, 65), '11:05 pm');
  assert.equal(clockWords(0), '12:00 am');
  assert.equal(clockWords(12), '12:00 pm');
});

test('the three times are the window the server keeps', () => {
  const w = sundayWindow('2026-11-22');
  assert.equal(IST(w.opensAt), '10:00');
  assert.equal(OPENS, '10:00 am');
  assert.equal(IST(w.closesAt), '22:00');
  assert.equal(LAST_START, '10:00 pm');
  assert.equal(IST(w.answersAt), '23:05');
  assert.equal(ANSWERS_AT, '11:05 pm');
});

test('the figures are the paper: its questions, its minutes, its marking', () => {
  assert.deepEqual(PAPER_FIGURES.map((f) => f.figure), [String(PAPER_COUNT), String(PAPER_MINUTES), '+5']);
  assert.match(PAPER_FIGURES[2].unit, /−1 wrong/);
});

test('the day runs in order, each step short, and the floor of sitters is the rule’s own', () => {
  assert.deepEqual(SUNDAY_STEPS.map((s) => s.when), [OPENS, 'When you send', LAST_START, ANSWERS_AT, 'After']);
  for (const step of SUNDAY_STEPS) {
    assert.ok(step.title.length <= 34, step.title);
    assert.ok(step.line.length <= 150, `${step.title}: ${step.line.length}`);
    assert.doesNotMatch(`${step.title} ${step.line}`, /!|→|->|\b(rank|percentile|topper)\b/i);
  }
  assert.ok(SUNDAY_STEPS[3].line.includes(`once ${SHARE_FLOOR} or more have`));
  assert.ok(SUNDAY_STEPS[2].line.includes(`${PAPER_MINUTES} minutes`));
});

test('the page draws the figures and the timeline, not the old six paragraphs', () => {
  const page = read('./page.js');
  assert.match(page, /PAPER_FIGURES\.map/);
  assert.match(page, /SUNDAY_STEPS\.map/);
  assert.doesNotMatch(page, /mm-beliefs|const HOW = \[/);
});
