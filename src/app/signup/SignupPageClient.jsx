"use client";

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';
import InviteCodeField from '@/components/referrals/InviteCodeField';
import { REFERRAL_COPY } from '@/lib/referrals/friendInvite.mjs';
import { clearSample, rawSample, readSample, signupWords } from '@/components/landing/sampleCarry.mjs';

// The home page's sample leaves its result in this browser (sampleCarry.mjs). The stored text is the snapshot (a string
// compares by value); another tab finishing a sample updates this page through the storage event. The server knows of none.
const subscribeSample = (notify) => {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
};
const noSample = () => null;

export default function SignupPageClient({ invite = false, invitesLive = false, pendingInvite = null }) {
  const router = useRouter();
  const { status, needsOnboarding } = useAuth();
  const destinationRef = useRef(null);
  // A visitor who has just finished the five sample questions is met with their own result (10 Nov 2026): the score in
  // the headline and the chapters they missed in the sentence under it, so the card's promise survives the click.
  const sampleText = useSyncExternalStore(subscribeSample, rawSample, noSample);
  const sample = useMemo(() => (sampleText ? signupWords(readSample()) : null), [sampleText]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // The account exists: the sample's note has done its job, and it must not greet the next person on this device.
    clearSample();
    // Read the saved return page once (it is cleared on read).
    destinationRef.current ??= postSignInPath({ needsOnboarding });
    router.replace(destinationRef.current);
  }, [status, needsOnboarding, router]);

  // A friend's link (/r/<code>) or a typed code is kept as a pending invite; a Mob invite keeps its own words above.
  const friendInvited = invitesLive && pendingInvite && pendingInvite.source !== 'mob_invite';
  // An invite's own words lead (a Mob seat, a friend's code); the sample's result greets everyone else.
  const carried = invite || friendInvited ? null : sample;

  if (status === 'loading' || status === 'authenticated') {
    return (
      <AuthSessionScreen
        message={status === 'authenticated' ? 'Opening MockMob…' : 'Checking your sign-in…'}
      />
    );
  }

  return (
    <AuthShell
      title={invite ? 'Create your account, then take your seat.' : carried ? carried.title : 'Start your CUET 2027 practice.'}
      lead={invite ? 'Your friend saved you a seat in a Mob. Sign up with Google or an email code, and you come straight back to the invite to pick your Fold.'
        : friendInvited ? REFERRAL_COPY.invitedBanner() : carried ? carried.lead : 'Keep your recorded mocks, chapter mistakes and saved questions together.'}
      points={invite ? [
        'Joining a Mob is free',
        'Only your Mob sees your name',
        'You can leave a Mob any time',
      ] : [
        'Quick practice and Full mock on free credits',
        'Chapter review traces every mistake back to its chapter',
        'Go Pro when you want unlimited practice',
      ]}
    >
      <SignupCard />
      {invitesLive ? <InviteCodeField pending={pendingInvite?.code || null} /> : null}
    </AuthShell>
  );
}
