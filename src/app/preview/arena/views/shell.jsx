// Preview views for IA1: the shell (sidebar, rail, phone bar, Start sheet, credits, guide tour). Suggested names: shell, start-sheet, guide.
// Owned by the IA1 builder; no other packet edits this file.
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
// IA1 views (all render Today's page inside the shell; the shell is the subject):
//   shell        the chrome at rest. ?badge=4 shows the Review badge, ?move=<fixture> publishes
//                Tonight's move from data/fixtures/next_step/<fixture>.json for the Start sheet's hero
//   start-sheet  the Start sheet open. ?row=quick|full|nta|repair|resume opens that row's confirm line;
//                ?move=repair|first|practise|resume|unopened|mock-due|stale picks the hero (default first)
//   guide        the guide open. ?stop=0..3 (Today, Start, Practice, Review)
// Widths: the sidebar shows at 1024 px and up, the rail at 768 to 1023 px, the phone bar below 768 px.
import { useEffect } from 'react';
import TodayPage from '@/app/(app)/today/page';
import { nextMove } from '@/../data/next_step_rules.mjs';
import { openGuide, openStartSheet, publishNextMove, publishTonightRepair } from '@/components/shell/shellSignals';
import first from '@/../data/fixtures/next_step/first.json';
import repair from '@/../data/fixtures/next_step/repair.json';
import practise from '@/../data/fixtures/next_step/practise.json';
import resume from '@/../data/fixtures/next_step/resume.json';
import unopened from '@/../data/fixtures/next_step/unopened.json';
import mockDue from '@/../data/fixtures/next_step/mock-due.json';
import stale from '@/../data/fixtures/next_step/stale.json';

const PREVIEW_USER = 'preview-user'; // the fixture account in ArenaPreviewClient
const MOVES = { first, repair, practise, resume, unopened, 'mock-due': mockDue, stale };

// Publishes fixture facts the way Today and Review will, then asks the shell to open what the view
// shows. A frame later, so the shell (the parent) has its listeners in place.
function ShellFixture({ params, open = null }) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const fixture = MOVES[params.get('move') || (open === 'sheet' ? 'first' : '')];
      if (fixture) publishNextMove(PREVIEW_USER, nextMove(fixture.input));
      const badge = Number(params.get('badge'));
      publishTonightRepair(PREVIEW_USER, Number.isFinite(badge) && badge > 0 ? { count: badge, attemptId: 'fixture-attempt' } : null);
      if (open === 'sheet') openStartSheet({ row: params.get('row') || null });
      if (open === 'guide') openGuide({ mode: 'replay', stop: Number(params.get('stop')) || 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [params, open]);
  return null;
}

export const views = {
  shell: { route: '/today', render: ({ params }) => <><ShellFixture params={params} /><TodayPage /></> },
  'start-sheet': { route: '/today', render: ({ params }) => <><ShellFixture params={params} open="sheet" /><TodayPage /></> },
  guide: { route: '/today', render: ({ params }) => <><ShellFixture params={params} open="guide" /><TodayPage /></> },
};
export const handlers = [];
