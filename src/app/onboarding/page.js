export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import OnboardingPageClient from './OnboardingPageClient';

export default function OnboardingPage() {
  return <OnboardingPageClient />;
}
