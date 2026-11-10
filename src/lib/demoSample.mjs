// "Not your subject?" on the home page's sample card (round 4 H3, owner LK123, 5 Nov 2026): the browser half.
// Pure and browser-safe (no server import, no alias import), so node --test holds it (data/tests/demo_sample_1105.test.mjs)
// and DemoDrill.jsx bundles only these few lines, never the syllabus.
//
// The card opens on its own five (DemoDrill DRILL: English first, no network). A visitor who picks a subject gets five
// live questions of it from GET /api/sample?subject=<slug>&set=<n> (src/app/api/sample/route.js): one of six sets, picked
// at random here. The server keeps a fixed window of DEMO_POOL_SIZE questions a subject, cut into sets of five; `set`
// picks one of them, so the CDN holds one answer per subject and set, and the questions a visitor can ever see are
// bounded. The card's copy therefore never says the five are drawn at random from the whole bank (the design note:
// docs/design-decisions/web-r4-demo.md).

/** Questions in a set: the card's five. */
export const DEMO_SET_SIZE = 5;
/** Sets a subject's window is cut into (the window is DEMO_SETS x DEMO_SET_SIZE questions). */
export const DEMO_SETS = 6;
export const DEMO_POOL_SIZE = DEMO_SETS * DEMO_SET_SIZE;
export const DEMO_ROUTE = '/api/sample';

// The 15 subjects Practice offers, in the order a student meets them (src/lib/subjectPages.mjs SUBJECT_PAGES; the test
// holds the two lists equal): English first, the default the card opens on, then the General Test, Commerce, Science and
// Humanities. `slug` is the public subject page's slug, the only subject word the route accepts.
export const DEMO_SUBJECTS = Object.freeze([
  ['english', 'English'],
  ['general-test', 'General Test'],
  ['accountancy', 'Accountancy'],
  ['business-studies', 'Business Studies'],
  ['economics', 'Economics'],
  ['mathematics', 'Mathematics'],
  ['physics', 'Physics'],
  ['chemistry', 'Chemistry'],
  ['biology', 'Biology'],
  ['computer-science', 'Computer Science'],
  ['history', 'History'],
  ['political-science', 'Political Science'],
  ['geography', 'Geography'],
  ['psychology', 'Psychology'],
  ['sociology', 'Sociology'],
].map(([slug, name]) => Object.freeze({ slug, name })));

const BY_SLUG = new Map(DEMO_SUBJECTS.map((s) => [s.slug, s]));

/** The picker's entry for a slug, or null. */
export function demoSubject(slug) {
  return BY_SLUG.get(String(slug ?? '')) || null;
}

/** The route's address for a subject's set. */
export function demoSetUrl(slug, set) {
  return `${DEMO_ROUTE}?subject=${encodeURIComponent(slug)}&set=${Number(set)}`;
}

/**
 * A random set number (0 to DEMO_SETS - 1), never `previous` when there is a choice: picking the same subject again
 * brings five other questions. `random` is Math.random in the browser and a fixed sequence in the test.
 */
export function pickDemoSet(previous = null, random = Math.random) {
  const prev = Number.isInteger(previous) ? previous : null;
  const choices = Array.from({ length: DEMO_SETS }, (_, i) => i).filter((i) => i !== prev);
  const r = Number(random());
  const at = Math.min(choices.length - 1, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * choices.length)));
  return choices[at];
}

const text = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

export function demoPastPaperLabel(pastPaper) {
  const year = pastPaper?.year;
  if (!Number.isInteger(year) || year < 2022 || year > new Date().getUTCFullYear()) return null;
  if (pastPaper.kind === 'asked') return `Asked in CUET ${year}`;
  if (pastPaper.kind === 'adapted') return `Adapted from CUET ${year}`;
  return null;
}

/**
 * The route's answer as the card plays it, or null when it is not one: exactly DEMO_SET_SIZE questions, each a stem,
 * four option texts, the right option's place (0 to 3), the reason and the chapter. A verified past-paper reference is optional. Each
 * question carries the subject's name for the card's head. Anything else (a short set, a fifth option, a missing
 * reason) is refused whole, so the card never plays half a set.
 */
export function acceptDemoSet(body, slug) {
  const subject = demoSubject(slug);
  if (!subject || !body || typeof body !== 'object' || body.subject !== subject.slug) return null;
  const list = Array.isArray(body.questions) ? body.questions : [];
  if (list.length !== DEMO_SET_SIZE) return null;
  const questions = [];
  for (const item of list) {
    const q = text(item?.q, 600);
    const why = text(item?.why, 900);
    const chapter = text(item?.chapter, 160) || subject.name;
    const options = Array.isArray(item?.options) && item.options.length === 4 ? item.options.map((o) => text(o, 300)) : [];
    const correct = item?.correct;
    if (!q || !why || options.length !== 4 || options.some((o) => !o) || !Number.isInteger(correct) || correct < 0 || correct > 3) return null;
    const pastPaper = demoPastPaperLabel(item?.pastPaper);
    questions.push({ subject: subject.name, q, options, correct, why, chapter, ...(pastPaper ? { pastPaper } : {}) });
  }
  const set = Number.isInteger(body.set) && body.set >= 0 && body.set < DEMO_SETS ? body.set : null;
  return { slug: subject.slug, name: subject.name, set, questions };
}
