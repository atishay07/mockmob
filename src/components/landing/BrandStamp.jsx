import { BRAND_ICONS, brandIconSrc, brandIconSrcSet } from '@/../data/brand_icons.mjs';
import '@/app/brand-stamp.css';

// A section's brand stamp (R3-D2, owner LK108/LK114, 5 Nov 2026): the section's desk object and the product's own name in the
// brand-word colour (volt in Night, #526700 in Day), sentence case, above the h2. Only product names stamp a head
// (homeCopy BRAND_STAMPS); a generic kicker or eyebrow never does.
//
//   <BrandStamp icon="compass" name="DU Compass" />
//
// The desk object is drawn at 28 px from the 96 px file (crisp at 2x), in a fixed box so nothing shifts while it decodes; it
// is decorative, because the name beside it says the same thing.
export function BrandStamp({ icon, name, size = 28 }) {
  return (
    <p className="lp-stamp">
      {BRAND_ICONS[icon] ? (
        <span className="lp-stamp__icon" aria-hidden="true" style={{ '--stamp-icon': `${size}px` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp pair, no optimizer round trip for a 28 px mark */}
          <img src={brandIconSrc(icon, size)} srcSet={brandIconSrcSet(icon)} sizes={`${size}px`} width={size} height={size}
            alt="" decoding="async" loading="lazy" draggable={false} />
        </span>
      ) : null}
      <span className="lp-stamp__name">{name}</span>
    </p>
  );
}
