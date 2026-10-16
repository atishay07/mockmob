import Link from 'next/link';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Four colleges students ask about, as a list of rows (two columns on desktop), not a row of cards: a small
// campus photo, the name, the programme, and the real Round I closing score for the unreserved category from
// DU's own published list (public/du/2026/offerings, the files the calculator reads). Read on the server; a
// college or a figure that is not in the published list is simply left out, never estimated.
// Each campus is its own tile (public/images/campus, cut from the old 1200x800 sprite at 300, 450 and 600 px
// wide, AVIF with a WebP fallback). The browser fetches only the width it draws, and only as the section nears
// the screen.
const COLLEGES = [
  { name: 'SRCC', detail: 'B.Com (Hons)', art: 'srcc', course: 'b-com-hons', match: /^Shri Ram .*Commerce/ },
  { name: 'Hindu College', detail: 'B.A. (Hons) Economics', art: 'hindu', course: 'b-a-hons-economics', match: /^Hindu\b/ },
  { name: 'Hansraj College', detail: 'B.Com (Hons)', art: 'hansraj', course: 'b-com-hons', match: /^Hansraj/ },
  { name: 'St. Stephen’s', detail: 'B.A. (Hons) English', art: 'stephens', course: 'b-a-hons-english', match: /^St\. Stephen/ },
];
const ART_WIDTHS = [300, 450, 600];
// The drawn width of the photo (home-refinements.css): 96 px on phones, 112 px from 640 px.
const ART_SIZES = '(max-width: 639px) 96px, 112px';
const srcSet = (art, type) => ART_WIDTHS.map((w) => `/images/campus/${art}-${w}.${type} ${w}w`).join(', ');

/** Round I, UR closing score from DU's published 2026 list, to one decimal, or null when it is not listed. */
function roundOneCutoff(course, match) {
  try {
    const group = JSON.parse(readFileSync(join(process.cwd(), 'public', 'du', '2026', 'offerings', `${course}.json`), 'utf8'));
    const ur = group.categories.indexOf('UR');
    const row = group.rows.find((r) => match.test(r[0]) && !/Evening/i.test(r[0]));
    const value = ur >= 0 ? row?.[2]?.[ur] : null;
    return typeof value === 'number' ? (Math.round(value * 10) / 10).toFixed(1) : null;
  } catch {
    return null;
  }
}

export function CollegeDestinations() {
  const colleges = COLLEGES.map((college) => ({ ...college, cutoff: roundOneCutoff(college.course, college.match) }));
  return (
    <div className="lp-colleges" id="college-destinations">
      <div className="lp-colleges__intro">
        <h3 className="lp-h3">Know where you’re headed.</h3>
        <p>Open a college to see its 2026 cutoffs by round and category.</p>
      </div>
      <ul className="lp-colleges__list">
        {colleges.map((college) => (
          <li key={college.name}>
            <Link className="lp-college" href={`/cuet-cutoff-calculator?course=${college.course}`}>
              <picture className="lp-college__art">
                <source type="image/avif" srcSet={srcSet(college.art, 'avif')} sizes={ART_SIZES} />
                <img src={`/images/campus/${college.art}-300.webp`} srcSet={srcSet(college.art, 'webp')} sizes={ART_SIZES} width={600} height={400} alt="" loading="lazy" decoding="async" />
              </picture>
              <span className="lp-college__copy"><strong>{college.name}</strong><span>{college.detail}</span></span>
              {college.cutoff ? (
                <span className="lp-college__cut"><b>{college.cutoff}</b><span>Round 1, UR</span></span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
