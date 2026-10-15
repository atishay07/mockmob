"use client";

// Tablet, 768 to 1023 px (plan 2.1): a 76 px rail. The Start key at the top, then the four places,
// each label under its icon (never icon only).
import { shellItems } from '@/lib/navigation';
import PlaceLink from './PlaceLink';
import StartKey from './StartKey';

export default function Rail({ activePlace = null, linkFor, badge = null, badgeCount = null, initial = '', sheetOpen = false, onStart }) {
  const places = shellItems('rail').filter((item) => item.id !== 'start');
  return (
    <nav className="sh-rail" aria-label="Places">
      <StartKey variant="rail" open={sheetOpen} onOpen={onStart} />
      <div className="sh-rail__places">
        {places.map((place) => (
          <PlaceLink key={place.id} place={place} variant="rail" href={linkFor(place.href)} active={activePlace === place.id}
            badge={place.id === 'review' ? badge : null} badgeCount={place.id === 'review' ? badgeCount : null} initial={place.id === 'you' ? initial : ''} />
        ))}
      </div>
    </nav>
  );
}
