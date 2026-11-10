// The guide ("Show me around"), rebuilt 10 Nov 2026 (owner: "the guide feature [is] just so, so, so bad. It should
// automatically start when someone is first-time entering the platform").
//   - the stops: few, one true line each, 16 words at most, plain copy;
//   - starting by itself: once, for a student who has just finished onboarding on this device, every condition held as a pure rule;
//   - the card: beside the target on the side with more room, never over it, inside the screen, never under the dock or the top bar;
//   - the shell only holds open and closed; the guide is its own component and stylesheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDE_AUTO_DELAY_MS, GUIDE_AUTO_PAGES, GUIDE_AUTO_WINDOW_MS, TOUR_LINE_WORDS, TOUR_STEPS_ALL, guideAutoStart, tourSteps } from '../../src/lib/appTour.mjs';
import { emptyRecord, markFirstShown, noteOnboarded, onboardedRecently } from '../../src/lib/proNudge.mjs';
import { tourNote } from '../../src/lib/helpDoor.mjs';
import { GUIDE_CARD_MAX, GUIDE_EDGE, GUIDE_GAP, boxesOverlap, guideCardWidth, placeGuideCard } from '../../src/components/guide/guidePlace.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---- the stops ---------------------------------------------------------------------------------------------------------------------

test('the stops: Today, Practice, Start, Ask Mobi, the Mob while it is on, You', () => {
  assert.deepEqual(TOUR_STEPS_ALL.map((s) => s.title), ['Today', 'Practice', 'Start', 'Ask Mobi', 'Your Mob', 'You']);
  assert.deepEqual(tourSteps().map((s) => s.title), ['Today', 'Practice', 'Start', 'Ask Mobi', 'You'], 'five stops while the Mob is off');
  assert.deepEqual(tourSteps({ mob: true }).map((s) => s.title), ['Today', 'Practice', 'Start', 'Ask Mobi', 'Your Mob', 'You']);
  assert.equal(tourSteps({ study: true }).length, 5, 'the lessons add no stop');
  assert.ok(TOUR_STEPS_ALL.length <= 6, 'short and few');
  assert.deepEqual(TOUR_STEPS_ALL.find((s) => s.title === 'Start').target, 'nav-start', 'the Start stop stands on the Start key');
  assert.deepEqual(TOUR_STEPS_ALL.find((s) => s.title === 'Ask Mobi').target, ['nav-mentor', 'nav-mentor-top']);
  assert.deepEqual(TOUR_STEPS_ALL.find((s) => s.title === 'You').target, ['nav-profile', 'nav-more']);
});

test('the stops: the words', () => {
  const lines = Object.fromEntries(TOUR_STEPS_ALL.map((s) => [s.title, s.body]));
  assert.deepEqual(lines, {
    Today: 'Your next step and the reason for it. Start here each day.',
    Practice: 'Pick a subject and a way to practise. Every set is timed and marked like CUET.',
    Start: 'Tap Start on any page to begin a session.',
    'Ask Mobi': 'Ask any CUET doubt, or ask what your papers say.',
    'Your Mob': 'You and up to four friends sit the same paper each week.',
    You: 'Progress, Colleges, Wallet and this guide are here.',
  });
});

test('the stops: one line each, 16 words at most, plain copy', () => {
  assert.equal(TOUR_LINE_WORDS, 16);
  for (const step of TOUR_STEPS_ALL) {
    const words = step.body.trim().split(/\s+/);
    assert.ok(words.length <= TOUR_LINE_WORDS, `${step.title}: ${words.length} words`);
    assert.doesNotMatch(step.body, /[!·•—–]/, `${step.title}: no exclamation mark, middle dot or dash`);
    assert.doesNotMatch(step.body, /\p{Extended_Pictographic}/u, `${step.title}: no emoji`);
    assert.doesNotMatch(step.body, /\b[A-Z]{2,}\b(?<!CUET)/, `${step.title}: no all-caps word but CUET`);
    assert.match(step.body, /^[A-Z].*\.$/, `${step.title}: a sentence`);
    assert.doesNotMatch(step.title, /[!·—]|\b[A-Z]{3,}\b/, `${step.title}: a plain name`);
    assert.equal(step.bodies, undefined, `${step.title}: one line, wherever the ring lands`);
    assert.doesNotMatch(step.body, /\n/);
  }
});

test('the stops: each line is true of the product', async () => {
  // Practice: every mode is timed.
  const { TEST_MODES } = await import('../test_modes.js');
  for (const mode of Object.values(TEST_MODES)) assert.ok(mode.durationPerQuestionSec > 0 || mode.fixedDurationSec > 0, `${mode.id} is timed`);
  // The Mob: five seats, so "you and up to four friends".
  const { MAX_MEMBERS } = await import('../../src/lib/mob/model.mjs');
  assert.equal(MAX_MEMBERS - 1, 4);
  // You: Progress, Colleges, Wallet and the Guide are rows of the sidebar's You group and of the You page.
  const nav = read('src/lib/arenaNavigation.js');
  assert.match(nav, /\{ id: 'you', label: 'You', place: true, items: \[place\(YOU\), sub\(PROGRESS\),[\s\S]{0,60}sub\(COLLEGES\), \{ \.\.\.sub\(WALLET\), ruleAbove: true \}, sub\(GUIDE\)\] \}/);
  assert.match(nav, /\{ id: 'progress', label: 'Your progress', items: \[PROGRESS,/);
  assert.match(nav, /\{ id: 'plan', label: 'Your plan', items: \[\{ \.\.\.COLLEGES, hint: null \}, WALLET\] \}/);
  assert.match(read('src/components/nav/YouPlaces.jsx'), /onClick=\{onTour\}/, 'and the You page offers the guide');
  // Start: the key is on every page with a dock or a sidebar, and it carries the tour's id in both.
  assert.match(read('src/components/start/StartKey.jsx'), /data-tour="nav-start"/);
});

test('the Guide page counts the stops that will run, by itself', () => {
  assert.equal(tourNote(tourSteps().length), 'Five stops, about a minute');
  assert.equal(tourNote(tourSteps({ mob: true }).length), 'Six stops, about a minute');
  assert.match(read('src/app/(app)/help/HelpPageClient.jsx'), /tourNote\(tourStops\)/);
});

// ---- starting by itself ----------------------------------------------------------------------------------------------------------

const HOLDS = Object.freeze({ onboarded: true, seen: false, path: '/today', open: false, sheetOpen: false });

test('auto-start: starts when every condition holds', () => {
  assert.equal(guideAutoStart(HOLDS), 'start');
  assert.equal(guideAutoStart({ ...HOLDS, path: '/dashboard' }), 'start', 'Practice is where the first run ends (firstRun.js DONE_PATH)');
  assert.equal(guideAutoStart({ ...HOLDS, path: '/today?from=onboarding' }), 'start');
  assert.deepEqual([...GUIDE_AUTO_PAGES], ['/today', '/dashboard']);
  assert.match(read('src/app/onboarding/firstRun.js'), /export const DONE_PATH = '\/dashboard';/);
  assert.equal(GUIDE_AUTO_DELAY_MS, 900);
  assert.equal(GUIDE_AUTO_WINDOW_MS, 24 * 3_600_000);
});

test('auto-start: each condition on its own stops it', () => {
  assert.equal(guideAutoStart({ ...HOLDS, onboarded: false }), 'no', 'a returning student, or a second device');
  assert.equal(guideAutoStart({ ...HOLDS, seen: true }), 'no', 'seen once is seen');
  assert.equal(guideAutoStart({ ...HOLDS, open: true }), 'no', 'already running');
  for (const path of ['/review', '/mob', '/profile', '/help', '/result/abc', '/', '']) assert.equal(guideAutoStart({ ...HOLDS, path }), 'no', `not on ${path || 'nowhere'}`);
  for (const path of ['/test', '/test/abc', '/onboarding', '/onboarding?step=days', '/mob/game/1', '/learn/run', '/explore/run']) assert.equal(guideAutoStart({ ...HOLDS, path }), 'no', `never on ${path}`);
  assert.equal(guideAutoStart({ ...HOLDS, sheetOpen: true }), 'wait', 'a dialog, a sheet or the Pro sheet is open: it waits');
  assert.equal(guideAutoStart({ ...HOLDS, sheetOpen: true, seen: true }), 'no');
  assert.equal(guideAutoStart(), 'no', 'nothing known, nothing starts');
});

test('auto-start: "finished onboarding on this device in the last 24 hours" is read from the record onboarding writes', () => {
  const t0 = Date.UTC(2026, 10, 10, 6, 0, 0);
  const record = noteOnboarded(emptyRecord(), { now: t0, session: 's1' });
  assert.equal(onboardedRecently(record, { now: t0 + 1000 }), true);
  assert.equal(onboardedRecently(record, { now: t0 + 23 * 3_600_000 }), true);
  assert.equal(onboardedRecently(record, { now: t0 + 24 * 3_600_000 }), true, 'the last moment of the day');
  assert.equal(onboardedRecently(record, { now: t0 + 24 * 3_600_000 + 1 }), false, 'a day later it is a returning student');
  assert.equal(onboardedRecently(record, { now: t0 - 1 }), false, 'a clock that went backwards starts nothing');
  assert.equal(onboardedRecently(emptyRecord(), { now: t0 }), false, 'a second device has no record');
  assert.equal(onboardedRecently(null, { now: t0 }), false);
  assert.equal(onboardedRecently({ v: 99, onboardedAt: t0 }, { now: t0 }), false, 'a record of another version is not read');
  assert.equal(onboardedRecently(record, {}), false);
  // It does not need the same browser session, and the Pro first-session sheet having shown does not end it.
  assert.equal(onboardedRecently(markFirstShown(record, t0 + 5000), { now: t0 + 6000 }), true);
  assert.equal(onboardedRecently(record, { now: t0 + 2 * 3_600_000, windowMs: 3_600_000 }), false, 'the window is the caller’s');
  assert.match(read('src/app/onboarding/OnboardingPageClient.jsx'), /if \(!edit && !preview\) noteOnboardedNow\(user\?\.id\);/, 'onboarding writes it when it is saved');
});

test('auto-start: the shell asks the rule, marks it seen as it starts, and stays clear of the Pro sheet', () => {
  const shell = code(read('src/app/(app)/AppLayoutClient.jsx'));
  assert.match(shell, /onboarded: onboardedRecently\(loadRecord\(user\.id\), \{ now: Date\.now\(\), windowMs: GUIDE_AUTO_WINDOW_MS \}\)/);
  assert.match(shell, /sheetOpen: upgradeState\(\)\.open \|\| Boolean\(document\.querySelector\('dialog\[open\], \[role="dialog"\], \[aria-modal="true"\]'\)\)/);
  assert.match(shell, /window\.setTimeout\(ask, GUIDE_AUTO_DELAY_MS\)/);
  // Seen is written before the guide opens: a second tab, or a reload, reads it and stays shut.
  assert.match(shell, /if \(verdict !== 'start'\) return;\s*try \{ window\.localStorage\.setItem\(tourSeenKey, 'true'\); \} catch \{ return; \}\s*setTourOpener\(null\);\s*setTourOpen\(true\);/);
  assert.match(shell, /if \(status !== 'authenticated' \|\| chromeless \|\| tourOpen \|\| !user\?\.id\) return undefined;/);
  // Closing by Skip, Escape or Done records it too.
  assert.match(shell, /function closeTour\(\) \{\s*setTourOpen\(false\);\s*try \{ window\.localStorage\.setItem\(tourSeenKey, 'true'\); \}/);
  // The guide is a modal dialog, and the Pro first-session sheet never opens over an open dialog.
  assert.match(read('src/components/pro/ProNudgeHost.jsx'), /const otherSheetOpen = Boolean\(document\.querySelector\('dialog\[open\]'\)\);/);
  assert.match(read('src/components/guide/AppGuide.jsx'), /<dialog\s+ref=\{dialog\}\s+className="gd"/);
  assert.match(read('src/components/guide/AppGuide.jsx'), /el\.showModal\(\)/);
});

test('auto-start: the preview can show it without an account (&guide=auto), and only the preview', () => {
  const preview = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /const guideAuto = params\.get\('guide'\) === 'auto';/);
  assert.match(preview, /saveRecord\('preview-user', \{ \.\.\.loadRecord\('preview-user'\), onboardedAt: Date\.now\(\) - 5 \* 60_000, session: browserSession\(\) \}\);/);
  assert.doesNotMatch(read('src/app/(app)/AppLayoutClient.jsx'), /guide=auto|get\('guide'\)/, 'the live shell reads no such parameter');
});

// ---- where the card stands -------------------------------------------------------------------------------------------------------

const SCREENS = [
  // The top bar's lower edge and the dock's upper edge, as drawn at each size (no dock from 1024 px).
  { name: '360 x 672', screen: { width: 360, height: 672 }, safe: { top: 56, bottom: 672 - 84 } },
  { name: '390 x 844', screen: { width: 390, height: 844 }, safe: { top: 56, bottom: 844 - 84 } },
  { name: '1440 x 900', screen: { width: 1440, height: 900 }, safe: { top: 56, bottom: 900 } },
];
const CARD_HEIGHTS = [150, 176, 200];
function targetsFor({ screen, safe }) {
  const phone = screen.width < 1024;
  const dockTop = safe.bottom + 6;
  return phone ? [
    { name: 'top: Ask Mobi in the top bar', box: { left: screen.width - 190, top: 4, width: 104, height: 48 } },
    { name: 'bottom left: Today in the dock', box: { left: 10, top: dockTop, width: 68, height: 68 } },
    { name: 'bottom middle: the Start key', box: { left: screen.width / 2 - 34, top: dockTop, width: 68, height: 68 } },
    { name: 'bottom right: You in the dock', box: { left: screen.width - 78, top: dockTop, width: 68, height: 68 } },
    { name: 'side: a row at the left edge, mid screen', box: { left: 0, top: 300, width: 60, height: 48 } },
    { name: 'side: a row at the right edge, mid screen', box: { left: screen.width - 60, top: 300, width: 60, height: 48 } },
  ] : [
    { name: 'top: the sidebar’s Start key', box: { left: 12, top: 78, width: 228, height: 56 } },
    { name: 'side: the sidebar’s Today row', box: { left: 12, top: 200, width: 228, height: 50 } },
    { name: 'bottom: the sidebar’s You group', box: { left: 12, top: 560, width: 228, height: 320 } },
    { name: 'top right: a key in the top bar', box: { left: 1180, top: 4, width: 120, height: 48 } },
    { name: 'bottom right: a key at the foot', box: { left: 1300, top: 820, width: 120, height: 60 } },
    { name: 'side: a row at the right edge', box: { left: 1380, top: 400, width: 60, height: 48 } },
  ];
}

test('the card: width is the screen less 32 px, 380 px at most', () => {
  assert.equal(guideCardWidth(360), 328);
  assert.equal(guideCardWidth(390), 358);
  assert.equal(guideCardWidth(412), 380);
  assert.equal(guideCardWidth(1440), GUIDE_CARD_MAX);
  assert.equal(GUIDE_CARD_MAX, 380);
  assert.equal(GUIDE_GAP, 14);
  assert.equal(GUIDE_EDGE, 16);
});

test('the card: never over the target, inside the screen, clear of the dock and the top bar, at every size', () => {
  let checked = 0;
  for (const size of SCREENS) {
    for (const height of CARD_HEIGHTS) {
      for (const target of targetsFor(size)) {
        const card = { width: guideCardWidth(size.screen.width), height };
        const at = placeGuideCard({ target: target.box, card, screen: size.screen, safe: size.safe });
        const box = { left: at.left, top: at.top, width: card.width, height: card.height };
        const where = `${size.name}, card ${height} px, ${target.name} (${at.side})`;
        assert.equal(at.fits, true, `${where}: a side has room`);
        assert.equal(boxesOverlap(box, target.box), false, `${where}: the card covers its target`);
        assert.ok(box.left >= GUIDE_EDGE && box.left + box.width <= size.screen.width - GUIDE_EDGE, `${where}: 16 px inside the screen, left and right`);
        assert.ok(box.top >= size.safe.top && box.top + box.height <= size.safe.bottom, `${where}: under the top bar or the dock`);
        assert.ok(box.top >= GUIDE_EDGE && box.top + box.height <= size.screen.height - GUIDE_EDGE, `${where}: 16 px inside the screen, top and bottom`);
        // 14 px from the target on the side it stands (more only where the bar or the dock pushes it clear).
        const gap = { above: target.box.top - (box.top + box.height), below: box.top - (target.box.top + target.box.height), right: box.left - (target.box.left + target.box.width), left: target.box.left - (box.left + box.width) }[at.side];
        assert.ok(gap >= GUIDE_GAP, `${where}: ${gap} px from the target`);
        assert.ok(gap <= GUIDE_GAP + 24, `${where}: ${gap} px is too far to point`);
        // The nub stands on the card's facing edge, over the target where the target is wide enough to be over.
        const vertical = at.side === 'above' || at.side === 'below';
        assert.ok(at.nub >= 22 && at.nub <= (vertical ? card.width : card.height) - 22, `${where}: the nub is on the card`);
        const point = vertical ? box.left + at.nub : box.top + at.nub;
        const lo = vertical ? target.box.left : target.box.top;
        const hi = lo + (vertical ? target.box.width : target.box.height);
        assert.ok(point >= lo - 22 && point <= hi + 22, `${where}: the nub points at the target`);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 3 * 3 * 6);
});

test('the card: it takes the side with more room', () => {
  const phone = SCREENS[1];
  const card = { width: guideCardWidth(390), height: 176 };
  const side = (box) => placeGuideCard({ target: box, card, screen: phone.screen, safe: phone.safe }).side;
  assert.equal(side({ left: 10, top: 766, width: 68, height: 68 }), 'above', 'a dock key: the card is above it');
  assert.equal(side({ left: 200, top: 4, width: 104, height: 48 }), 'below', 'a top bar key: the card is below it');
  assert.equal(side({ left: 20, top: 250, width: 300, height: 60 }), 'below', 'more room below');
  assert.equal(side({ left: 20, top: 520, width: 300, height: 60 }), 'above', 'more room above');
  const desk = SCREENS[2];
  const wide = { width: 380, height: 176 };
  assert.equal(placeGuideCard({ target: { left: 12, top: 200, width: 228, height: 50 }, card: wide, screen: desk.screen, safe: desk.safe }).side, 'right', 'a sidebar row: the card is beside it');
  assert.equal(placeGuideCard({ target: { left: 1380, top: 400, width: 60, height: 48 }, card: wide, screen: desk.screen, safe: desk.safe }).side, 'left');
});

test('the card: a target with no room on any side still gets a card inside the screen', () => {
  const size = SCREENS[0];
  const card = { width: guideCardWidth(360), height: 200 };
  const at = placeGuideCard({ target: { left: 0, top: 60, width: 360, height: 520 }, card, screen: size.screen, safe: size.safe });
  assert.equal(at.fits, false);
  assert.ok(at.left >= GUIDE_EDGE && at.left + card.width <= 360 - GUIDE_EDGE);
  assert.ok(at.top >= size.safe.top && at.top + card.height <= size.safe.bottom);
});

// ---- the component and its stylesheet --------------------------------------------------------------------------------------------

test('the guide is its own component: a labelled dialog, focus held and returned, Escape, arrows, Skip, Back, Next and Done', () => {
  const guide = read('src/components/guide/AppGuide.jsx');
  assert.match(guide, /aria-labelledby="gd-title"\s+aria-describedby="gd-line"/);
  assert.match(guide, /<h2 id="gd-title" className="gd-title">\{step\.title\}<\/h2>\s*<p id="gd-line" className="gd-line">\{step\.body\}<\/p>/);
  assert.match(guide, /aria-live="polite" aria-atomic="true"/, 'a screen reader hears each stop');
  assert.match(guide, /<p className="gd-count">\{index \+ 1\} of \{steps\.length\}<\/p>/, '"1 of 5", sentence case');
  assert.match(guide, /onCancel=\{\(event\) => \{ event\.preventDefault\(\); onClose\(\); \}\}/, 'Escape closes');
  assert.match(guide, /event\.key === 'ArrowRight'[\s\S]{0,80}go\(1\)/);
  assert.match(guide, /event\.key === 'ArrowLeft'[\s\S]{0,60}go\(-1\)/);
  assert.match(guide, /event\.key === 'Tab'/, 'Tab goes round the card’s keys');
  assert.match(guide, /className="gd-skip" hidden=\{index === last\} onClick=\{onClose\}>Skip<\/button>/);
  assert.match(guide, />Back<\/button>/);
  assert.match(guide, /className="btn-volt gd-next" onClick=\{onward\}>\{index === last \? 'Done' : 'Next'\}<\/button>/);
  assert.equal((code(guide).match(/btn-volt/g) || []).length, 1, 'one filled key');
  assert.match(guide, /opener && opener\.isConnected && onScreen\(opener\) \? opener/, 'focus returns to the key that opened it');
  assert.match(guide, /PipActor pose=/, 'Mobi is on the card');
  assert.match(guide, /addEventListener\('wheel', hold, \{ passive: false \}\)/, 'the page behind does not scroll');
  assert.match(guide, /addEventListener\('touchmove', hold, \{ passive: false \}\)/);
  assert.match(guide, /node\.scrollIntoView\(/, 'the target is brought into view first');
  assert.doesNotMatch(code(guide), /Step \{|mono-label|&times;|uppercase/, 'no "Step 1 of 9" label, no close cross');
  // No words in the guide but the stops' own and the five keys' names.
  const said = [...code(guide).matchAll(/>([A-Z][a-z]+(?: [a-z]+)*)</g)].map((m) => m[1]);
  assert.deepEqual(said.sort(), ['Back', 'Skip']);
});

test('the shell only holds open and closed', () => {
  const shell = code(read('src/app/(app)/AppLayoutClient.jsx'));
  assert.match(shell, /import AppGuide from '@\/components\/guide\/AppGuide';/);
  assert.match(shell, /\{!isTestRoute && tourOpen && <AppGuide steps=\{TOUR_STEPS\} opener=\{tourOpener\} onClose=\{closeTour\} \/>\}/);
  assert.doesNotMatch(shell, /tourStep\b|tourTarget|arena-tour-ring|bg-black\/62|TOUR_POSES|PipActor/, 'the four panels, the ring and the card left the shell');
  assert.match(shell, /window\.addEventListener\('mockmob:open-guide', openGuide\)/, 'the account page still opens it');
  assert.match(shell, /onTour: startTour/);
  assert.match(shell, /onClick=\{startTour\}/);
  assert.match(shell, /onTour=\{startTour\}/);
});

test('the stylesheet: tokens only, one spotlight, a 2 px ring, about 260 ms on an ease-out curve, reduced motion jumps', () => {
  const css = code(read('src/components/guide/app-guide.css'));
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, 'no literal colour');
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|background-clip: text|text-shadow|filter: drop-shadow|backdrop-filter/, 'no gradient, glow or blur');
  assert.doesNotMatch(css, /text-transform: uppercase|letter-spacing: 0\.[1-9]/, 'no all-caps label');
  assert.match(css, /\.gd-spot \{[^}]*border: 2px solid var\(--a-select\);[^}]*box-shadow: 0 0 0 200vmax var\(--gd-dim\);/);
  assert.match(css, /--gd-travel: 260ms;/);
  assert.match(css, /--gd-ease: cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
  assert.match(css, /\.gd\[data-settled\] \.gd-spot \{\s*transition: transform var\(--gd-travel\) var\(--gd-ease\), width var\(--gd-travel\) var\(--gd-ease\), height var\(--gd-travel\) var\(--gd-ease\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.gd-spot,[\s\S]*?\{ animation: none; transition: none; \}/);
  assert.match(css, /\.gd-card__in \{[^}]*background: var\(--a-raised\);[^}]*box-shadow: var\(--a-shadow-2\)/);
  assert.match(css, /\.gd-card \{[^}]*width: min\(380px, calc\(100vw - 32px\)\);/);
  // Every key is 44 px.
  assert.match(css, /\.gd-skip,\s*\.app-shell \.gd-back \{\s*min-height: 44px;\s*min-width: 44px;/);
  assert.match(css, /\.gd-next \{ min-height: 44px;/);
  // The only volt marks: the ring, the dot for this stop, and the key (btn-volt).
  assert.equal((css.match(/var\(--a-select\)/g) || []).length, 2);
  assert.doesNotMatch(css, /--a-volt|--a-accent-text/);
});
