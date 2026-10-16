// node --test src/components/landing/labStory.test.mjs
// The landing's illustrative session must agree with itself and with the interactive replay
// (MistakeLab.jsx reads the same rows: 22 marks, 5 right, 3 wrong, 2 blank, 3 changes netting -6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESSION, REPAIR, labStory, clock, signed, PAPER_PACE_SEC, marksLedger, repairRecordLine, nextMove, weakChapters, chapterRecord } from './labStory.mjs';

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

test('the replay component reads the same session and ledger, never its own copy', () => {
  const lab = readFileSync(new URL('./MistakeLab.jsx', import.meta.url), 'utf8');
  assert.match(lab, /from '\.\/labStory\.mjs'/);
  assert.doesNotMatch(lab, /n: \d+, first: '/, 'MistakeLab must not type its own rows');
  const tour = readFileSync(new URL('./TourScreens.jsx', import.meta.url), 'utf8');
  assert.match(tour, /from '\.\/labStory\.mjs'/, 'the tour replay reads the same clock times');
});

test('the ledger sorts every missed mark once, in the product groups', () => {
  const ledger = marksLedger();
  assert.equal(ledger.gap, story.facts.outOf - story.facts.marks);
  assert.deepEqual(ledger.groups.map((g) => [g.id, g.marks, g.qs]), [
    ['changed_from_right', 12, [4, 8]],
    ['other_wrong', 6, [3]],
    ['other_blank', 10, [6, 10]],
  ]);
  assert.equal(ledger.headline, '2 answers were right until you changed them. That cost 12 of the 28 marks you missed.');
});

test('every change happens inside the session clock and after its first pick', () => {
  for (const c of story.changes) {
    assert.ok(c.atSec < c.toAtSec, `Q${c.n} changes before its first pick`);
    assert.ok(c.toAtSec <= story.facts.totalSec, `Q${c.n} changes after the session ends`);
    assert.equal(Math.abs(c.net), 6, 'a CUET answer change swings +5 against -1');
  }
  assert.deepEqual(story.changes.map((c) => c.toAtSec), story.changes.map((c) => c.toAtSec).slice().sort((a, b) => a - b));
});

test('every change falls inside the open window of its own question, as the Time scene and the Replay draw it', () => {
  let opened = 0;
  for (const r of SESSION) {
    const closed = opened + r.sec;
    if (r.change) {
      assert.ok(r.change.at >= opened && r.change.at <= closed, `Q${r.n}'s first pick falls inside ${opened}-${closed}`);
      assert.ok(r.change.toAt >= opened && r.change.toAt <= closed, `Q${r.n}'s change falls inside ${opened}-${closed}`);
    }
    opened = closed;
  }
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

test('the time scene: every question against the pace, some under it and some over', () => {
  assert.equal(story.rows.length, SESSION.length);
  assert.deepEqual(story.rows.map((r) => r.n), SESSION.map((r) => r.n), 'paper order');
  const bands = Object.fromEntries(story.rows.map((r) => [r.n, r.band]));
  assert.deepEqual(bands, { 1: 'under', 2: 'under', 3: 'over', 4: 'over', 5: 'under', 6: 'blank', 7: 'over', 8: 'over', 9: 'over', 10: 'blank' });
  for (const r of story.rows) {
    assert.ok(Math.abs(r.base + r.over - r.sec / 200) < 1e-9, `Q${r.n} bar adds up to its time`);
    if (r.band === 'over') assert.ok(Math.abs(r.base - story.paceShare) < 1e-9, `Q${r.n} turns at the pace line`);
  }
  assert.equal(story.rows.find((r) => r.n === 4).delta, '2:08');
  assert.equal(story.time.wrongAllOver, true);
  assert.equal(story.time.underAllRight, true);
  assert.equal(story.time.overWrongTime, '3:37');
});

test('the SWOT lines come from the rows and the earlier record, in the product words', () => {
  assert.deepEqual({ right: story.partnership.right, of: story.partnership.of }, { right: 1, of: 4 });
  assert.deepEqual({ right: story.ratios.right, of: story.ratios.of }, { right: 3, of: 3 });
  assert.equal(story.partnership.lost, 18);
  assert.equal(story.blankMarks, 10);
  assert.deepEqual(story.blanks.map((b) => b.n), [6, 10]);
  const q = Object.fromEntries(story.swot.quadrants.map((x) => [x.id, x]));
  assert.equal(q.weakness.detail, '2 answers were right before you changed them. Those changes cost 12 marks.');
  assert.deepEqual(q.weakness.qs, [4, 8]);
  assert.equal(q.threat.detail, 'Marks lost here: 12, 12 and 18, oldest first.');
  assert.equal(q.strength.detail, '14 right of 15 across 3 papers, 3 of 3 in this one.');
  assert.equal(story.swot.plan[0].label, 'Practise 10 on Partnership');
  assert.equal(story.swot.plan[1].reason, '9 right of 14 so far. 10 marks lost here in this paper.');
});

test('the changes carry both verdicts, the gap and the first answers score', () => {
  const q9 = story.changes.find((c) => c.n === 9);
  assert.deepEqual([q9.from, q9.fromVerdict, q9.to, q9.toVerdict, q9.net, q9.gap], ['D', 'wrong', 'B', 'right', 6, '1:06']);
  const q4 = story.changes.find((c) => c.n === 4);
  assert.deepEqual([q4.from, q4.fromVerdict, q4.to, q4.toVerdict, q4.net], ['B', 'right', 'D', 'wrong', -6]);
  assert.equal(story.firstAnswers, 28);
  assert.equal(story.gainedMarks + story.lostToChanges, story.net);
});

test('the repair question is the changed Q4: picked the wrong option, key is the first pick', () => {
  const q4 = SESSION.find((r) => r.n === REPAIR.n);
  assert.equal(q4.change.to, REPAIR.picked);
  assert.equal(q4.change.from, REPAIR.key);
  assert.equal(q4.verdict, 'wrong');
  assert.ok(REPAIR.options.some(([letter]) => letter === REPAIR.key));
  assert.ok(REPAIR.blocks[0].label.includes(REPAIR.picked));
  assert.ok(REPAIR.blocks[2].label.includes(REPAIR.key));
  assert.equal(REPAIR.blocks[3].label, 'Keep this');
  assert.equal(repairRecordLine(), 'You first chose B here, then changed to D.');
});

test('copy rules: no exclamation marks or em dashes in the story', () => {
  const text = JSON.stringify({ REPAIR, story });
  assert.doesNotMatch(text, /!/);
  assert.doesNotMatch(text, /—/);
  assert.equal(signed(-6), '−6');
  assert.equal(signed(6), '+6');
});

test('the times are a real student\'s: nothing near ten minutes, one or two slow questions', () => {
  const secs = SESSION.map((r) => r.sec);
  assert.ok(Math.max(...secs) <= 220, 'the longest question stays under about 3:40');
  assert.ok(secs.filter((s) => s > 130).length <= 2, 'at most two long questions');
  assert.ok(secs.filter((s) => s >= 35 && s <= 130).length >= secs.length - 2, 'most bars sit between 0:35 and 2:10');
  assert.ok(Math.min(...secs) >= 35, 'even a blank was opened for a while');
  for (const c of story.changes) assert.ok(c.toAtSec - c.atSec <= 200, `Q${c.n} change comes within about three minutes of its first pick`);
  assert.equal(story.median, '1:19');
  assert.equal(story.total, '14:59');
});

test('the time summary line is tied to the bars that are drawn', () => {
  const over = story.rows.filter((r) => r.band === 'over' && r.verdict === 'wrong');
  assert.equal(over.length, story.facts.wrong);
  assert.equal(story.time.overWrongTime, clock(over.reduce((t, r) => t + r.deltaSec, 0)));
  assert.ok(story.rows.filter((r) => r.band === 'under').every((r) => r.verdict === 'right'));
});

test('the repair has a one-line form for phones, taken from the same blocks', () => {
  assert.ok(REPAIR.stemShort.length < REPAIR.stem.length);
  const shown = REPAIR.blocks.filter((b) => b.short);
  assert.deepEqual(shown.map((b) => b.kind), ['trap', 'right', 'rule'], 'why it tempted, why the key is right, the rule');
  for (const b of shown) assert.ok(b.short.length <= 42, `${b.kind} fits one line on a phone`);
  assert.equal(REPAIR.blocks.find((b) => b.kind === 'wrong').short, null, 'where it breaks waits behind the tap');
});

test('each SWOT quadrant has one strong line and its count for phones', () => {
  const q = Object.fromEntries(story.swot.quadrants.map((x) => [x.id, x]));
  assert.deepEqual([q.strength.line, q.strength.figure, q.strength.unit], ['Ratios', '14 of 15', 'right in 3 papers']);
  assert.deepEqual([q.weakness.line, q.weakness.figure, q.weakness.unit], ['Right, then changed', '2 answers', 'cost 12 marks']);
  assert.deepEqual([q.opportunity.line, q.opportunity.figure, q.opportunity.unit], ['Cash flow', '9 of 14', 'right in 3 papers']);
  assert.deepEqual([q.threat.line, q.threat.figure, q.threat.unit], ['Partnership', '3 of 3', 'mocks lost marks']);
});

test('one sample student, one next move: the SWOT, the tour and the Score Recovery Lab agree', () => {
  const move = nextMove();
  assert.equal(story.swot.plan[0].label, move.label);
  assert.equal(move.chapter, 'Partnership');
  assert.deepEqual([...move.lost], [...story.swot.partnershipLost]);
  // The tour's weak chapters print the SWOT's counts for the same chapters, and the move's chapter goes first.
  const rows = weakChapters();
  assert.equal(rows[0].chapter, move.chapter);
  const byName = Object.fromEntries(rows.map((r) => [r.chapter, `${r.right} of ${r.of}`]));
  for (const q of story.swot.quadrants.filter((x) => ['Ratios', 'Cash flow'].includes(x.title))) assert.equal(byName[q.title], q.figure);
  assert.ok(!rows.some((r) => /retirement/i.test(r.chapter)), 'one chapter name for the weakest chapter');
  // The Find step's closing line: Partnership's lost marks are a share of the session's missed marks.
  const lost = chapterRecord(move.chapter);
  assert.ok(lost.lost > 0 && lost.lost <= marksLedger().gap);
});
