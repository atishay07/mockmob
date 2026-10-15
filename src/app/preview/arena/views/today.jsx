// Preview views for IA2: Today (states first, resume, unopened, repair, practise, mock-due, stale from data/fixtures/next_step). Replaces the legacy today view by using the name today.
// Owned by the IA2 builder; no other packet edits this file.
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
// What this view answers (every reply is illustrative data, no real read or write):
//   ?view=today                       the repair state (the usual evening)
//   &state=first|resume|unopened|repair|practise|mock-due|stale|pro-daytime|repair-off|check-gated
//                                     the fixture in data/fixtures/next_step, its times moved to now
//   &data=empty                       a student with no record (state first)
//   &data=loading|error               the shared loading and error states (ArenaPreviewClient)
//   &rhythm=fresh|some|met|returning  the week card (built-in)
//   &goal=unset                       no weekly goal chosen yet ("Set your goal")
//   &sheet=missing|done               the "Finish your sheet" card (shown by default on state first)
//   &plan=pro                         a Pro student ("Included with Pro.")
import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import TodayPage from '@/app/(app)/today/page';
import { learningPlan } from '@/../data/learning_engine';
import { projectWallet, walletWindow } from '@/services/credits/aiWalletState';
import first from '@/../data/fixtures/next_step/first.json';
import resume from '@/../data/fixtures/next_step/resume.json';
import unopened from '@/../data/fixtures/next_step/unopened.json';
import repair from '@/../data/fixtures/next_step/repair.json';
import practise from '@/../data/fixtures/next_step/practise.json';
import mockDue from '@/../data/fixtures/next_step/mock-due.json';
import stale from '@/../data/fixtures/next_step/stale.json';
import proDaytime from '@/../data/fixtures/next_step/pro-daytime.json';
import repairOff from '@/../data/fixtures/next_step/repair-off.json';
import checkGated from '@/../data/fixtures/next_step/check-gated.json';

const FIXTURES = { first, resume, unopened, repair, practise, 'mock-due': mockDue, stale, 'pro-daytime': proDaytime, 'repair-off': repairOff, 'check-gated': checkGated };
const STATES = Object.keys(FIXTURES);

const onToday = (fixture) => fixture.get('view') === 'today';
function stateOf(fixture) {
  const wanted = fixture.get('state');
  if (STATES.includes(wanted)) return wanted;
  return fixture.get('data') === 'empty' ? 'first' : 'repair';
}

// The server's moveFacts (src/lib/server/todayFacts.js) from a fixture, with every time moved so the
// fixture's "now" is the real now: "Tuesday's mock" and "6 days away" stay true whenever it is opened.
function factsFor(name) {
  const { input } = FIXTURES[name];
  const shift = Date.now() - Date.parse(input.now);
  const at = (t) => new Date(Date.parse(t) + shift).toISOString();
  return {
    attempts: (input.attempts || []).map((a) => ({ id: a.id, subject: a.subject, mode: a.mode, completedAt: at(a.completedAt), wrong: 0 })),
    openSession: input.openSession || null,
    unopenedResult: input.unopenedResult || null,
    repair: input.repair ? { ...input.repair, completedAt: at(input.repair.completedAt) } : null,
    weakChapter: input.weakChapter || null,
    freshCheck: input.freshCheck || null,
    capabilities: { mistakeRepair: true, freshCheck: false, ...(input.capabilities || {}) },
  };
}

export const handlers = [
  ({ url, fixture, json }) => {
    if (!onToday(fixture)) return null;
    const name = stateOf(fixture);
    const { input } = FIXTURES[name];
    if (url.pathname === '/api/learning/plan') {
      return json({ ...learningPlan({ minutes: 10 }), episodes: [], supportedConcepts: [], pathwayState: 'blocked_content', recordState: 'ready', ordinaryAttemptCount: input.attempts?.length || 0, moveFacts: factsFor(name) });
    }
    if (url.pathname === '/api/ai/credits') {
      const pro = fixture.get('plan') === 'pro';
      const allowance = pro ? 50 : 10;
      const left = Math.min(allowance, Math.max(0, input.aiCredits ?? allowance));
      const wallet = projectWallet({ included_monthly_credits: allowance, included_credits_used: allowance - left, bonus_credits: 0, period_start: walletWindow().periodStart, reset_at: walletWindow().resetAt }, { paid: pro, includedMonthlyCredits: allowance, paidAiOpen: true });
      return json({ ok: true, state: wallet.state, message: wallet.message, wallet, practiceCredits: { balance: input.practiceCredits ?? 40, label: 'Practice credits' } });
    }
    if (url.pathname === '/api/me/goal') return json({ daysPerWeek: 4, timezone: 'Asia/Kolkata', pausedUntil: null, set: fixture.get('goal') !== 'unset' });
    return null;
  },
];

// The preview user has no course or colleges (the site keeps neither yet), so the card is shown by
// asking for it: state first shows it by default, as a new student would see it.
function WithSheet({ missing, children }) {
  const auth = useContext(AuthContext);
  if (!missing || !auth?.user) return children;
  return <AuthContext.Provider value={{ ...auth, user: { ...auth.user, course: null, colleges: [] } }}>{children}</AuthContext.Provider>;
}

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
  today: {
    route: '/today',
    render: ({ params }) => {
      const sheet = params.get('sheet');
      const missing = sheet === 'missing' || (sheet !== 'done' && stateOf(params) === 'first');
      return <WithSheet missing={missing}><TodayPage /></WithSheet>;
    },
    toolbar: ({ params }) => <StatePicker params={params} />,
  },
};
