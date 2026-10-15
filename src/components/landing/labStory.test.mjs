// node --test src/components/landing/labStory.test.mjs
// The landing's illustrative session must agree with itself and with the interactive replay
// (MistakeLab.jsx: 22 marks, 5 right, 3 wrong, 2 blank, 3 changes netting -6, Q7 the slow right one).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESSION, REPAIR, labStory, clock, signed, PAPER_PACE_SEC } from './labStory.mjs';

const story = labStory();

test('the session totals match the replay further down the page', () => {
  assert.equal(story.facts.marks, 22);
  assert.equal(story.facts.outOf, 50);
  assert.deepEqual([story.facts.right, story.facts.wrong, story.facts.blank], [5, 3, 2]);
  assert.equal(story.changes.length, 3);
  assert.equal(story.net, -6);
  assert.equal(story.lostToChanges, -12);
  assert.deepEqual(story.lostQuestions.slice().sort((a, b) => a - b), [4, 8]);
});

test('the replay component carries the same verdicts and change count', () => {
  const lab = readFileSync(new URL('./MistakeLab.jsx', import.meta.url), 'utf8');
  for (const r of SESSION) {
    const final = r.verdict === 'blank' ? 'skip' : r.verdict;
    assert.match(lab, new RegExp(`n: ${r.n}, first: '\\w+', final: '${final}'`), `Q${r.n} verdict differs from MistakeLab`);
  }
  assert.match(lab, /3 changes, net −?−?6 marks/);
});

test('every change happens inside the session clock and after its first pick', () => {
  for (const c of story.changes) {
    assert.ok(c.atSec < c.toAtSec, `Q${c.n} changes before its first pick`);
    assert.ok(c.toAtSec <= story.facts.totalSec, `Q${c.n} changes after the session ends`);
    assert.equal(Math.abs(c.net), 6, 'a CUET answer change swings +5 against -1');
  }
  assert.deepEqual(story.changes.map((c) => c.toAtSec), story.changes.map((c) => c.toAtSec).slice().sort((a, b) => a - b));
});

test('time figures are derived, not typed', () => {
  assert.equal(story.pace, '1:12');
  assert.equal(PAPER_PACE_SEC, 72);
  assert.equal(story.total, clock(SESSION.reduce((t, r) => t + r.sec, 0)));
  assert.equal(story.longest[0].n, 4);
  assert.equal(story.longest[0].share, 1);
  assert.ok(story.longest.every((l, i, all) => i === 0 || all[i - 1].share >= l.share));
  assert.equal(story.longest.find((l) => l.n === 7).verdict, 'right');
});

test('the SWOT lines come from the rows', () => {
  assert.deepEqual({ right: story.partnership.right, of: story.partnership.of }, { right: 1, of: 4 });
  assert.deepEqual({ right: story.ratios.right, of: story.ratios.of }, { right: 3, of: 3 });
  assert.equal(story.blankMarks, 10);
  assert.deepEqual(story.blanks.map((b) => b.n), [6, 10]);
  assert.ok(story.blanks.every((b) => b.chapter === story.blanks[0].chapter), 'the SWOT says both blanks share a chapter');
});

test('the repair question is the changed Q4: picked the wrong option, key is the first pick', () => {
  const q4 = SESSION.find((r) => r.n === REPAIR.n);
  assert.equal(q4.change.to, REPAIR.picked);
  assert.equal(q4.change.from, REPAIR.key);
  assert.equal(q4.verdict, 'wrong');
  assert.ok(REPAIR.options.some(([letter]) => letter === REPAIR.key));
  assert.ok(REPAIR.blocks[0].label.includes(REPAIR.picked));
  assert.ok(REPAIR.blocks[2].label.includes(REPAIR.key));
});

test('copy rules: no exclamation marks or em dashes in the story', () => {
  const text = JSON.stringify({ REPAIR, story });
  assert.doesNotMatch(text, /!/);
  assert.doesNotMatch(text, /—/);
  assert.equal(signed(-6), '−6');
  assert.equal(signed(6), '+6');
});
