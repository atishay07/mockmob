// Round 4, packet A1 + A2 (owner LK136, LK137, LK139, LK140; 5 Nov 2026, about 11:40 pm):
//   A1  Find answers a chapter search with chapters first and the Key cards as a separate, secondary section; "Show answers" is a
//       plain key, not the switch he called broken; Learn's sets are one quiet chip row; Accountancy's part choice sits right above
//       the units it changes ("The rest of Part 2 has two options"), after the chapters every student reads.
//   A2  a turned card can be swiped to rate it on the web: right Got it, left Missed it, down Easy, with the words shown while
//       dragging, the keys kept, reduced motion keys only.
//   node --test data/tests/learn_r4_1105.test.mjs (also in the round gate's *_1105 glob)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardPreview, resultCounts } from '../../src/components/learn2/cards/findModel.mjs';
import { SWIPE, SWIPE_RATINGS, SWIPE_WORDS, applyPose, clearSwipe, commitDistance, dragPose, lockAxis, onWords, poseTransform, pressStartsSwipe, releaseRating, swipeHint, swipeLeaveTo, swipePose } from '../../src/components/keycards/rateSwipe.mjs';
import { RATINGS } from '../../src/components/keycards/kinds.js';
import { leaveCard, swipeLeaveKeyframes } from '../../src/components/keycards/studyMotion.js';
import { optionAtTail, optionLine, chosenOptionLine } from '../../src/components/learn2/home/homeModel.mjs';
import { searchSubject } from '../../data/learn/search.js';
import { SUBJECT_OPTIONS, unitsFor } from '../../data/cuet_syllabus.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ------------------------------------------------------------------------------------------------ A1 Find

test('A1 a chapter search lists the chapter itself, even when its cards match too', () => {
  const chapters = [
    { key: 'accountancy.goodwill-valuation', title: 'Goodwill: Nature and Valuation', cards: 48 },
    { key: 'accountancy.admission-of-partner', title: 'Admission of a Partner', cards: 60 },
  ];
  const cards = [
    { id: 'g1', chapterKey: 'accountancy.goodwill-valuation', kind: 'definition', front: 'What is goodwill?', quote: 'goodwill is...', order: 1 },
    { id: 'a1', chapterKey: 'accountancy.admission-of-partner', kind: 'key_line', front: 'Goodwill brought in by a new partner', quote: '', order: 1 },
  ];
  const body = searchSubject({ query: 'goodwill', chapters, cards });
  assert.deepEqual(body.chapters.map((c) => c.key), ['accountancy.goodwill-valuation']);
  // The page no longer drops a chapter row because its cards also matched (the old inGroups filter).
  const view = code('src/components/learn2/cards/FindView.jsx');
  assert.doesNotMatch(view, /inGroups/);
  assert.match(view, /<LinkRows label="Chapters"[^>]*rows=\{chapterRows\}/);
  // Chapters, then lessons, then the cards' own section, in that order on the page.
  const at = (s) => view.indexOf(s);
  assert.ok(at('<LinkRows label="Chapters"') < at('<LinkRows label="Lessons"'));
  assert.ok(at('<LinkRows label="Lessons"') < at('className="l2f-cards"'));
});

test('A1 the cards are secondary while a chapter or lesson matched: three, then "Show all"; all of them when only cards matched', () => {
  const sections = [
    { key: 'a', title: 'A', cards: [{ id: 1 }, { id: 2 }] },
    { key: 'b', title: 'B', cards: [{ id: 3 }, { id: 4 }, { id: 5 }] },
  ];
  const three = cardPreview(sections, 3);
  assert.equal(three.cut, true);
  assert.deepEqual(three.sections.map((s) => s.cards.map((c) => c.id)), [[1, 2], [3]]);
  assert.deepEqual(cardPreview(sections, Infinity), { sections, cut: false });
  assert.equal(cardPreview(sections, 5).cut, false, 'nothing is cut when all fit');
  const view = code('src/components/learn2/cards/FindView.jsx');
  assert.match(view, /const secondary = chapterRows\.length \+ lessonRows\.length > 0;/);
  assert.match(view, /cardPreview\(sections, secondary && !allCards \? PREVIEW : Infinity\)/);
  assert.match(view, /`Show all \$\{countWord\(nCards, 'card'\)\}`/);
  // The volt Study key belongs to the cards only when they are the whole answer.
  assert.match(view, /panel\.showPickBar \|\| secondary \? 'kc-btn kc-btn--line kc-btn--small' : 'kc-btn kc-btn--volt kc-btn--small'/);
});

test('A1 the head line counts what was found; Free\'s locked matches are said once, as one number', () => {
  const body = { chapters: [{ key: 'c' }], lessons: [], cards: [{ card: { id: 1 } }, { card: { id: 2 } }, { locked: true, card: { id: 3, locked: true } }], more: 31 };
  const c = resultCounts(body, 2);
  assert.equal(c.line, '1 chapter, 2 cards');
  assert.equal(c.locked, 32, 'every match past the limit is locked when any is (open cards sort first)');
  assert.equal(c.moreOpen, 0);
  const pro = resultCounts({ chapters: [], lessons: [{ id: 'l' }], cards: [{ card: { id: 1 } }], more: 12 }, 1);
  assert.equal(pro.line, '1 lesson, 1 card');
  assert.equal(pro.locked, 0);
  assert.equal(pro.moreOpen, 12);
  assert.equal(resultCounts(null, 0).line, '');
});

test('A1 "Show answers" is a key that says what it does (the switch he called broken is gone from Learn\'s card lists)', () => {
  const key = code('src/components/learn2/cards/AnswersKey.jsx');
  assert.match(key, /\{on \? 'Hide answers' : 'Show answers'\}/);
  assert.match(key, /aria-controls=\{controls\}/);
  assert.doesNotMatch(key, /aria-pressed|role="switch"/, 'the label says the action, so no pressed state is announced over it');
  assert.match(key, /aria-expanded=\{Boolean\(on\)\}/, 'R8 LEARN-14: the state reaches assistive tech as the list it opens');
  for (const file of ['src/components/learn2/cards/FindView.jsx', 'src/components/learn2/cards/CardsView.jsx']) {
    const view = code(file);
    assert.doesNotMatch(view, /ui\/Switch|<Switch /, file);
    assert.match(view, /<AnswersKey on=\{showAnswers\} onChange=\{/, file);
  }
  const css = code('src/components/learn2/cards/cards.css');
  assert.doesNotMatch(css, /\.l2c \.mk-switch/, 'no more ink-on-ink switch overrides');
  assert.match(css, /\.l2c-answers \{[^}]*min-height: 44px/);
  // R8 LEARN-05: on is the rimmed pick (tint + 1.5px line), as a chosen chip and the chapter page's "10 min"; never an ink slab.
  assert.match(css, /\.l2c-answers\[data-on\] \{ background: var\(--ctl-seg-pick-bg\);[^}]*inset 0 0 0 1\.5px var\(--ctl-seg-pick-line\)/);
  assert.match(css, /\.l2c-chips__ind \{[^}]*background: var\(--ctl-seg-pick-bg\)/);
});

test('A1 Learn\'s sets are one row of chips (name and count), the full words kept in the spoken name', () => {
  const sets = code('src/components/learn2/home/CardSets.jsx');
  assert.match(sets, /value: k\.count/);
  assert.match(sets, /about \$\{shelves\.due\.minutes\} min\. Show them/);
  const css = code('src/components/learn2/home/learn-home.css');
  assert.match(css, /\.lh-sets \{[^}]*display: flex;[^}]*overflow-x: auto/);
  assert.match(css, /\.lh-set \{[^}]*min-height: 44px;[^}]*border-radius: 999px/);
});

// ------------------------------------------------------------------------------------------------ A1 Accountancy

test('A1 Accountancy cross-check: Part 1 and Company Accounts are common; only Unit V is AFS or CAS; three NCERT books', () => {
  assert.deepEqual(SUBJECT_OPTIONS.accountancy.choices.map((c) => c.id), ['AFS', 'CAS']);
  const units = unitsFor('accountancy', {});
  const common = units.filter((u) => !u.chapters.some((c) => c.section));
  const optional = units.filter((u) => u.chapters.some((c) => c.section));
  assert.deepEqual(common.map((u) => u.unit), ['Accounting for Partnership', 'Reconstitution of a Partnership firm', 'Dissolution of Partnership Firm', 'Company Accounts: Accounting for Share and Debenture Capital']);
  assert.deepEqual(optional.map((u) => [u.unit, [...new Set(u.chapters.map((c) => c.section))]]), [['Analysis of Financial Statements', ['AFS']], ['Computerised Accounting System', ['CAS']]]);
  const books = new Set(units.flatMap((u) => u.chapters.map((c) => c.ncert?.book)).filter(Boolean));
  assert.deepEqual([...books].sort(), ['Accountancy Part 1', 'Accountancy Part 2', 'Computerised Accounting System']);
  // The choice changes only AFS's chapters for CAS's: every Part 1 chapter and Share Capital and Debentures are both students'.
  const afs = unitsFor('accountancy', { option: 'AFS' }).flatMap((u) => u.chapters.map((c) => c.name));
  const cas = unitsFor('accountancy', { option: 'CAS' }).flatMap((u) => u.chapters.map((c) => c.name));
  const both = afs.filter((n) => cas.includes(n));
  assert.ok(both.includes('Share Capital') && both.includes('Debentures') && both.includes('Partnership Fundamentals'));
  assert.ok(!cas.includes('Cash Flow Statement') && !afs.includes('Computerized Accounting System'));
});

test('A1 the part choice sits right above the units it changes, and says "The rest of Part 2" (owner decision LK139)', () => {
  const unit = (optionId, title = optionId || 'common') => ({ optionId, title, chapters: [{ key: title }] });
  const choices = [{ id: 'AFS', label: 'Analysis of Financial Statements' }, { id: 'CAS', label: 'Computerised Accounting' }];
  const part2 = { title: 'Part 2, Company Accounts and Analysis of Financial Statements', option: { choices }, units: [unit(null, 'Company Accounts'), unit('AFS'), unit('CAS')] };
  assert.equal(optionAtTail(part2), true);
  assert.equal(optionLine(part2, 1), 'The rest of Part 2 has two options. Pick the one your school teaches.');
  assert.equal(chosenOptionLine(part2, 'AFS', 1), 'The rest of Part 2 has two options. Yours is Analysis of Financial Statements.');
  // A part made only of option units (or with a common unit after them) keeps the part's own line under its heading.
  assert.equal(optionAtTail({ ...part2, units: [unit('AFS'), unit('CAS')] }), false);
  assert.equal(optionAtTail({ ...part2, units: [unit('AFS'), unit(null, 'after')] }), false);
  assert.equal(optionLine({ ...part2, units: [unit('AFS'), unit('CAS')] }, 1), 'Part 2 has two options. Pick the one your school teaches.');
  const map = code('src/components/learn2/home/ChapterMap.jsx');
  assert.match(map, /if \(atTail\) out\.push\(partSwitch\);/);
  assert.match(map, /\{atTail \? null : partSwitch\}/);
  assert.match(code('src/components/learn2/home/learn-home.css'), /\.lh-opt__btn \{[^}]*min-height: 44px/);
});

// ------------------------------------------------------------------------------------------------ A2 swipe to rate

test('A2 the three ways rate as he asked: right Got it, left Missed it, down Easy (the keys\' own ratings)', () => {
  const byRating = Object.fromEntries(RATINGS.map((r) => [r.rating, r.label]));
  assert.equal(byRating[SWIPE_RATINGS.right], 'Got it');
  assert.equal(SWIPE_RATINGS.left, 1);
  assert.equal(byRating[SWIPE_RATINGS.down], 'Easy');
  assert.deepEqual(SWIPE_WORDS, { right: 'Got it', left: 'Missed it', down: 'Easy' });
});

test('A2 the axis locks after the slop; up (or down when not offered) is left to the page', () => {
  assert.equal(lockAxis(4, 3), null, 'inside the slop');
  assert.equal(lockAxis(12, 4), 'x');
  assert.equal(lockAxis(-12, 4), 'x');
  assert.equal(lockAxis(3, 14), 'y');
  assert.equal(lockAxis(3, -14), 'page', 'an upward drag scrolls');
  assert.equal(lockAxis(3, 14, { down: false }), 'page', 'a touch on a card that does not fit keeps its scroll');
  assert.equal(lockAxis(7, 0, { slop: SWIPE.slopMouse }), 'x', 'a mouse claims sooner');
});

test('A2 the pose follows the finger, leans, and says how far: commit at 30% of the width (72 to 120 px) or 96 px down', () => {
  assert.equal(commitDistance('x', 360), 108);
  assert.equal(commitDistance('x', 200), 72);
  assert.equal(commitDistance('x', 640), 120);
  assert.equal(commitDistance('y', 360), 96);
  const half = dragPose('x', 54, 10, 360);
  assert.equal(half.intent, 'right');
  assert.equal(half.progress, 0.5);
  assert.equal(half.ready, false);
  assert.equal(half.y, 2.5, 'the other axis moves a quarter');
  assert.ok(half.r > 0 && half.r <= SWIPE.leanMax);
  const far = dragPose('x', -400, 0, 360);
  assert.equal(far.intent, 'left');
  assert.equal(far.ready, true);
  assert.equal(far.r, -SWIPE.leanMax);
  const down = dragPose('y', 6, 100, 360);
  assert.equal(down.intent, 'down');
  assert.equal(down.ready, true);
  assert.equal(down.r, 0);
  assert.equal(dragPose('y', 0, -40, 360).intent, null, 'up is not Easy');
  assert.equal(poseTransform({ x: 10, y: 2, r: 1 }), 'translate3d(10px, 2px, 0) rotate(1deg)');
});

test('A2 a release rates only past the line or on a fling its way; a fling back springs home', () => {
  assert.equal(releaseRating('x', 120, 0, 0, 360), 3);
  assert.equal(releaseRating('x', -120, 0, 0, 360), 1);
  assert.equal(releaseRating('x', 60, 0, 0, 360), null, 'short and slow');
  assert.equal(releaseRating('x', 40, 0, 900, 360), 3, 'a quick flick right');
  assert.equal(releaseRating('x', 20, 0, 900, 360), null, 'too short even for a flick');
  assert.equal(releaseRating('x', 130, 0, -900, 360), null, 'flung back');
  assert.equal(releaseRating('y', 0, 100, 0, 360), 4);
  assert.equal(releaseRating('y', 0, 50, 800, 360), 4);
  assert.equal(releaseRating('y', 0, 120, -900, 360), null);
  assert.equal(releaseRating('y', 0, -120, 0, 360), null);
  assert.equal(releaseRating('page', 300, 0, 0, 360), null);
});

test('A2 a swiped card leaves the way it was going, from where it was let go', () => {
  const right = swipeLeaveTo({ x: 120, y: 4, r: 7, intent: 'right' }, 360);
  assert.ok(right.x > 400);
  const left = swipeLeaveTo({ x: -120, y: 4, r: -7, intent: 'left' }, 360);
  assert.ok(left.x < -400);
  const down = swipeLeaveTo({ x: 4, y: 100, r: 0, intent: 'down' }, 360);
  assert.ok(down.y > 400 && Math.abs(down.x) < 10);
  const frames = swipeLeaveKeyframes({ x: 120, y: 4, r: 7, intent: 'right' }, 360);
  assert.equal(frames[0].transform, 'translate3d(120px, 4px, 0) rotate(7deg)');
  assert.equal(frames.at(-1).opacity, 0);
  // The flight reads the pose a committed card carries, and only a committed one.
  const el = { dataset: { swipe: 'commit', swipePose: JSON.stringify({ x: 1, y: 2, r: 0, intent: 'down' }) }, style: { translate: '', rotate: '', removeProperty() {} } };
  assert.deepEqual(swipePose(el), { x: 1, y: 2, r: 0, intent: 'down' });
  assert.equal(swipePose({ dataset: { swipe: 'drag' } }), null);
  applyPose(el, { x: 12, y: -3, r: 4 });
  assert.deepEqual([el.style.translate, el.style.rotate], ['12px -3px', '4deg'], 'translate and rotate, never transform (the entrance animation fills transform)');
  clearSwipe(el);
  assert.deepEqual([el.style.translate, el.style.rotate], ['', '']);
  assert.equal(el.dataset.swipe, undefined);
  assert.equal(typeof leaveCard, 'function');
});

test('A2 the hint says the ways that work here', () => {
  assert.equal(swipeHint({ down: true }), 'Drag the card: right for Got it, left for Missed it, down for Easy.');
  assert.equal(swipeHint({ down: false, touch: true }), 'Swipe the card: right for Got it, left for Missed it.');
});

test('A2 wired in the Learn run and Key cards Study; keys kept; reduced motion turns the gesture off', () => {
  const hook = code('src/components/keycards/useRateSwipe.js');
  assert.match(hook, /setLive\(!isMotionReduced\(\)\)/, 'reduced motion: no gesture, the keys rate');
  assert.match(hook, /el\.addEventListener\('pointerdown', down\)/);
  assert.match(hook, /if \(e\.target\?\.closest\?\.\(INTERACTIVE\)\) return;/, 'a press on a key or the menu is never a drag');
  const run = code('src/components/learn2/run/RunPlayer.jsx');
  assert.match(run, /const canDrag = phase === 'play' && item\?\.type === 'card' && isTurned && !look && !isRecap;/);
  assert.match(run, /useRateSwipe\(\{ enabled: canDrag && !busy && !leaving && !reporting && !sheet, onRate: rate \}\)/);
  assert.match(run, /const r = RATINGS\.find\(\(x\) => x\.key === e\.key\);/, 'the 1 2 3 keys stay');
  assert.match(run, /data-lit=\{drag\.intent && SWIPE_RATINGS\[drag\.intent\] === r\.rating/);
  assert.match(code('src/components/learn2/run/RunParts.jsx'), /\{swipe \? <SwipeLabels \/> : null\}/);
  // The one-time hint: the ratings' own line has the first rateable card, the drag line the next one (both in a first run).
  assert.match(run, /useCoach\(coachKey, 'swipe1', canDrag && drag\.live && \(!coachRate \|\| ratedNow > 0\)\)/);
  const card = code('src/components/keycards/KeyCard.jsx');
  assert.match(card, /useRateSwipe\(\{ enabled: swipeOn && revealed && !busy && !reporting/);
  assert.match(card, /\{swipeOn \? <SwipeLabels \/> : null\}/);
  assert.match(code('src/components/keycards/ChapterDeck.jsx'), /<KeyCardPlayer key=[\s\S]*?feel swipe arrive=/);
  const css = code('src/components/keycards/keycards.css');
  assert.match(css, /\[data-swipeable\] \{ touch-action: pan-y; \}/);
  assert.match(css, /\[data-swipeable\]\[data-swipe-on\]\[data-swipe-down\] \{ touch-action: none; \}/);
  assert.doesNotMatch(hook, /style\.transform =/, 'the live card moves by translate and rotate only');
});

test('A2 on a real touch: the scroll box inside the run\'s card follows the card, and a child\'s lost capture never ends the drag', () => {
  // Found in real Chrome (CDP touch, 390 px): the run's card face scrolls (overflow-y: auto), so the browser read touch-action only up
  // to the face and panned, cancelling the drag; and moving the touch's capture from the word it landed on to the card fired a
  // lostpointercapture on that word, which bubbled to the card and sprang it home.
  const css = code('src/components/keycards/keycards.css');
  assert.match(css, /\[data-swipeable\]\[data-swipe-on\] \* \{ touch-action: inherit; \}/);
  const hook = code('src/components/keycards/useRateSwipe.js');
  assert.match(hook, /const lost = \(e\) => \{ if \(e\.target === el\) cancel\(e\); \};/);
  assert.match(hook, /el\.addEventListener\('lostpointercapture', lost\);/);
  // Down is offered to a touch only while the whole card is in view and nothing inside it scrolls (the inner walk is cached: see the
  // review test below).
  assert.match(hook, /const ok = wholeInView\(el\) && !inner;/);
  // The swiped card is never cut at the stage column's edge, and the status line steps aside while it moves.
  const run = code('src/components/learn2/run/run.css');
  assert.doesNotMatch(run, /\.lr-area:has\([^\n]*data-swipe[^\n]*overflow: visible/);
  assert.match(run, /\.lr:has\(\.lr-card\[data-swipe='drag'\], \.lr-card\[data-swipe='commit'\]\) \.lr-bar \.lr-status \{ opacity: 0; \}/);
});

// ------------------------------------------------------------------------------------------------ the review (6 Nov)

test('A2 review: a mouse drag that starts on the answer selects it and never rates; the head and margins still grab', () => {
  // The run's turned card at 1280 px, as the browser lays it out: the head row, the asked line, the NCERT paragraph (3 lines).
  const head = { left: 380, right: 1020, top: 160, bottom: 188 };
  const ask = { left: 380, right: 1020, top: 210, bottom: 262 };
  const ncert = { left: 380, right: 1020, top: 290, bottom: 380 };
  const words = [ask, ncert]; // the head is not words (wordRects skips .kc-head): it is where a mouse grabs the card
  const mouseAt = (x, y) => pressStartsSwipe({ pointer: 'mouse', button: 0, words: onWords(x, y, words) });
  assert.equal(mouseAt(600, 330), false, 'a press on the NCERT paragraph is a selection, not a swipe');
  assert.equal(mouseAt(600, 268), false, 'between two blocks, within the reach: still the words');
  assert.equal(mouseAt(372, 300), false, 'just before the first letter (a selection begun in the margin): the words');
  assert.equal(mouseAt(600, 174), true, 'the head grabs the card');
  assert.equal(mouseAt(350, 300), true, 'the margin, past the reach, grabs the card');
  assert.equal(mouseAt(600, 460), true, 'the empty space under a short answer grabs the card');
  assert.equal(pressStartsSwipe({ pointer: 'pen', words: true }), false, 'a pen selects like a mouse');
  assert.equal(pressStartsSwipe({ pointer: 'touch', words: true }), true, 'a touch never selects by dragging: it swipes from the words');
  assert.equal(pressStartsSwipe({ pointer: 'mouse', button: 2 }), false, 'a right-click is the menu');
  assert.equal(pressStartsSwipe({ pointer: 'touch', onKey: true }), false);
  assert.equal(onWords(600, 330, [{ left: 0, right: 0, top: 0, bottom: 0 }]), false, 'a block with no box (hidden) is no words');
  assert.equal(SWIPE.wordReach, 12);
  // Wired: the hook asks before a mouse press becomes a gesture, and the cursor says which part does what.
  const hook = code('src/components/keycards/useRateSwipe.js');
  assert.match(hook, /const words = e\.pointerType !== 'touch' && onWords\(e\.clientX, e\.clientY, wordRects\(el\)\);\s*if \(!pressStartsSwipe\(\{ pointer: e\.pointerType, button: e\.button, words \}\)\) return;/);
  assert.match(hook, /const NOT_WORDS = '\.kc-head, \.kc-swipe, \[inert\], \[aria-hidden="true"\]';/, 'the head, the pills and the turned-away face are not words');
  assert.match(hook, /\.kc-ncert'/, 'the NCERT text is words');
  const css = code('src/components/keycards/keycards.css');
  assert.match(css, /\[data-swipeable\]\[data-swipe-on\]\[data-swipe-words\]:not\(\[data-swipe\]\) \{ cursor: text; \}/);
});

test('A2 review: a scroll frame measures only the card\'s box; the walk for inner scroll boxes runs on resize and the late check', () => {
  const hook = code('src/components/keycards/useRateSwipe.js');
  const watch = hook.slice(hook.indexOf('function watchDown'), hook.indexOf('function bindSwipe'));
  assert.match(watch, /const soon = \(\) => \{ if \(!raf\) raf = requestAnimationFrame\(apply\); \};/, 'scroll: apply (one rect), not check');
  assert.match(watch, /document\.addEventListener\('scroll', soon, \{ capture: true, passive: true \}\);/);
  assert.match(watch, /const check = \(\) => \{ inner = scrollsInside\(el\); apply\(\); \};/);
  assert.match(watch, /new ResizeObserver\(resized\)/, 'the answer opening resizes the card: the walk runs again');
  assert.match(watch, /window\.setTimeout\(check, 400\)/);
  assert.doesNotMatch(watch.slice(watch.indexOf('const apply'), watch.indexOf('const check')), /scrollsInside/);
});

test('A1 review: the sets row fades its right edge only while its last chip is cut by it', () => {
  const css = code('src/components/learn2/home/learn-home.css');
  assert.doesNotMatch(css.match(/\.lh-sets \{[^}]*\}/)[0], /mask-image/, 'no fade on a row that fits');
  assert.match(css, /\.lh-sets\[data-more\] \{ -webkit-mask-image: linear-gradient/);
  const sets = code('src/components/learn2/home/CardSets.jsx');
  assert.match(sets, /const more = Boolean\(last\) && last\.getBoundingClientRect\(\)\.right > row\.getBoundingClientRect\(\)\.right \+ 0\.5;/,
    'the last chip cut by the edge, not the end padding (at 540 px the chips fit while the padding still scrolls 13 px)');
  assert.match(sets, /row\.addEventListener\('scroll', check, \{ passive: true \}\);/, 'scrolled to its end, the last chip is not faded');
});
