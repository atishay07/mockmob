export const dynamic = "force-dynamic";

import SignupPageClient from './SignupPageClient';
import { isInvitePath, safeNextPath } from '@/lib/auth-redirect';
import { seoMetadata } from '@/lib/seo';
import { cookies } from 'next/headers';
import { INVITE_COOKIE, decodeInviteCookie, referralsLive } from '@/lib/referrals/friendInvite.mjs';

export const metadata = seoMetadata({
  title: 'Create a Free MockMob Account',
  description: 'Create a free MockMob account and start CUET mock tests, question practice, and progress tracking.',
  path: '/signup',
});

// A visit that came from a friend's Mob invite (?next=/join/<code>) says so, so the page is not a stranger to the link they tapped.
// A friend's invite link (/r/<code>, owner D165) leaves a pending invite cookie: the page says a friend invited you and offers
// the code field (only while REFERRALS_ENABLED is on).
export default async function SignupPage({ searchParams }) {
  const next = (await searchParams)?.next;
  const invitesLive = referralsLive();
  const pending = invitesLive ? decodeInviteCookie((await cookies()).get(INVITE_COOKIE)?.value) : null;
  return (
    <SignupPageClient
      invite={isInvitePath(safeNextPath(Array.isArray(next) ? next[0] : next))}
      invitesLive={invitesLive}
      pendingInvite={pending ? { code: pending.code, source: pending.source } : null}
    />
  );
}
