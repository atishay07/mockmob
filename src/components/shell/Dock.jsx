"use client";

// Phone, under 768 px: the app's bottom bar (DOCK.md option A). Today, Practice, Start, Review,
// You. Exactly 5 slots, no hamburger, no More. Glass on the bar only, with a solid fallback, and a
// scrim beneath it so labels keep their contrast over any content. The lens slides to the current
// place and passes under the raised volt Start key.
import { shellItems } from '@/lib/navigation';
import PlaceLink from './PlaceLink';
import StartKey from './StartKey';
import { lensFor } from './shellModel.mjs';

export default function Dock({ activePlace = null, linkFor, badge = null, badgeCount = null, initial = '', sheetOpen = false, onStart }) {
  const items = shellItems('phone');
  const lens = lensFor(activePlace);
  return (
    <>
      <div className="sh-bar-scrim" aria-hidden="true" />
      <nav className="sh-bar" aria-label="Places">
        <div className="sh-bar__inner" data-lens={lens ? 'on' : 'off'} data-side={lens?.side || 'left'} style={{ '--lens-k': lens?.k ?? 0 }}>
          <span className="sh-bar__lens" aria-hidden="true" />
          {items.map((item) => (item.id === 'start' ? (
            <div key="start" className="sh-bar__start"><StartKey variant="bar" open={sheetOpen} onOpen={onStart} /></div>
          ) : (
            <PlaceLink key={item.id} place={item} variant="bar" href={linkFor(item.href)} active={activePlace === item.id}
              badge={item.id === 'review' ? badge : null} badgeCount={item.id === 'review' ? badgeCount : null} initial={item.id === 'you' ? initial : ''} />
          )))}
        </div>
      </nav>
    </>
  );
}
