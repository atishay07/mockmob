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
//   replay_bst_input.json         Business Studies full mock: two passage sets, Q41 to Q45 and Q46 to Q50, each shown
//                                 on one page as the web runner does (via 'set' for the questions not in focus); Q45 and
//                                 Q50 shown but never in focus (Q45 marked), the submit sheet opened twice (once left
//                                 with Keep answering), a return to the first set by the palette with time away in it.
//   replay_english_input.json     English NTA paper: two passages (Q1 to Q8, Q9 to Q16) and 34 single questions; Q8 and
//                                 Q16 shown but never in focus, Q4 skipped on the first read and answered on a return
//                                 visit, then the NTA submit check (via 'sheet') and the submit.
//   contract_replay_v1.json       the lab built from replay_full_input, with the sample cohort (the main contract)
//   contract_replay_time_up_v1.json, contract_replay_nta_v1.json, contract_replay_bst_v1.json,
//   contract_replay_english_v1.json   the lab of the other papers
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
    // A page coming on screen as the web runner records it: the other questions of its passage set (via 'set'), then
    // the question in focus.
    page: (qid, at, via, setQids = []) => {
      for (const other of setQids) if (other !== qid) push({ qid: other, at, type: 'visit', via: 'set' });
      push({ qid, at, type: 'visit', ...(via ? { via } : {}) });
    },
    // The submit sheet (or the NTA submit check) opening over the question in focus.
    sheet: (qid, at) => push({ qid, at, type: 'visit', via: 'sheet' }),
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

// ---------- Business Studies: two passage sets on one page each ----------
const PASSAGE_A = 'Illustrative case: a small firm plans its production for the festive season.';
const PASSAGE_B = 'Illustrative case: a retailer chooses how to reach buyers in a new town.';
const BST_CHAPTERS = ['Nature and Significance of Management', 'Planning', 'Organising', 'Staffing', 'Marketing'];
function bstQuestions() {
  return Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    const set = n >= 41 && n <= 45 ? { passageGroupId: 'bst-case-a', passageText: PASSAGE_A, orderIndex: n - 40 }
      : n >= 46 ? { passageGroupId: 'bst-case-b', passageText: PASSAGE_B, orderIndex: n - 45 } : {};
    return { id: `b${n}`, chapter: BST_CHAPTERS[i % BST_CHAPTERS.length], question: `Illustrative question ${n}`,
      options: [`b${n} statement one`, `b${n} statement two`, `b${n} statement three`, `b${n} statement four`], correctIndex: n % 4, ...set };
  });
}
function bstPaper(qs) {
  const key = (n) => qs[n - 1].correctIndex;
  const id = (n) => qs[n - 1].id;
  const setA = [41, 42, 43, 44, 45].map(id);
  const setB = [46, 47, 48, 49, 50].map(id);
  const e = recorder();
  for (let n = 1; n <= 40; n++) {
    const t = (n - 1) * 60 * S;
    e.visit(id(n), t, n === 1 ? undefined : 'next');
    if (n % 11 === 0) continue; // opened, left blank
    e.answer(id(n), t + 40 * S, n % 7 === 0 ? (key(n) + 1) % 4 : key(n));
  }
  // 40:00, Next: the first set's page. Q41 in focus; picking an answer in Q42 and Q44 moves focus there.
  let t = 2400 * S;
  e.page(id(41), t, 'next', setA);
  e.answer(id(41), t + 150 * S, key(41));
  e.answer(id(42), t + 190 * S, (key(42) + 2) % 4); e.visit(id(42), t + 190 * S);
  e.answer(id(44), t + 230 * S, key(44)); e.visit(id(44), t + 230 * S);
  e.mark(id(45), t + 240 * S, true); // marked on the page; focus stays on Q44
  // 44:20, Next: the second set's page.
  t = 2660 * S;
  e.page(id(46), t, 'next', setB);
  e.answer(id(46), t + 100 * S, key(46));
  e.answer(id(47), t + 140 * S, key(47)); e.visit(id(47), t + 140 * S);
  e.answer(id(48), t + 170 * S, (key(48) + 1) % 4); e.visit(id(48), t + 170 * S);
  e.answer(id(49), t + 200 * S, key(49)); e.visit(id(49), t + 200 * S);
  // 48:10, Next on the last page opens the submit sheet; Keep answering 15 s later.
  e.sheet(id(49), 2890 * S);
  e.visit(id(49), 2905 * S);
  // 48:35, the palette: Q43 on the first set's page again, with 15 s away.
  t = 2915 * S;
  e.page(id(43), t, 'palette', setA);
  e.away(id(43), t + 15 * S); e.back(id(43), t + 30 * S);
  e.answer(id(43), t + 45 * S, key(43));
  // 49:40, Submit test: the sheet, then Submit now at 50:10.
  e.sheet(id(43), 2980 * S);
  e.end(id(43), 3010 * S, 'submit');
  return e;
}

// ---------- English (NTA): two passages, then single questions ----------
const ENGLISH_PASSAGES = ['Illustrative passage: a river town and its old bridge.', 'Illustrative passage: notes from a science fair.'];
function englishQuestions() {
  return Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    const set = n <= 8 ? { passageGroupId: 'eng-p1', passageText: ENGLISH_PASSAGES[0], orderIndex: n }
      : n <= 16 ? { passageGroupId: 'eng-p2', passageText: ENGLISH_PASSAGES[1], orderIndex: n - 8 } : {};
    return { id: `e${n}`, chapter: n <= 16 ? 'Reading Comprehension' : ['Vocabulary', 'Grammar', 'Verbal Ability'][n % 3], question: `Illustrative question ${n}`,
      options: [`e${n} choice one`, `e${n} choice two`, `e${n} choice three`, `e${n} choice four`], correctIndex: (n + 1) % 4, ...set };
  });
}
function englishPaper(qs) {
  const key = (n) => qs[n - 1].correctIndex;
  const id = (n) => qs[n - 1].id;
  const p1 = [1, 2, 3, 4, 5, 6, 7, 8].map(id);
  const p2 = [9, 10, 11, 12, 13, 14, 15, 16].map(id);
  const e = recorder();
  // The paper opens on the first passage: Q1 in focus, Q2 to Q8 shown with it.
  e.page(id(1), 0, undefined, p1);
  e.answer(id(1), 120 * S, key(1));
  for (const [n, at, wrong] of [[2, 160, false], [3, 190, true], [5, 230, false], [6, 260, false], [7, 290, false]]) {
    e.answer(id(n), at * S, wrong ? (key(n) + 1) % 4 : key(n)); e.visit(id(n), at * S);
  }
  // 5:10, Next: the second passage.
  e.page(id(9), 310 * S, 'next', p2);
  e.answer(id(9), 460 * S, key(9));
  for (let n = 10; n <= 15; n++) { const at = (460 + (n - 9) * 30) * S; e.answer(id(n), at, n === 12 ? (key(n) + 2) % 4 : key(n)); e.visit(id(n), at); }
  // 11:00 to 45:00: the single questions, a minute each.
  for (let n = 17; n <= 50; n++) {
    const t = (660 + (n - 17) * 60) * S;
    e.visit(id(n), t, 'next');
    if (n % 10 === 0) continue;
    e.answer(id(n), t + 45 * S, n % 6 === 0 ? (key(n) + 3) % 4 : key(n));
  }
  // 45:00, the palette: Q4 on the first passage's page again; answered at 46:00.
  e.page(id(4), 2700 * S, 'palette', p1);
  e.answer(id(4), 2760 * S, (key(4) + 1) % 4);
  // 46:30, Submit: the NTA check (questions left blank), then the submit 5 s later.
  e.sheet(id(4), 2790 * S);
  e.end(id(4), 2795 * S, 'submit');
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

  const bqs = bstQuestions();
  const be = bstPaper(bqs);
  const bs = scored(bqs, be, 3600 * S);
  const bst = {
    description: 'Business Studies full mock, 50 questions: Q41 to Q45 and Q46 to Q50 are passage sets, each on one page with every question of the set shown (via set); Q45 (marked) and Q50 shown but never in focus; the submit sheet opened at 48:10 and was left with Keep answering, a palette return to Q43 with 15 s away, then the sheet again at 49:40 and the submit at 50:10.',
    attempt: { id: 'lab-replay-bst-1', subject: 'business_studies', completedAt: T0 + 10800 * S, questionsSnapshot: bqs, details: bs.details,
      selectionMeta: { ...meta('full', bs), endedBy: 'submit' } },
    answerReviews: {},
    events: be.ev,
  };

  const eqs = englishQuestions();
  const ee = englishPaper(eqs);
  const es = scored(eqs, ee, 3600 * S);
  const english = {
    description: 'English NTA paper, 50 questions: two passages (Q1 to Q8, Q9 to Q16) shown on one page each, Q8 and Q16 shown but never in focus, Q4 skipped on the first read and answered on a palette return at 46:00, then the NTA submit check at 46:30 and the submit at 46:35.',
    attempt: { id: 'lab-replay-english-1', subject: 'english', completedAt: T0 + 14400 * S, questionsSnapshot: eqs, details: es.details,
      selectionMeta: { ...meta('nta', es), endedBy: 'submit' } },
    answerReviews: {},
    events: ee.ev,
  };

  const cohort = cohortForAttempt({ attempt: full.attempt, allAttempts: [], answerReviews: full.answerReviews, snapshot });
  const contracts = {
    contract_replay_v1: buildMistakeLab({ attempt: full.attempt, answerReviews: full.answerReviews, cohort }),
    contract_replay_time_up_v1: buildMistakeLab({ attempt: timeUp.attempt, answerReviews: timeUp.answerReviews, cohort: null }),
    contract_replay_nta_v1: buildMistakeLab({ attempt: nta.attempt, answerReviews: nta.answerReviews, cohort: null }),
    contract_replay_bst_v1: buildMistakeLab({ attempt: bst.attempt, answerReviews: bst.answerReviews, cohort: null }),
    contract_replay_english_v1: buildMistakeLab({ attempt: english.attempt, answerReviews: english.answerReviews, cohort: null }),
  };
  return { inputs: { replay_full_input: full, replay_time_up_input: timeUp, replay_nta_input: nta, replay_bst_input: bst, replay_english_input: english }, contracts };
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { inputs, contracts } = buildReplayFixtures();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const [name, value] of Object.entries({ ...inputs, ...contracts })) writeFileSync(join(FIXTURE_DIR, `${name}.json`), json(value));
  console.log(`wrote ${Object.keys(inputs).length + Object.keys(contracts).length} files to ${FIXTURE_DIR}`);
}
