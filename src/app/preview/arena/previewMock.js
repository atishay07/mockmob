// Development-only mock-paper fixtures for /preview/arena?view=result&mock=full|nta. The papers are made of
// illustrative questions, scored by the real server scorer, and the SWOT, the "From your record" lines and the
// Mistake Lab come from the real builders (data/mock_swot.js, data/mistake_insights.js, data/mistake_lab.js) over a
// short earlier record, so the panels the preview shows are the ones the route would send. Never real bank rows,
// never real students.
// mock=full is the Mistake Lab's 50-question fixture paper (every ledger group, 5 answer changes, Q14 held, Q45 to
// Q50 never opened) with its illustrative cohort read (full_mock_cohort.json: cohortForAttempt over the sample
// snapshot, precomputed because data/cohort_picks.js is server-only). ?lab=basic marks the device record
// inconsistent (the basic ledger); ?lab=off leaves the Lab out (the page as it was before the ledger).
// Older papers: ?lab=older is the same paper taken before the clock was kept (no record, so the plain ledger and one
// line with one action); ?lab=precapture keeps the clock record but has none of the 15 Oct capture (no time away, marks,
// strike-outs or end), so the full ledger shows with a line on what it lacks.
// The Replay (slice 2): mock=full, with the Lab on and the checks ready, serves the paper recorded with the new capture
// (replay_full_input.json: time away, strike-outs, marks, an end event) and, as its lab, the committed contract itself
// (contract_replay_v1.json, what the server builds from that paper with the sample cohort), so the page shows exactly
// what the website and the app are built against. &paper=time_up and &paper=nta show the other two contracts (time ran
// out with Q44 open; an NTA paper ended by the third warning); &paper=bst and &paper=english the passage-set papers
// (questions shown with their set, the submit sheet); &paper=v1 the slice 1 paper above, built live.
// Slice 3 (fixtureLabLoop): the Full mock's lab also carries the loop parts the route adds (data/lab_loop.js), from the
// committed contracts: lab.acrossMocks (&across=none|below_gate for the other states), lab.repairOrder built by the real
// builder over the paper and its sample cohort (&order=paper for today's order), lab.rules, and lab.prove.ruleCheck
// (&rulecheck=not_kept|counted|not_checked|none; kept by default).
import { scoreSession } from '../../../../data/recovery';
import { buildSwot } from '../../../../data/mock_swot';
import { buildMistakeInsights } from '../../../../data/mistake_insights';
import { buildMistakeLab } from '../../../../data/mistake_lab';
import LAB_PAPER from '../../../../data/tests/fixtures/mistake_lab/full_mock_input.json';
import LAB_COHORT from '../../../../data/tests/fixtures/mistake_lab/full_mock_cohort.json';
import ACROSS from '../../../../data/tests/fixtures/mistake_lab/contract_across_v1.json';
import RULES from '../../../../data/tests/fixtures/mistake_lab/contract_rules_v1.json';
import RULECHECK from '../../../../data/tests/fixtures/mistake_lab/contract_rulecheck_v1.json';
import LAB_COPY from '../../../../data/mistake_lab.copy.json';
import { buildRepairOrder } from '../../../../data/repair_order';
import TRAPS from '../../../../data/tests/fixtures/mistake_lab/contract_traps_v1.json';
import LATER from '../../../../data/tests/fixtures/mistake_lab/contract_later_v1.json';
import { buildTrapTags, indexAtlas } from '../../../../data/trap_atlas';
import { buildLater } from '../../../../data/revise';
import { optionHash } from '../../../../data/option_hash';

const DAY = 86_400_000;
const SUBJECT = 'accountancy';

// [chapter, outcomes] per block. R right, W wrong, B blank (visited, not answered). Six questions a block.
const THIS_PAPER = [
  ['Partnership Fundamentals', 'RRRRRR'],
  ['Profit & Loss Appropriation Account', 'RRRRRW'],
  ['Share Capital', 'WWRWWR'],
  ['Accounting Ratios', 'RWWRWR'],
  ['Depreciation', 'RBWRBW'],
];
const EARLIER_PAPERS = [
  [['Partnership Fundamentals', 'RRRWRR'], ['Profit & Loss Appropriation Account', 'RRRRRR'], ['Share Capital', 'WWWRWR'], ['Accounting Ratios', 'RWRWRR'], ['Depreciation', 'RRWRRR']],
  [['Partnership Fundamentals', 'RRRRRR'], ['Profit & Loss Appropriation Account', 'RRRWRR'], ['Share Capital', 'WRWWRW'], ['Accounting Ratios', 'RRWRWR'], ['Depreciation', 'RRRRWR']],
  [['Partnership Fundamentals', 'RRRRWR'], ['Profit & Loss Appropriation Account', 'RRRRRR'], ['Share Capital', 'WWRWWW'], ['Accounting Ratios', 'RWRRRR'], ['Depreciation', 'RRRWRR']],
];

function paper({ id, prefix, mode, completedAt, blocks, firstPicks = {}, quickWrong = true }) {
  const rows = [];
  blocks.forEach(([chapter, outcomes]) => {
    [...outcomes].forEach((outcome) => {
      const n = rows.length + 1;
      rows.push({ id: `${prefix}-q${n}`, chapter, outcome, key: n % 4, n });
    });
  });
  const questions = rows.map((r) => ({
    id: r.id, chapter: r.chapter, difficulty: ['easy', 'medium', 'hard'][r.n % 3],
    question: `Illustrative question ${r.n} on ${r.chapter}. Fixture text, not a bank question.`,
    explanation: 'Fixture explanation.',
    options: ['Option one', 'Option two', 'Option three', 'Option four'],
    correctIndex: r.key,
  }));
  const answers = {};
  const events = [];
  let at = 0;
  let seq = 1;
  rows.forEach((r, i) => {
    events.push({ seq: seq++, qid: r.id, at, type: 'visit' });
    const final = r.outcome === 'R' ? r.key : r.outcome === 'W' ? (r.key + 1) % 4 : null;
    // Wrong answers alternate between a fast pick and a slow one; every fifth question is slower.
    const seconds = r.outcome === 'W' ? (quickWrong && i % 2 === 0 ? 11 + (i % 7) : 52) : 38 + (i % 5) * 4;
    // A first pick that was later changed (the paper's two key-to-wrong changes are set by the caller).
    const changed = firstPicks[r.n];
    if (changed !== undefined) events.push({ seq: seq++, qid: r.id, at: at + seconds * 400, type: 'answer', answer: changed === 'key' ? r.key : changed });
    if (final !== null) { answers[r.id] = final; events.push({ seq: seq++, qid: r.id, at: at + seconds * 900, type: 'answer', answer: final }); }
    at += seconds * 1000;
  });
  events.push({ seq: seq++, qid: rows.at(-1).id, at, type: 'visit' });
  const scored = scoreSession(questions, answers, events);
  return {
    id, subject: SUBJECT, mode, score: scored.score, correct: scored.correct, wrong: scored.wrong, unattempted: scored.unattempted, total: scored.total,
    completedAt, questionsSnapshot: questions, details: scored.details,
    selectionMeta: { mode, scoringVersion: 'server_snapshot_v1', recovery: scored.recovery },
  };
}

// The three earlier papers behind the SWOT and the "From your record" lines.
function earlierPapers(now) {
  return EARLIER_PAPERS.map((blocks, i) => paper({
    id: `fixture-earlier-${i + 1}`, prefix: `e${i + 1}`, mode: i === 1 ? 'nta' : 'full', completedAt: now - (i + 1) * 4 * DAY, blocks,
  })).reverse();
}

// The Lab's 50-question fixture paper as a scored attempt, completed an hour ago.
function labPaper({ now, labMode }) {
  const src = JSON.parse(JSON.stringify(LAB_PAPER.attempt));
  const right = src.details.filter((d) => d.isCorrect === true).length;
  const wrong = src.details.filter((d) => d.isCorrect === false).length;
  const rec = src.selectionMeta.recovery;
  const stripVia = (events) => (events || []).map(({ via, ...event }) => event);
  const recovery = labMode === 'basic' ? { ...rec, telemetry: 'inconsistent' }
    : labMode === 'older' ? { ...rec, telemetry: 'not_recorded', timeline: [], marks: [], presence: [], strikes: [], end: undefined }
    : labMode === 'precapture' ? { ...rec, timeline: stripVia(rec.timeline), marks: [], presence: [], strikes: [], end: undefined }
    : rec;
  return {
    ...src, id: 'fixture-attempt', mode: 'full', completedAt: now - 3_600_000,
    score: right * 5 - wrong, correct: right, wrong, unattempted: src.details.length - right - wrong, total: src.questionsSnapshot.length,
    selectionMeta: { ...src.selectionMeta, recovery },
  };
}

/**
 * The attempt, the SWOT, the record lines and the Mistake Lab for one preview mock. `mode` is 'full' or 'nta'.
 * As in the route (data/mock_swot.js resultHistory), the Lab is built only when the answer checks are ready, and
 * the SWOT then leaves out what the ledger already shows.
 */
export function fixtureMock(mode = 'full', { checks = 'ready', lab: labMode = 'on' } = {}) {
  const now = Date.now();
  const earlier = earlierPapers(now);
  // full: the Lab's fixture paper. nta: Q13 and Q20 were right first and changed to wrong, so the change line and the
  // SWOT's changes item show.
  const full = mode === 'full';
  const attempt = full ? labPaper({ now, labMode })
    : paper({ id: 'fixture-attempt', prefix: 'fixture-mock', mode, completedAt: now - 3_600_000, blocks: THIS_PAPER, firstPicks: { 13: 'key', 20: 'key' } });
  const answerReviews = full ? { ...LAB_PAPER.answerReviews } : {};
  const answerReviewState = checks === 'ready' ? 'ready' : 'unavailable';
  const lab = answerReviewState === 'ready' && labMode !== 'off' ? buildMistakeLab({ attempt, answerReviews, cohort: full ? LAB_COHORT : null }) : null;
  const ledgerGroups = lab && (lab.state === 'ready' || lab.state === 'basic') ? lab.groups.map((g) => g.id) : null;
  const swot = buildSwot({ attempt, allAttempts: earlier, answerReviews, answerReviewState, missedBefore: {}, now, ledgerGroups });
  const mistakeInsights = buildMistakeInsights({ attempt, allAttempts: earlier, missedBefore: {}, answerReviews });
  return { attempt, swot, mistakeInsights, answerReviewState, answerReviews, lab };
}

// The slice 2 papers and their contracts, loaded only when asked for (they are large and development-only).
const REPLAY_PAPERS = {
  full: () => Promise.all([
    import('../../../../data/tests/fixtures/mistake_lab/replay_full_input.json'),
    import('../../../../data/tests/fixtures/mistake_lab/contract_replay_v1.json'),
  ]),
  time_up: () => Promise.all([
    import('../../../../data/tests/fixtures/mistake_lab/replay_time_up_input.json'),
    import('../../../../data/tests/fixtures/mistake_lab/contract_replay_time_up_v1.json'),
  ]),
  nta: () => Promise.all([
    import('../../../../data/tests/fixtures/mistake_lab/replay_nta_input.json'),
    import('../../../../data/tests/fixtures/mistake_lab/contract_replay_nta_v1.json'),
  ]),
  bst: () => Promise.all([
    import('../../../../data/tests/fixtures/mistake_lab/replay_bst_input.json'),
    import('../../../../data/tests/fixtures/mistake_lab/contract_replay_bst_v1.json'),
  ]),
  english: () => Promise.all([
    import('../../../../data/tests/fixtures/mistake_lab/replay_english_input.json'),
    import('../../../../data/tests/fixtures/mistake_lab/contract_replay_english_v1.json'),
  ]),
};

/**
 * The Replay preview: one slice 2 paper (`paper` is 'full', 'time_up', 'nta', 'bst' or 'english'), completed an hour
 * ago, with its committed lab contract, and the SWOT and record lines built over it as the route would.
 */
export async function fixtureReplayMock(paperName = 'full', { marks = null } = {}) {
  const load = REPLAY_PAPERS[paperName] || REPLAY_PAPERS.full;
  const [{ default: input }, { default: contract }] = await load();
  const now = Date.now();
  const src = JSON.parse(JSON.stringify(input.attempt));
  const right = src.details.filter((d) => d.isCorrect === true).length;
  const wrong = src.details.filter((d) => d.isCorrect === false).length;
  const mode = src.selectionMeta?.mode || 'full';
  const attempt = {
    ...src, id: 'fixture-attempt', mode, completedAt: now - 3_600_000,
    score: right * 5 - wrong, correct: right, wrong, unattempted: src.details.length - right - wrong, total: src.questionsSnapshot.length,
  };
  // ?marks=more (preview only): six more questions marked for review in the record the SWOT reads, so its marked
  // line shows. The committed contract's Replay still draws only the marks it was built from.
  if (marks === 'more') {
    const rec = attempt.selectionMeta.recovery;
    const last = Math.max(0, ...(rec.marks || []).map((m) => m.seq || 0));
    const more = ['q3', 'q5', 'q12', 'q19', 'q28', 'q40'].map((qid, i) => ({ seq: last + 1 + i, qid, at: 60_000 * (i + 1), marked: true }));
    attempt.selectionMeta = { ...attempt.selectionMeta, recovery: { ...rec, marks: [...(rec.marks || []), ...more] } };
  }
  const lab = JSON.parse(JSON.stringify(contract));
  const answerReviews = { ...(input.answerReviews || {}) };
  const earlier = earlierPapers(now);
  const ledgerGroups = lab.state === 'ready' || lab.state === 'basic' ? lab.groups.map((g) => g.id) : null;
  const swot = buildSwot({ attempt, allAttempts: earlier, answerReviews, answerReviewState: 'ready', missedBefore: {}, now, ledgerGroups });
  const mistakeInsights = buildMistakeInsights({ attempt, allAttempts: earlier, missedBefore: {}, answerReviews });
  return { attempt, swot, mistakeInsights, answerReviewState: 'ready', answerReviews, lab };
}

// A v3 Mistake Repair payload (fixture text, no model call, no credit). `stored` is the free reopen.
export function fixtureRepairV3({ stored = false, practiceChapter = 'Share Capital' } = {}) {
  const chapterParam = encodeURIComponent(practiceChapter).replace(/%20/g, '+');
  const practiceHref = `/test?subject=accountancy&mode=quick&count=5&chapter=${chapterParam}&recoveryFrom=fixture-attempt`;
  return {
    ok: true, status: stored ? 'stored' : 'explained', charged: stored ? 0 : 1, wallet: stored ? null : { total: 67, state: 'available' },
    chosenIndex: 0, keyIndex: 2, practiceHref,
    practiceAction: { type: 'practice', subject: 'accountancy', chapter: practiceChapter, mode: 'quick', count: 5, attemptId: 'fixture-attempt' },
    pattern: { line: 'Since 9 Oct, 2 of your 3 repairs in Share Capital had this trap.', scope: 'chapter', k: 2, n: 3, trapType: 'wrong_rule' },
    repair: {
      version: 3, trap_type: 'wrong_rule',
      trap: 'Illustrative: option A applies the old ratio. It is the first ratio in the question, and it is the right rule in the most common textbook case.',
      why_wrong: 'Illustrative: here a new ratio is stated, so each partner gave up a different share. Using the old ratio assumes both gave up shares in 3:2.',
      why_right: 'Illustrative: sacrifice is old share minus new share, worked out for each partner. That gives the key, option C.',
      contrast: 'If the question had said the incoming partner takes the share in the old ratio, option A would be right. It states a new ratio, so option C.',
      others: [
        { index: 1, why: 'Illustrative: this is the gaining ratio, the new share minus the old share, so it turns the subtraction around.' },
        { index: 3, why: 'Illustrative: this treats the incoming partner’s share as equal, which the question does not say.' },
      ],
      rule: 'Illustrative: sacrifice = old share − new share, for each partner.',
      memory_hook: 'Sacrifice is what you had, minus what you keep.',
      another_way: 'Illustrative: put every share over 10 first. Old shares 6 and 4, new shares 4 and 4, so the sacrifice is 2 and 0. Only one partner gives anything up.',
      why_tempting: 'Illustrative: option A applies the old ratio.', key_idea: 'Illustrative: sacrifice = old share − new share, for each partner.',
      model: 'fixture', generatedAt: new Date().toISOString(),
    },
  };
}

// ---------- Slice 3: Across your mocks, the Rule book, the rule check, repair order ----------

/** Across your mocks in one of its three states: the committed contract (ready), or the none and below-gate shells. */
export function fixtureAcross(state = 'ready') {
  const A = LAB_COPY.across;
  const shell = (s, mocks, message) => ({ version: 1, state: s, title: A.title, mocks, message, basis: null, lines: [], more: [], showAll: null, showFewer: A.showFewer });
  if (state === 'none') return shell('none', 0, A.none);
  if (state === 'below_gate') return shell('below_gate', 1, A.belowGate.one);
  return JSON.parse(JSON.stringify(ACROSS));
}

/** The Rule book in a state: 'ready' (the contract), 'few' (repairs only; the habits below their gate), 'new' (nothing yet). */
export function fixtureRuleBook(state = 'ready') {
  const book = JSON.parse(JSON.stringify(RULES.book));
  if (state === 'ready') return book;
  const R = LAB_COPY.rules;
  const habits = { state: 'below_gate', gateLine: R.habitsGate.replace('{n}', state === 'new' ? '0' : '1'), rules: [] };
  const repairs = state === 'new' ? { empty: R.repairsEmpty, chapters: [] } : book.repairs;
  const unmark = (r) => ({ ...r, active: false });
  const kept = { empty: repairs.empty, chapters: repairs.chapters.map((ch) => ({ ...ch, rules: ch.rules.map(unmark) })) };
  const count = kept.chapters.reduce((n, ch) => n + ch.rules.length, 0);
  return { ...book, count, countLabel: R.countLabel.replace('{n}', String(count)), active: null, repairs: kept, habits, basis: state === 'new' ? null : LAB_COPY.across.basis.one };
}

export const FIXTURE_PLAYBOOK = RULES.playbook;

/** The lab with the slice 3 parts the route adds (data/lab_loop.js), for the preview's Full mock. */
export function fixtureLabLoop({ lab, attempt, answerReviews = {}, across = 'ready', ruleCheck = 'kept', order = 'cohort' } = {}) {
  if (!lab) return lab;
  const repairOrder = buildRepairOrder({ lab: order === 'paper' ? { ...lab, byQuestion: {} } : lab, attempt, answerReviews });
  return {
    ...lab,
    acrossMocks: fixtureAcross(across),
    repairOrder,
    rules: JSON.parse(JSON.stringify(RULES.summary)),
    prove: { ...(lab.prove || {}), ruleCheck: ruleCheck === 'none' ? null : JSON.parse(JSON.stringify(RULECHECK[ruleCheck] || RULECHECK.kept)) },
  };
}

// ---------- Slice 4: the trap tag, Same mistakes later, Traps you meet and Revise ----------

/**
 * The lab with slice 4 (data/lab_loop.js buildLabSlice4), for the preview's Full mock: illustrative trap atlas rows on
 * three of the paper's wrong answers (a look-alike term, the wrong rule, a reversed relation), the real builders over them,
 * and lab.prove.later for the paper. `&traps=off` leaves slice 4 out (the Lab as it was).
 */
export function fixtureSlice4({ lab, attempt, answerReviews = {}, traps = 'on' } = {}) {
  if (!lab || traps === 'off') return lab;
  const snapshot = new Map((attempt.questionsSnapshot || []).map((q) => [q.id, q]));
  const types = ['look_alike_term', 'wrong_rule', 'reversed'];
  const wrong = (attempt.details || []).filter((d) => d.isCorrect === false && Number.isInteger(d.givenIndex) && !answerReviews[d.qid]);
  const rows = wrong.slice(0, 3).map((d, i) => ({ qid: d.qid, option_hash: optionHash(snapshot.get(d.qid).options[d.givenIndex]), trap_type: types[i], repairs_agreeing: 2, repairs_disagreeing: 0, source: 'repair' }));
  const tags = buildTrapTags({ attempt, answerReviews, lab, atlas: indexAtlas(rows) });
  const later = buildLater({ attempt, allAttempts: [attempt], answerReviews, cards: null, now: Date.now() });
  return { ...lab, ...(tags ? { traps: tags } : {}), prove: { ...(lab.prove || {}), ...(later ? { later } : {}) } };
}

/** GET /api/me/traps: the committed `sheet` contract, or `empty`. */
export const fixtureTrapsMeet = (kind = 'ready') => JSON.parse(JSON.stringify(kind === 'empty' ? TRAPS.empty : TRAPS.sheet));
/** GET /api/me/revise: the committed contract, or the empty state. */
export function fixtureRevise(kind = 'ready') {
  const body = JSON.parse(JSON.stringify(LATER.revise));
  if (kind !== 'empty') return body;
  return { ...body, state: 'empty', items: [], shown: 0, due: 0, minutes: 0, boxes: [0, 0, 0, 0], cards: 0, head: LAB_COPY.revise.head.none, summary: null, next: LAB_COPY.revise.nextNone, nextDay: null, nextDayLabel: null };
}
/** POST /api/me/revise/answer: the committed right, wrong and done answers (the key of every fixture question is B). */
export const fixtureReviseAnswer = (choice, box = 1) => JSON.parse(JSON.stringify(choice === 1 ? (box >= 4 ? LATER.answers.done : LATER.answers.right) : LATER.answers.wrong));
