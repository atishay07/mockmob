"use client";
import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import MobPage from '@/components/mob/MobPage';
import DenChains from '@/components/mob/den/DenChains';
import DenShelf from '@/components/mob/den/DenShelf';
import JoinMob from '@/components/mob/JoinMob';
import { installDenPreview } from './previewDen';

installDenPreview();

// The den's keys link to the real /mob/game/<id> screens, which need a signed-in account. In this preview they open the
// game preview (/preview/mob-play) instead, on the matching screen, so a game can be walked from the den and back.
export function previewGameHref(href) {
  const u = new URL(href, 'http://preview.local');
  if (!u.pathname.startsWith('/mob/game/')) return null;
  const view = u.searchParams.get('view');
  if (view === 'podium') return '/preview/mob-play?view=podium';
  if (view === 'moments') return '/preview/mob-play?view=moments&closed=1';
  if (view === 'fix') return '/preview/mob-play?view=fix&closed=1';
  return `/preview/mob-play?view=run&run=${u.searchParams.get('play') === '1' ? 'play' : 'ready'}`;
}

export default function DenPreviewClient() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      const to = a ? previewGameHref(a.getAttribute('href')) : null;
      if (!to || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(to);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router]);
  const view = params.get('view') || 'mob';
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: 'Aarav Mehta', email: 'preview@example.test', role: 'student',
      subjects: params.get('den') === 'nosubjects' ? [] : ['accountancy', 'business_studies', 'economics', 'english'], retiredSubjects: [], creditBalance: 0 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}), signOut: async () => {}, refreshSession: async () => {},
  }), [params]);
  const links = { mob: `/preview/mob-den?${params.toString()}` };
  if (view === 'join') {
    // /join/<code>: the full page a friend's link opens (auth=out is signed out; the codes 000000, 111111, 222222, 333333 and 444444 are the expired, full, paused,
    // invalid and did-not-load states, see previewDen.js; joining opens the den).
    const joinAuth = params.get('auth') === 'out' ? { ...auth, user: null, status: 'unauthenticated', isAuthenticated: false } : auth;
    return <AuthContext.Provider value={joinAuth}><JoinMob code={params.get('code') || 'MR1SNQ'} onJoined={() => router.push('/preview/mob-den?den=quiet')} codeHref={(c) => `/preview/mob-den?view=join&code=${c}${params.get('auth') === 'out' ? '&auth=out' : ''}`} /></AuthContext.Provider>;
  }
  const body = view === 'chains' || view === 'chains-mob' ? <DenChains user={auth.user} /> : view === 'shelf' ? <DenShelf user={auth.user} /> : <MobPage user={auth.user} />;
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <AppLayoutClient previewRoute="/mob" previewLinks={links} mobEnabled>{body}</AppLayoutClient>
      </RoleProvider>
    </AuthContext.Provider>
  );
}
