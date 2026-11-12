import { STRIP_OBJECT_BOX, STRIP_OBJECT_SIZES, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';

// The hero's features strip (round 4, owner LK124, 5 Nov 2026; supersedes R3-D3's number strip of 5 / 73 / 2 / 60, which the
// owner called "very useless"): MockMob's main features (heroTaps.mjs heroFeatures), each one link to where it lives on this
// page, with its desk object, its name and one plain line. Round 5 (owner, 6 Nov 2026, LK160: the drawn line icons that
// replaced the objects that morning were "a regression ... rather than the 3D-generated icons"): the brand's 3D desk objects
// again, made better (stripObjects.mjs): each the object that already means its feature on this page, trimmed to one visual
// weight and one baseline, cut for 2x and 3x screens, standing on a soft contact shadow; Ask Mobi is Mobi himself. No tile
// behind an object (DESIGN.md: never an icon tile). Under them, the honest price hook (heroPriceHook): "As low as ₹X a mock on
// Pro at N full mocks a day" (the figure never without its pace), then the price that makes it, a link to the pricing
// section's slider that works it out. Raised paper with hairline cells on phones; from 960 px it sits in the words' column
// under the keys, on the page's own paper (hero-scene.css). No glass, no glow, nothing moves. Server-drawn.
export default function HeroBeatStrip({ items, label, hook = null }) {
  return (
    <nav className="lp-strip" aria-label={label}>
      <ul className="lp-strip__list">
        {items.map((item) => (
          <li key={item.href + item.name} className="lp-strip__item">
            {/* `data-ask-mobi` (the Ask Mobi row): AskMobiSheet takes the tap and opens; the href stays for no JavaScript. */}
            <a href={item.href} className="lp-strip__fact" data-ask-mobi={item.ask || undefined}>
              <StripObject name={item.icon} />
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
          <span className="lp-strip__hook-unit">{hook.unit}</span>{' '}
          {/* The pace never parts from the figure's line; it moves down whole only where the line is full (phones). */}
          <span className="lp-strip__hook-at">{hook.at}<span className="sr-only">.</span></span>{' '}
          <span className="lp-strip__hook-line">{hook.line}</span>
        </a>
      ) : null}
    </nav>
  );
}

// One feature's desk object (stripObjects.mjs): a fixed 12:11 box laid out before the file decodes, so nothing shifts; the
// srcset gives a 2x phone the 96 px file and a 3x phone the 144 px one. Decorative: the link's words name it. Lazy: on a phone
// the strip is below the first screen, and on desktop the six files are about 25 KB together.
function StripObject({ name }) {
  const src = stripObjectSrc(name);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a pre-cut webp set with its own srcset; no optimizer round trip for a 48 px object
    <img
      className="lp-strip__obj"
      src={src}
      srcSet={stripObjectSrcSet(name)}
      sizes={STRIP_OBJECT_SIZES}
      width={STRIP_OBJECT_BOX.width}
      height={STRIP_OBJECT_BOX.height}
      alt=""
      decoding="async"
      loading="lazy"
      draggable={false}
    />
  );
}
