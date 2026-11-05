import { BrandIcon, MobiMark } from '@/components/brand/BrandIcon';

// The hero's features strip (round 4, owner LK124, 5 Nov 2026; supersedes R3-D3's number strip of 5 / 73 / 2 / 60, which the
// owner called "very useless"): MockMob's main features (heroTaps.mjs heroFeatures), each one link to where it lives on this
// page, with its desk object (BrandIcon, the tour rail's objects; Ask Mobi is Mobi's own face mark), its name and one plain
// line. Under them, the honest price hook (heroPriceHook): "As low as ₹1.10 a mock on Pro", with the pace and the price
// beside it, a link to the pricing section's slider that works it out. Raised paper with hairline cells on phones; from
// 960 px it sits in the words' column under the keys, on the page's own paper (hero-scene.css). No glass, no glow, nothing
// moves. Server-drawn.
export default function HeroBeatStrip({ items, label, hook = null }) {
  return (
    <nav className="lp-strip" aria-label={label}>
      <ul className="lp-strip__list">
        {items.map((item) => (
          <li key={item.href + item.name} className="lp-strip__item">
            <a href={item.href} className="lp-strip__fact">
              {item.icon === 'mobi'
                ? <span className="lp-strip__icon lp-strip__icon--mobi" aria-hidden="true"><MobiMark size={30} /></span>
                : <BrandIcon name={item.icon} size={36} className="lp-strip__icon" />}
              {/* The space keeps the link's spoken name in words ("Mistake Lab. Every lost mark, traced"); the grid ignores it. */}
              <span className="lp-strip__name">{item.name}<span className="sr-only">.</span></span>{' '}
              <span className="lp-strip__line">{item.line}</span>
            </a>
          </li>
        ))}
      </ul>
      {hook ? (
        <a href={hook.href} className="lp-strip__hook">
          <span className="lp-strip__hook-lead">{hook.lead}</span>{' '}
          <b className="lp-strip__hook-fig">{hook.figure}</b>{' '}
          <span className="lp-strip__hook-unit">{hook.unit}<span className="sr-only">.</span></span>{' '}
          <span className="lp-strip__hook-line">{hook.line}</span>
        </a>
      ) : null}
    </nav>
  );
}
