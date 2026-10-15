import { permanentRedirect } from 'next/navigation';
import { recoveryReleased } from '@/../data/capabilities';
import { REVIEW_HREF } from '@/lib/navigation';
import RecoveryJourney from './RecoveryJourney';

export const dynamic = 'force-dynamic';

// /recovery is Review now (web IA plan 2.4): a 308 to /review while the old episodes are not released. The
// episode journey itself stays in ./RecoveryJourney.jsx for the day that gate opens.
export default function RecoveryPage() {
  if (!recoveryReleased()) permanentRedirect(REVIEW_HREF);
  return <RecoveryJourney />;
}
