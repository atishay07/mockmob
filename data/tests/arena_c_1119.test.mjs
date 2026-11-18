// arena-c (19 Nov 2026): Colleges says its count once and draws each course's Round 1 range as a bar on one scale; Saved is a
// shelf (the count as the figure, 25 slots, one volt key for the chapter with the most saved, one card per chapter).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { barScaleMax, rangeOnScale, tickOnScale } from '../../src/lib/du/compassBar.mjs';
import { groupByChapter, topGroup, topGroupLabel } from '../../src/app/(app)/saved/savedModel.mjs';

const read = (rel) => fs.readFileSync(path.resolve(import.meta.dirname, '../..', rel), 'utf8');

test('the bar scale is the top of the 2026 lists the page already prints, never a typed number', () => {
  assert.equal(barScaleMax({ scoreRange: [0, 1000] }), 1000);
  assert.equal(barScaleMax({ scoreRange: [12.5, 946.1] }), 946.1);
  assert.equal(barScaleMax({}), null);
  assert.equal(barScaleMax({ scoreRange: [0, 0] }), null);
  assert.equal(barScaleMax(null), null);
  const index = JSON.parse(read('public/du/2026/index.json'));
  assert.ok(barScaleMax(index.meta) > 0, 'the real index carries the scale');
});

test('a range sits on the scale as fractions, clamped; nothing to draw is null; zero is a position, not unknown', () => {
  assert.deepEqual(rangeOnScale(170.9, 946.1, 1000), { from: 0.1709, to: 0.9461 });
  assert.deepEqual(rangeOnScale(946.1, 170.9, 1000), { from: 0.1709, to: 0.9461 }, 'order does not matter');
  assert.deepEqual(rangeOnScale(0, 500, 1000), { from: 0, to: 0.5 });
  assert.deepEqual(rangeOnScale(900, 1200, 1000), { from: 0.9, to: 1 });
  assert.equal(rangeOnScale(null, 500, 1000), null);
  assert.equal(rangeOnScale(100, 500, null), null);
  assert.equal(tickOnScale(700, 1000), 0.7);
  assert.equal(tickOnScale(0, 1000), 0);
  assert.equal(tickOnScale(null, 1000), null, 'no score, no tick');
});

test('Colleges: the count is the anchor, the strip waits for it, the row draws the bar with its two figures as printed', () => {
  const page = read('src/app/(app)/admission-compass/AdmissionCompassPageClient.jsx');
  const calc = read('src/components/du/CutoffCalculator.jsx');
  const css = read('src/app/(app)/admission-compass/compass.css');
  assert.match(page, /<CutoffCalculator seedSubjects=\{seed\} foldSubjects arena anchorFoot=\{anchorFoot\} \/>/);
  assert.match(page, /with 2026 cutoffs at each college\.'/, 'the opening paragraph is its first sentence');
  assert.match(page, /Plan subjects[\s\S]*Past papers[\s\S]*Get a score/, 'the three tools stay');
  assert.match(calc, /<section className="du-anchor" ref=\{anchorRef\}/);
  assert.match(calc, /<EligibleMeter eligible=\{eligible\.length\} total=\{total\} \/>/);
  assert.match(calc, /hasSelection && !arena \? <EligibleMeter/, 'the second ring block goes on the signed-in page');
  assert.match(calc, /data-away=\{away \? '' : undefined\}/, 'the sticky strip waits while the anchor is on screen');
  assert.match(calc, /<SubjectObject id=\{objectId\(s\.id\)\}/, 'the subjects as desk objects');
  assert.match(calc, /className="du-anchor__go" onClick=\{\(\) => goTo\(resultsRef\)\}>View courses</);
  assert.match(calc, /const scaleMax = arena \? barScaleMax\(data\.meta\) : null;/);
  assert.match(calc, /\{formatScore\(r1\[2\]\)\}<\/span>[\s\S]*\{formatScore\(r1\[3\]\)\}<\/span>/, 'the two figures as printed today');
  assert.match(calc, /2026 Round 1 \(\{category\}\)/);
  assert.match(calc, /\{matched && !arena \? <MatchLine/, 'the option moves inside the disclosure');
  assert.match(calc, /className="du-card__first"/, 'and is shown first when it opens');
  assert.match(calc, /\{arena \? <SubjectObject id=\{objectId\(u\.id\)\}/, 'a suggestion is a tile with its desk object');
  assert.match(css, /\.du-anchor \.du-meter__ring \{ width: 104px; height: 104px; \}/, 'the ring is at least 96 px on phones');
  assert.match(css, /\.du-app\[data-arena\] \.du-streams button \{ min-height: 44px; \}/);
  assert.match(calc, /export function CutoffCalculator\(\{ seedSubjects = null, foldSubjects = false, arena = false, anchorFoot = null \} = \{\}\)/, 'the public calculator does not pass arena');
});

test('Saved: the chapter with the most saved questions is the volt key; a tie keeps the first; no link, no key', () => {
  const q = (id, chapter, subject = 'accountancy') => ({ id, subject, chapter, body: `Stem ${id}` });
  const groups = groupByChapter([q('a', 'Goodwill Valuation'), q('b', 'Admission of Partner'), q('c', 'Admission of Partner')]);
  assert.equal(topGroup(groups).title, 'Admission of a Partner');
  assert.equal(topGroupLabel(topGroup(groups)), 'Practise Admission of a Partner');
  const tie = groupByChapter([q('a', 'Goodwill Valuation'), q('b', 'Admission of Partner')]);
  assert.equal(topGroup(tie).title, 'Goodwill: Nature and Valuation');
  assert.equal(topGroup([]), null);
  assert.equal(topGroup(null), null);
  assert.equal(topGroup([{ href: null, items: [q('x', 'y')] }]), null);
  const bySubject = groupByChapter([{ id: 'd', subject: 'economics', chapter: null }]);
  assert.equal(topGroupLabel(topGroup(bySubject)), bySubject[0].practise, 'a subject group keeps its own words');
  assert.equal(topGroupLabel(null), '');
});

test('Saved: a shelf with the figure, the 25 slots, one card per chapter and Remove inside the opened row', () => {
  const page = read('src/app/(app)/saved/SavedPageClient.jsx');
  const card = read('src/components/feed/QuestionCard.jsx');
  const css = read('src/app/(app)/saved/saved.css');
  assert.match(page, /<p className="sv-shelf__fig"><b>\{count\}<\/b><span>saved<\/span><\/p>/);
  assert.match(page, /\{top \? <Link className="sv-shelf__go mk-press" data-page-primary="" href=\{top\.href\}>\{topGroupLabel\(top\)\}<\/Link> : null\}/);
  assert.match(page, /<span className="sv-ghead__n">\{group\.items\.length\} saved<\/span>/);
  assert.match(page, /<SlotMeter count=\{count\} limit=\{FREE_LIMIT\} pop=\{pop\} \/>/);
  assert.match(page, /href="\/explore" className="ui-state__action ui-state__action--primary/, 'empty: Explore stays the volt key');
  assert.match(card, /\{savedList \? \(open \? \(/, 'Remove lives inside the opened row');
  assert.match(css, /min-height: 56px;/);
  assert.match(css, /\.app-shell \.sv-gkey \{ min-height: 44px;/);
});
