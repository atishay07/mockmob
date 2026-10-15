// Development-only mock-paper fixtures for /preview/arena?view=result&mock=full|nta. The papers are made of
// illustrative questions, scored by the real server scorer, and the SWOT, the "From your record" lines and the
// Mistake Lab come from the real builders (data/mock_swot.js, data/mistake_insights.js, data/mistake_lab.js) over a
// short earlier record, so the panels the preview shows are the ones the route would send. Never real bank rows,
// never real students.
// mock=full is the Mistake Lab's 50-question fixture paper (every ledger group, 5 answer changes, Q14 held, Q45 to
// Q50 never opened) with its illustrative cohort read (full_mock_cohort.json: cohortForAttempt over the sample
// snapshot, precomputed because data/cohort_picks.js is server-only). ?lab=basic marks the device record
// inconsistent (the basic ledger); ?lab=off leaves the Lab out (the page as it was before the ledger).
// The Replay (slice 2): mock=full, with the Lab on and the checks ready, serves the paper recorded with the new capture
// (replay_full_input.json: time away, strike-outs, marks, an end event) and, as its lab, the committed contract itself
// (contract_replay_v1.json, what the server builds from that paper with the sample cohort), so the page shows exactly
// what the website and the app are built against. &paper=time_up and &paper=nta show the other two contracts (time ran
// out with Q44 open; an NTA paper ended by the third warning); &paper=bst and &paper=english the passage-set papers
// (questions shown with their set, the submit sheet); &paper=v1 the slice 1 paper above, built live.
import { scoreSession } from '../../../../data/recovery';
import { buildSwot } from '../../../../data/mock_swot';
import { buildMistakeInsights } from '../../../../data/mistake_insights';
import { buildMistakeLab } from '../../../../data/mistake_lab';
import LAB_PAPER from '../../../../data/tests/fixtures/mistake_lab/full_mock_input.json';
import LAB_COHORT from '../../../../data/tests/fixtures/mistake_lab/full_mock_cohort.json';

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
  const recovery = labMode === 'basic' ? { ...src.selectionMeta.recovery, telemetry: 'inconsistent' } : src.selectionMeta.recovery;
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
export async function fixtureReplayMock(paperName = 'full') {
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
