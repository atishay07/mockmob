// The DU cutoff pages' model (cutoffPages.mjs) against the served 2026 files, and the pages' wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CHECKED_LINE, CUTOFF_CATEGORIES, PAIRS_COURSE, YEAR_LINE, buildCatalog, calculatorHref, cellFor, collegeMeta, collegePath,
  collegeSections, collegeSlug, collegeTitle, courseMeta, coursePath, courseSections, coursesByStream, cutoffSources,
  eligibilityLines, hasAnyScore, indexMeta, longDate, orderRows, printedScore, roundOneRange,
} from './cutoffPages.mjs';

const repo = path.resolve(import.meta.dirname, '../../..');
const root = path.join(repo, 'public/du/2026');
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const offerings = {};
for (const g of index.groups) {
  if (g.offerings) offerings[g.id] = JSON.parse(fs.readFileSync(path.join(root, 'offerings', `${g.id}.json`), 'utf8'));
}
const catalog = buildCatalog(index, offerings);
const course = (id) => catalog.courses.find((c) => c.id === id);
const college = (slug) => catalog.colleges.find((c) => c.slug === slug);
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');

test('one page per course with a cutoff list and per college, every row on both', () => {
  assert.equal(catalog.courses.length, 68);
  assert.equal(catalog.colleges.length, 67);
  assert.equal(catalog.courses.reduce((n, c) => n + c.rows.length, 0), 1393);
  assert.equal(catalog.colleges.reduce((n, c) => n + c.rows.length, 0), 1393);
  assert.equal(new Set(catalog.courses.map((c) => c.id)).size, 68);
  assert.equal(new Set(catalog.colleges.map((c) => c.slug)).size, 67, 'college addresses are unique');
  for (const c of catalog.colleges) assert.match(c.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, c.name);
  assert.ok(!catalog.courses.some((c) => c.id === 'colleges'), 'no course id collides with /du-cutoffs/colleges');
  assert.equal(catalog.withoutCutoffs.length, 5);
  // Streams in the calculator's order, every course once.
  const streams = coursesByStream(catalog.courses);
  assert.equal(streams[0].stream, 'Commerce & Economics');
  assert.equal(streams.flatMap((s) => s.courses).length, 68);
  assert.equal(new Set(streams.map((s) => s.stream)).size, streams.length);
});

test('college addresses and titles', () => {
  assert.equal(collegeSlug('St. Stephen\'s College'), 'st-stephens-college');
  assert.equal(collegeSlug('Miranda House (W)'), 'miranda-house');
  assert.equal(collegeSlug('Jesus & Mary College (W)'), 'jesus-and-mary-college');
  assert.equal(collegeSlug('P.G.D.A.V. College (Evening)'), 'pgdav-college-evening');
  assert.equal(collegeSlug('Sri Aurobindo College (Day)'), 'sri-aurobindo-college-day');
  assert.equal(collegeTitle('Lady Shri Ram College for Women (W)'), 'Lady Shri Ram College for Women');
  assert.ok(college('miranda-house').women);
  assert.ok(!college('hindu-college').women);
  assert.equal(collegePath('hindu-college'), '/du-cutoffs/colleges/hindu-college');
  assert.equal(coursePath('b-com-hons'), '/du-cutoffs/b-com-hons');
  assert.equal(calculatorHref('b-com-hons'), '/cuet-cutoff-calculator?course=b-com-hons');
  assert.equal(calculatorHref(null), '/cuet-cutoff-calculator');
});

test('scores print exactly as DU printed them', () => {
  assert.equal(printedScore(570), '570');
  assert.equal(printedScore(426.45), '426.45');
  assert.equal(printedScore(924.3009), '924.3009');
  assert.equal(printedScore(null), null);
  // DU prints at most four decimals; String(n) of every served score keeps that form.
  for (const c of catalog.courses) {
    for (const r of c.rows) {
      for (const arr of r.rounds) {
        if (!arr) continue;
        for (const v of arr) if (v !== null) assert.match(printedScore(v), /^\d{1,3}(\.\d{1,4})?$/, `${r.college} ${c.name}: ${v}`);
      }
    }
  }
  const srcc = course('b-com-hons').rows.find((r) => r.college === 'Shri Ram College of Commerce');
  assert.equal(cellFor(srcc.rounds, 0, 1), '924.3009');
  assert.equal(cellFor(srcc.rounds, 0, 3), null, 'SRCC is not in the round 3 list');
  assert.equal(cellFor(srcc.rounds, CUTOFF_CATEGORIES.indexOf('SIKH'), 1), null);
});

test('course sections: a row per college, or per subject pair inside each college for B.A. (Programme)', () => {
  const bcom = courseSections(course('b-com-hons'));
  assert.equal(bcom.length, 1);
  assert.equal(bcom[0].rows.length, 55);
  const slugs = new Set(catalog.colleges.map((c) => collegePath(c.slug)));
  for (const row of bcom[0].rows) assert.ok(slugs.has(row.href), row.title);
  assert.equal(bcom[0].rows.filter((r) => r.sub).length, 0, 'DU prints B.Com. (Hons.) under its own name');
  const ba = courseSections(course(PAIRS_COURSE));
  assert.equal(ba.length, 54);
  assert.equal(ba.reduce((n, s) => n + s.rows.length, 0), 627);
  assert.ok(ba.every((s) => s.heading && s.href && s.rows.every((r) => r.title && !r.href)));
  // A course DU printed under a longer name shows that name.
  const voc = courseSections(course('b-a-vocational-studies'))[0].rows[0];
  assert.equal(voc.sub, 'B.A. (Vocational Studies) Tourism Management');
});

test('college sections: its courses, then its B.A. (Programme) pairs', () => {
  const hindu = college('hindu-college');
  const secs = collegeSections(hindu);
  assert.equal(secs.reduce((n, s) => n + s.rows.length, 0), hindu.rows.length);
  assert.equal(secs[0].heading, null);
  assert.ok(secs[0].rows.every((r) => r.href.startsWith('/du-cutoffs/')));
  const srcc = collegeSections(college('shri-ram-college-of-commerce'));
  assert.deepEqual(srcc[0].rows.map((r) => r.title), ['B.A. (Hons.) Economics', 'B.Com. (Hons.)']);
  assert.equal(srcc.length, 1, 'SRCC teaches no B.A. (Programme)');
  const spm = collegeSections(college('shyama-prasad-mukherji-college-for-women'));
  const pairs = spm.find((s) => s.key === PAIRS_COURSE);
  assert.ok(pairs.rows.some((r) => r.title === 'Computer Applications + Economics'));
  assert.equal(cellFor(pairs.rows.find((r) => r.title === 'Computer Applications + Economics').rounds, 0, 1), '570');
});

test('order: A to Z as DU lists it, or highest round 1 first with blanks last', () => {
  const rows = courseSections(course('b-com-hons'))[0].rows;
  assert.equal(orderRows(rows, 0, 'name'), rows);
  const high = orderRows(rows, 0, 'high');
  assert.equal(high[0].title, 'Shri Ram College of Commerce');
  const r1 = high.map((r) => (r.rounds[0] ? r.rounds[0][0] : null));
  const filled = r1.filter((v) => v !== null);
  assert.deepEqual(filled, [...filled].sort((a, b) => b - a));
  assert.ok(r1.indexOf(null) === -1 || r1.slice(r1.indexOf(null)).every((v) => v === null));
  // A category with blanks: the blanks go last, in their own order.
  const sikh = CUTOFF_CATEGORIES.indexOf('SIKH');
  const bySikh = orderRows(rows, sikh, 'high');
  const firstBlank = bySikh.findIndex((r) => !r.rounds[0] || r.rounds[0][sikh] === null);
  assert.ok(firstBlank > 0);
  assert.ok(bySikh.slice(firstBlank).every((r) => !r.rounds[0] || r.rounds[0][sikh] === null));
  assert.equal(bySikh.length, rows.length);
});

test('an empty category is detected, so the page says so instead of a table of dashes', () => {
  const sections = courseSections(course('b-a-hons-arabic'));
  const empty = CUTOFF_CATEGORIES.map((c, i) => [c, hasAnyScore(sections, i)]).filter(([, any]) => !any).map(([c]) => c);
  assert.ok(empty.length > 0, 'a one-college course has categories DU printed nothing for');
  assert.equal(hasAnyScore(sections, 0), true);
});

test('the round 1 range under a course title', () => {
  assert.deepEqual(roundOneRange(course('b-com-hons')), { low: '645.287', high: '924.3009', count: 55 });
  assert.equal(roundOneRange(course('b-a-hons-arabic')), null);
});

test('who can apply: DU\'s options, the seats-remain rule and the performance test', () => {
  const eng = eligibilityLines(course('b-a-hons-english'));
  assert.deepEqual(eng.options.map((o) => o.label), ['Option 1', 'Option 2']);
  assert.equal(eng.options[0].text, 'English from List A + Any three subjects from List B');
  const withSeats = catalog.courses.map(eligibilityLines).filter((e) => e.options.some((o) => o.secondary));
  assert.ok(withSeats.length > 0);
  for (const e of withSeats) assert.ok(e.options.filter((o) => o.secondary).every((o) => ['Option 3', 'Option 4'].includes(o.label)));
});

test('page words: course not programme, the year line, the checked line, the sources with dates', () => {
  assert.equal(CHECKED_LINE, 'Checked against DU’s PDFs on 15 November 2026.');
  assert.equal(longDate('2026-08-09'), '9 August 2026');
  assert.match(YEAR_LINE, /2026/);
  assert.match(YEAR_LINE, /2027 will be different/);
  const sources = cutoffSources();
  assert.deepEqual(sources.map((s) => s.released), ['6 January 2026', '17 July 2026', '25 July 2026', '9 August 2026']);
  for (const s of sources) assert.match(s.url, /^https:\/\//);
  const words = [
    YEAR_LINE, CHECKED_LINE, ...sources.flatMap((s) => [s.label, s.use]),
    ...Object.values(indexMeta(catalog)),
    ...catalog.courses.flatMap((c) => Object.values(courseMeta(c)).map((w) => w.split(c.name).join(''))),
    ...catalog.colleges.flatMap((c) => Object.values(collegeMeta(c))),
  ];
  for (const w of words) {
    assert.doesNotMatch(w, /programme|program\b/i, w);
    assert.doesNotMatch(w, /!/, w);
  }
  assert.equal(courseMeta(course('b-com-hons')).title, 'DU B.Com. (Hons.) Cutoff 2026: 55 Colleges, Rounds 1 to 3 | MockMob');
  assert.equal(collegeMeta(college('miranda-house')).title.startsWith('Miranda House Cutoff 2026: '), true);
  assert.match(courseMeta(course('b-a-hons-arabic')).description, /the DU college that offers it/);
});

test('the pages are static, carry their metadata and reach the sitemap', () => {
  const coursePage = read('src/app/du-cutoffs/[course]/page.js');
  const collegePage = read('src/app/du-cutoffs/colleges/[college]/page.js');
  const indexPage = read('src/app/du-cutoffs/page.js');
  for (const page of [coursePage, collegePage]) {
    assert.match(page, /export const dynamicParams = false;/);
    assert.match(page, /export function generateStaticParams\(\)/);
    assert.match(page, /export async function generateMetadata/);
    assert.match(page, /seoMetadata\(/);
  }
  assert.match(indexPage, /export const metadata = seoMetadata\(/);
  for (const page of [coursePage, collegePage, indexPage]) {
    assert.match(page, /<CutoffSources \/>/);
    assert.match(page, /<YearNote \/>/);
    assert.match(page, /<CutoffClose /);
    assert.match(page, /calculatorHref\(/);
    assert.match(page, /<PublicDock /);
  }
  // One volt key on a page: the closing sign-up (the phone dock yields to it). Everything else is secondary.
  const parts = read('src/app/du-cutoffs/_parts/CutoffParts.jsx');
  assert.equal((parts.match(/mm-btn--primary/g) || []).length, 1);
  for (const page of [coursePage, collegePage, indexPage]) assert.doesNotMatch(page, /mm-btn--primary/);
  const sitemap = read('src/app/sitemap.js');
  assert.match(sitemap, /du\.courses\.map/);
  assert.match(sitemap, /du\.colleges\.map/);
  assert.match(sitemap, /CUTOFFS_PATH/);
});

test('the table stacks on a phone: three equal round columns under the name, never a sideways grid', () => {
  const css = read('src/app/du-cutoffs/du-cutoffs.css');
  assert.match(css, /\.dc-table tbody tr \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.dc-table td::before \{\s*content: attr\(data-label\);/);
  assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll)/);
  assert.match(css, /@media \(min-width: 720px\)/);
});
