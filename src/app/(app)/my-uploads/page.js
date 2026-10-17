export const dynamic = "force-dynamic";

import MyUploadsPageClient from './MyUploadsPageClient';
import ContributionsPaused from '@/components/contribute/ContributionsPaused';
import { contributeEnabled } from '@/lib/contribute';

// Hidden with Contribute (COMMUNITY-1018): the data stays, the page answers a calm "paused" while the flag is off.
export default function MyUploadsPage() {
  return contributeEnabled() ? <MyUploadsPageClient /> : <ContributionsPaused title="My uploads are paused with Contribute" />;
}
