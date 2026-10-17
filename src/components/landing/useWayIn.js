'use client';

import { useSyncExternalStore } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { useSample, visitorKind } from './useSampleState';

// Preview flag: "/?dock=member" shows the signed-in keys ("Welcome back", "Go to practice") to a visitor who is
// not signed in, so the state can be looked at and captured without an account. It changes only what the keys
// say, never the session, and it is read only on a development server or a build made with
// NEXT_PUBLIC_LANDING_PREVIEW=1; the live site ignores it.
const PREVIEW_ALLOWED = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_LANDING_PREVIEW === '1';

const noSubscribe = () => () => {};
function previewFlag() {
  if (!PREVIEW_ALLOWED) return false;
  try { return new URLSearchParams(window.location.search).get('dock') === 'member'; } catch { return false; }
}
// False on the server and in the first client render (so they agree), then the flag.
function usePreviewMember() {
  return useSyncExternalStore(noSubscribe, previewFlag, () => false);
}

/** Where sign-up leads, and the signed-in way back in. Every sign-up and "Go to practice" key on the landing reads this. */
export function useWayIn() {
  const auth = useAuth();
  const previewMember = usePreviewMember();
  const isAuthenticated = Boolean(auth.isAuthenticated) || previewMember;
  const released = recoveryReleased();
  return {
    isAuthenticated,
    signupHref: released ? '/signup?next=%2Frecovery' : '/signup',
    homeHref: released ? '/recovery' : '/dashboard',
    homeText: 'Go to practice',
  };
}

/**
 * Which visitor this is, for the keys that change with them:
 *   member   signed in: "Go to practice"
 *   sampled  answered at least one sample question: "Start free", or "Sign up" in the dock once the sample is finished
 *   new      neither: "Start free", with the sample one tap away in the hero
 */
export function useVisitor() {
  const way = useWayIn();
  const sample = useSample();
  return { ...way, kind: visitorKind(way.isAuthenticated, sample), sample };
}
