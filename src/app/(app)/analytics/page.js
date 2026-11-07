export const dynamic = "force-dynamic";

import AnalyticsPageClient from './AnalyticsPageClient';

export const metadata = {
  title: 'Marks trend | MockMob',
  description: 'Where your marks are going, paper by paper.',
};

export default function AnalyticsPage() {
  return <AnalyticsPageClient />;
}
