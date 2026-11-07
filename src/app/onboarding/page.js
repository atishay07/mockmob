export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import { redirect } from 'next/navigation';
import { authWithStatus } from '@/lib/auth';
import OnboardingPageClient from './OnboardingPageClient';
import { SIGNUP_PATH } from './firstRun';

// R8 PUB-12: a guest following an old onboarding link used to sit on a blank "Checking your account…" screen for about 3 s
// before the client sent them to sign-up. The server now sends them straight there, before any paint. Only a definite
// "signed out" redirects: when the session lookup failed for a transient reason (Supabase or the network), the page renders
// and the client's own rule (firstRun.js onboardingEntry) decides, so a signed-in student is never bounced by a blip.
export default async function OnboardingPage() {
  const { session, transient } = await authWithStatus();
  if (!session && !transient) redirect(SIGNUP_PATH);
  return <OnboardingPageClient />;
}
