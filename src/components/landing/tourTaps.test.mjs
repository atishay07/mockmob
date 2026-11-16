// node --test src/components/landing/tourTaps.test.mjs
// 16 Nov 2026 (owner, on www.mockmob.in on his phone): after the Practice tool the held tour was "doing weird movements";
// "It needs to be interactive"; "Don't use obviously AI slop elements like ... flashing, pulsing dots". So: the tour holds
// only for a mouse or a trackpad (a finger gets a plain stack), every screen answers a tap, and nothing pulses or fakes a tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BENCH_LEVELS, BENCH_RUN, LEARN_LINES, LEARN_RIGHT, START_REPLY, TOUR_HOLD, askView, benchView, learnView, letter, mobView, practiceView, whyReply } from './tourTaps.mjs';
import { FLOW_QUERY } from './storyGesture.mjs';
import { labStory } from './labStory.mjs';
import { DRILL, publicSample } from './sampleFive.mjs';
import { scheduleReview } from '../../../data/study_scheduler.mjs';
import { whenDue } from '../study/studyCopy.js';
import { tourTouchSub } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

// ---------------------------------------------------------------- the hold query
// A tiny evaluator for the two media features these queries use, over every combination a device can report.
function matches(query, { hover, pointer }) {
  return query.split(',').some((part) => [...part.matchAll(/\((hover|pointer):\s*(\w+)\)/g)].every(([, feature, value]) => (feature === 'hover' ? hover : pointer) === value));
}
const DEVICES = ['hover', 'none'].flatMap((hover) => ['fine', 'coarse', 'none'].map((pointer) => ({ hover, pointer })));

test('the tour holds only for a mouse or a trackpad; every touch-first device gets the stack', () => {
  assert.equal(TOUR_HOLD, '(hover: hover) and (pointer: fine)');
  for (const device of DEVICES) {
    const held = matches(TOUR_HOLD, device);
    assert.equal(held, device.hover === 'hover' && device.pointer === 'fine', JSON.stringify(device));
    if (matches(FLOW_QUERY, device)) assert.equal(held, false, `a touch-first device is never held: ${JSON.stringify(device)}`);
  }
  const tour = code(read('./FeatureTour.jsx'));
  assert.match(tour, /<ScrollStory [^>]*hold=\{TOUR_HOLD\}/);
  assert.match(tour, /return props\.pinned \? <HeldTour \{\.\.\.props\} \/> : <TourStack \{\.\.\.props\} \/>;/, 'unheld, the tools stack');
  // The old timed carousel is gone: no autoplay clock, no progress timer, no Pause key, no sideways track to swipe.
  assert.doesNotMatch(tour, /TOUR_ADVANCE_MS|createDemoPlayback|setPlaying|keyboardHold|readSwipe|Pause|scrollTo\(\{ left: slide\.offsetLeft/);
  // The stack: one IntersectionObserver for every screen, a screen plays once at half on screen and only while on screen.
  const stack = tour.slice(tour.indexOf('function TourStack('), tour.indexOf('function TourStage('));
  assert.equal((stack.match(/new IntersectionObserver\(/g) || []).length, 1);
  assert.match(stack, /threshold: \[0, 0\.5\]/);
  assert.match(stack, /entry\.intersectionRatio >= 0\.5/);
  assert.match(stack, /const play = !watching \|\| Boolean\(view\[i\]\?\.seen && view\[i\]\?\.on\);/);
  assert.doesNotMatch(stack, /ft__list|ft__controls|ft__next|setTimeout|setInterval/, 'no chip row, no Up next, no timer');
  // The touch sub names the tools actually shown.
  assert.equal(tourTouchSub(5), 'Five tools. Tap any screen to try it.');
  assert.equal(tourTouchSub(3), 'Three tools. Tap any screen to try it.');
  // The band under the site bar and the bottom bar stay quiet for a story that is not held.
  assert.match(read('./SectionPosition.jsx'), /if \(story && story\.dataset\.pinned !== 'true'\) return null;/);
  assert.match(read('./SectionPosition.jsx'), /root\.dataset\.pinned === 'true' && root\.dataset\.live === 'true'/);
  assert.match(read('./ScrollStory.jsx'), /setLive\(false\);\n {4}\};\n {2}\}, \[pinned, steps, applyStep, id\]\);/, 'a story let go is never left live');
});

// ---------------------------------------------------------------- Practice
test('Practice: a tap picks, another moves the pick, and it never says right or wrong', () => {
  assert.deepEqual(practiceView({ step: 0 }), { picked: null, saved: false, answered: 21, said: '' });
  assert.deepEqual(practiceView({ step: 5 }), { picked: 0, saved: false, answered: 21, said: '' }, 'the demo picks A');
  assert.deepEqual(practiceView({ step: 6 }), { picked: 0, saved: true, answered: 22, said: '' }, 'then saves');
  assert.deepEqual(practiceView({ step: 0, mine: 1 }), { picked: 1, saved: true, answered: 22, said: 'Picked B. 22 of 50 answered. Saved.' });
  assert.equal(practiceView({ step: 6, mine: 3 }).picked, 3);
  for (const mine of [0, 1, 2, 3]) assert.doesNotMatch(practiceView({ step: 6, mine }).said, /right|wrong|correct/i, 'a mock never tells you mid-paper');
});

// ---------------------------------------------------------------- Learn
test('Learn: B is right; a miss is marked, B is shown as the meaning, and the line says what the app does with a missed card', () => {
  assert.equal(LEARN_RIGHT, 1);
  const right = learnView({ step: 0, mine: 1 });
  assert.equal(right.verdict, 'right');
  assert.equal(right.lead, 'Correct');
  assert.equal(right.next, 'Comes back in a few days');
  assert.equal(right.said, 'Correct. Comes back in a few days.');
  assert.deepEqual([0, 1, 2].map(right.state), [null, 'picked', null]);
  const miss = learnView({ step: 6, mine: 0 });
  assert.equal(miss.verdict, 'miss');
  assert.equal(miss.lead, 'The meaning here is B.');
  assert.equal(miss.next, LEARN_LINES.missNext);
  assert.deepEqual([0, 1, 2].map(miss.state), ['miss', 'answer', null], 'the miss is marked and B is shown');
  assert.equal(miss.said, 'The meaning here is B. Comes back in under an hour.');
  // The demo: B picked at step 4, Correct at 5, when it comes back at 6.
  assert.equal(learnView({ step: 3 }).picked, null);
  assert.equal(learnView({ step: 4 }).verdict, null);
  assert.equal(learnView({ step: 5 }).lead, 'Correct');
  assert.equal(learnView({ step: 5 }).next, '');
  assert.equal(learnView({ step: 6 }).next, 'Comes back in a few days');
});

test('Learn: the timing lines are what the study engine and its scheduler really do', () => {
  // A wrong recall answer is rated 1 by the engine (data/study_engine.js), a right unassisted one 3.
  const engine = read('../../../data/study_engine.js');
  assert.match(engine, /if \(run\.mode === 'recall'\) rating = !correct \? 1 : event\.assisted === true \? 2 : 3;/);
  const t0 = Date.parse('2026-11-01T10:00:00Z');
  const dueIn = (s, at) => Date.parse(s.schedule.due) - at;
  // A missed card, new or already graduated, is due again in minutes: the app's own words for that are "in under an hour".
  const missNew = scheduleReview(null, 1, t0);
  assert.ok(dueIn(missNew, t0) <= 60 * 60 * 1000);
  assert.equal(whenDue(missNew.schedule.due, t0), 'in under an hour');
  let card = scheduleReview(null, 3, t0); let at = Date.parse(card.schedule.due);
  card = scheduleReview(card.schedule, 3, at); at = Date.parse(card.schedule.due);
  const missLater = scheduleReview(card.schedule, 1, at);
  assert.equal(whenDue(missLater.schedule.due, at), 'in under an hour');
  assert.equal(LEARN_LINES.missNext, 'Comes back in under an hour');
  // A card on its first review after it graduates, answered right, comes back in a few days (2 at 0.9 retention).
  let fresh = scheduleReview(null, 3, t0); let freshAt = Date.parse(fresh.schedule.due);
  fresh = scheduleReview(fresh.schedule, 3, freshAt);
  const days = dueIn(fresh, freshAt) / 86400000;
  assert.ok(days >= 2 && days <= 6, `${days} days`);
});

// ---------------------------------------------------------------- Ask Mobi
test('Ask Mobi: "Why this?" is the sample record\'s own numbers; "Start the 10" says the set is ready; the badge says sample', () => {
  const story = labStory();
  const lost = story.swot.partnershipLost;
  assert.deepEqual(lost, [12, 12, 18], 'the record the Lab tells: Partnership in each of the last three mocks');
  assert.equal(story.chapters[0].chapter, 'Partnership', 'and the chapter that cost the most in the latest');
  assert.equal(whyReply(story), 'Partnership cost you marks in each of your last three mocks: 12, 12, then 18. It cost the most in your latest, so tonight starts there.');
  for (const n of lost) assert.ok(whyReply(story).includes(String(n)));
  assert.equal(START_REPLY, '10 Partnership questions are set. They open in Practice.');
  assert.deepEqual(askView({ mine: null, story }), { reply: '', said: '' });
  assert.equal(askView({ mine: 'why', story }).said, whyReply(story));
  assert.equal(askView({ mine: 'start', story }).reply, START_REPLY);
  const screens = read('./TourScreens.jsx');
  assert.match(screens, /right=\{<span className="ts__badge">Sample record<\/span>\}/);
  assert.match(screens, /const PREP_ANSWERS = \[\['why', whyReply\(STORY\)\], \['start', START_REPLY\]\];/, 'never typed twice');
});

// ---------------------------------------------------------------- Benchmarks
test('Benchmarks: a tapped level becomes the target; the bar, the points short, the top line and the tag follow', () => {
  assert.equal(BENCH_RUN, 72);
  assert.deepEqual(BENCH_LEVELS.map((l) => [l.name, l.pct]), [['DU level', 88], ['College level', 82], ['Daily', 78]]);
  assert.deepEqual(BENCH_LEVELS.map((l) => benchView({ mine: l.id }).short), [16, 10, 6]);
  const daily = benchView();
  assert.equal(daily.target, 'daily');
  assert.equal(daily.line, '25 questions. Hold 78% accuracy at 55 seconds a question.');
  assert.equal(daily.said, '', 'nothing is announced until the reader taps');
  const du = benchView({ mine: 'du' });
  assert.equal(du.pct, 88);
  assert.equal(du.line, '25 questions. Hold 88% accuracy at 55 seconds a question.');
  assert.equal(du.said, 'DU level is today’s target, 88%. You are 16 points short.');
  const screens = read('./TourScreens.jsx');
  assert.match(screens, /<i><b style=\{\{ '--w': `\$\{view\.pct\}%`, '--t': '0\.8s' \}\} \/><\/i><em>\{view\.pct\}%<\/em>/, 'the Target bar follows');
  assert.match(screens, /\{target \? <small>Today’s target<\/small> : null\}/, 'the tag follows');
});

// ---------------------------------------------------------------- The Mob
test('The Mob: Fix it together opens one of the home sample\'s own public questions, read on the server; right or wrong with its reason', () => {
  const sample = publicSample('Economics');
  const source = DRILL.find((q) => q.subject === 'Economics');
  assert.deepEqual({ ...sample, options: [...sample.options] }, source, 'exactly a question every signed-out visitor plays on the desk');
  assert.ok(Object.isFrozen(sample));
  assert.equal(publicSample('Physics'), null, 'a subject the five do not hold gives nothing, never a question written here');
  const wrong = mobView({ sample, open: true, mine: 0 });
  assert.equal(wrong.mark, 'Not quite.');
  assert.equal(wrong.verdict, source.why);
  assert.deepEqual([0, 1, 2, 3].map(wrong.state), ['wrong', null, 'right', null]);
  assert.equal(wrong.said, `Not quite. The answer is ${letter(source.correct)}, ${source.options[source.correct]}. ${source.why}`);
  const right = mobView({ sample, open: true, mine: source.correct });
  assert.equal(right.mark, 'Correct.');
  assert.equal(right.said, `Correct. ${source.why}`);
  assert.equal(mobView({ sample: null }).open, false);
  // Where it comes from: page.js reads it on the server and hands it down; DemoDrill plays the same five.
  const page = read('../../app/page.js');
  assert.match(page, /import \{ publicSample \} from '@\/components\/landing\/sampleFive\.mjs';/);
  assert.match(page, /const TOUR_SAMPLES = MOB_LIVE \? \{ mob: publicSample\('Economics'\) \} : null;/);
  assert.match(page, /<FeatureTour slides=\{TOUR\} samples=\{TOUR_SAMPLES\} \/>/);
  assert.match(read('./DemoDrill.jsx'), /import \{ DRILL as SAMPLE_FIVE \} from '\.\/sampleFive\.mjs';/);
  // The screen draws only what it is given: none of the five's words are written in the tour's own source.
  const screens = read('./TourScreens.jsx');
  for (const q of DRILL) {
    assert.ok(!screens.includes(q.q), `TourScreens.jsx does not write "${q.q.slice(0, 40)}"`);
    for (const option of q.options) if (option.length > 12) assert.ok(!screens.includes(`'${option}'`), option);
  }
  assert.match(screens, /export function MobScreen\(\{ play, sample = null \}\)/);
  assert.match(screens, /\{sample\.q\}/);
  assert.match(screens, /sample\.options\.map\(/);
});

// ---------------------------------------------------------------- controls, live lines, no fakes
test('every control is a real button with a pressed state; results are read from a polite live line; a hint sits in each foot', () => {
  const screens = read('./TourScreens.jsx');
  for (const name of ['PracticeScreen', 'LearnScreen', 'PrepOSScreen', 'BenchmarkScreen', 'MobScreen']) {
    const body = screens.slice(screens.indexOf(`export function ${name}(`), screens.indexOf('\n}\n', screens.indexOf(`export function ${name}(`)));
    assert.match(body, /<button type="button" [^>]*className="ts__key/, `${name} has real buttons`);
    assert.match(body, /aria-pressed=\{/, `${name} holds its choice in aria-pressed`);
    assert.match(body, /foot=/, `${name} has a hint line`);
    assert.match(body, /said=/, `${name} says the result`);
    assert.match(body, /useDemo\(play, \w+_T, taken\)/, `${name}: a tap stops the demo for good`);
  }
  assert.match(screens, /\{foot \? <p className="lp-sr" aria-live="polite">\{said\}<\/p> : null\}/);
  // A tap takes over at once and is never undone by the demo: once taken, the demo is paused and the screen is finished.
  assert.match(screens, /function useDemo\(play, timeline, taken\) \{\n {2}const step = useSteps\(play && !taken, timeline\);\n {2}return taken \? timeline\.length : step;\n\}/);
  const css = read('../../app/tour-screens.css');
  assert.match(css, /\.ts \.ts__key:focus-visible \{ outline: 2px solid var\(--ts-volt\); outline-offset: 2px; \}/, 'a focus ring that shows on the dark screen');
  assert.match(css, /\.ts \.ts__key:active:not\(\[aria-disabled='true'\]\) \{ transform: scale\(\.98\); \}/, 'a pressed state');
  assert.match(css, /\.ts__choice \{[^}]*min-height: 44px;/);
  assert.match(css, /\.ts__level \{[^}]*min-height: 44px;/);
  assert.match(css, /\.ts__reply-key::before \{[^}]*height: 44px;/, 'the 36 px quick replies keep a 44 px hit area');
});

test('nothing in the tour pulses, blinks, pings or loops, and the demo never fakes a tap', () => {
  const sheets = ['../../app/feature-tour.css', '../../app/tour-screens.css', '../../app/r10-lab-tour.css', '../../app/r13-motion.css', '../../app/r14-look.css', '../../app/r16-tour-stack.css'].map(read).join('\n');
  assert.doesNotMatch(code(sheets), /\binfinite\b/);
  assert.doesNotMatch(sheets, /ts__tap|ts-tap|ts__live|ts-breathe|ts-eyes/);
  const screens = read('./TourScreens.jsx');
  assert.doesNotMatch(screens, /ts__tap|ts__live/);
  assert.doesNotMatch(read('./FeatureTour.jsx'), /ts__tap|ft__status|ft__play/);
});

test('the stack sheet: the touch sub swaps by the same split as the hold, the index fits, the tools keep one left edge', () => {
  const css = read('../../app/r16-tour-stack.css');
  assert.match(css, /@media not all and \(hover: hover\) and \(pointer: fine\) \{\n {2}#your-prep \.ft-sub--hold \{ display: none; \}\n {2}#your-prep \.ft-sub--touch \{ display: inline; \}/);
  assert.match(css, /\.fts__index ul \{[^}]*grid-template-columns: repeat\(var\(--fts-n, 5\), minmax\(min-content, 1fr\)\);/);
  assert.match(css, /\.fts__jump \{[^}]*min-height: 64px;/);
  assert.match(css, /\.fts__tool \{[^}]*scroll-margin-top: 8px; \}/, 'with the page\'s 76 px scroll padding, a jump lands the name 84 px down');
  assert.match(css, /--fts-air: 56px;/);
  assert.doesNotMatch(css, /linear-gradient|box-shadow|backdrop-filter/, 'no card, no glow, no glass around a tool');
  const list = read('../../lib/homeCss.mjs');
  // After every older layer; only round 16's own phone pass (r16-phone.css, which does not touch the tour) follows it.
  assert.match(list, /'src\/app\/r14-companion\.css',\n {2}\/\/ Round 16[^\n]*\n {2}'src\/app\/r16-tour-stack\.css',\n/, 'after every older layer of the home sheets');
});
