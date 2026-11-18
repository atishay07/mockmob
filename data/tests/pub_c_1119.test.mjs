// Lane pub-c (19 Nov 2026): /features shows the product's own screens, /about leads each principle with the figure that backs
// it, and the footer folds on a phone on every public page, not only the home page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('features: nine parts in three groups, word for word, seven led by the tour screens and three as rows', () => {
  const page = read('src/app/features/page.js');
  for (const g of ["{ title: 'Practise', parts: ['Practice', 'NTA mode', 'Saved questions', 'Your standing'] }",
    "{ title: 'Fix what you missed', parts: ['Your papers and mistake repair', 'Chapter review', 'Ask Mobi'] }",
    "{ title: 'Free DU tools', parts: ['DU cutoff calculator', 'Subject combination planner'] }"]) assert.ok(page.includes(g), g);
  // The bodies and links stay word for word (other suites pin several of them too).
  assert.match(page, /Close the tab mid-test and pick up where you left off\./);
  assert.match(page, /everyone gets 50 free a month/);
  assert.match(page, /Free for everyone, no account needed\./);
  assert.match(page, /It is separate from your CUET exam rank\./);
  // The screen per part (Your standing keeps a desk object: the Benchmark screen shows a target score, not a rank).
  const screens = [...page.matchAll(/title: '([^']+)',\n\s+screen: '(\w+)'/g)].map((m) => `${m[1]}=${m[2]}`);
  assert.deepEqual(screens, ['Practice=arena', 'Your papers and mistake repair=repair', 'Chapter review=radar', 'Ask Mobi=prepos',
    'DU cutoff calculator=compass', 'Subject combination planner=combo']);
  const icons = [...page.matchAll(/title: '([^']+)',\n\s+icon: '(\w+)'/g)].map((m) => `${m[1]}=${m[2]}`);
  assert.deepEqual(icons, ['NTA mode=papers', 'Saved questions=saved', 'Your standing=you']);
  assert.match(page, /<h2 className="mm-h2 fx-group__h" id=\{group\.id\}>\{group\.title\}<\/h2>/);
  assert.match(page, /<span className="fx-tile"><BrandIcon name=\{part\.icon\} size=\{48\} \/><\/span>/);
  // One volt key: the closing Sign up free.
  assert.equal((page.match(/mm-btn--primary/g) || []).length, 1);
  // A long body shows its first sentence; the rest sits behind "More", closed on a phone and open from 720 px.
  assert.match(page, /<Unfold from=\{720\} className="fx-more" summary="More"><p>\{rest\}<\/p><\/Unfold>/);
  assert.match(page, /import '@\/app\/tour-screens\.css';/);
});

test('features: the screens rest finished and play nothing by themselves', () => {
  const screen = read('src/app/features/FeatureScreen.jsx');
  assert.match(screen, /const STILL = Object\.freeze\(\{ active: false, reduced: true, paused: false, epoch: 0, held: false \}\);/);
  assert.match(screen, /<Screen play=\{false\} \/>/);
  assert.match(screen, /TOUR_SCREENS\[id\]/);
  const css = strip(read('src/app/pub-pages.css'));
  assert.doesNotMatch(css, /animation|@keyframes|glow|drop-shadow/);
  // Phones: the screen runs 12 px from the edges; from 900 px the screen and the words sit side by side, alternating.
  assert.match(css, /\.fx-shot \{ margin-inline: calc\(12px - var\(--gutter, 20px\)\); \}/);
  assert.match(css, /\.fx-part\[data-flip\] \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 30rem\); grid-template-areas: 'words shot'; \}/);
});

test('about: four tiles, each led by its live figure where the code holds one; unknown is no figure', () => {
  const page = read('src/app/about/page.js');
  assert.match(page, /<dl className="ab-tiles">/);
  assert.match(page, /\{fig \? <dd className="ab-fig"><b>\{fig\.value\}<\/b> <span>\{fig\.unit\}<\/span><\/dd> : null\}/);
  assert.match(page, /publicStatsView\(await publicInventory\(\)\)/, 'the bank count is /api/stats\'s own figure');
  assert.match(page, /view\.bankSize > 0 \? view\.bankSize : null/, 'unknown is not zero');
  assert.match(page, /import DU_RULES from '@\/\.\.\/public\/du\/2026\/rules\.json';/, 'the file the DU calculator counts');
  assert.match(page, /PUBLIC_SUBJECT_COUNT/);
  const figures = [...page.matchAll(/figure: '(\w+)',\n\s+title: '([^']+)'/g)].map((m) => `${m[2]}=${m[1]}`);
  assert.deepEqual(figures, ['One exam, all the way down=subjects', 'Receipts over reviews=bank', 'A score should tell you what to do next=courses']);
  assert.match(page, /title: 'The question bank is engineered, not scraped',/);
  assert.match(strip(read('src/app/pub-pages.css')), /@media \(min-width: 720px\) \{ \.ab-tiles \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 1rem; \} \}/);
});

test('footer: every public page folds its groups on a phone; the home page keeps its own rules and markup', () => {
  const footer = read('src/components/MarketingFooter.jsx');
  assert.match(footer, /<footer className=\{home \? 'mm-foot' : 'mm-foot mm-foot--page'\}>/);
  assert.match(footer, /<Unfold from=\{720\} className="lp-fold--foot" summary=\{<h3>\{title\}<\/h3>\} head=\{<h3>\{title\}<\/h3>\}>/);
  assert.doesNotMatch(footer, /if \(!home\) return <div><h3>/, 'no page keeps the two-screen footer');
  const css = strip(read('src/app/marketing.css'));
  assert.match(css, /@media \(max-width: 719px\) \{\n  \.mm-foot--page \.mm-foot__cols \{ grid-template-columns: minmax\(0, 1fr\); gap: 0; \}/);
  assert.match(css, /\.mm-foot--page \.lp-fold > \.lp-fold__sum \{[^}]*min-height: 56px/);
  assert.match(css, /\.mm-foot--page \.lp-fold\[open\] \.lp-fold__head \{ display: block; \}/);
  // Nothing in the shared sheet styles the home footer's fold (it is `mm-foot` without `--page`).
  assert.doesNotMatch(css, /\.mm-foot \.lp-fold/);
  assert.match(read('src/app/r19-home-b.css'), /body \.mm\.lp \.mm-foot \.lp-fold > \.lp-fold__sum \{ color: var\(--chalk\); \}/);
});
