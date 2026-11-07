export const dynamic = "force-dynamic";

import LeaderboardPageClient from './LeaderboardPageClient';

export const metadata = {
  title: 'Your standing | MockMob',
  description: 'Your place among MockMob students, worked out from your recorded mocks.',
};

export default function LeaderboardPage() {
  return <LeaderboardPageClient />;
}
