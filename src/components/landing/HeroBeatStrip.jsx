import { BrandIcon } from '@/components/brand/BrandIcon';

// The hero's second beat, variant B (R3-D3, LK100; brandloss B4): a branded number strip under the hero. Each of the
// four facts (heroTaps.mjs heroBeat) is one link to its section: its desk object (BrandIcon, the same objects the tour's
// rail draws), its figure in Bricolage 700 tabular in the brand word colour (volt in Night, the Day green in Day), the
// words the figure counts, and one quiet line. A raised paper strip with hairline cells: no glass (the owner asked for
// glass on the pricing and Key cards, not here), no glow. Two by two on phones, four across from 960 px.
// Server-drawn: nothing to load, nothing moves.
export default function HeroBeatStrip({ items, label }) {
  return (
    <nav className="lp-strip" aria-label={label}>
      {items.map((item) => (
        <a key={item.href} href={item.href} className="lp-strip__fact">
          <BrandIcon name={item.icon} size={36} className="lp-strip__icon" />
          {/* The spaces keep the link's spoken name in words ("73 DU programmes. Matched to your subjects"); the grid
              ignores them. */}
          <span className="lp-strip__fig">{item.figure}</span>{' '}
          <span className="lp-strip__unit">{item.unit}<span className="sr-only">.</span></span>{' '}
          <span className="lp-strip__line">{item.line}</span>
        </a>
      ))}
    </nav>
  );
}
