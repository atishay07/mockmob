export const dynamic = "force-dynamic";

import LoginPageClient from './LoginPageClient';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Log in to MockMob',
  description: 'Log in to MockMob to continue your CUET practice, saved questions and the chapters to repair.',
  path: '/login',
});

export default function LoginPage() {
  return <LoginPageClient />;
}
