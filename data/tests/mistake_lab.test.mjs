// The Mistake Lab ledger, re-mark and contract (data/mistake_lab.js; spec tmp/mistake-lab-v4/SPEC.md 4.1 to 4.3, 7).
// Fixtures and the three app contracts: data/tests/fixtures/mistake_lab, built by scripts/mistake-lab/build-fixtures.mjs.
// After a deliberate change, regenerate them with:  node scripts/mistake-lab/build-fixtures.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAll, FIXTURE_DIR } from '../../scripts/mistake-lab/build-fixtures.mjs';
import { buildMistakeLab, othersFor, LAB_RULES, LAB_GROUPS, LAB_COPY, LAB_VERSION, numberList, marksNumber } from '../mistake_lab.js';
import { buildTimeDecisions } from '../time_decisions.js';
import { scoreSession } from '../recovery.js';

const load = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const INPUTS = ['full_mock_input', 'quick_set_input', 'no_timeline_input', 'inconsistent_input', 'no_missed_input', 'nta_shuffled_input'];
const FIX = Object.fromEntries(INPUTS.map((n) => [n, load(n)]));
const COHORT = load('full_mock_cohort');
const labOf = (input, cohort = null) => buildMistakeLab({ attempt: input.attempt, answerReviews: input.answerReviews, cohort });
const groupOf = (lab, number) => lab.groups.find((g) => g.numbers.includes(number))?.id ?? null;

// A small paper factory over the real scorer. spec: per question [outcome, secs, { first, clear, unopened }].
function paper(spec, { mode = 'quick', meta = {} } = {}) {
  const qs = spec.map((_, i) => ({ id: `t${i + 1}`, chapter: 'Ratios', question: `Q${i + 1}`, options: ['a', 'b', 'c', 'd'].map((o) => `${o}${i}`), correctIndex: i % 4 }));
  const events = []; const answers = {}; let seq = 0; let t = 0;
  spec.forEach(([outcome, secs, extra = {}], i) => {
    const q = qs[i];
    if (extra.unopened) return;
    events.push({ seq: ++seq, qid: q.id, at: t, type: 'visit' });
    const wrong = (q.correctIndex + 1) % 4;
    if (Number.isInteger(extra.first)) events.push({ seq: ++seq, qid: q.id, at: t + 300, type: 'answer', answer: extra.first === -1 ? q.correctIndex : extra.first });
    const final = outcome === 'R' ? q.correctIndex : outcome === 'W' ? wrong : null;
    if (final !== null) { events.push({ seq: ++seq, qid: q.id, at: t + secs * 1000 - 100, type: 'answer', answer: final }); answers[q.id] = final; }
    else if (extra.clear) events.push({ seq: ++seq, qid: q.id, at: t + secs * 1000 - 100, type: 'answer', answer: null });
    t += secs * 1000;
  });
  // A closing visit to the last question, so every earlier question's time is known in these synthetic papers.
  events.push({ seq: ++seq, qid: qs.at(-1).id, at: t, type: 'visit' });
  const s = scoreSession(qs, answers, events);
  return { attempt: { id: 'synthetic', questionsSnapshot: qs, details: s.details, selectionMeta: { mode, scoringVersion: 'server_practice_v1', recovery: s.recovery, ...meta } }, score: s.rawScore };
}

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

test('fixtures and the three contracts on disk equal what the code builds today', () => {
  const { inputs, snapshot, fullCohort, contracts } = buildAll();
  for (const name of INPUTS) assert.deepEqual(FIX[name], JSON.parse(JSON.stringify(inputs[name])), name);
  assert.deepEqual(load('cohort_snapshot_sample'), JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(COHORT, JSON.parse(JSON.stringify(fullCohort)));
  for (const [name, built] of Object.entries(contracts)) assert.deepEqual(load(name), JSON.parse(JSON.stringify(built)), name);
  assert.equal(load('contract_ready_v1').state, 'ready');
  assert.equal(load('contract_basic_v1').state, 'basic');
  assert.equal(load('contract_none_v1').state, 'none');
});

test('on every input the groups add up to the gap, and every lost question sits in exactly one group', () => {
  for (const name of INPUTS) {
    for (const cohort of [null, name === 'full_mock_input' ? COHORT : null]) {
      const input = FIX[name];
      const lab = labOf(input, cohort);
      const details = input.attempt.details;
      const wrong = details.filter((d) => d.isCorrect === false).length;
      const blank = details.filter((d) => d.isCorrect !== true && d.isCorrect !== false).length;
      assert.equal(lab.gap, 6 * wrong + 5 * blank, `${name} gap`);
      assert.equal(lab.groups.reduce((s, g) => s + g.marks, 0), lab.gap, `${name} sum`);
      const lost = input.attempt.questionsSnapshot.map((q, i) => [q.id, i + 1]).filter(([qid]) => details.find((d) => d.qid === qid)?.isCorrect !== true).map(([, n]) => n);
      const placed = lab.groups.flatMap((g) => g.numbers).sort((a, b) => a - b);
      assert.deepEqual(placed, lost, `${name}: each lost question once`);
      for (const g of lab.groups) assert.equal(g.count, g.numbers.length);
    }
  }
});

test('the Full mock: every group, in order, with the headline group open', () => {
  const lab = labOf(FIX.full_mock_input, COHORT);
  assert.equal(lab.version, LAB_VERSION);
  assert.equal(lab.heading, "You missed 112 marks. Here's where they went.");
  assert.deepEqual(lab.groups.map((g) => [g.id, g.marks, g.numbers]), [
    ['changed_from_right', 12, [17, 31]], ['never_opened', 30, [45, 46, 47, 48, 49, 50]], ['long_stay', 17, [5, 12, 28]],
    ['quick_wrong', 18, [3, 19, 33]], ['other_wrong', 24, [22, 26, 38, 42]], ['other_blank', 5, [40]], ['held', 6, [14]],
  ]);
  assert.deepEqual(lab.headline, { group: 'never_opened', text: 'You never opened 6 of the 50 questions. That is 30 of the 112 marks you missed.' });
  assert.deepEqual(lab.groups.filter((g) => g.open).map((g) => g.id), ['never_opened']);
  assert.equal(lab.groups.find((g) => g.id === 'other_blank').line, '5 marks on 1 question');
  assert.equal(lab.barLabel, '112 marks missed: 12 right then changed, 30 never opened, 17 at 2 minutes or more, 18 wrong in under 20 seconds, 24 other wrong answers, 5 opened and left blank, 6 under re-check or corrected.');
  assert.deepEqual(lab.fine, [LAB_COPY.fineReady]);
  assert.deepEqual(lab.labels, { name: 'Mistake Lab', othersTitle: 'How others answered', showMore: 'Show {k} more', seeChanges: 'See every change' });
  assert.deepEqual(LAB_GROUPS.map((g) => g.id), [...LAB_RULES.groupOrder, 'wrong', 'blank']);
});

test('precedence: a right-then-changed question that took over 3 minutes sits only in "Right, then changed"', () => {
  const td = buildTimeDecisions(FIX.full_mock_input.attempt, { answerReviews: FIX.full_mock_input.answerReviews });
  assert.ok(td.rows[16].ms >= 180000, `Q17 took ${td.rows[16].ms} ms`);
  assert.equal(td.lastQid, 'q17');
  const lab = labOf(FIX.full_mock_input);
  assert.equal(groupOf(lab, 17), 'changed_from_right');
  assert.equal(lab.groups.filter((g) => g.numbers.includes(17)).length, 1);
  // The held question is never sorted by how it was lost, though it was answered wrong in 25 s.
  assert.equal(groupOf(lab, 14), 'held');
});

test('the last question opened is never a quick pick; a cleared first pick counts as the first pick', () => {
  const lab = labOf(FIX.quick_set_input);
  assert.equal(lab.state, 'ready');
  assert.equal(groupOf(lab, 10), 'other_wrong', 'Q10 was wrong after 5 s but its time after the last tap is unknown');
  assert.equal(groupOf(lab, 6), 'quick_wrong');
  assert.equal(groupOf(lab, 4), 'changed_from_right', 'picked the key, then cleared it');
  assert.equal(groupOf(lab, 2), 'other_blank');
  assert.equal(lab.byQuestion.k4.group, 'changed_from_right');
});

test('headline gate: 12 marks or 15% of the gap; ties broken by group order; none when nothing passes', () => {
  // Tie at 12: two right-then-changed and two quick wrong answers. Group order puts "Right, then changed" first.
  const tie = paper([['W', 40, { first: -1 }], ['W', 40, { first: -1 }], ['W', 10], ['W', 10], ['R', 30], ['R', 30]]);
  const t = buildMistakeLab({ attempt: tie.attempt });
  assert.equal(t.headline.group, 'changed_from_right');
  assert.equal(t.headline.text, '2 answers were right until you changed them. That cost 12 of the 24 marks you missed.');
  // 6 marks of a 30-mark gap is 20%: shown although under 12 marks.
  const share = paper([['W', 10], ['B', 30], ['B', 30], ['B', 30], ['B', 30], ['R', 30]]);
  const s = buildMistakeLab({ attempt: share.attempt });
  assert.equal(s.gap, 26);
  assert.equal(s.headline.text, '1 wrong answer took under 20 seconds. It cost 6 of the 26 marks you missed.');
  // 6 marks of a 106-mark gap, under 12 and under 15%: no headline. Opened blanks never lead.
  const none = paper([['W', 10], ...Array.from({ length: 20 }, () => ['B', 30])]);
  const n = buildMistakeLab({ attempt: none.attempt });
  assert.equal(n.gap, 106);
  assert.equal(n.headline, null);
  assert.ok(n.groups.every((g) => g.open === false));
});

test('the long-stay headline: the time in all, "at least" for the last question, "in all" without a paper limit', () => {
  const p = paper([['W', 150], ['W', 130], ['R', 30], ['R', 30]]);
  const lab = buildMistakeLab({ attempt: p.attempt });
  assert.equal(lab.headline.text, '2 questions took 2 minutes or more each and were still lost: 4m 40s of your 4 minutes, and 12 of the 12 marks you missed.');
  // Without the closing visit, the last question's time is a lower bound; a paper with no known limit says "in all".
  const open = paper([['R', 30], ['W', 150]], { mode: 'custom' });
  open.attempt.selectionMeta.recovery.timeline = open.attempt.selectionMeta.recovery.timeline.slice(0, -1);
  const o = buildMistakeLab({ attempt: open.attempt });
  assert.equal(o.groups[0].id, 'long_stay');
  assert.equal(o.headline.text, '1 question took 2 minutes or more and was still lost: at least 2m 30s in all, and 6 of the 6 marks you missed.');
});

test('the re-mark: a hand count of first picks against final answers, held questions left out of both', () => {
  const lab = labOf(FIX.full_mock_input);
  // First picks: 29 right with no change (+145), Q8 first wrong (-1), Q17 and Q31 first right (+10), Q22 and Q40 first
  // wrong (-2), 8 other wrong answers (-8), blanks 0: 144. Final: 30 right (+150), 11 wrong not held (-11): 139.
  // Of the 5 changed: Q17 and Q31 went right to wrong (lost 12), two went wrong to right or blank (won back 7), one
  // went wrong to another wrong (no change in marks). 49 questions count (Q14 is held): 245.
  assert.deepEqual(lab.remark, {
    first: 144, final: 139, max: 245, questions: 5,
    lost: { marks: 12, questions: 2 }, won: { marks: 7, questions: 2 }, net: -5,
    text: 'Changing answers: lost 12 marks on 2, won back 7 on 2. Net cost 5 marks.',
    scores: 'First picks: 144 of 245. Final answers: 139 of 245 (1 question under re-check left out of both).',
    fine: 'Same paper, same key, only your first picks swapped in. 1 question under re-check is left out of both.',
  });
  // With no held question, the final answers re-marked equal the paper's own score, over the paper's maximum.
  const quick = labOf(FIX.quick_set_input);
  const details = FIX.quick_set_input.attempt.details;
  const score = details.filter((d) => d.isCorrect === true).length * 5 - details.filter((d) => d.isCorrect === false).length;
  assert.equal(quick.remark.final, score);
  assert.equal(quick.remark.text, 'Changing answers lost 5 marks on 1 question.');
  assert.equal(quick.remark.scores, 'First picks: 33 of 50. Final answers: 28 of 50.');
  // No change: no re-mark.
  assert.equal(labOf(FIX.nta_shuffled_input).remark, null);
  // A gain, and an even result.
  const gain = paper([['R', 30, { first: 2 }], ['W', 30], ['R', 30]]);
  assert.equal(buildMistakeLab({ attempt: gain.attempt }).remark.text, 'Changing answers won back 6 marks on 1 question.');
  const even = paper([['R', 30, { first: 2 }], ['W', 30, { first: -1 }], ['R', 30]]);
  const evenLab = buildMistakeLab({ attempt: even.attempt });
  assert.equal(evenLab.remark.text, 'Changing answers: lost 6 marks on 1, won back 6 on 1. They evened out.');
  assert.equal(evenLab.remark.scores, 'First picks: 9 of 15. Final answers: 9 of 15.');
  // A change from one wrong option to another moves no marks.
  const sideways = paper([['W', 30, { first: 2 }], ['R', 30], ['R', 30]]);
  const side = buildMistakeLab({ attempt: sideways.attempt }).remark;
  if (side) assert.equal(side.net, 0);
  for (const t of strings([lab.remark, quick.remark])) assert.doesNotMatch(t, /would have|could have|recoverable|potential/i);
});

test('the re-mark net object: lost minus won is the cost, both figures carry one denominator, on every input', () => {
  const papers = [
    ...INPUTS.map((n) => labOf(FIX[n])),
    buildMistakeLab({ attempt: paper([['R', 30, { first: 2 }], ['W', 30, { first: -1 }], ['W', 30, { first: 3 }], ['B', 30, { first: -1, clear: true }], ['R', 30]]).attempt }),
  ];
  let seen = 0;
  for (const lab of papers) {
    const r = lab?.remark;
    if (!r) continue;
    seen += 1;
    assert.equal(r.lost.marks - r.won.marks, r.first - r.final, 'lost minus won equals the net cost');
    assert.equal(r.net, r.final - r.first);
    assert.ok(r.lost.questions + r.won.questions <= r.questions);
    const of = [...r.scores.matchAll(/ of (\d+)/g)].map((m) => Number(m[1]));
    assert.deepEqual(of, [r.max, r.max], 'both re-mark figures carry the same denominator');
    if (r.lost.questions && r.won.questions) assert.match(r.text, new RegExp(`lost ${r.lost.marks} marks? on ${r.lost.questions}, won back ${r.won.marks} on ${r.won.questions}[.]`));
  }
  assert.ok(seen >= 3, `re-marks checked: ${seen}`);
});

test('How this is counted: every method sentence sits in lab.method, and none of them in the body', () => {
  const lab = labOf(FIX.full_mock_input, COHORT);
  assert.equal(lab.method.label, 'How this is counted');
  assert.deepEqual(lab.method.lines, [
    LAB_COPY.method.ready,
    LAB_COPY.method.remark,
    '33 of the 50 questions in this paper have answers from 10 or more other students.',
    "Other students' first answers to the same question on MockMob, 21 Apr to 15 Oct 2026. Your own answers are not counted.",
  ]);
  // The body: everything the Lab shows in flow. No method sentence, and no "device's record" or "Same paper" wording.
  const body = strings([lab.heading, lab.hero, lab.headline, lab.groups, lab.barLabel, lab.remark?.text, lab.remark?.scores, lab.cohort?.line, lab.cohort?.truth, lab.cohort?.slow?.line]);
  for (const line of lab.method.lines) for (const t of body) assert.ok(!t.includes(line), `method sentence in the body: ${line}`);
  for (const t of body) assert.doesNotMatch(t, /device's record|Same paper, same key|answers from 10 or more other students|Your own answers are not counted/);
  // The one in-flow truth line after the cohort line.
  assert.equal(lab.cohort.truth, 'Each had answers from 20 or more other students.');
  // The hero: the missed marks over the paper's maximum.
  assert.deepEqual(lab.hero, { value: 112, max: 250, label: 'marks missed, of 250' });
  // A basic paper has no device record to describe: no method without a cohort, and its one state line stays in flow.
  const basic = labOf(FIX.no_timeline_input);
  assert.equal(basic.method, null);
  assert.equal(basic.fine.length, 1);
  const none = labOf(FIX.no_missed_input);
  assert.equal(none.hero, null);
});

test('negative marks use the minus sign', () => {
  assert.equal(marksNumber(-4), '−4');
  const low = paper([['W', 30, { first: -1 }], ['W', 30], ['W', 30]]);
  assert.equal(buildMistakeLab({ attempt: low.attempt }).remark.scores, 'First picks: 3 of 15. Final answers: −3 of 15.');
});

test('states: basic for a browser-scored paper, an inconsistent record and no timeline; none when nothing was missed', () => {
  const device = labOf(FIX.no_timeline_input);
  assert.equal(device.state, 'basic');
  assert.deepEqual(device.groups.map((g) => g.id), ['wrong', 'blank']);
  assert.deepEqual(device.fine, ['This earlier session was scored in your browser, so answer changes and timings are not available. The split shows wrong and blank only.']);
  assert.equal(device.headline, null);
  assert.equal(device.remark, null);
  const inconsistent = labOf(FIX.inconsistent_input);
  assert.equal(inconsistent.state, 'basic');
  assert.match(inconsistent.fine[0], /^The record from your device did not match your submitted answers/);
  const quiet = paper([['W', 30], ['R', 30]]);
  quiet.attempt.selectionMeta.recovery.timeline = [];
  const notRecorded = buildMistakeLab({ attempt: quiet.attempt });
  assert.equal(notRecorded.state, 'basic');
  assert.equal(notRecorded.fine[0], 'Time and answer changes were not recorded for this paper. Your score is unaffected. The split shows wrong and blank only.');
  const none = labOf(FIX.no_missed_input);
  assert.equal(none.state, 'none');
  assert.equal(none.heading, "You didn't miss a mark this session.");
  assert.deepEqual([none.groups, none.barLabel, none.headline, none.remark], [[], null, null, null]);
  assert.equal(buildMistakeLab({ attempt: { questionsSnapshot: [] } }), null);
  // Held questions in a basic paper still add up, in their own group.
  const held = buildMistakeLab({ attempt: FIX.no_timeline_input.attempt, answerReviews: { d3: { state: 'corrected' } } });
  assert.deepEqual(held.groups.map((g) => [g.id, g.marks]), [['wrong', 12], ['blank', 10], ['held', 6]]);
});

test('the blank do line appears only when every question in the group has 4 options', () => {
  const lab = labOf(FIX.full_mock_input);
  assert.equal(lab.groups.find((g) => g.id === 'other_blank').doLine, LAB_COPY.groups.other_blank.do);
  const three = JSON.parse(JSON.stringify(FIX.no_timeline_input.attempt));
  three.questionsSnapshot[4].options = three.questionsSnapshot[4].options.slice(0, 3);
  const b = buildMistakeLab({ attempt: three });
  assert.equal(b.groups.find((g) => g.id === 'blank').doLine, null);
});

test('How others answered: on right, wrong and blank answers alike, only from 10 students, never on a held question', () => {
  const lab = labOf(FIX.full_mock_input, COHORT);
  const others = (qid) => lab.byQuestion[qid]?.others ?? null;
  assert.equal(others('q17').line, '31 other students answered this. 19 got it right. 8 of the 12 who got it wrong chose B, as you did.');
  assert.deepEqual(others('q17').counts, [3, 8, 1, 19]);
  assert.equal(others('q17').optionLabels[1], 'Option B: chosen by 8 of 31 other students.');
  assert.equal(others('q1').line, '15 other students answered this. 12 got it right. A small group so far.');
  assert.equal(others('q40').line, '15 other students answered this. 10 got it right. A small group so far.', 'a blank gets no trap sentence');
  assert.equal(others('q3'), null, '8 students: under the gate');
  assert.equal(others('q14'), null, 'held');
  assert.equal(lab.cohort.line, '3 questions you lost were ones most other students got right: Q12, Q22 and Q42 (18 marks).');
  assert.deepEqual(lab.cohort.fine, [
    '33 of the 50 questions in this paper have answers from 10 or more other students.',
    "Other students' first answers to the same question on MockMob, 21 Apr to 15 Oct 2026. Your own answers are not counted.",
  ]);
  // Without a cohort read: no cohort block and no counts.
  const bare = labOf(FIX.full_mock_input);
  assert.equal(bare.cohort, null);
  assert.ok(Object.values(bare.byQuestion).every((q) => q.others === null));
});

test('othersFor: the trap sentence, the "1 other" form, a tie with no "More chose", and nobody else', () => {
  const read = (counts, keyIndex = 0) => ({ n: counts.reduce((s, c) => s + c, 0), right: counts[keyIndex], counts, keyIndex });
  assert.match(othersFor(read([20, 6, 3, 1]), { givenIndex: 1, outcome: 'wrong' }).line, / 6 of the 10 who got it wrong chose B, as you did\.$/);
  // 4 picks: under the 5-pick floor, so it is "others chose", with no "More chose" since B is the top wrong option.
  assert.match(othersFor(read([20, 4, 3, 1]), { givenIndex: 1, outcome: 'wrong' }).line, /got it right\. 4 others chose B, as you did\.$/);
  assert.match(othersFor(read([20, 1, 5, 0]), { givenIndex: 1, outcome: 'wrong' }).line, / 1 other student chose B, as you did\. More chose C: 5\.$/);
  assert.match(othersFor(read([20, 2, 5, 5]), { givenIndex: 1, outcome: 'wrong' }).line, / 2 others chose B, as you did\.$/, 'tied top wrong options');
  // Half of the wrong picks but tied with another wrong option: not the common trap.
  assert.match(othersFor(read([10, 5, 5, 0]), { givenIndex: 1, outcome: 'wrong' }).line, / 5 others chose B, as you did\.$/);
  assert.match(othersFor(read([20, 0, 5, 1]), { givenIndex: 1, outcome: 'wrong' }).line, / No other student chose B\.$/);
  assert.equal(othersFor(read([20, 0, 5, 1]), { givenIndex: 0, outcome: 'right' }).line, '26 other students answered this. 20 got it right.');
  assert.equal(othersFor(read([0, 6, 5, 1]), { givenIndex: 3, outcome: 'wrong' }).line.split('. ')[1], 'None of them got it right');
  assert.equal(othersFor(read([5, 2, 1, 1]), { givenIndex: 1, outcome: 'wrong' }), null, '9 students');
  assert.equal(othersFor(null), null);
});

test('copy rules: no "!", em dash or middle dot anywhere; no cause words; the minus sign in the blank do line', () => {
  const all = [...strings(LAB_COPY), ...['contract_ready_v1', 'contract_basic_v1', 'contract_none_v1'].flatMap((n) => strings(load(n)))];
  for (const s of all) {
    assert.doesNotMatch(s, /[!—·]/, s);
    assert.doesNotMatch(s, /\byou (?:rushed|overthink|overthought|fell for|panicked|guessed)\b/i, s);
  }
  assert.match(LAB_COPY.groups.other_blank.do, /−1 for wrong/);
  assert.equal(numberList([12]), 'Q12');
  assert.equal(numberList([12, 17, 36]), 'Q12, Q17 and Q36');
});

test('frozen rules match the spec', () => {
  assert.ok(Object.isFrozen(LAB_RULES));
  assert.deepEqual([LAB_RULES.longMs, LAB_RULES.quickMs, LAB_RULES.headlineMarks, LAB_RULES.headlineShare, LAB_RULES.cohortMin, LAB_RULES.cohortLabelMin, LAB_RULES.trapMinPicks, LAB_RULES.chipsShown],
    [120000, 20000, 12, 0.15, 10, 20, 5, 8]);
});

// ---------- Older papers: one line on what the paper cannot show, and one action ----------

test('older papers: each way a record can be missing gets its own one line, and the same one action', () => {
  const action = { label: 'Take a timed mock to see your full Lab', subject: 'accountancy', mode: 'full', href: '/dashboard?subject=accountancy&mode=full' };
  const device = labOf(FIX.no_timeline_input);
  assert.deepEqual(device.older, { reason: 'no_clock', line: 'This paper has no clock record, so its time, answer changes and replay are not shown.', action });
  const mismatch = labOf(FIX.inconsistent_input);
  assert.deepEqual(mismatch.older, { reason: 'not_matched', line: 'The clock from your device did not match your submitted answers, so its time, answer changes and replay are not shown.', action });
  // A server-scored paper whose record has under 2 events: a record exists but is too short to read.
  const quiet = paper([['W', 30], ['R', 30]]);
  quiet.attempt.subject = 'economics';
  quiet.attempt.selectionMeta.recovery.timeline = [];
  const short = buildMistakeLab({ attempt: quiet.attempt });
  assert.equal(short.older.reason, 'short');
  assert.equal(short.older.action.href, '/dashboard?subject=economics&mode=full');
  // A record the server could not read (telemetry invalid, which a paper taken today can have) is not "no clock record".
  quiet.attempt.selectionMeta.recovery = { telemetry: 'invalid', timeline: [] };
  const unreadable = buildMistakeLab({ attempt: quiet.attempt });
  assert.equal(unreadable.older.reason, 'unreadable');
  assert.equal(unreadable.older.line, 'The clock record from your device could not be read, so its time, answer changes and replay are not shown.');
  // No subject: the setup still opens on a Full mock.
  quiet.attempt.subject = null;
  quiet.attempt.selectionMeta.recovery = undefined;
  const bare = buildMistakeLab({ attempt: quiet.attempt });
  assert.equal(bare.older.reason, 'no_clock');
  assert.equal(bare.older.action.href, '/dashboard?mode=full');
  // A subject is encoded into the link.
  quiet.attempt.subject = 'business studies';
  assert.equal(buildMistakeLab({ attempt: quiet.attempt }).older.action.href, '/dashboard?subject=business%20studies&mode=full');
});

test('older papers: a usable record from before the capture of 15 Oct says what it lacks; a whole record has no older key', () => {
  const pre = labOf(FIX.quick_set_input);
  assert.equal(pre.state, 'ready', 'the clock record is usable, so the full ledger shows');
  assert.equal(pre.older.reason, 'before_capture');
  assert.equal(pre.older.line, "This paper's record has no time away, marks for review or how the paper ended, so those are not shown.");
  assert.equal(labOf(FIX.no_missed_input).older.reason, 'before_capture', 'a paper with nothing missed still says so');
  for (const name of ['full_mock_input', 'replay_full_input', 'replay_time_up_input', 'replay_nta_input', 'replay_bst_input', 'replay_english_input']) {
    const input = name.startsWith('replay') ? load(name) : FIX[name];
    assert.equal('older' in labOf(input), false, `${name} has a whole record`);
  }
});

test('older papers: the existing sentences stay (the app reads them), the new line is plain and passes the copy rules', () => {
  const device = labOf(FIX.no_timeline_input);
  assert.match(device.fine[0], /The split shows wrong and blank only\.$/, 'fine is unchanged for the app');
  for (const s of strings(LAB_COPY.older)) {
    assert.doesNotMatch(s, /[!—·]/, s);
    assert.doesNotMatch(s, /\b(?:would have|could have|recoverable|potential|forecast)\b/i, s);
    assert.ok(s.length < 140, s);
  }
  assert.deepEqual(Object.keys(LAB_COPY.older), ['no_clock', 'short', 'not_matched', 'unreadable', 'before_capture', 'action', 'actionAgain']);
});
