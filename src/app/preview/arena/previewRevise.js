// Development-only fixtures for Revise as one queue (/preview/arena?view=revise; LEARN-REVIEW-1017 5.8, packet P-LR2).
// The design student of data/tests/fixtures/review/student.json: 8 due today = 5 questions back (one of them a repaired mistake),
// 1 Check it held and 2 concept cards. ?revise= picks the state:
//   ready (default)   the 8 above, card 1 first; the checks and cards use the preview's own /api/recovery/check and study run
//   dedupe            a question due as a wrong answer AND as a repaired mistake plays once (revise_dedupe.json)
//   cards             only the concept cards (the same as /review/revise?source=cards)
//   legacy            an older server: the v1 body without `queue`
//   empty | down      as before (previewMock.js fixtureRevise)
// The questions and lessons are illustrative, written for the preview, never bank rows. Every key is B (index 1), which is what
// fixtureReviseAnswer (previewMock.js) grades.
import { createStudyRun, publicStudyItem, studyTransition } from '@/../data/study_engine';
import { headLine, mergeQueue, mixLine } from '@/components/revise/reviseQueue';

const TODAY = '2026-10-17';
const q = (id, chapter, question, options, extra = {}) => ({ questionId: id, subject: 'accountancy', chapter, question, passage: null, options, box: 1, dueDay: TODAY, source: null, ...extra });

const QUESTIONS = [
  q('rv-q42', 'Admission of a partner', 'The firm’s goodwill is valued at ₹60,000. A new partner is admitted for a 1/5 share. How much goodwill must the new partner bring in?',
    ['₹6,000', '₹12,000', '₹10,000', '₹15,000'], { dueDay: '2026-10-14', source: 'Mock 3, 16 Oct, 9:40 PM' }),
  q('rv-q38', 'Admission of a partner', 'Old partners A and B share profits 3:2 and admit C for 1/5. If C takes the whole share from A, what is the new ratio of A, B and C?',
    ['2:2:1', '2:3:1', '3:1:1', '1:3:1'], { dueDay: '2026-10-15', source: 'Mock 3, 16 Oct, 9:40 PM' }),
  q('rv-cash', 'Cash flow statement', 'Interest received by a non-financial company is shown under which activity in a cash flow statement?',
    ['Operating activities', 'Investing activities', 'Financing activities', 'Cash and cash equivalents'], { dueDay: '2026-10-16', source: 'Mock 2, 12 Oct, 10:42 PM' }),
  q('rv-q11', 'Admission of a partner', 'At admission, a partner’s share of premium for goodwill brought in privately is credited to:',
    ['The new partner’s capital account', 'The old partners’ capital accounts in the sacrificing ratio', 'The firm’s Profit and Loss Account', 'The Goodwill account'], { dueDay: '2026-10-16', box: 2, source: 'Mock 2, 12 Oct, 10:42 PM' }),
  q('rv-q45', 'Issue of shares', 'Share capital that has been called up but not yet paid by shareholders is called:',
    ['Paid-up capital', 'Calls in arrear', 'Reserve capital', 'Authorised capital'], { dueDay: '2026-10-17', source: 'Mock 3, 16 Oct, 9:40 PM' }),
];
const CHECK = { attemptId: 'fixture-attempt', questionId: 'fixture-q2', number: 27, paper: 'Mock 2', chapter: 'Change in profit sharing ratio' };

const BOXES = { 1: 'back after 1 day', 2: 'after 3 days', 3: 'after 7 days', 4: 'after 21 days' };
const LABELS = {
  title: 'Revise', sub: 'Same question, so this checks memory. A check on new questions is separate.',
  fine: 'Revise costs no credits. It does not change your record, your chapter numbers or any accuracy.', boxes: BOXES,
};

/** GET /api/me/revise for the design student. */
export function fixtureReviseQueue(kind = 'ready') {
  const again = QUESTIONS.filter((i) => i.questionId === 'rv-q11');
  let questions = QUESTIONS.filter((i) => i.questionId !== 'rv-q11');
  let checks = [CHECK];
  let cards = 2;
  let dupes = [];
  if (kind === 'dedupe') dupes = [{ ...QUESTIONS.find((i) => i.questionId === 'rv-q11') }]; // due as a wrong answer too
  if (kind === 'dedupe') questions = [...questions, ...dupes];
  if (kind === 'cards') { questions = []; checks = []; }
  const merged = mergeQueue({ questions, again: kind === 'cards' ? [] : again, checks, cards, cap: 10 });
  const items = merged.items.filter((i) => i.kind === 'question' || i.kind === 'again').map(({ kind: _kind, dueDay: _due, source: _src, ...v1 }) => v1);
  return {
    version: 1, state: 'ready', today: TODAY, cap: 10, due: merged.total, shown: items.length, answeredToday: 0, minutes: merged.minutes, boxes: [14, 8, 5, 3], cards: 30,
    nextDay: '2026-10-18', nextDayLabel: 'Sun 18 Oct', head: `${items.length} questions to revise today`, summary: '30 questions in rotation, 4 recalled twice.', next: 'The next ones are due on Sun 18 Oct.', labels: LABELS, items,
    queue: {
      version: 2, today: TODAY, cap: 10, items: merged.items, counts: merged.counts, total: merged.total, minutes: merged.minutes, unknown: merged.unknown, dropped: merged.dropped,
      cardsAvailable: 2, head: headLine(merged.total, merged.minutes), mix: mixLine(merged.counts), boxes: [14, 8, 5, 3], rotation: 30, nextDay: '2026-10-18', nextDayLabel: 'Sun 18 Oct',
    },
  };
}

/** The v1 body alone (an older server). */
export function fixtureReviseLegacy() {
  const { queue: _queue, ...v1 } = fixtureReviseQueue('ready');
  return v1;
}

// ---------------------------------------------------------------- the concept cards: the study engine's own recall run

const LESSON = { id: 'accountancy-sacrificing-gaining', title: 'Sacrificing and gaining ratios', subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio' };
const CARDS = [
  { id: 'accountancy-ratio-formula', version: 2, unitId: LESSON.id, type: 'reveal', title: 'Sacrifice and gain formulas', prompt: 'Complete the formula: sacrifice = …', answer: 'Old share − New share', explanation: 'A sacrifice is how much a share fell, so start from the old share.', cue: 'Sacrifice looks back: old minus new.' },
  { id: 'accountancy-gain-formula', version: 2, unitId: LESSON.id, type: 'reveal', title: 'Gain formula', prompt: 'Complete the formula: gain = …', answer: 'New share − Old share', explanation: 'A gain is how much a share rose, so start from the new share.', cue: 'Gain looks forward: new minus old.' },
];

export const freshCardsMemory = () => ({ run: null, events: new Map() });

const viewOf = (row) => ({
  ...row.projection, title: row.title, total: row.items.length, item: publicStudyItem(row.items[row.projection.cursor], row.projection.revealed),
  units: [LESSON], focus: null,
});

/** /api/study/runs (POST), /api/study/runs/{id} (GET) and /api/study/runs/{id}/events (POST), in this tab's memory. Returns { http, body }. */
export function fixtureStudyRun(method, pathname, input, memory) {
  if (method === 'POST' && pathname === '/api/study/runs') {
    if (!memory.run) {
      const projection = createStudyRun({ id: 'preview-recall-run', mode: 'recall', unitIds: [LESSON.id], cardIds: CARDS.map((c) => c.id) });
      memory.run = { projection, items: CARDS, title: 'Review', reviewed: [] };
    }
    return { http: 200, body: viewOf(memory.run) };
  }
  const row = memory.run;
  if (!row) return { http: 404, body: { error: 'RUN_NOT_FOUND' } };
  if (method === 'GET') return { http: 200, body: viewOf(row) };
  const earlier = memory.events.get(input.requestKey);
  if (earlier) return { http: 200, body: earlier };
  try {
    const item = row.items[row.projection.cursor];
    const result = studyTransition(row.projection, item, input);
    row.projection = result.projection;
    if (result.rating) {
      const due = new Date(Date.now() + (result.rating >= 3 ? 4 : 1) * 86_400_000).toISOString();
      row.reviewed = [...row.reviewed, { cardId: item.id, title: item.title, rating: result.rating, due, unitId: LESSON.id }];
      row.projection = { ...row.projection, lastReview: { cardId: item.id, rating: result.rating, due, unitId: LESSON.id, lessonRecommended: false }, reviewed: row.reviewed };
    }
  } catch (e) {
    return { http: 409, body: { error: e.message, message: 'That step has already moved on.' } };
  }
  const body = viewOf(row);
  memory.events.set(input.requestKey, body);
  return { http: 200, body };
}
