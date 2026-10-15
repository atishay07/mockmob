// Preview views for IA3: first run (onboarding steps subjects and days, Today's first move). Replaces the legacy onboarding view by using the name onboarding.
// Owned by the IA3 builder; no other packet edits this file.
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
// Views (all render without the signed-in shell, as the real pages do):
//   ?view=onboarding&step=subjects|days   a brand-new student (no subjects yet); days has subjects saved
//   ?view=onboarding&edit=true            You > Your sheet (subjects only)
//     &data=save-error (subjects do not save), &goal=error (days do not save), &brand=art (3D objects)
//     Finishing opens ?view=today&data=empty&rhythm=fresh (Today's first move); an edit opens Practice.
//   ?view=signup&stage=choose|email|code  the sign-up page signed out (&from=sample adds the hand-off line)
//   ?view=login&stage=...&visitor=new|returning   the log-in page; returning shows "Welcome back"
import { useContext, useMemo } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import OnboardingPageClient from '@/app/onboarding/OnboardingPageClient';
import SignupPageClient from '@/app/signup/SignupPageClient';
import LoginPageClient from '@/app/login/LoginPageClient';

const STAGES = ['choose', 'email', 'code'];

function previewHref(params, view, extra = {}) {
  return `/preview/arena?${new URLSearchParams({ view, plan: params.get('plan') || 'free', ...extra })}`;
}

/** The fixture account as a first-run student: no subjects until step 1 is saved. */
function FirstRunAuth({ params, status = 'authenticated', children }) {
  const base = useContext(AuthContext);
  const edit = params.get('edit') === 'true';
  const days = params.get('step') === 'days';
  const value = useMemo(() => {
    if (!base) return base;
    const signedIn = status === 'authenticated';
    const subjects = edit || days ? base.user?.subjects || [] : [];
    return {
      ...base,
      status,
      isAuthenticated: signedIn,
      user: signedIn ? { ...base.user, subjects } : null,
      needsOnboarding: signedIn && subjects.length === 0,
    };
  }, [base, status, edit, days]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function OnboardingPreview({ params }) {
  const edit = params.get('edit') === 'true';
  const finish = () => {
    window.location.href = edit
      ? previewHref(params, 'dashboard', { data: 'ready' })
      : previewHref(params, 'today', { data: 'empty', rhythm: 'fresh' });
  };
  return (
    <FirstRunAuth params={params}>
      <OnboardingPageClient
        preview
        initialStep={params.get('step') === 'days' ? 'days' : null}
        edit={edit}
        brand={params.get('brand')}
        onFinish={finish}
      />
    </FirstRunAuth>
  );
}

function AuthPagePreview({ params, mode }) {
  const stage = STAGES.includes(params.get('stage')) ? params.get('stage') : 'choose';
  const visitor = params.get('visitor') === 'returning' ? 'returning' : 'new';
  return (
    <FirstRunAuth params={params} status="unauthenticated">
      {mode === 'login'
        ? <LoginPageClient previewStage={stage} previewVisitor={visitor} />
        : <SignupPageClient previewStage={stage} fromSample={params.get('from') === 'sample'} />}
    </FirstRunAuth>
  );
}

export const views = {
  onboarding: { route: '/onboarding', shell: false, render: ({ params }) => <OnboardingPreview params={params} /> },
  signup: { route: '/signup', shell: false, render: ({ params }) => <AuthPagePreview params={params} mode="signup" /> },
  login: { route: '/login', shell: false, render: ({ params }) => <AuthPagePreview params={params} mode="login" /> },
};

const FIRST_RUN_VIEWS = new Set(['onboarding', 'signup', 'login']);

export const handlers = [
  ({ url, method, init, fixture, json }) => {
    if (!FIRST_RUN_VIEWS.has(fixture.get('view') || '')) return null;
    if (url.pathname === '/api/me/goal') {
      if (method === 'PUT') {
        if (fixture.get('goal') === 'error') return json({ error: 'unavailable' }, 503);
        let daysPerWeek = 4;
        try { daysPerWeek = JSON.parse(init?.body || '{}').daysPerWeek ?? 4; } catch { /* keep 4 */ }
        return json({ daysPerWeek, timezone: 'Asia/Kolkata', pausedUntil: null });
      }
      if (method === 'GET') return json({ daysPerWeek: 4, timezone: 'Asia/Kolkata', pausedUntil: null });
    }
    // The sample import answers as saved; nothing is stored.
    if (url.pathname === '/api/me/sample-import' && method === 'POST') return json({ status: 'saved', savedAt: '2026-10-15T09:00:00.000Z', correct: 3, total: 5 });
    return null;
  },
];
