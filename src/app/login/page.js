export const dynamic = "force-dynamic";

import LoginPageClient from './LoginPageClient';
import { isInvitePath, safeNextPath } from '@/lib/auth-redirect';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Login to MockMob',
  description: 'Log in to MockMob to continue CUET mock tests, saved questions, analytics, and practice history.',
  path: '/login',
});

// A visit that came from a friend's Mob invite (?next=/join/<code>) says so, so the page is not a stranger to the link they tapped.
export default async function LoginPage({ searchParams }) {
  const next = (await searchParams)?.next;
  return <LoginPageClient invite={isInvitePath(safeNextPath(Array.isArray(next) ? next[0] : next))} />;
}
