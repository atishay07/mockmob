// The college strip under the hero (round 7, owner 7 Nov 2026, after klayprep.com): "Get into the college you want." over
// the CUET colleges' own emblems, set as chips like the promo film's (raised paper, the emblem, the short name in the
// display face), then one quiet line that the names and logos are their owners' and MockMob is not affiliated with them.
// Only colleges that admit through CUET UG. To add one: put its transparent emblem (192 px tall WebP) in
// public/art/colleges/ and add a row here with the file's pixel size. A server component; nothing here moves.
export const COLLEGE_HEAD = 'Get into the college you want.';
export const COLLEGE_NOTE = 'College names and logos belong to their owners. MockMob is not affiliated with them.';

// name: the full name (the emblem's text alternative is empty because this name is beside it, so the full name is kept
// for a screen reader when the short one differs); short: what the chip shows; file: public/art/colleges/<file>.webp;
// w, h: the file's pixel size, so the browser reserves its box.
export const COLLEGES = Object.freeze([
  { name: 'University of Delhi', short: 'University of Delhi', file: 'du', w: 195, h: 192 },
  { name: 'Shri Ram College of Commerce', short: 'SRCC', file: 'srcc', w: 207, h: 192 },
  { name: "St. Stephen's College", short: "St. Stephen's College", file: 'ststephens', w: 179, h: 192 },
  { name: 'Hindu College', short: 'Hindu College', file: 'hindu', w: 163, h: 192 },
  { name: 'Lady Shri Ram College for Women', short: 'LSR', file: 'lsr', w: 105, h: 192 },
  { name: 'Miranda House', short: 'Miranda House', file: 'miranda', w: 192, h: 192 },
  { name: 'Hansraj College', short: 'Hansraj College', file: 'hansraj', w: 138, h: 192 },
  { name: 'Kirori Mal College', short: 'Kirori Mal College', file: 'kmc', w: 192, h: 192 },
  { name: 'Ramjas College', short: 'Ramjas College', file: 'ramjas', w: 192, h: 192 },
  { name: 'Jawaharlal Nehru University', short: 'JNU', file: 'jnu', w: 120, h: 192 },
  { name: 'Banaras Hindu University', short: 'BHU', file: 'bhu', w: 132, h: 192 },
  { name: 'Jamia Millia Islamia', short: 'Jamia Millia Islamia', file: 'jamia', w: 176, h: 192 },
  { name: 'Aligarh Muslim University', short: 'AMU', file: 'amu', w: 193, h: 192 },
  { name: 'University of Hyderabad', short: 'University of Hyderabad', file: 'uoh', w: 192, h: 192 },
  { name: 'University of Allahabad', short: 'University of Allahabad', file: 'allahabad', w: 191, h: 192 },
  { name: 'Pondicherry University', short: 'Pondicherry University', file: 'pondicherry', w: 191, h: 192 },
]);

export const collegeSrc = (file) => `/art/colleges/${file}.webp`;

export function CollegeStrip({ colleges = COLLEGES }) {
  return (
    <section className="lp-colleges" id="colleges" aria-labelledby="colleges-title">
      <div className="mm-wrap lp-colleges__wrap">
        <h2 className="lp-colleges__title" id="colleges-title">{COLLEGE_HEAD}</h2>
        {/* A slow marquee (owner, 7 Nov 2026: like klayprep.com): the list twice in one track, the second copy hidden from
            screen readers, moving left on a linear loop; paused on hover and keyboard focus; a still, wrapped list under
            reduced motion (college-strip.css). */}
        <div className="lp-colleges__marquee">
          <div className="lp-colleges__track">
            {[0, 1].map((copy) => (
              <ul key={copy} className="lp-colleges__list" aria-hidden={copy ? 'true' : undefined}>
                {colleges.map((college) => (
            <li key={`${copy}-${college.file}`} className="lp-colleges__chip">
                  <span className="lp-colleges__seal">
                    {/* eslint-disable-next-line @next/next/no-img-element -- small fixed emblems with their own pixel size */}
                    <img className="lp-colleges__logo" src={collegeSrc(college.file)} width={college.w} height={college.h} alt="" loading="lazy" decoding="async" draggable={false} />
                  </span>
                  {college.short === college.name || copy ? (
                    <span className="lp-colleges__name">{college.short}</span>
                  ) : (
                    <span className="lp-colleges__name">{college.short}<span className="sr-only">, {college.name}</span></span>
                  )}
                </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
        <p className="lp-colleges__note">{COLLEGE_NOTE}</p>
      </div>
    </section>
  );
}

export default CollegeStrip;
