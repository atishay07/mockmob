// Preview views for IA6: the Review hub, Ask Mobi and the old recovery journey. Replaces the legacy review, prepos and recovery
// views by using those names. Your record (radar) and Saved questions (saved) keep their legacy views: only their headers changed.
// Owned by the IA6 builder; no other packet edits this file.
//
// Contract (src/app/preview/arena/views/index.js):
//   views     { [name]: { route, render(ctx), shell?: false, toolbar?(ctx), moderatorOnly?, linkKeys? } }
//             Open with /preview/arena?view=<name>. A name already in legacy.jsx replaces that view.
//             ctx = { params (URLSearchParams of the page), pro (boolean), openDrawer() }.
//             route is the path the shell treats as current ('/today'); its last segment is the
//             previewLinks key, so the shell's links stay inside the preview.
//   handlers  [(req) => Promise<Response> | null]. Fixture API replies, tried before the built-in
//             fixtures in ArenaPreviewClient. req = { url (URL), method, init, fixture (URLSearchParams
//             of the page), json(body, status = 200) }. Return null to pass. Never call a real write.
//
// What these views answer (every reply is illustrative data, no real read or write):
//   ?view=review                         tonight's repair, rich (4 mistakes across 3 chapters, 8 past results, a repair record)
//   &state=thin                          one quick practice, 3 mistakes in one chapter, nothing repaired yet, no finding
//   &state=clear                         every mistake repaired ("Nothing waiting to repair")
//   &state=empty                         no practice yet ("Your mistakes gather here")
//   &state=nolist                        tonight's paper is known but its chapter list did not load
//   &state=error                         every read fails with a server error
//   &state=offline                       every read fails as if the device were offline
//   &data=loading|error                  the shared loading and error states (ArenaPreviewClient)
//   ?view=prepos (Ask Mobi)              a signed-in student with 9 of 10 AI credits
//   &wallet=paused|empty|down            written replies paused, no credits left, or the balance unreadable
//   &chat=1                              a conversation already on screen: one reply from the record, one written reply
import ReviewHubClient from '@/app/(app)/review/ReviewHubClient';
import RecoveryJourney from '@/app/(app)/recovery/RecoveryJourney';
import MockMobAIHub from '@/components/ai/MockMobAIHub';
import { projectWallet, unreadableWallet, walletWindow } from '@/services/credits/aiWalletState';

const DAY = 86_400_000;
const STATES = ['rich', 'thin', 'clear', 'empty', 'nolist', 'error', 'offline'];
const onReview = (fixture) => fixture.get('view') === 'review';
const onAsk = (fixture) => fixture.get('view') === 'prepos';
const stateOf = (fixture) => (STATES.includes(fixture.get('state')) ? fixture.get('state') : 'rich');

const CHAPTERS = ['Partnership fundamentals', 'Goodwill valuation', 'Reconstitution of a partnership', 'Company accounts', 'Cash flow statement', 'Financial statement analysis'];
const WRONG = { 3: CHAPTERS[0], 7: CHAPTERS[0], 12: CHAPTERS[0], 15: CHAPTERS[1], 21: CHAPTERS[2], 30: CHAPTERS[2], 38: CHAPTERS[3], 44: CHAPTERS[4] };
const REPAIRED = [7, 21, 38, 44];
const BLANKS = [2, 9, 18, 24, 27, 33, 36, 41, 45, 47, 49];

// The paper tonight's repair points at: 50 questions, 8 answered wrong, 11 left blank.
function paper(id, now, { wrong = WRONG, blanks = BLANKS } = {}) {
  const questionsSnapshot = Array.from({ length: 50 }, (_, i) => ({ id: `${id}-q${i + 1}`, chapter: wrong[i + 1] || CHAPTERS[(i + 1) % CHAPTERS.length] }));
  const details = questionsSnapshot.map((q, i) => ({ qid: q.id, isCorrect: wrong[i + 1] ? false : blanks.includes(i + 1) ? null : true }));
  return { id, subject: 'accountancy', mode: 'full', completedAt: now - 2 * DAY, questionsSnapshot, details };
}

const slim = (id, subject, mode, daysAgo, correct, wrong, total, now) => ({
  id, subject, mode, correct, wrong, unattempted: total - correct - wrong, total, marks: correct * 5 - wrong, maxMarks: total * 5, completedAt: now - daysAgo * DAY,
  formatId: `${mode}:${subject}:q${total}:server_snapshot_v1`,
});

function summaryFor(state, now) {
  if (state === 'empty') return [];
  if (state === 'thin') return [slim('rv-thin', 'accountancy', 'quick', 1, 7, 3, 10, now)];
  return [
    slim('rv1', 'accountancy', 'full', 2, 31, 8, 50, now),
    slim('rv2', 'economics', 'quick', 3, 6, 4, 10, now),
    slim('rv3', 'accountancy', 'full', 6, 27, 12, 50, now),
    slim('rv4', 'business_studies', 'quick', 7, 9, 1, 10, now),
    slim('rv5', 'english', 'quick', 8, 10, 0, 10, now),
    slim('rv6', 'accountancy', 'nta', 9, 22, 14, 50, now),
    slim('rv7', 'economics', 'full', 12, 25, 9, 50, now),
    slim('rv8', 'accountancy', 'quick', 14, 8, 2, 10, now),
  ];
}

const repairRow = (attemptId, n, chapter, foundDaysAgo, repairedDaysAgo, now) => ({
  attemptId, questionId: `${attemptId}-q${n}`, chapter, subject: 'accountancy',
  foundAt: new Date(now - foundDaysAgo * DAY).toISOString(), repairedAt: new Date(now - repairedDaysAgo * DAY).toISOString(), checkedState: 'not_available',
});

function repairsFor(state, now) {
  if (state === 'empty' || state === 'thin') return [];
  const tonight = REPAIRED.map((n, i) => repairRow('rv1', n, WRONG[n], 2, 1 - i * 0.1, now));
  const older = [[5, 'Partnership fundamentals'], [11, 'Goodwill valuation'], [19, 'Reconstitution of a partnership']].map(([n, c], i) => repairRow('rv3', n, c, 6, 5 - i * 0.2, now));
  if (state === 'clear') return [...tonight, ...[3, 12, 15, 30].map((n) => repairRow('rv1', n, WRONG[n], 2, 0.5, now)), ...older];
  return [...tonight, ...older];
}

function planFor(state, now) {
  const attempts = summaryFor(state, now).map((a) => ({ id: a.id, subject: a.subject, mode: a.mode, completedAt: new Date(a.completedAt).toISOString(), wrong: a.wrong }));
  const open = state === 'thin' ? 3 : state === 'clear' || state === 'empty' ? 0 : 4;
  const id = state === 'thin' ? 'rv-thin' : 'rv1';
  const repair = open > 0 ? { attemptId: id, subject: 'accountancy', mode: state === 'thin' ? 'quick' : 'full', completedAt: new Date(now - (state === 'thin' ? 1 : 2) * DAY).toISOString(), open } : null;
  return { moveFacts: { attempts, openSession: null, unopenedResult: null, repair, weakChapter: null, freshCheck: null, capabilities: { mistakeRepair: true, freshCheck: false } } };
}

// The thin paper: a quick practice of 10, 3 wrong, all in one chapter.
function thinPaper(now) {
  const questionsSnapshot = Array.from({ length: 10 }, (_, i) => ({ id: `rv-thin-q${i + 1}`, chapter: 'Partnership fundamentals' }));
  const details = questionsSnapshot.map((q, i) => ({ qid: q.id, isCorrect: [2, 5, 9].includes(i + 1) ? false : true }));
  return { id: 'rv-thin', subject: 'accountancy', mode: 'quick', completedAt: now - DAY, questionsSnapshot, details };
}

function wallet(fixture, { allowance = 10, used = 1 } = {}) {
  const kind = fixture.get('wallet');
  if (kind === 'down') return unreadableWallet('schema_unavailable');
  const window = walletWindow();
  return projectWallet({ included_monthly_credits: allowance, included_credits_used: kind === 'empty' ? allowance : used, bonus_credits: 0, period_start: window.periodStart, reset_at: window.resetAt },
    { paid: fixture.get('plan') === 'pro', includedMonthlyCredits: allowance, paidAiOpen: kind !== 'paused' });
}

const credits = (fixture, json) => {
  const w = wallet(fixture);
  return json({ ok: true, state: w.state, message: w.message, wallet: w, practiceCredits: { balance: 40, label: 'Practice credits' } });
};

export const handlers = [
  // Review hub
  ({ url, fixture, json }) => {
    if (!onReview(fixture)) return null;
    const state = stateOf(fixture);
    const now = Date.now();
    const offlineReads = ['/api/learning/plan', '/api/attempts/summary', '/api/me/repair-record'];
    if (state === 'offline' && offlineReads.includes(url.pathname)) return Promise.reject(new TypeError('Failed to fetch'));
    if (state === 'error' && (offlineReads.includes(url.pathname) || url.pathname.startsWith('/api/attempts/'))) return json({ error: 'Illustrative server failure' }, 503);
    if (url.pathname === '/api/learning/plan') return json(planFor(state, now));
    if (url.pathname === '/api/attempts/summary') return json({ items: summaryFor(state, now), nextCursor: null });
    if (url.pathname === '/api/me/repair-record') return json({ repairs: repairsFor(state, now) });
    if (url.pathname === '/api/attempts/rv1') return state === 'nolist' ? json({ error: 'Illustrative read failure' }, 503) : json(paper('rv1', now));
    if (url.pathname === '/api/attempts/rv-thin') return json(thinPaper(now));
    if (url.pathname === '/api/ai/credits') return credits(fixture, json);
    if (url.pathname === '/api/prepos/insights' && (state === 'thin' || state === 'empty')) return json({ ok: true, insights: { state: 'empty', sessions: 0, questions: 0 }, findings: [] });
    return null;
  },
  // Ask Mobi
  ({ url, method, fixture, json, init }) => {
    if (!onAsk(fixture)) return null;
    if (url.pathname === '/api/ai/credits') return credits(fixture, json);
    if (url.pathname === '/api/ai/mentor/history') {
      if (fixture.get('chat') !== '1') return null;
      return json({ ok: true, session: { id: 'ask-preview' }, messages: [
        { id: 'h1', role: 'user', text: 'Where am I losing marks?' },
        { id: 'h2', role: 'assistant', response: { reply: 'Partnership fundamentals is costing you the most: 6 wrong of 9 answered across your last two mocks. Goodwill valuation is next, with 2 wrong of 5.', actions: [{ label: 'Open Review', type: 'navigate', route: '/review' }], origin: 'record' } },
        { id: 'h3', role: 'user', text: 'How should I think about sacrificing ratio questions?' },
        { id: 'h4', role: 'assistant', response: { reply: 'Work out each partner’s old share and new share over the same denominator, then subtract: sacrifice is old minus new. Do that before you look at the options, so the ratio in the stem cannot pull you toward the old one.', actions: [], origin: 'model', charge: { kind: 'prepos_credit', amount: 1 } } },
      ] });
    }
    if (url.pathname === '/api/ai/mentor/chat' && method === 'POST') {
      let body = {};
      try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
      if (body.replyKind !== 'model') return null;
      if (fixture.get('wallet') === 'empty') return json({ ok: false, message: 'Illustrative: no credits left.' }, 402);
      return json({ ok: true, runtimeState: 'live', sessionId: 'ask-preview', response: { reply: 'Illustrative written reply: separate the capital adjustments from the goodwill entry, then say what each debit and credit shows before you try a new question.', actions: [], charge: { kind: 'prepos_credit', amount: 1 } } });
    }
    return null;
  },
];

function StatePicker({ params }) {
  const current = stateOf(params);
  const go = (state) => {
    const next = new URLSearchParams(window.location.search);
    next.set('state', state);
    window.location.href = `${window.location.pathname}?${next}`;
  };
  return (
    <label>State
      <select value={current} onChange={(event) => go(event.target.value)}>
        {STATES.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  );
}

export const views = {
  review: {
    route: '/review',
    render: () => <ReviewHubClient />,
    toolbar: ({ params }) => <StatePicker params={params} />,
  },
  prepos: {
    route: '/mentor',
    render: () => <div className="student-page student-page--mentor"><MockMobAIHub variant="page" /></div>,
    toolbar: ({ openDrawer }) => <button type="button" className="arena-chip" onClick={openDrawer}>Preview Ask Mobi drawer</button>,
  },
  // /recovery now redirects to /review while the old episodes are off, so the preview renders the journey itself.
  recovery: { route: '/recovery', render: () => <RecoveryJourney /> },
};
