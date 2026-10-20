"use client";
// /preview/mob-explainer: the Mob explainer and its setup against fixtures, no sign-in, no network writes.
//   ?view=d0 (default)  the Mob tab with no Mob (D0), the real DenStart: Start a Mob, Join with a code, How the Mob works
//   ?view=explainer     the explainer over D0: &mode=start|join|invite|replay &slide=0..6 &mobname=<invite's Mob name>
//   ?view=setup         the setup over D0: &step=fold|name|subject|you &seat=<key> (already sits as) &fold=<key> &nameKey=<n> &subject=<id> &name=<text> &colour=<n>
//   ?view=den           a Mob (the den), whose Mob settings carry "How the Mob works"
//   ?view=join          /join/<code>, signed in: the invite page with the explainer the first time (&code=)
//   &rm=1 reduced motion; &billing=on|off (slide 3; default on, as on production); &seen=1 marks the flag first;
//   &nosubjects=1 an account with no subjects, &onesubject=1 just Accountancy; &seat=<key> a seat Fold (D0 and setup); &fail=create and &slow=<ms> for the create call.
// window.__mx (the explainer's seek hooks: slide(i), seek(t), dur(), play(), state(), ready()) exists in this preview only.
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import MobPage from '@/components/mob/MobPage';
import JoinMob from '@/components/mob/JoinMob';
import { MobFlow, markExplainerSeen } from '@/components/mob/v3/explainer/MobFlow';
import { installExplainerPreview } from './previewExplainer';

installExplainerPreview();

const USER_ID = 'preview-user';

export default function ExplainerPreviewClient() {
  const params = useSearchParams();
  const router = useRouter();
  const view = params.get('view') || 'd0';
  const billingOn = params.get('billing') !== 'off';
  const rm = params.get('rm') === '1' ? true : params.get('rm') === '0' ? false : null;
  const [overlay, setOverlay] = useState(view === 'explainer' || view === 'setup');
  const auth = useMemo(() => ({
    user: { id: USER_ID, name: 'Aarav Mehta', email: 'preview@example.test', role: 'student',
      subjects: params.get('nosubjects') === '1' ? [] : params.get('onesubject') === '1' ? ['accountancy'] : ['accountancy', 'business_studies', 'economics', 'english'], retiredSubjects: [], creditBalance: 0 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}), signOut: async () => {}, refreshSession: async () => {},
  }), [params]);
  if (params.get('seen') === '1') markExplainerSeen(USER_ID);
  useEffect(() => () => { window.__mx = undefined; }, []);
  const links = { mob: `/preview/mob-explainer?${params.toString()}` };

  if (view === 'join') {
    return (
      <AuthContext.Provider value={auth}>
        <JoinMob code={params.get('code') || 'K7P2M9'} billingOn={billingOn} onJoined={() => router.push('/preview/mob-explainer?view=den')}
          codeHref={(c) => `/preview/mob-explainer?view=join&code=${c}`} setupHref="/preview/mob-explainer?view=d0&setup=1&seen=1" />
      </AuthContext.Provider>
    );
  }
  const setupInitial = view === 'setup' ? Object.fromEntries([
    ['step', params.get('step') || 'fold'],
    ...(params.get('fold') ? [['fold', params.get('fold')]] : []),
    ...(params.get('nameKey') != null ? [['nameKey', Number(params.get('nameKey'))]] : []),
    ...(params.get('subject') ? [['subject', params.get('subject')]] : []),
    ...(params.get('name') != null ? [['name', params.get('name')]] : []),
    ...(params.get('colour') != null ? [['colour', Number(params.get('colour'))]] : []),
  ]) : null;
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <AppLayoutClient previewRoute="/mob" previewLinks={links} mobEnabled>
          <MobPage user={auth.user} billingOn={billingOn} />
        </AppLayoutClient>
        {overlay ? (
          <PreviewFlow view={view} params={params} billingOn={billingOn} rm={rm} user={auth.user} setupInitial={setupInitial} onClose={() => setOverlay(false)} />
        ) : null}
      </RoleProvider>
    </AuthContext.Provider>
  );
}

/** The explainer or the setup opened straight away (the den's own keys open them the same way). */
function PreviewFlow({ view, params, billingOn, rm, user, setupInitial, onClose }) {
  const [busy, setBusy] = useState(null);
  const run = async (path, body, { name } = {}) => {
    setBusy(name);
    const r = await fetch(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    return r.ok ? { ok: true, data } : { ok: false, code: data?.error?.code, message: data?.error?.message };
  };
  const subjects = (user.subjects || []).map((id) => ({ id, name: { accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English' }[id] }));
  return (
    <MobFlow mode={params.get('mode') || 'start'} screen={view === 'setup' ? 'setup' : 'explainer'} userId={user.id} mobName={params.get('mobname')}
      billingOn={billingOn} subjects={subjects} suggestedName="Aarav" seatFold={params.get('seat')} run={run} busy={busy} reducedMotion={rm}
      startSlide={Math.max(0, Math.min(6, Number(params.get('slide')) || 0))} setupInitial={setupInitial}
      onApi={(api) => { window.__mx = api || undefined; }} onClose={onClose} />
  );
}
