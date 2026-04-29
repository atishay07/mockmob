export const dynamic = "force-dynamic";

import LoginPageClient from './LoginPageClient';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Login to MockMob',
  description: 'Log in to MockMob to continue CUET mock tests, saved questions, analytics, and practice history.',
  path: '/login',
});

export default function LoginPage() {
  return <LoginPageClient />;
}
