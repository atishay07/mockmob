// The not-found page inside the signed-in app (the sidebar and dock stay). A hidden feature's route lands here while its flag is
// off, for example /upload and /my-uploads without CONTRIBUTE_ENABLED, exactly as a page that never existed would.
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
