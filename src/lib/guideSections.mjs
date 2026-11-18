// The four long guides (SeoContentPage: /cuet-mock-test-free, /cuet-practice-tests-online, /cuet-previous-year-questions,
// /cuet-2027), made scannable (lane pub-d, 19 Nov 2026). Pure, so node --test holds the rules
// (data/tests/pub_d_1119.test.mjs):
//   * every section heading gets an in-page id made from its own words, stable across builds and unique on the page;
//   * "On this page" lists those headings in order, the questions block last;
//   * the try band sits after the second section and sends a reader to the home page's five sample questions (/#try).
// The words of the guides themselves live in src/lib/seoPages.js and src/app/cuet-2027/page.js and are not changed here.

/** The questions block's heading on every guide (drawn by SeoContentPage). */
export const GUIDE_FAQ_HEADING = 'Frequently asked questions';

/** The try band comes after this many sections. */
export const TRY_AFTER = 2;

/** Where the try band's key goes: the home page's five sample questions (its section id="try"). */
export const TRY_HREF = '/#try';

/** "Why free CUET mock tests matter" -> "why-free-cuet-mock-tests-matter". Only a-z and 0-9 survive, joined by single dashes. */
export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The page's sections in order, each { id, heading, number }, then the questions block ({ number: null }).
 * A heading whose slug is already taken on the page gets "-2", "-3" ... so ids stay unique.
 */
export function guideSections(page) {
  const seen = new Map();
  const unique = (base) => {
    const root = base || 'section';
    const n = (seen.get(root) || 0) + 1;
    seen.set(root, n);
    return n === 1 ? root : `${root}-${n}`;
  };
  const sections = (page.sections || []).map((section, i) => ({ id: unique(slugify(section.heading)), heading: section.heading, number: i + 1 }));
  return [...sections, { id: unique(slugify(GUIDE_FAQ_HEADING)), heading: GUIDE_FAQ_HEADING, number: null }];
}
