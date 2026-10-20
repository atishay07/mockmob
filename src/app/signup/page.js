export const dynamic = "force-dynamic";

import SignupPageClient from './SignupPageClient';
import { isInvitePath, safeNextPath } from '@/lib/auth-redirect';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Create a Free MockMob Account',
  description: 'Create a free MockMob account and start CUET mock tests, question practice, and progress tracking.',
  path: '/signup',
});

// A visit that came from a friend's Mob invite (?next=/join/<code>) says so, so the page is not a stranger to the link they tapped.
export default async function SignupPage({ searchParams }) {
  const next = (await searchParams)?.next;
  return <SignupPageClient invite={isInvitePath(safeNextPath(Array.isArray(next) ? next[0] : next))} />;
}
