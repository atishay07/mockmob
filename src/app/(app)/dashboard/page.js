export const dynamic = "force-dynamic";

import DashboardPageClient from './DashboardPageClient';

export default function DashboardPage() {
  return <DashboardPageClient studyEnabled={process.env.STUDY_CONTENT_ENABLED === 'true'} />;
}
