export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import DashboardPageClient from './DashboardPageClient';
import { PracticeSkeleton } from './PracticeParts';

export const metadata = { title: 'Practice | MockMob' };

// Practice (/dashboard). /practice rewrites here in IA9. Concepts shows in "More ways to practise" only
// while the server's study flag is on, the same switch the shell reads in (app)/layout.js.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <DashboardPageClient studyEnabled={process.env.STUDY_CONTENT_ENABLED === 'true'} />
    </Suspense>
  );
}
