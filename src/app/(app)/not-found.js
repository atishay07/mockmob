// The not-found page inside the signed-in app (the sidebar and dock stay), for a route that does not exist. A hidden feature is not
// a missing route: /upload and /my-uploads answer the calm paused page (ContributionsPaused) while CONTRIBUTE_ENABLED is off.
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';

export default function AppNotFound() {
  return (
    <div className="student-page">
      <ArenaHead title="That page is not here." lede="The link may be old, or the page may have moved. Your practice, your record and the question bank are all where you left them." />
      <p>
        <Link href="/today" className="ui-state__action ui-state__action--primary mk-press" data-page-primary="">Go to Today</Link>
        {' '}
        <Link href="/dashboard" className="ui-state__action mk-press">Open Practice</Link>
      </p>
    </div>
  );
}
