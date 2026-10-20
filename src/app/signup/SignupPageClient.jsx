"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';
import InviteCodeField from '@/components/referrals/InviteCodeField';
import { REFERRAL_COPY } from '@/lib/referrals/friendInvite.mjs';

export default function SignupPageClient({ invite = false, invitesLive = false, pendingInvite = null }) {
  const router = useRouter();
  const { status, needsOnboarding } = useAuth();
  const destinationRef = useRef(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Read the saved return page once (it is cleared on read).
    destinationRef.current ??= postSignInPath({ needsOnboarding });
    router.replace(destinationRef.current);
  }, [status, needsOnboarding, router]);

  // A friend's link (/r/<code>) or a typed code is kept as a pending invite; a Mob invite keeps its own words above.
  const friendInvited = invitesLive && pendingInvite && pendingInvite.source !== 'mob_invite';

  if (status === 'loading' || status === 'authenticated') {
    return (
      <AuthSessionScreen
        message={status === 'authenticated' ? 'Opening MockMob…' : 'Checking your sign-in…'}
      />
    );
  }

  return (
    <AuthShell
      title={invite ? 'Create your account, then take your seat.' : 'Start your CUET 2027 practice.'}
      lead={invite ? 'Your friend saved you a seat in a Mob. Sign up with Google or an email code, and you come straight back to the invite to pick your Fold.'
        : friendInvited ? REFERRAL_COPY.invitedBanner() : 'Keep your recorded mocks, chapter mistakes and saved questions together.'}
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
