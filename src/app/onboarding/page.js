export const dynamic = "force-dynamic";
export const metadata = {
  title: 'Your subjects | MockMob',
  robots: {
    index: false,
    follow: false,
  },
};

import OnboardingPageClient from './OnboardingPageClient';

export default function OnboardingPage() {
  return <OnboardingPageClient />;
}
