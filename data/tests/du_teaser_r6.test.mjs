import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const teaser = read('src/components/du/EligibilityTeaser.jsx');
const colleges = read('src/components/landing/CollegeDestinations.jsx');
const page = read('src/app/page.js');

test('collapsed domain list always shows the four commerce domains and a toggle with aria-expanded', () => {
  assert.match(teaser, /SHOWN_DOMAINS = \['accountancy', 'business_studies', 'economics', 'mathematics'\]/);
  assert.match(teaser, /showAll \|\| kept\.includes\(id\) \|\| selection\.domains\.includes\(id\)/);
  assert.match(teaser, /aria-expanded=\{showAll\}/);
  assert.match(teaser, /aria-controls="du-teaser-domains"/);
  assert.match(teaser, /Show all 12 subjects and GAT/);
  assert.match(teaser, /Show fewer/);
});

test('the teaser has one count: no du-live bar', () => {
  assert.doesNotMatch(teaser, /du-live/);
  assert.match(teaser, /du-teaser__big/);
});

test('result lists up to six programme names then "and n more"', () => {
  assert.match(teaser, /MAX_NAMES = 6/);
  assert.match(teaser, /and \$\{moreCount\} more/);
});

test('compact college row keeps the same hrefs', () => {
  assert.match(page, /<CollegeDestinations compact \/>/);
  assert.match(colleges, /compact = false/);
  assert.match(colleges, /\/cuet-cutoff-calculator\?course=\$\{college\.course\}/);
  for (const c of ['b-com-hons', 'b-a-hons-economics', 'b-a-hons-english']) assert.ok(colleges.includes(`course: '${c}'`));
});

test('DU and pricing seats use the eyebrow and center classes', () => {
  assert.doesNotMatch(page, /pip-seat--utility/);
  assert.equal((page.match(/pip-seat--eyebrow pip-seat--center/g) || []).length >= 2, true);
});

test('ticked chips stay revealed until Show fewer (kept list)', () => {
  assert.match(teaser, /const \[kept, setKept\] = useState\(\[\]\)/);
  assert.match(teaser, /kept\.includes\('gat'\)/);
  assert.match(teaser, /if \(showAll\) setKept\(\[\]\)/);
});

test('named programmes are sorted by colleges and never include a group with none', () => {
  assert.match(teaser, /b\.group\.offerings - a\.group\.offerings/);
  assert.match(teaser, /r\.group\.offerings > 0/);
});

test('the DU head is centred and no longer forced left on desktop', () => {
  assert.doesNotMatch(read('src/app/home-sections.css'), /#du-eligibility \.lp-head/);
  assert.match(read('src/app/home-refinements.css'), /#du-eligibility \.lp-head \{[^}]*text-align: center/);
});

test('the dock no longer yields to a du-live bar', () => {
  const gate = read('src/components/landing/HeroDockGate.jsx');
  assert.doesNotMatch(gate, /state.elig|eligWatch|data-yield/);
  assert.doesNotMatch(read('src/app/hero-depth.css'), /du-live/);
  assert.doesNotMatch(read('src/components/du/du.css'), /\.du-live/);
});

test('compact college row has no nav landmark and a labelled list', () => {
  assert.doesNotMatch(colleges, /<nav/);
  assert.match(colleges, /aria-labelledby="lp-colleges-label"/);
});
