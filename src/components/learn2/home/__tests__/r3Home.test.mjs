// node --test src/components/learn2/home/__tests__/r3Home.test.mjs
// Learn v2 round 3, packet R3-home: the page's own rules (R3-SPEC rulings W, F, Z, R1 to R6, S1 to S3) pinned on the source, as nav.test.mjs does,
// because the page is client code: no zero lead, one word for each thing, the picker on phones, the dots with names, no ring dots, no status line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FREE_DONE_HEADLINE, FREE_DONE_LINE } from '../../../../../data/learn/allowance.js';
import { WORDS, fixMistakes, reviseDue, withMinutes } from '../../../../../data/learn/words.js';

const here = (path) => new URL(path, import.meta.url);
const src = (path) => readFileSync(here(path), 'utf8').replace(/\r\n/g, '\n');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const HOME = ['../LearnHome.jsx', '../RoadmapHero.jsx', '../ChapterMap.jsx', '../SubjectShelf.jsx', '../SubjectPicker.jsx', '../FindHome.jsx', '../homeModel.mjs', '../../../../../data/learn/roadmap.js'];

test('W: the words Learn home draws come from one place; the old words are gone', () => {
  assert.equal(withMinutes(WORDS.continue, 6), 'Continue · 6 min');
  assert.equal(reviseDue(9, 3), 'Revise 9 due cards · 3 min');
  assert.equal(fixMistakes(3, 3), 'Fix 3 open mistakes · 3 min');
  assert.equal(WORDS.skipKnown, 'Skip what you already know');
  const road = code(src('../../../../../data/learn/roadmap.js'));
  assert.match(road, /withMinutes\(WORDS\.continue, left\)/);
  assert.match(road, /label: WORDS\.skipKnown/);
  assert.match(road, /headline: FREE_DONE_HEADLINE/);
  assert.match(road, /line: FREE_DONE_LINE/);
  assert.match(road, /label: WORDS\.seePro/);
  assert.match(road, /label: WORDS\.singles/);
  for (const file of HOME) {
    const text = code(src(file)).replace("Today's ${minutes} minutes in ${name}", ''); // R2 ruling 1's headline, a sentence, not a label with a length
    assert.doesNotMatch(text, /Find your level|Pick up where you stopped|Pick up, \d|Another \d+ minutes|opens again tomorrow/i, `${file}: an old word`);
    assert.doesNotMatch(text, /, \d+ min\b|\d+ minutes\b|\$\{[^}]*\} minutes\b/, `${file}: time is " · N min"`);
    assert.doesNotMatch(text, /mastered|mastery|marks to recover|!['"`]/i, `${file}: the owner's banned words`);
  }
  // The string constants are imported, never retyped.
  assert.ok(FREE_DONE_HEADLINE.length > 10 && FREE_DONE_LINE.length > 10);
  assert.ok(!code(src('../../../../../data/learn/roadmap.js')).includes(FREE_DONE_HEADLINE), 'the headline is imported, not typed');
});

test('R1 and R6: phones get one subject picker row and a sheet; tablet and desktop keep the loop, with no due number', () => {
  const home = code(src('../LearnHome.jsx'));
  assert.match(home, /<SubjectPicker subjects=\{subjects\} current=\{active\} onPick=\{pick\}/);
  assert.match(home, /<SubjectShelf subjects=\{subjects\} current=\{active\} onPick=\{pick\}/);
  assert.doesNotMatch(home, /dues=/, 'no due count is handed to the loop');
  const shelf = code(src('../SubjectShelf.jsx'));
  assert.doesNotMatch(shelf, /due/i, 'the subject loop never draws a due count');
  const picker = code(src('../SubjectPicker.jsx'));
  assert.match(picker, /role="dialog" aria-modal="true"/);
  assert.match(picker, /createPortal\(/, 'a fixed sheet needs the body: the page is a size container');
  assert.match(picker, /e\.key === 'Escape'/);
  assert.match(picker, /<ChevronDown/);
  const css = src('../learn-home.css');
  assert.match(css, /@media \(min-width: 768px\) \{ \.lh-picker \{ display: none; \} \}/);
  assert.match(css, /@media \(max-width: 767px\) \{ \.app-shell \.pr\.lh-shelf \{ display: none; \} \}/);
  // L7 for this sheet: the page's own background at about 60%, never a grey wash.
  assert.match(css, /\.lh-psheet__scrim \{[^}]*color-mix\(in srgb, var\(--a-bg\) 60%, transparent\)/);
});

test('R2, R3 and R4: no row of ring dots, at most two Or rows, no status line under the search', () => {
  const hero = code(src('../RoadmapHero.jsx'));
  assert.doesNotMatch(hero, /lh-route|function Route/);
  assert.match(hero, /const or = \(roadmap\.or \|\| \[\]\)\.slice\(0, 2\)/);
  assert.doesNotMatch(code(src('../learn-home.css')), /lh-route|lh-skey/, 'the CSS of the dots and the status line is gone');
  const home = code(src('../LearnHome.jsx'));
  assert.doesNotMatch(home, /ShelfKeys/);
  assert.match(code(src('../../../../../data/learn/roadmap.js')), /maxOr: 2/);
});

test('R5: the roadmap has no subline, no "Coming soon", no "free" on a row; the option line and the empty-option line are the spec\'s', () => {
  const map = code(src('../ChapterMap.jsx'));
  assert.doesNotMatch(map, /in book order|chapters started|Coming soon|Your school teaches/);
  assert.match(map, /freeEach\(/);
  assert.match(map, /roadmapRow\(row\)/, 'a row never says "free"');
  assert.match(map, /OPTION_COMING/);
  // 5 Nov (LK94): once a part is chosen the line says which ("Yours is ..."); with no choice it is optionLine's.
  assert.match(map, /chosenOptionLine\(part, choice, at\)/);
  assert.match(map, /playableParts\(allParts\)/);
});

test('Z and S2: due is a dot with an aria-label; Learn home draws no "N due" anywhere', () => {
  for (const file of HOME) assert.doesNotMatch(code(src(file)), /\$\{[^}]*\} due\b|label: 'due'/, `${file}: a bare "N due"`);
  const layout = code(src('../../../../app/(app)/AppLayoutClient.jsx'));
  assert.match(layout, /arena-dot" role="img" aria-label=\{LEARN_DOT_LABEL\}/);
  assert.doesNotMatch(layout, /learnDue\} \$\{learnDue|dueBadge/);
});

test('S1: the yellow bar is the current route\'s alone; Learn\'s due tick is gone', () => {
  const css = src('../../../../app/(app)/arena.css');
  assert.doesNotMatch(css, /nav-learn"\]\[data-due\]/);
  assert.doesNotMatch(code(src('../../../../app/(app)/AppLayoutClient.jsx')), /data-due=/);
});

test('S3: the theme switch renders neutral on the server and settles after mount, so the pick never slides in on arrival', () => {
  const sw = code(src('../../../AppearanceSwitch.jsx'));
  assert.match(sw, /aria-checked=\{ready && mode === id\}/, 'no choice is marked until it is read');
  assert.match(sw, /data-settled=\{settled \|\| undefined\}/);
  const css = src('../../../../app/(app)/arena.css');
  assert.match(css, /\.arena-appearance\[data-settled\]::before \{ transition: transform 240ms/);
  assert.doesNotMatch(css, /\.arena-appearance::before \{[^}]*transition: transform/, 'the base rule has no transition');
});

test('R4 home lows: the picker is plain buttons with aria-pressed, the portalled sheet owns its curve, the pill has no glow, the picked pill is drawn', () => {
  const picker = code(src('../SubjectPicker.jsx'));
  assert.doesNotMatch(picker, /role="radio/, 'no radio roles on list items');
  assert.match(picker, /aria-pressed=\{s\.id === current\}/);
  const css = src('../learn-home.css');
  assert.match(css, /\.lh-psheet \{ --lh-ease: /);
  assert.match(css, /\.lh-row__here \{[^}]*box-shadow: none; filter: none; text-shadow: none;/);
  // R8 LEARN-11: the picked part is rimmed, as Key cards' "Your part" (no ink slab on Day).
  assert.match(css, /\.lh-opt__btn\[aria-checked='true'\] \{ background: var\(--ctl-seg-pick-bg\);[^}]*inset 0 0 0 1\.5px var\(--ctl-seg-pick-line\)/);
  const map = code(src('../ChapterMap.jsx'));
  assert.match(map, /impliedOptionLine\(part, choice\)/);
  assert.match(map, /<Check className="lh-opt__tick"/);
});

test('R4 home: an option with no cards swaps the faded rows out once its save settles (no blank gap above the coming line)', () => {
  const map = code(src('../ChapterMap.jsx'));
  assert.match(map, /if \(!target\.length && saving\) return undefined;/);
  assert.match(map, /saving=\{status\[part\.id\] === 'saving'\}/);
});
