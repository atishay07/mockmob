import { GLYPH_GAP, GLYPH_GRID, GLYPH_STROKE, featureGlyph } from './featureGlyphs.mjs';

// The hero's features strip (round 4, owner LK124, 5 Nov 2026; supersedes R3-D3's number strip of 5 / 73 / 2 / 60, which the
// owner called "very useless"): MockMob's main features (heroTaps.mjs heroFeatures), each one link to where it lives on this
// page, with its icon, its name and one plain line. Round 5 (owner, 6 Nov 2026: the icons "need improvement"): the icons are
// one drawn line set (featureGlyphs.mjs: a 24 px grid, a 1.75 px round stroke in ink, one detail in the brand accent), not
// the small photographic desk objects, which read muddy at this size. No tile behind an icon (DESIGN.md: icons sit inline
// beside their label). Under them, the honest price hook (heroPriceHook): "As low as ₹X a mock on Pro at N full mocks a
// week" (the figure never without its pace), then the price that makes it, a link to the pricing section's slider that
// works it out. Raised paper with hairline cells on phones; from 960 px it sits in the words' column under the keys, on the
// page's own paper (hero-scene.css). No glass, no glow, nothing moves. Server-drawn.
export default function HeroBeatStrip({ items, label, hook = null }) {
  return (
    <nav className="lp-strip" aria-label={label}>
      <ul className="lp-strip__list">
        {items.map((item) => (
          <li key={item.href + item.name} className="lp-strip__item">
            <a href={item.href} className="lp-strip__fact">
              <StripGlyph name={item.icon} />
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

// One strip icon, drawn inline from featureGlyphs.mjs: ink parts take currentColor (the strip sets it), accent parts the
// brand word colour (hero-scene.css .lp-strip__accent). A part marked `cut` loses a GLYPH_GAP band around the icon's `cut`
// shape, so the card behind reads as behind without a fill in the page's colour (the strip's hover tint shows through).
// The strip draws once a page, so the knockout's id is the icon's own name. Decorative: the link's words name it.
function StripGlyph({ name }) {
  const glyph = featureGlyph(name);
  if (!glyph) return null;
  const cutId = `lp-strip-cut-${name}`;
  return (
    <svg
      className="lp-strip__icon"
      viewBox={`0 0 ${GLYPH_GRID} ${GLYPH_GRID}`}
      width={GLYPH_GRID}
      height={GLYPH_GRID}
      fill="none"
      stroke="currentColor"
      strokeWidth={GLYPH_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph.cut ? (
        <defs>
          <mask id={cutId} maskUnits="userSpaceOnUse" x="0" y="0" width={GLYPH_GRID} height={GLYPH_GRID}>
            <rect width={GLYPH_GRID} height={GLYPH_GRID} fill="#fff" />
            <path d={glyph.cut} fill="#000" stroke="#000" strokeWidth={GLYPH_STROKE + 2 * GLYPH_GAP} />
          </mask>
        </defs>
      ) : null}
      {glyph.parts.map((part, index) => (
        <path
          key={index}
          d={part.d}
          className={part.accent === 'fill' ? 'lp-strip__accent lp-strip__accent--fill' : part.accent ? 'lp-strip__accent' : undefined}
          strokeWidth={part.width}
          transform={part.transform}
          mask={part.cut ? `url(#${cutId})` : undefined}
        />
      ))}
    </svg>
  );
}
