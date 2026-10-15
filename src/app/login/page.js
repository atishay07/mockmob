export const dynamic = "force-dynamic";

import LoginPageClient from './LoginPageClient';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Login to MockMob',
  description: 'Log in to MockMob to continue CUET mock tests, saved questions, analytics, and practice history.',
  path: '/login',
});

const one = (value) => (Array.isArray(value) ? value[0] : value) ?? null;

// ?next survives log-in (validated again on the client before use).
export default async function LoginPage({ searchParams }) {
  const query = (await searchParams) || {};
  return <LoginPageClient nextPath={one(query.next)} />;
}
