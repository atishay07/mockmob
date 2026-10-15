export const dynamic = "force-dynamic";

import SignupPageClient from './SignupPageClient';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Create a Free MockMob Account',
  description: 'Create a free MockMob account and start CUET mock tests, question practice, and progress tracking.',
  path: '/signup',
});

const one = (value) => (Array.isArray(value) ? value[0] : value) ?? null;

// ?next survives sign-up (validated again on the client); ?from=sample keeps a line for the
// landing sample hand-off reserved, so the card does not move when it appears.
export default async function SignupPage({ searchParams }) {
  const query = (await searchParams) || {};
  return <SignupPageClient nextPath={one(query.next)} fromSample={one(query.from) === 'sample'} />;
}
