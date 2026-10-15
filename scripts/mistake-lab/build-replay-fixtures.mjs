// Builds the slice 2 fixtures (spec tmp/mistake-lab-v4/SPEC.md 4.5, 4.6, 6): papers recorded with the new capture
// (an end event, time away and back, strike-outs, marks for review, how each question was reached) and the contracts
// the website and the app build the Replay and the question trace against.
//   node scripts/mistake-lab/build-replay-fixtures.mjs     writes data/tests/fixtures/mistake_lab/replay_*.json
// Every question, option and count is illustrative: never real bank rows, never real students. Papers are scored by
// the real server scorer (data/recovery.js scoreSession) and the contracts built by the real builder, so
// data/tests/replay.test.mjs can check that the committed files equal what the code builds today.
//
//   replay_full_input.json        Full mock, 50 questions, submitted at the end: every group but never opened (the
//                                 key crossed out, a change without leaving, changes on later visits), time away
//                                 twice, strike-outs, marks, via on every visit, a first pass then 4 return visits.
//   replay_time_up_input.json     Full mock, time ran out with Q44 open; 6 questions never opened.
//   replay_nta_input.json         NTA paper, 50 questions in shuffled option orders; two warnings came back, the third
//                                 left the paper and submitted it (end reason nta_strikes, with time away to the end).
//   contract_replay_v1.json       the lab built from replay_full_input, with the sample cohort (the main contract)
//   contract_replay_time_up_v1.json, contract_replay_nta_v1.json   the lab of the other two papers
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreSession } from '../../data/recovery.js';
import { buildMistakeLab } from '../../data/mistake_lab.js';
import { cohortForAttempt } from '../../data/cohort_picks.js';
import { buildAll, FIXTURE_DIR } from './build-fixtures.mjs';

const T0 = Date.UTC(2026, 9, 16, 6, 30); // 16 Oct 2026, 12:00 IST
const S = 1000;

function recorder() {
  const ev = [];
  let seq = 1;
  let t = 0;
  const push = (e) => { ev.push({ seq: seq++, ...e }); };
  return {
    ev,
    get t() { return t; },
    set t(v) { t = v; },
    visit: (qid, at, via) => push({ qid, at, type: 'visit', ...(via ? { via } : {}) }),
    answer: (qid, at, answer) => push({ qid, at, type: 'answer', answer }),
    mark: (qid, at, marked) => push({ qid, at, type: 'mark', marked }),
    strike: (qid, at, option, on) => push({ qid, at, type: 'strike', option, on }),
    away: (qid, at) => push({ qid, at, type: 'away' }),
    back: (qid, at) => push({ qid, at, type: 'back' }),
    end: (qid, at, reason) => push({ qid, at, type: 'end', reason }),
  };
}
const answersFrom = (events) => {
  const a = {};
  for (const e of events) if (e.type === 'answer') { if (e.answer === null) delete a[e.qid]; else a[e.qid] = e.answer; }
  return a;
};
const scored = (qs, e, durationMs) => scoreSession(qs, answersFrom(e.ev), e.ev, durationMs);

// ---------- The Full mock, submitted at the end ----------
function fullPaper(qs) {
  const key = (n) => qs[n - 1].correctIndex;
  const wrong = (n) => (key(n) + 2) % 4;
  const otherWrong = (n) => (key(n) + 1) % 4;
  const e = recorder();
  const id = (n) => qs[n - 1].id;
  for (let n = 1; n <= 50; n++) {
    const q = id(n);
    const t = e.t;
    e.visit(q, t, n === 1 ? undefined : 'next');
    let stay = 50 * S;
    switch (n) {
      case 3: case 19: case 33: stay = 12 * S; e.answer(q, t + 8 * S, wrong(n)); break; // wrong in under 20 seconds
      case 5: stay = 150 * S; e.answer(q, t + 140 * S, wrong(n)); break; // 2 minutes or more
      case 12: stay = 135 * S; e.answer(q, t + 125 * S, wrong(n)); break;
      case 6: stay = 45 * S; e.strike(q, t + 10 * S, key(n), true); e.answer(q, t + 35 * S, wrong(n)); break; // the key crossed out
      case 16: stay = 50 * S; e.strike(q, t + 5 * S, key(n), true); e.strike(q, t + 15 * S, key(n), false); e.answer(q, t + 40 * S, wrong(n)); break;
      case 11: stay = 35 * S; e.strike(q, t + 8 * S, otherWrong(n), true); e.answer(q, t + 25 * S, key(n)); break;
      case 8: stay = 40 * S; e.answer(q, t + 30 * S, wrong(n)); break; // changed to the key on a later visit
      case 10: stay = 125 * S; e.away(q, t + 20 * S); e.back(q, t + 90 * S); e.answer(q, t + 110 * S, key(n)); break; // away 1m 10s
      case 30: stay = 300 * S; e.away(q, t + 10 * S); e.back(q, t + 250 * S); e.answer(q, t + 280 * S, key(n)); break; // away 4m
      case 14: stay = 40 * S; e.answer(q, t + 25 * S, wrong(n)); break; // held: under re-check
      case 17: stay = 60 * S; e.answer(q, t + 20 * S, key(n)); break; // right, then changed on a later visit
      case 20: stay = 30 * S; e.mark(q, t + 15 * S, true); break; // marked, answered on a later visit
      case 22: stay = 60 * S; e.answer(q, t + 20 * S, otherWrong(n)); e.answer(q, t + 50 * S, wrong(n)); break;
      case 26: case 38: case 42: case 49: stay = 45 * S; e.answer(q, t + 35 * S, wrong(n)); break;
      case 28: stay = 125 * S; e.mark(q, t + 60 * S, true); break; // marked, left blank, still marked at the submit
      case 31: stay = 80 * S; e.answer(q, t + 15 * S, key(n)); e.answer(q, t + 70 * S, wrong(n)); break; // right, then changed without leaving
      case 40: stay = 40 * S; e.answer(q, t + 15 * S, wrong(n)); e.answer(q, t + 32 * S, null); break; // picked, then cleared
      case 47: stay = 30 * S; break; // opened, left blank
      default: e.answer(q, t + 30 * S, key(n));
    }
    e.t = t + stay;
  }
  // Return visits from the palette.
  let t = e.t;
  e.visit(id(8), t, 'palette'); e.answer(id(8), t + 25 * S, key(8)); t += 30 * S;
  e.visit(id(20), t, 'palette'); e.answer(id(20), t + 20 * S, key(20)); e.mark(id(20), t + 22 * S, false); t += 30 * S;
  e.visit(id(17), t, 'palette'); e.answer(id(17), t + 90 * S, wrong(17)); t += 95 * S;
  e.visit(id(22), t, 'palette');
  const endAt = Math.min(t + 40 * S, 3598 * S);
  e.end(id(22), endAt, 'submit');
  if (endAt > 3600 * S) throw new Error('the full paper runs past 60 minutes');
  return e;
}

// ---------- Time up with Q44 open; 6 never opened ----------
function timeUpPaper(qs) {
  const key = (n) => qs[n - 1].correctIndex;
  const e = recorder();
  for (let n = 1; n <= 43; n++) {
    const q = qs[n - 1].id;
    const t = (n - 1) * 80 * S;
    e.visit(q, t, n === 1 ? undefined : 'next');
    if (n === 7) { e.away(q, t + 10 * S); e.back(q, t + 40 * S); }
    if (n % 9 === 0) e.answer(q, t + 60 * S, (key(n) + 1) % 4);
    else if (n % 13 !== 0) e.answer(q, t + 60 * S, key(n));
  }
  const q44 = qs[43].id;
  e.visit(q44, 43 * 80 * S, 'next');
  e.mark(q44, 43 * 80 * S + 30 * S, true);
  e.answer(q44, 43 * 80 * S + 100 * S, (key(44) + 3) % 4);
  e.end(q44, 3600 * S, 'time_up');
  return e;
}

// ---------- NTA, shuffled option orders, ended by the third warning ----------
const PERMS = [[0, 1, 2, 3], [2, 0, 3, 1], [1, 3, 0, 2], [3, 2, 1, 0], [0, 2, 1, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 1, 2, 0]];
function ntaQuestions() {
  return Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    const stored = [`r${n} statement one`, `r${n} statement two`, `r${n} statement three`, `r${n} statement four`];
    const storedKey = n % 4;
    const order = PERMS[n % PERMS.length];
    return { id: `r${n}`, chapter: ['Partnership Fundamentals', 'Share Capital', 'Accounting Ratios'][n % 3], question: `Illustrative question ${n}`,
      options: order.map((k) => stored[k]), correctIndex: order.indexOf(storedKey), optionOrder: order, optionsShuffled: true };
  });
}
function ntaPaper(qs) {
  const e = recorder();
  let t = 0;
  for (let n = 1; n <= 26; n++) {
    const q = qs[n - 1];
    e.visit(q.id, t, n === 1 ? undefined : 'next');
    if (n === 4) { e.away(q.id, t + 20 * S); e.back(q.id, t + 50 * S); } // warning 1
    if (n === 15) { e.away(q.id, t + 10 * S); e.back(q.id, t + 25 * S); } // warning 2
    if (n === 9) e.mark(q.id, t + 20 * S, true);
    if (n % 5 === 0) e.answer(q.id, t + 50 * S, (q.correctIndex + 1) % 4);
    else if (n !== 9 && n !== 23) e.answer(q.id, t + 50 * S, q.correctIndex);
    t += (n === 4 ? 100 : n === 15 ? 85 : 70) * S;
  }
  const q26 = qs[25].id;
  e.away(q26, t - 10 * S); // warning 3: the paper is submitted with the student away
  e.end(q26, t + 5 * S, 'nta_strikes');
  return e;
}

export function buildReplayFixtures() {
  const { inputs, snapshot } = buildAll();
  const fullQs = inputs.full_mock_input.attempt.questionsSnapshot;
  const meta = (mode, s) => ({ mode, durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: s.recovery,
    client: { platform: 'web', appVersion: '2026.10.16', startedAt: T0 - 3600 * S } });

  const fe = fullPaper(fullQs);
  const fs = scored(fullQs, fe, 3600 * S);
  const full = {
    description: 'Full mock, 50 questions, submitted at 59:58 on a return visit to Q22: the key crossed out (Q6, Q16 restored), right then changed later (Q17) and without leaving (Q31), Q8 changed to the key later, away 1m 10s on Q10 and 4m 10s on Q30, marks on Q20 (removed) and Q28 (kept), Q14 held, every question opened.',
    attempt: { id: 'lab-replay-full-1', subject: 'accountancy', completedAt: T0, questionsSnapshot: fullQs, details: fs.details,
      selectionMeta: { ...meta('full', fs), endedBy: 'submit' } },
    answerReviews: { q14: { state: 'under_review' } },
    events: fe.ev,
  };

  const te = timeUpPaper(fullQs);
  const ts = scored(fullQs, te, 3600 * S);
  const timeUp = {
    description: 'Full mock, 50 questions, 80 s a question: time ran out at 60:00 with Q44 open (marked, picked wrong at 58:20), Q45 to Q50 never opened, away 30 s on Q7.',
    attempt: { id: 'lab-replay-timeup-1', subject: 'accountancy', completedAt: T0 + 3600 * S, questionsSnapshot: fullQs, details: ts.details,
      selectionMeta: { ...meta('full', ts), endedBy: 'time_up' } },
    answerReviews: {},
    events: te.ev,
  };

  const nqs = ntaQuestions();
  const ne = ntaPaper(nqs);
  const ns = scored(nqs, ne, 3600 * S);
  const nta = {
    description: 'NTA paper, 50 questions in shuffled option orders: two warnings came back (Q4 30 s, Q15 15 s), the third left the paper on Q26 and submitted it 15 s later (nta_strikes); Q9 marked; Q27 to Q50 never opened.',
    attempt: { id: 'lab-replay-nta-1', subject: 'accountancy', completedAt: T0 + 7200 * S, questionsSnapshot: nqs, details: ns.details,
      selectionMeta: { ...meta('nta', ns), endedBy: 'nta_strikes' } },
    answerReviews: {},
    events: ne.ev,
  };

  const cohort = cohortForAttempt({ attempt: full.attempt, allAttempts: [], answerReviews: full.answerReviews, snapshot });
  const contracts = {
    contract_replay_v1: buildMistakeLab({ attempt: full.attempt, answerReviews: full.answerReviews, cohort }),
    contract_replay_time_up_v1: buildMistakeLab({ attempt: timeUp.attempt, answerReviews: timeUp.answerReviews, cohort: null }),
    contract_replay_nta_v1: buildMistakeLab({ attempt: nta.attempt, answerReviews: nta.answerReviews, cohort: null }),
  };
  return { inputs: { replay_full_input: full, replay_time_up_input: timeUp, replay_nta_input: nta }, contracts };
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { inputs, contracts } = buildReplayFixtures();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const [name, value] of Object.entries({ ...inputs, ...contracts })) writeFileSync(join(FIXTURE_DIR, `${name}.json`), json(value));
  console.log(`wrote ${Object.keys(inputs).length + Object.keys(contracts).length} files to ${FIXTURE_DIR}`);
}
