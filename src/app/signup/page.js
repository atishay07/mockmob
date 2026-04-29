export const dynamic = "force-dynamic";

import SignupPageClient from './SignupPageClient';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Create a Free MockMob Account',
  description: 'Create a free MockMob account and start CUET mock tests, question practice, and progress tracking.',
  path: '/signup',
});

export default function SignupPage() {
  return <SignupPageClient />;
}
