export const dynamic = "force-dynamic";

import UploadPageClient from './UploadPageClient';
import ContributionsPaused from '@/components/contribute/ContributionsPaused';
import { contributeEnabled } from '@/lib/contribute';

export const metadata = {
  title: 'Contribute | MockMob',
  description: 'Write an original CUET question for other students.',
};

// Contributions are paused unless CONTRIBUTE_ENABLED=true (COMMUNITY-1018): the route stays and answers a calm page, never a 404.
export default function UploadPage() {
  return contributeEnabled() ? <UploadPageClient /> : <ContributionsPaused />;
}
