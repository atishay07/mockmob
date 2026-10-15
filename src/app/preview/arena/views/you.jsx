// Preview views for IA7: the You hub (/you), Account, Contribute questions, Your submissions, the
// Leaderboard and the Cutoff calculator. Replaces the legacy progress, upload, my-uploads and ranks views.
// Owned by the IA7 builder; no other packet edits this file.
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
//   ?view=you                       the hub: sheet, week and goal, plan, personal bests, tools, settings, community, help
//   &goal=unset|paused|slow|error|fail|offline|invalid
//                                   no goal chosen yet | a pause made in the app | a slow answer | the goal does not load |
//                                   a save the server refuses | a save that never arrives | a save the server does not accept
//   &bests=first|empty|error        one saved mock | no comparable mock | the marks do not load (default: three mock types)
//   &sheet=empty                    a student with no subjects yet
//   &brand=art                      the app's photo-real subject objects on the sheet (brand flag)
//   &role=moderator                 adds the Moderation group (built-in)
//   ?view=profile                   Account (sections: sign-in, appearance, Start on, privacy, delete account)
//   &consent=error                  the usage-data choice does not load
//   ?view=upload                    Contribute questions, Submit tab (a submit is answered "Preview only", nothing is sent)
//   ?view=my-uploads                Contribute questions, Your submissions tab (&data=empty|error built-in)
//   ?view=ranks                     Leaderboard (&board=empty|rivals|error): real students first, simulated rivals apart
//   ?view=compass                   Cutoff calculator (built-in fixtures)
//   ?view=progress                  /progress, which is the You hub now
import { useContext } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import YouPageClient from '@/app/(app)/you/YouPageClient';
import ProfilePageClient from '@/app/(app)/profile/ProfilePageClient';
import UploadPageClient from '@/app/(app)/upload/UploadPageClient';
import LeaderboardPageClient from '@/app/(app)/leaderboard/LeaderboardPageClient';
import AdmissionCompassPageClient from '@/app/(app)/admission-compass/AdmissionCompassPageClient';
import { computeRhythm } from '@/lib/server/rhythm';

const YOU_VIEWS = new Set(['you', 'progress']);
const DAY = 86400000;
const NOW = () => Date.now();
const after = (ms, make) => new Promise((resolve) => setTimeout(resolve, ms)).then(make);

// The preview's own "server": a goal saved here lasts until the page is reloaded, so the week card and the
// picker can be seen agreeing after a save.
let savedGoal = null;

const isoDay = (offsetDays) => new Date(NOW() + offsetDays * DAY).toISOString().slice(0, 10);

function goalBody(fixture) {
  const mode = fixture.get('goal');
  return {
    daysPerWeek: savedGoal?.daysPerWeek ?? 4,
    timezone: 'Asia/Kolkata',
    pausedUntil: savedGoal ? savedGoal.pausedUntil : mode === 'paused' ? isoDay(6) : null,
    set: savedGoal !== null || mode !== 'unset',
  };
}

// Two to four comparable mocks, the way /api/me/bests answers (data/tests/app_rhythm and recap.js shape).
function bestsBody(fixture) {
  const kind = fixture.get('bests');
  if (kind === 'empty') return { bests: [] };
  const at = (days) => NOW() - days * DAY;
  const mark = (id, marks, days) => ({ attemptId: id, marks, max: 250, completedAt: at(days) });
  const first = { formatId: 'full:accountancy:50', subject: 'accountancy', mode: 'full', attempts: 1, best: mark('a1', 138, 5), latest: mark('a1', 138, 5) };
  if (kind === 'first') return { bests: [first] };
  return {
    bests: [
      { formatId: 'full:economics:50', subject: 'economics', mode: 'full', attempts: 3, best: mark('e2', 171, 12), latest: mark('e3', 164, 2) },
      { formatId: 'nta:accountancy:50', subject: 'accountancy', mode: 'nta', attempts: 2, best: mark('n2', 149, 3), latest: mark('n2', 149, 3) },
      { formatId: 'full:business_studies:50', subject: 'business_studies', mode: 'full', attempts: 1, best: mark('b1', 96, 9), latest: mark('b1', 96, 9) },
      { formatId: 'quick:english:10', subject: 'english', mode: 'quick', attempts: 4, best: { attemptId: 'q4', marks: 40, max: 50, completedAt: at(1) }, latest: { attemptId: 'q4', marks: 40, max: 50, completedAt: at(1) } },
      first,
    ],
  };
}

// The week card (RhythmCard) with the saved goal, so a goal change shows in the ring. The same activity
// pattern as the built-in fixture in ArenaPreviewClient.
function rhythmBody(fixture) {
  const kind = fixture.get('rhythm') || 'some';
  let activities = [];
  if (fixture.get('data') !== 'empty' && kind !== 'fresh') {
    const backs = kind === 'returning' ? [9, 10, 11, 16, 17, 23, 24, 30, 31, 32, 38, 45] : [0, 1, 3, 8, 9, 10, 12, 16, 17, 18, 24, 25, 31, 38, 45];
    activities = backs.map((back, i) => {
      const d = new Date(NOW() - back * DAY);
      d.setHours(back === 0 ? 0 : 9 + (i % 5), 0, 0, 0);
      return { id: `fx${i}`, at: d.getTime(), kind: i % 4 === 3 ? 'repair' : 'session', answered: 12, fullMock: i === 9 };
    });
  }
  return computeRhythm({ activities, daysPerWeek: savedGoal?.daysPerWeek ?? 4, now: NOW() });
}

function boardBody(fixture) {
  const kind = fixture.get('board');
  if (kind === 'empty') return [];
  const rivals = [
    ['Practice rival one', 68, 2815], ['Practice rival two', 64, 2630], ['Practice rival three', 61, 2485], ['Practice rival four', 59, 2320],
  ].map(([name, tests, totalScore], i) => ({ userId: `practice_rival_${i + 1}`, name, tests, totalScore, isSynthetic: true }));
  if (kind === 'rivals') return rivals;
  const students = [
    ['fixture-s1', 'Illustrative student A', 9, 940], ['fixture-s2', 'Illustrative student B', 7, 810], ['fixture-s3', 'Illustrative student C', 6, 655],
    ['preview-user', 'Preview Student', 4, 410], ['fixture-s5', 'Illustrative student D', 3, 262], ['fixture-s6', 'Illustrative student E', 2, 118],
  ].map(([userId, name, tests, totalScore]) => ({ userId, name, tests, totalScore }));
  // The built-in order put a rival first: the page sorts students apart, whatever order the server uses.
  return [rivals[0], students[0], rivals[1], ...students.slice(1, 3), rivals[2], ...students.slice(3), rivals[3]];
}

export const handlers = [
  ({ url, method, init, fixture, json }) => {
    const view = fixture.get('view');

    if (YOU_VIEWS.has(view) && url.pathname === '/api/me/goal') {
      const mode = fixture.get('goal');
      if (method === 'GET') {
        if (mode === 'error') return json({ error: 'unavailable' }, 503);
        return mode === 'slow' ? after(1400, () => json(goalBody(fixture))) : json(goalBody(fixture));
      }
      if (method === 'PUT') {
        let body = {};
        try { body = JSON.parse(init?.body || '{}'); } catch { /* a bad body is answered below */ }
        if (mode === 'offline') return Promise.reject(new TypeError('Illustrative connection lost'));
        if (mode === 'fail') return json({ error: 'unavailable' }, 503);
        if (mode === 'invalid' || !Number.isInteger(body.daysPerWeek) || body.daysPerWeek < 1 || body.daysPerWeek > 7) {
          return json({ error: 'invalid_request', message: 'Choose between 1 and 7 days a week.' }, 422);
        }
        savedGoal = { daysPerWeek: body.daysPerWeek, pausedUntil: typeof body.pausedUntil === 'string' ? body.pausedUntil : null };
        const reply = () => json(goalBody(fixture));
        return mode === 'slow' ? after(1400, reply) : reply();
      }
    }

    if (YOU_VIEWS.has(view) && url.pathname === '/api/me/rhythm') return json(rhythmBody(fixture));

    if (YOU_VIEWS.has(view) && url.pathname === '/api/me/bests') {
      if (fixture.get('bests') === 'error') return json({ error: 'unavailable' }, 503);
      return json(bestsBody(fixture));
    }

    if (view === 'ranks' && url.pathname === '/api/leaderboard') {
      if (fixture.get('board') === 'error') return json({ error: 'Failed to load leaderboard' }, 500);
      return json(boardBody(fixture));
    }

    if (view === 'profile' && url.pathname === '/api/me/consent') {
      if (fixture.get('consent') === 'error') return json({ error: 'unavailable' }, 503);
      if (method === 'PUT') {
        let body = {};
        try { body = JSON.parse(init?.body || '{}'); } catch { /* the defaults below answer */ }
        return json({ ageBand: body.ageBand || 'unknown', analyticsAllowed: body.analyticsAllowed === true, deletedEvents: 0 });
      }
      return json({ ageBand: 'adult', analyticsAllowed: false });
    }
    return null;
  },
];

// "No subjects yet": the preview student's sheet, emptied for the one view that asks.
function WithSheet({ empty, children }) {
  const auth = useContext(AuthContext);
  if (!empty || !auth?.user) return children;
  return <AuthContext.Provider value={{ ...auth, user: { ...auth.user, subjects: [] } }}>{children}</AuthContext.Provider>;
}

const youView = (route) => ({
  route,
  render: ({ params }) => <WithSheet empty={params.get('sheet') === 'empty'}><YouPageClient brand={params.get('brand')} /></WithSheet>,
});

export const views = {
  you: youView('/you'),
  // /progress is part of You now; its own route keeps the shell's links pointing at the right preview.
  progress: youView('/progress'),
  profile: { route: '/profile', render: () => <ProfilePageClient /> },
  upload: { route: '/upload', render: () => <UploadPageClient /> },
  'my-uploads': { route: '/my-uploads', render: () => <UploadPageClient initialTab="mine" /> },
  ranks: { route: '/leaderboard', render: () => <LeaderboardPageClient /> },
  compass: { route: '/admission-compass', render: () => <AdmissionCompassPageClient /> },
};
