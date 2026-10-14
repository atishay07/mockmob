export const dynamic = "force-dynamic";

import SignupPageClient from './SignupPageClient';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Create a free MockMob account',
  description: 'Create a free MockMob account for CUET UG practice: mock tests, chapter practice and a record of the marks you are losing.',
  path: '/signup',
});

export default function SignupPage() {
  return <SignupPageClient />;
}
