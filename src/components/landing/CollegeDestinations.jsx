import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';

// Each campus is its own tile (public/images/campus, cut from the old 1200x800 sprite at 300, 450 and 600 px
// wide, AVIF with a WebP fallback). The browser fetches only the width it draws, and only as the section nears
// the screen: the sprite was a CSS background, so every phone downloaded all 270 KB of it during the first paint.
const COLLEGES = [
  { name: 'SRCC', detail: 'B.Com (Hons) cutoffs', art: 'srcc', course: 'b-com-hons' },
  { name: 'Hindu College', detail: 'B.A. (Hons) Economics cutoffs', art: 'hindu', course: 'b-a-hons-economics' },
  { name: 'Hansraj College', detail: 'B.Com (Hons) cutoffs', art: 'hansraj', course: 'b-com-hons' },
  { name: 'St. Stephen’s', detail: 'B.A. (Hons) English cutoffs', art: 'stephens', course: 'b-a-hons-english' },
];
const ART_WIDTHS = [300, 450, 600];
// The drawn width of the art (home-refinements.css): half the row on phones, half a card on tablets, a quarter
// of the 1200 px wrap on desktop.
const ART_SIZES = '(max-width: 760px) calc(50vw - 26px), (max-width: 1023px) calc(25vw - 20px), 288px';
const srcSet = (art, type) => ART_WIDTHS.map((w) => `/images/campus/${art}-${w}.${type} ${w}w`).join(', ');

export function CollegeDestinations() {
  return (
    <div className="lp-colleges" id="college-destinations">
      <div className="lp-colleges__intro">
        <div><MapPin size={17} aria-hidden="true" /><h3>Know where you’re headed.</h3></div>
        <p>Open a college to see its 2026 cutoffs by round and category.</p>
      </div>
      <div className="lp-colleges__grid">
        {COLLEGES.map((college) => (
          <Link className="lp-college" href={`/cuet-cutoff-calculator?course=${college.course}`} key={college.name}>
            <picture className="lp-college__art">
              <source type="image/avif" srcSet={srcSet(college.art, 'avif')} sizes={ART_SIZES} />
              <img src={`/images/campus/${college.art}-450.webp`} srcSet={srcSet(college.art, 'webp')} sizes={ART_SIZES} width={600} height={400} alt="" loading="lazy" decoding="async" />
            </picture>
            <span className="lp-college__copy"><strong>{college.name}</strong><span>{college.detail}</span></span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
