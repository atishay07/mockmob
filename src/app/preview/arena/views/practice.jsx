// Preview views for IA5: Practice (/dashboard) with its confirm line, locks and costs. The Question stream is the
// existing `explore` view (legacy.jsx); it renders the restyled stream. Owned by the IA5 builder; no other packet edits this file.
//
// Contract (src/app/preview/arena/views/index.js):
//   views     { [name]: { route, render(ctx), shell?: false, toolbar?(ctx), moderatorOnly?, linkKeys? } }
//             Open with /preview/arena?view=<name>. A name already in legacy.jsx replaces that view.
//             ctx = { params (URLSearchParams of the page), pro (boolean), openDrawer() }.
//   handlers  [(req) => Promise<Response> | null]. Fixture API replies, tried before the built-in
//             fixtures in ArenaPreviewClient. req = { url (URL), method, init, fixture (URLSearchParams
//             of the page), json(body, status = 200) }. Return null to pass. Never call a real write.
//
// What this view answers (every reply is illustrative data, no real read or write):
//   ?view=practice                          the usual evening: Tonight's move is "practise a weak chapter"
//   &move=first|resume|unopened|repair|practise|mock-due|stale|none
//                                           the fixture in data/fixtures/next_step, its times moved to now
//                                           (none: the plan could not be read, so the card is left out)
//   &subject=&mode=&count=&chapter=&interface=nta
//                                           the prefill contract, exactly as a "Do these next" link sends it
//   &plan=pro                               a Pro student ("Included with Pro.")
//   &credits=4                              a free student with 4 practice credits (the quote says not enough)
//   &stale=1                                two saved subjects that cannot start practice
//   &subjects=none                          no subject the bank supports (the empty state)
//   &inventory=down                         the question bank could not be read (built-in)
//   &study=off                              Concepts hidden (the study flag is off in production today)
//   &brand=art                              the app's photo-real subject objects (development preview of the flag)
//   &data=loading|error                     the shared loading and error states (ArenaPreviewClient)
import DashboardPageClient from '@/app/(app)/dashboard/DashboardPageClient';
import { buildPracticeQuote } from '@/../data/practice_quote';
import { learningPlan } from '@/../data/learning_engine';
import { FIXTURE_SUBJECTS } from '../previewFixtures';
import first from '@/../data/fixtures/next_step/first.json';
import resume from '@/../data/fixtures/next_step/resume.json';
import unopened from '@/../data/fixtures/next_step/unopened.json';
import repair from '@/../data/fixtures/next_step/repair.json';
import practise from '@/../data/fixtures/next_step/practise.json';
import mockDue from '@/../data/fixtures/next_step/mock-due.json';
import stale from '@/../data/fixtures/next_step/stale.json';

const FIXTURES = { first, resume, unopened, repair, practise, 'mock-due': mockDue, stale };
const MOVES = [...Object.keys(FIXTURES), 'none'];
const VIEWS = ['practice', 'dashboard'];

const onPractice = (fixture) => VIEWS.includes(fixture.get('view'));
const moveOf = (fixture) => (MOVES.includes(fixture.get('move')) ? fixture.get('move') : 'practise');

// The server's moveFacts (src/lib/server/todayFacts.js) from a fixture, with every time moved so the fixture's "now" is
// the real now. The weak chapter is one the preview's own subject has, so the prefill lands on a real chapter.
function factsFor(name) {
  const { input } = FIXTURES[name];
  const shift = Date.now() - Date.parse(input.now);
  const at = (t) => new Date(Date.parse(t) + shift).toISOString();
  const weak = input.weakChapter && input.weakChapter.subject === 'accountancy'
    ? { ...input.weakChapter, chapter: 'Partnership Fundamentals', href: '/dashboard?subject=accountancy&mode=quick&count=10&chapter=Partnership%20Fundamentals' }
    : input.weakChapter || null;
  return {
    attempts: (input.attempts || []).map((a) => ({ id: a.id, subject: a.subject, mode: a.mode, completedAt: at(a.completedAt), wrong: 0 })),
    openSession: input.openSession || null,
    unopenedResult: input.unopenedResult || null,
    repair: input.repair ? { ...input.repair, completedAt: at(input.repair.completedAt) } : null,
    weakChapter: weak,
    freshCheck: input.freshCheck || null,
    capabilities: { mistakeRepair: true, freshCheck: false, ...(input.capabilities || {}) },
  };
}

const COUNTS = { accountancy: 640, economics: 720, business_studies: 580, english: 12 };

export const handlers = [
  ({ url, fixture, json }) => {
    if (!onPractice(fixture)) return null;
    if (url.pathname === '/api/learning/plan') {
      const name = moveOf(fixture);
      return json({ ...learningPlan({ minutes: 10 }), episodes: [], supportedConcepts: [], pathwayState: 'blocked_content', recordState: 'ready', ordinaryAttemptCount: 1, moveFacts: name === 'none' ? null : factsFor(name) });
    }
    // ?subjects=none: the bank supports none of the saved subjects, so the empty state shows.
    if (url.pathname === '/api/subjects' && fixture.get('subjects') === 'none') {
      return json(FIXTURE_SUBJECTS.map((subject) => ({ ...subject, practice: 'planned', practiceReason: 'Practice for this subject is not open yet.' })));
    }
    // ?credits=N: a free student with N practice credits. The built-in quote pins 40.
    if (url.pathname === '/api/practice/quote' && fixture.get('credits') !== null && Number.isFinite(Number(fixture.get('credits')))) {
      const pro = fixture.get('plan') === 'pro';
      const inventory = fixture.get('inventory') === 'down' ? { state: 'unavailable' }
        : { state: 'available', checkedAt: new Date().toISOString(), subjectCounts: COUNTS };
      return json(buildPracticeQuote({
        user: { id: 'preview-user', isPremium: pro, premiumUntil: pro ? '2027-07-31T18:29:59.000Z' : null, creditBalance: Number(fixture.get('credits')) },
        subject: url.searchParams.get('subject'), mode: url.searchParams.get('mode'), count: Number(url.searchParams.get('count')),
        inventory, allowance: { enabled: false, used: false }, token: `preview-${Date.now()}`,
      }));
    }
    return null;
  },
];

const CASES = [
  ['Usual evening', {}],
  ['Prefilled link', { subject: 'accountancy', mode: 'quick', count: '15', chapter: 'Partnership Fundamentals' }],
  ['Full mock link', { subject: 'economics', mode: 'full' }],
  ['NTA mode, free (locked)', { mode: 'nta', interface: 'nta' }],
  ['Smart practice, free (locked)', { mode: 'smart' }],
  ['Low credits', { credits: '4' }],
  ['Pro', { plan: 'pro' }],
  ['Pro, NTA mode', { plan: 'pro', mode: 'nta', interface: 'nta' }],
  ['Pro, smart length adjusted', { plan: 'pro', mode: 'smart', count: '5' }],
  ['First move', { move: 'first' }],
  ['Repair first', { move: 'repair' }],
  ['No suggestion', { move: 'none' }],
  ['Unknown chapter', { subject: 'accountancy', chapter: 'Not a chapter' }],
  ['Subject not on the sheet', { subject: 'physics' }],
  ['Stale subjects', { stale: '1' }],
  ['No practice subjects', { subjects: 'none' }],
  ['Question bank down', { inventory: 'down' }],
  ['Concepts hidden', { study: 'off' }],
];

function CasePicker({ params }) {
  const go = (index) => {
    const next = new URLSearchParams({ view: params.get('view') || 'practice', plan: 'free', data: params.get('data') || 'ready', ...CASES[index][1] });
    if (params.get('brand')) next.set('brand', params.get('brand'));
    window.location.href = `${window.location.pathname}?${next}`;
  };
  return (
    <label>Case
      <select defaultValue="" onChange={(event) => go(Number(event.target.value))}>
        <option value="" disabled>Choose a case</option>
        {CASES.map(([name], index) => <option key={name} value={index}>{name}</option>)}
      </select>
    </label>
  );
}

const render = ({ params }) => <DashboardPageClient studyEnabled={params.get('study') !== 'off'} />;

export const views = {
  practice: { route: '/dashboard', linkKeys: ['practice'], render, toolbar: ({ params }) => <CasePicker params={params} /> },
  // The original view name shows the same page.
  dashboard: { route: '/dashboard', linkKeys: ['practice'], render, toolbar: ({ params }) => <CasePicker params={params} /> },
};
