'use client';

import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { useSample, visitorKind } from './useSampleState';

/** Where sign-up leads, and the signed-in way back in. Every sign-up and "Go to practice" key on the landing reads this. */
export function useWayIn() {
  const { isAuthenticated } = useAuth();
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
 *   sampled  answered at least one sample question: "Save your answers"
 *   new      neither: "Free to start", with the sample one tap away
 */
export function useVisitor() {
  const way = useWayIn();
  const sample = useSample();
  return { ...way, kind: visitorKind(way.isAuthenticated, sample), sample };
}
