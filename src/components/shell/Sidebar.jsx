"use client";

// Desktop, 1024 px and up (plan 2.1): a 232 px sidebar. The logo (to Today), a full-width volt
// Start key, then the four places. Footer: two labelled credit lines and the theme switch.
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { shellItems } from '@/lib/navigation';
import PlaceLink from './PlaceLink';
import StartKey from './StartKey';
import CreditsLine from './CreditsLine';

export default function Sidebar({ activePlace = null, linkFor, homeHref, badge = null, badgeCount = null, initial = '', sheetOpen = false, onStart, credits, planHref }) {
  const places = shellItems('sidebar').filter((item) => item.id !== 'start');
  return (
    <aside className="sh-sidebar" aria-label="MockMob">
      {/* The one logo component, so logo B (data/brand_flags.mjs) lands here too; it goes to Today. */}
      <div className="sh-brand"><Logo href={homeHref} /></div>
      <StartKey variant="sidebar" open={sheetOpen} onOpen={onStart} />
      <nav className="sh-sidebar__places" aria-label="Places">
        {places.map((place) => (
          <PlaceLink key={place.id} place={place} variant="sidebar" href={linkFor(place.href)} active={activePlace === place.id}
            badge={place.id === 'review' ? badge : null} badgeCount={place.id === 'review' ? badgeCount : null} initial={place.id === 'you' ? initial : ''} />
        ))}
      </nav>
      <div className="sh-sidebar__foot">
        <CreditsLine {...credits} href={planHref} />
        <div className="sh-sidebar__theme"><span>Dark mode</span><ThemeToggle /></div>
      </div>
    </aside>
  );
}
