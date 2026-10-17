// The calm page for /upload and /my-uploads while CONTRIBUTE_ENABLED is off. Not a 404: an old link or bookmark lands on a
// plain answer with a way on. Server component, no state.
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';

export default function ContributionsPaused({ title = 'Question contributions are paused' }) {
  return (
    <div className="student-page">
      <ArenaHead title={title} lede="We are not taking new questions from students for now. Anything you sent before is kept. Practice and Explore have the full question bank." />
      <p>
        <Link href="/dashboard" className="ui-state__action ui-state__action--primary mk-press" data-page-primary="">Back to Practice</Link>
        {' '}
        <Link href="/explore" className="ui-state__action mk-press">Open Explore</Link>
      </p>
    </div>
  );
}
