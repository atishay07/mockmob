export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

import OnboardingPageClient from './OnboardingPageClient';

const one = (value) => (Array.isArray(value) ? value[0] : value) ?? null;

// ?step=days reopens the second step after a reload; ?edit=true is You > Your sheet (subjects only);
// ?next is where an edit returns (validated again on the client before use).
export default async function OnboardingPage({ searchParams }) {
  const query = (await searchParams) || {};
  return (
    <OnboardingPageClient
      initialStep={one(query.step) === 'days' ? 'days' : null}
      edit={one(query.edit) === 'true'}
      nextPath={one(query.next)}
    />
  );
}
