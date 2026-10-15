"use client";

// Log in (web IA plan section 3 rules): "Welcome back" only when this device has signed in before;
// a new visitor reads "Log in", with "New here? Create an account". Both headings are rendered and
// the visitor hint picks one (<html data-visitor> before first paint, or this page's own read).
// The classes are this page's own (auth.css), not the public vs-* ones: here a stored member is a
// returning visitor, and the public rules hide both variants for a member.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';
import { isKnownVisitor, readVisitorKind, rememberMember, rememberReturning, runSampleImport } from '@/app/onboarding/firstRun';

const noSubscribe = () => () => {};
const serverNone = () => null;

// previewStage, previewVisitor: development previews only (/preview/arena?view=login); nothing is stored then.
export default function LoginPageClient({ nextPath = null, previewStage = null, previewVisitor = null }) {
  const router = useRouter();
  const { status, needsOnboarding, user } = useAuth();
  const destinationRef = useRef(null);
  const kind = useSyncExternalStore(noSubscribe, () => readVisitorKind(), serverNone);
  const preview = previewStage !== null;
  const visitor = preview ? previewVisitor : kind === null ? null : isKnownVisitor(kind) ? 'returning' : 'new';

  useEffect(() => {
    if (preview) return;
    if (status === 'unauthenticated') { rememberReturning(); return; }
    if (status !== 'authenticated') return;
    rememberMember({ pro: Boolean(user?.isPremium), started: needsOnboarding ? false : null });
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
      visitor={visitor}
      title={(
        <>
          <span className="auth-v-returning">Welcome back</span>
          <span className="auth-v-new">Log in</span>
        </>
      )}
      lead="Use the Google account or email you signed up with. Your mocks, results and saved questions are kept on your account."
    >
      <SignupCard mode="login" nextPath={nextPath} previewStage={previewStage} />
    </AuthShell>
  );
}
