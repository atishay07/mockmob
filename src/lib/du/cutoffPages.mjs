// The public DU cutoff pages (/du-cutoffs, /du-cutoffs/<course>, /du-cutoffs/colleges/<college>). Pure: built from
// public/du/2026/index.json and offerings/<id>.json, which were checked cell by cell against DU's PDFs
// (data/du-csas-2026/verification/REPORT.md). Every score is shown as DU printed it: the PDFs print each score as the
// shortest decimal for its number, so String(n) is the printed text (570, 426.45, 924.3009). Nothing here estimates.
import { CATEGORY_LABELS } from './eligibility.js';
import { STREAM_ORDER } from './client.js';
import { DU_CHECKED_ON, DU_SOURCES } from './sources.js';

export const CUTOFFS_PATH = '/du-cutoffs';
export const CUTOFF_CATEGORIES = Object.freeze(['UR', 'OBC-NCL', 'SC', 'ST', 'EWS', 'SIKH', 'PwBD', 'KM', 'SGC', 'ORPHAN-FEMALE', 'ORPHAN-MALE']);
export const CUTOFF_ROUNDS = Object.freeze([1, 2, 3]);
/** B.A. (Programme) is listed per pair of subjects, so its rows are pairs inside each college. */
export const PAIRS_COURSE = 'b-a-programme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-11-15' -> '15 November 2026'. */
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** The line every cutoff page carries under its sources. */
export const CHECKED_LINE = `Checked against DU’s PDFs on ${longDate(DU_CHECKED_ON)}.`;

/** The year line: these are the latest published numbers, and 2027 will differ. */
export const YEAR_LINE = 'These are from DU’s 2026 admissions, the latest published. Cutoffs for 2027 will be different.';

/** DU's own documents, in the words the pages show, with release dates. */
export function cutoffSources() {
  return DU_SOURCES.map((s) => ({
    id: s.id,
    label: s.round ? `Round ${s.round} list` : 'UG Bulletin of Information 2026-27',
    use: s.round ? `Round ${s.round} minimum allocation scores` : 'Who can apply to each course',
    released: longDate(s.releasedOn),
    url: s.url,
  }));
}

/** A score as DU printed it, or null for a blank cell. */
export function printedScore(v) {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : null;
}

/** DU marks a college for women "(W)". */
export const isWomenCollege = (name) => /\(W\)/.test(String(name));

/** A college's name without DU's "(W)" mark, for titles and headings ("Miranda House"). */
export const collegeTitle = (name) => String(name).replace(/\s*\(W\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * A college's address: lower case, "&" as "and", no dots or apostrophes, "(W)" dropped, every other run of
 * non-letters a hyphen. "St. Stephen's College" -> st-stephens-college, "Sri Aurobindo College (Evening)" ->
 * sri-aurobindo-college-evening. Unique across the 67 colleges (tested).
 */
export function collegeSlug(name) {
  return collegeTitle(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const coursePath = (courseId) => `${CUTOFFS_PATH}/${courseId}`;
export const collegePath = (slug) => `${CUTOFFS_PATH}/colleges/${slug}`;

/** The free calculator, opened on this course when there is one (its ?course= link opens that course's card). */
export function calculatorHref(courseId) {
  return courseId ? `/cuet-cutoff-calculator?course=${encodeURIComponent(courseId)}` : '/cuet-cutoff-calculator';
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });

/**
 * Every course with a published cutoff list and every college, from the index and the offerings files.
 * offeringsById: { [courseId]: offerings file }. Rows keep DU's own order inside a course (by college).
 * A row: { college, collegeSlug, printed, pair, rounds: [r1, r2, r3] }, each round an 11-category array or null
 * when that round's list did not print the row.
 */
export function buildCatalog(index, offeringsById) {
  const categories = index.meta.categories;
  if (categories.join() !== CUTOFF_CATEGORIES.join()) throw new Error('DU categories changed');
  const courses = [];
  const colleges = new Map();
  for (const group of index.groups) {
    const file = offeringsById[group.id];
    if (!group.offerings || !file) continue;
    const pairs = group.id === PAIRS_COURSE;
    const rows = file.rows.map((r) => ({
      college: r[0],
      collegeSlug: collegeSlug(r[0]),
      printed: r[1],
      pair: pairs ? r[1] : null,
      rounds: [r[2] ?? null, r[3] ?? null, r[4] ?? null],
    }));
    const course = {
      id: group.id,
      name: group.name,
      stream: group.stream,
      collegeCount: new Set(rows.map((r) => r.college)).size,
      rows,
      pairs,
      eligibility: group.eligibility,
    };
    courses.push(course);
    for (const row of rows) {
      if (!colleges.has(row.collegeSlug)) {
        colleges.set(row.collegeSlug, { slug: row.collegeSlug, name: row.college, title: collegeTitle(row.college), women: isWomenCollege(row.college), rows: [] });
      }
      const college = colleges.get(row.collegeSlug);
      if (college.name !== row.college) throw new Error(`Two colleges share the address ${row.collegeSlug}`);
      college.rows.push({ courseId: course.id, courseName: course.name, printed: row.printed, pair: row.pair, rounds: row.rounds });
    }
  }
  courses.sort((a, b) => streamRank(a.stream) - streamRank(b.stream) || byName(a.name, b.name));
  const collegeList = [...colleges.values()].sort((a, b) => byName(a.name, b.name));
  for (const c of collegeList) {
    c.rows.sort((a, b) => byName(a.courseName, b.courseName) || byName(a.printed, b.printed));
    c.courseCount = new Set(c.rows.map((r) => r.courseId)).size;
  }
  return { courses, colleges: collegeList, withoutCutoffs: index.meta.programmesWithoutCutoffs || [] };
}

function streamRank(stream) {
  const i = STREAM_ORDER.indexOf(stream);
  return i === -1 ? STREAM_ORDER.length : i;
}

/** Courses grouped by stream, in the calculator's stream order. */
export function coursesByStream(courses) {
  const out = [];
  for (const course of courses) {
    const last = out[out.length - 1];
    if (last && last.stream === course.stream) last.courses.push(course);
    else out.push({ stream: course.stream, courses: [course] });
  }
  return out;
}

/**
 * A course page's table sections. Most courses: one section, a row per college (linked to its college page).
 * B.A. (Programme): a section per college, a row per subject pair. Rows are plain data for the client table:
 * { key, title, href, sub, rounds }.
 */
export function courseSections(course) {
  const show = (row) => (row.printed && normName(row.printed) !== normName(course.name) ? row.printed : null);
  if (!course.pairs) {
    return [{
      key: 'all',
      heading: null,
      rows: course.rows.map((r) => ({ key: r.college, title: r.college, href: collegePath(r.collegeSlug), sub: show(r), rounds: r.rounds })),
    }];
  }
  const sections = [];
  for (const r of course.rows) {
    let sec = sections[sections.length - 1];
    if (!sec || sec.key !== r.collegeSlug) {
      sec = { key: r.collegeSlug, heading: r.college, href: collegePath(r.collegeSlug), rows: [] };
      sections.push(sec);
    }
    sec.rows.push({ key: `${r.college}|${r.pair}`, title: r.pair, href: null, sub: null, rounds: r.rounds });
  }
  return sections;
}

/**
 * A college page's table sections: one for its courses (each linked to its course page), then B.A. (Programme)'s
 * subject pairs when the college offers it.
 */
export function collegeSections(college) {
  const plain = college.rows.filter((r) => !r.pair);
  const pairs = college.rows.filter((r) => r.pair);
  const sections = [];
  if (plain.length) {
    sections.push({
      key: 'courses',
      heading: null,
      rows: plain.map((r) => ({
        key: r.courseId,
        title: r.courseName,
        href: coursePath(r.courseId),
        sub: normName(r.printed) !== normName(r.courseName) ? r.printed : null,
        rounds: r.rounds,
      })),
    });
  }
  if (pairs.length) {
    sections.push({
      key: PAIRS_COURSE,
      heading: pairs[0].courseName,
      href: coursePath(PAIRS_COURSE),
      rows: pairs.map((r) => ({ key: r.pair, title: r.pair, href: null, sub: null, rounds: r.rounds })),
    });
  }
  return sections;
}

function normName(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** The score a row shows for a category in a round (1 to 3), as printed, or null. */
export function cellFor(rounds, categoryIndex, round) {
  const arr = rounds[round - 1];
  return arr ? printedScore(arr[categoryIndex]) : null;
}

/** Does any row of these sections have a score for this category in any round? */
export function hasAnyScore(sections, categoryIndex) {
  return sections.some((s) => s.rows.some((r) => r.rounds.some((arr) => arr && typeof arr[categoryIndex] === 'number')));
}

/**
 * Rows in the chosen order. 'name': as given (DU's A to Z). 'high': highest round 1 score for the category first;
 * rows with no round 1 score for it keep their order at the end.
 */
export function orderRows(rows, categoryIndex, order) {
  if (order !== 'high') return rows;
  const r1 = (row) => (row.rounds[0] && typeof row.rounds[0][categoryIndex] === 'number' ? row.rounds[0][categoryIndex] : null);
  const scored = rows.filter((r) => r1(r) !== null).sort((a, b) => r1(b) - r1(a));
  return [...scored, ...rows.filter((r) => r1(r) === null)];
}

export const categoryLabel = (c) => CATEGORY_LABELS[c] || c;

// ---- Page words -----------------------------------------------------------------------------------------------

export function courseMeta(course) {
  const n = plural(course.collegeCount, 'College');
  return {
    title: `DU ${course.name} Cutoff 2026: ${n}, Rounds 1 to 3 | MockMob`,
    description: `The lowest CUET score that got a ${course.name} seat at ${course.collegeCount === 1 ? 'the DU college that offers it' : `each of the ${course.collegeCount} DU colleges that offer it`}, in rounds 1, 2 and 3 of 2026 admissions, for every category. Checked against DU’s own PDFs.`,
  };
}

export function collegeMeta(college) {
  return {
    title: `${college.title} Cutoff 2026: ${plural(college.courseCount, 'DU Course')}, Rounds 1 to 3 | MockMob`,
    description: `${college.title}’s 2026 DU cutoffs for ${college.courseCount === 1 ? 'its course' : `all ${college.courseCount} of its courses`}: the lowest CUET score that got a seat in rounds 1, 2 and 3, for every category. Checked against DU’s own PDFs.`,
  };
}

export function indexMeta(catalog) {
  return {
    title: 'DU Cutoff 2026: Every Course and College, Rounds 1 to 3 | MockMob',
    description: `DU cutoffs from 2026 admissions: the lowest CUET score that got a seat in ${catalog.courses.length} courses at ${catalog.colleges.length} colleges, in rounds 1, 2 and 3, for every category. Checked against DU’s own PDFs.`,
  };
}

/**
 * The round 1 unreserved (UR) scores a course's rows run between, as printed: { low, high, count } or null when fewer
 * than two rows have one. For the line under a course page's title.
 */
export function roundOneRange(course) {
  const vals = course.rows.map((r) => (r.rounds[0] ? r.rounds[0][0] : null)).filter((v) => typeof v === 'number');
  if (vals.length < 2) return null;
  return { low: printedScore(Math.min(...vals)), high: printedScore(Math.max(...vals)), count: vals.length };
}

/**
 * Who can apply, as the calculator states it (src/lib/du/eligibility.js explainCombinations): each of DU's subject
 * combinations as "Option n" with the Bulletin's own text; `secondary` when the Bulletin considers it only if seats
 * remain after Options 1 and 2; `extraLanguage` when the Bulletin also asks for a language the option does not name.
 * The Bulletin's free-text notes are not shown: the parsed notes carry headings and descriptions of other courses.
 */
export function eligibilityLines(course) {
  const e = course.eligibility || {};
  const seatsRemain = (e.notes || []).some((n) => /only if seats remain vacant/i.test(n));
  const options = (e.combinations || []).map((c, i) => ({
    label: `Option ${i + 1}`,
    text: c.text,
    secondary: seatsRemain && /^Combination (III|IV)$/.test(c.label),
    extraLanguage: Boolean(e.requiresLanguage) && !(c.slots || []).some((slot) => slot.type === 'lang'),
  }));
  return { options, performanceTest: Boolean(e.performanceTest) };
}
