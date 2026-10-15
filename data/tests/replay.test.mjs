// Replay and the slice 2 lab (data/replay.js, data/mistake_lab.js; spec tmp/mistake-lab-v4/SPEC.md 4.5, 4.6).
// Fixtures and contracts: data/tests/fixtures/mistake_lab/replay_*.json and contract_replay*_v1.json, built by
// scripts/mistake-lab/build-replay-fixtures.mjs. The website and the app build the Replay against these files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReplayFixtures } from '../../scripts/mistake-lab/build-replay-fixtures.mjs';
import { FIXTURE_DIR } from '../../scripts/mistake-lab/build-fixtures.mjs';
import { buildMistakeLab, LAB_COPY, LAB_RULES } from '../mistake_lab.js';
import { paperTrace } from '../paper_trace.js';
import { REPLAY_RULES } from '../replay.js';
import { paperPace } from '../time_decisions.js';
import { scoreSession } from '../recovery.js';

const load = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const CONTRACTS = ['contract_replay_v1', 'contract_replay_time_up_v1', 'contract_replay_nta_v1'];
const INPUTS = { contract_replay_v1: 'replay_full_input', contract_replay_time_up_v1: 'replay_time_up_input', contract_replay_nta_v1: 'replay_nta_input' };

test('the slice 2 fixtures and contracts on disk equal what the code builds today', () => {
  const { inputs, contracts } = buildReplayFixtures();
  for (const [name, built] of Object.entries(inputs)) assert.deepEqual(load(name), JSON.parse(JSON.stringify(built)), name);
  for (const [name, built] of Object.entries(contracts)) assert.deepEqual(load(name), JSON.parse(JSON.stringify(built)), name);
});

test('the slice 1 contracts keep the slice 1 shape: no replay or time inside them', () => {
  for (const name of ['contract_ready_v1', 'contract_basic_v1', 'contract_none_v1']) {
    const c = load(name);
    assert.equal('replay' in c, false, name);
    assert.equal('time' in c, false, name);
  }
});

test('every lost mark sits in exactly one group, and the groups add up to the gap', () => {
  for (const name of CONTRACTS) {
    const c = load(name);
    assert.equal(c.groups.reduce((s, g) => s + g.marks, 0), c.gap, name);
    const numbers = c.groups.flatMap((g) => g.numbers);
    assert.equal(new Set(numbers).size, numbers.length, name);
    const { attempt } = load(INPUTS[name]);
    const lost = attempt.details.filter((d) => d.isCorrect !== true).length;
    assert.equal(numbers.length, lost, name);
  }
});

test('crossed out the key: a wrong answer whose key was crossed out at any point, even if restored', () => {
  const c = load('contract_replay_v1');
  const g = c.groups.find((x) => x.id === 'struck_key');
  assert.deepEqual(g.numbers, [6, 16]);
  assert.equal(g.label, 'Crossed out the key');
  assert.equal(g.doLine, 'Before you cross out an option, name the word in it that makes it wrong.');
  assert.equal(c.byQuestion.q6.group, 'struck_key');
  assert.ok(!c.groups.some((x) => x.numbers.includes(11)), 'Q11 crossed out a wrong option and was right');
  assert.equal(LAB_RULES.groupOrder[1], 'struck_key');
});

test('with an end event the last question is timed, so it can be a quick wrong answer; without one it cannot', () => {
  const qs = ['a1', 'a2'].map((id) => ({ id, correctIndex: 0, options: ['w', 'x', 'y', 'z'].map((o) => `${id} ${o}`) }));
  const events = [{ seq: 1, qid: 'a1', at: 0, type: 'visit' }, { seq: 2, qid: 'a1', at: 30000, type: 'answer', answer: 0 }, { seq: 3, qid: 'a2', at: 60000, type: 'visit' }, { seq: 4, qid: 'a2', at: 65000, type: 'answer', answer: 2 }];
  const make = (ev) => {
    const s = scoreSession(qs, { a1: 0, a2: 2 }, ev, 3600000);
    return { questionsSnapshot: qs, details: s.details, selectionMeta: { mode: 'nta', durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: s.recovery } };
  };
  const open = buildMistakeLab({ attempt: make(events) });
  assert.equal(open.byQuestion.a2.group, 'other_wrong');
  const closed = buildMistakeLab({ attempt: make([...events, { seq: 5, qid: 'a2', at: 70000, type: 'end', reason: 'submit' }]) });
  assert.equal(closed.byQuestion.a2.group, 'quick_wrong');
});

test('replay rows: one per 10 minutes up to the end of the record, labelled with answered and even pace', () => {
  for (const name of CONTRACTS) {
    const { attempt } = load(INPUTS[name]);
    const r = load(name).replay;
    const pace = paperPace(attempt);
    assert.equal(r.rowSec, REPLAY_RULES.rowSec);
    assert.equal(r.playMs, 15000);
    assert.equal(r.rows.length, Math.ceil(r.recordSec / r.rowSec), name);
    let answered = 0;
    r.rows.forEach((row, i) => {
      assert.equal(row.from, i * r.rowSec);
      assert.ok(row.answeredBy >= answered, `${name} answered never goes down`);
      answered = row.answeredBy;
      const labelSec = i === r.rows.length - 1 && r.end ? Math.min(row.to, r.recordSec) : row.to;
      assert.equal(row.evenPaceBy, Math.min(r.total, Math.floor((labelSec * 1000) / pace.perQuestionMs)), name);
      assert.match(row.label, /^By \d+:\d\d: \d+ answered\. Even pace: \d+\.$/);
      for (const bar of row.bars) {
        assert.ok(bar.from >= row.from && bar.to <= row.to && bar.from <= bar.to, `${name} bar inside its row`);
        assert.ok(['right', 'wrong', 'blank', 'held'].includes(bar.result));
        for (const p of bar.picks) assert.ok(p.at >= bar.from && p.at <= bar.to && (p.option === null || Number.isInteger(p.option)));
        for (const m of bar.marks) assert.ok(m >= bar.from && m <= bar.to);
        for (const w of bar.away) assert.ok(w.from >= bar.from && w.to <= bar.to && /^Away \d/.test(w.label));
      }
    });
  }
});

test('replay bars cover each visit exactly once: per question they add up to its visits', () => {
  for (const name of CONTRACTS) {
    const trace = paperTrace(load(INPUTS[name]).attempt);
    const bars = load(name).replay.rows.flatMap((row) => row.bars);
    const byQ = new Map();
    for (const b of bars) byQ.set(b.qid, (byQ.get(b.qid) || 0) + (b.to - b.from));
    const spans = new Map();
    for (const s of trace.spans) spans.set(s.qid, (spans.get(s.qid) || 0) + (s.to - s.from) / 1000);
    for (const [qid, seconds] of spans) assert.ok(Math.abs((byQ.get(qid) || 0) - seconds) <= 2, `${name} ${qid}`);
    const picks = bars.flatMap((b) => b.picks).length;
    const steps = [...trace.stepsByQid.values()].reduce((s, list) => s + list.length, 0);
    assert.equal(picks, steps, `${name} every pick is on a bar once`);
  }
});

test('replay facts, end and chips for the three papers', () => {
  const full = load('contract_replay_v1').replay;
  assert.deepEqual(full.facts, [
    'You opened all 50 questions.',
    'Your first pass ended at 48:31, on Q50. You spent the last 3m 15s on 4 return visits.',
    'At 40:00 you had answered 37 of 50. Even pace gets to 33.',
  ]);
  assert.deepEqual(full.end, { at: 3106, reason: 'submit', label: 'Submitted at 51:46.' });
  assert.deepEqual(full.chips.map((c) => [c.id, c.count]), [['all', null], ['changed_from_right', 2], ['struck_key', 2], ['long_stay', 3], ['quick_wrong', 3]]);
  const lab = load('contract_replay_v1');
  for (const chip of full.chips.slice(1)) assert.equal(chip.count, lab.groups.find((g) => g.id === chip.id).count);

  const up = load('contract_replay_time_up_v1').replay;
  assert.deepEqual(up.facts, ['You opened 44 of 50 questions.', 'You never finished a first pass. 6 questions were never opened.', 'At 40:00 you had answered 28 of 50. Even pace gets to 33.']);
  assert.equal(up.end.label, 'Time ran out at 60:00.');
  assert.deepEqual(up.chips.map((c) => c.id), ['all', 'long_stay', 'never_opened']);

  const nta = load('contract_replay_nta_v1').replay;
  assert.deepEqual(nta.facts, ['You opened 26 of 50 questions.', 'You never finished a first pass. 24 questions were never opened.']);
  assert.equal(nta.end.label, 'Submitted at 31:10, after the third warning.');
  const last = nta.rows.at(-1);
  assert.equal(last.label, 'By 31:10: 24 answered. Even pace: 25.');
  assert.deepEqual(last.bars.at(-1).away, [{ from: 1855, to: 1870, label: 'Away 15s' }]);
});

test('NTA shuffled papers: picks carry the served option, and the trace names it in the paper\'s own letters', () => {
  const { attempt } = load('replay_nta_input');
  const lab = load('contract_replay_nta_v1');
  const bars = lab.replay.rows.flatMap((row) => row.bars);
  for (const q of attempt.questionsSnapshot.slice(0, 26)) {
    const d = attempt.details.find((x) => x.qid === q.id);
    const picks = bars.filter((b) => b.qid === q.id).flatMap((b) => b.picks);
    if (d.givenIndex === null) { assert.equal(picks.length, 0); continue; }
    assert.equal(picks.at(-1).option, d.givenIndex, q.id);
    const row = lab.time.rows.find((r) => r.qid === q.id);
    assert.ok(row.lines[1].startsWith(`Picked ${'ABCD'[d.givenIndex]} at`), q.id);
  }
});

test('gates: no replay without a usable record; a paper with nothing missed still has one', () => {
  assert.equal(buildMistakeLab(load('no_timeline_input')).replay, null);
  assert.equal(buildMistakeLab(load('inconsistent_input')).replay, null);
  const none = buildMistakeLab(load('no_missed_input'));
  assert.equal(none.state, 'none');
  assert.deepEqual(none.replay.chips, [{ id: 'all', label: 'All', count: null }]);
  assert.deepEqual(none.replay.facts, ['You opened all 10 questions.', 'You opened Q10, the last question you had not seen, at 4:30.']);
  assert.equal(buildMistakeLab(load('no_timeline_input')).time.state, 'device');
});

test('lab.time is the whole Time and decisions read, finished on the server', () => {
  const c = load('contract_replay_v1');
  assert.equal(c.time.state, 'ready');
  assert.equal(c.time.rows.length, 50);
  assert.equal(c.time.end.reason, 'submit');
  assert.equal(c.time.captured, true);
  assert.deepEqual(c.time.rows.find((r) => r.qid === 'q10').lines.at(-1), 'Away from the paper for 1m 10s while this question was open. Not counted.');
});

const BANNED = [/!/, /—/, /·/, /would have/i, /could have/i, /potential/i, /recoverable/i, /you rushed/i, /overthink/i, /you fell for/i];
const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
test('copy rules: no "!", em dash, middle dot, forecast or cause words in the copy or any slice 2 contract', () => {
  const all = [...strings(LAB_COPY), ...CONTRACTS.flatMap((n) => strings(load(n)))];
  assert.ok(all.length > 500);
  for (const s of all) for (const bad of BANNED) assert.ok(!bad.test(s), `${bad} in: ${s}`);
  for (const s of strings(LAB_COPY.replay).concat(strings(LAB_COPY.trace))) assert.ok(!/ -\d/.test(s), `minus sign: ${s}`);
});
