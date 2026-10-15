"use client";

// Sign up (web IA plan section 3, step 3): "Create your free account.", one line of verified free
// facts from plan_facts, and the card with one primary (Continue with Google). No upsell bullet.
// The form paints at once; only a confirmed session swaps it for "Opening MockMob".
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';
import { hasPendingSample, rememberMember, rememberReturning, runSampleImport, sampleNoteLine, signupFactsLine } from '@/app/onboarding/firstRun';

const noSubscribe = () => () => {};
const serverNone = () => false;

// previewStage: development previews only (/preview/arena?view=signup); nothing is stored then.
export default function SignupPageClient({ nextPath = null, fromSample = false, previewStage = null }) {
  const router = useRouter();
  const { status, needsOnboarding, user } = useAuth();
  const destinationRef = useRef(null);
  const preview = previewStage !== null;
  const storedSample = useSyncExternalStore(noSubscribe, () => hasPendingSample(), serverNone);
  const pendingSample = storedSample || (preview && fromSample);

  useEffect(() => {
    if (preview) return;
    if (status === 'unauthenticated') { rememberReturning(); return; }
    if (status !== 'authenticated') return;
    rememberMember({ pro: Boolean(user?.isPremium), started: needsOnboarding ? false : null });
    // The landing sample goes to the account once, silently (onboarding retries if this fails).
    runSampleImport();
    // Read the saved return page once (it is cleared on read).
    destinationRef.current ??= postSignInPath({ needsOnboarding });
    router.replace(destinationRef.current);
  }, [preview, status, needsOnboarding, router, user?.isPremium]);

  if (status === 'authenticated') {
    return <AuthSessionScreen title="You are signed in" message="Opening MockMob…" />;
  }

  return (
    <AuthShell
      title="Create your free account."
      lead="Take timed CUET mocks in your own subjects, see which chapters cost you marks, and repair each mistake."
      facts={signupFactsLine()}
      note={pendingSample ? sampleNoteLine() : fromSample ? '' : null}
    >
      <SignupCard nextPath={nextPath} previewStage={previewStage} />
    </AuthShell>
  );
}
