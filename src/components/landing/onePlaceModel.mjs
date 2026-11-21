// The one frame on /home-next (owner LK363, 20 Nov 2026, after Preparoo: "a cursor which is updating the screen live ... using
// actual screens and actual UI, because we are showing people how to use it"). Pure, so node --test holds it
// (data/tests/home_next_1120.test.mjs); OnePlace.jsx plays it in the browser.
//
// SCRIPTS: what the demo cursor (demo/CursorDemo.jsx) does on each row's stage, the landing's own real component:
//   practise  ExamStage (ExamScreen.jsx): pick an option in MockMob style, Next (the next question appears), switch to NTA
//             style (answers kept), pick an option, NTA's Save & Next. From 640 px it plays on the monitor; below, on the
//             exam as a phone shows it (ExamStage `inline`: the MockMob phone runner, then PhoneNta), in real pixels. The
//             same hooks are on both, so one script serves both.
//   cards     KeyCardsDemo.jsx: turn the card, rest on the rating keys, rate it Got it (the app's key), the next card rises.
//   mobi, learn, rival, mob   the row stories (stories/<Id>Story.jsx), each playing its own script (stories/<id>Story.mjs).
// Every target is a data-demo hook the component itself carries (the test reads them out of the component's source). Every
// step names its own move and dwell, so scriptMs is the script's real length and the row's line fills over exactly that.
//
// Say beats (owner LK365, 21 Nov 2026: "the screens are moving too fast and without much explanation"): a step's `say` is the
// line the frame's caption strip shows for that beat (OnePlace.jsx op-say), and its `focus` the part of the screen the line
// is about (CursorDemo sets data-demo-focus on it; one-place.css stresses it). The pace rules (PACE, sayPace below): every
// line stays at least 2.2 s; the cursor waits at least 500 ms after a line appears before it moves (the reader reads first,
// then watches); a row runs 11 to 16 s. Each line opens on a `wait` step, so the cursor is still while it is read.
//
// The rules of the frame (useOnePlace in OnePlace.jsx):
//   * It plays only while all of these hold: hydrated, motion not reduced (prefers-reduced-motion or html[data-motion]),
//     the frame in the middle band of the window, the tab visible, and no reader holding it. Otherwise the rows are a plain
//     tab list, the first tool shown, every screen usable by hand.
//   * A row plays its script once, then the frame moves to the next row. After one pass through the rows it rests on the
//     last finished screen; the pass starts again only when the frame comes back into the window. Each row starts from the
//     component's start state (a fresh mount).
//   * A tap or click on a row jumps there and plays that row (and the rows after it, to the end of the pass). A press inside
//     the stage is the reader taking over, and the stage is never remounted under them: with a mouse, autoplay holds until
//     the pointer (or the focus) has been outside the frame for TAKEOVER_HOLD_MS; on touch (lifting a finger ends the
//     pointer too), only until the frame leaves the window or another row is chosen.
import { MOBI_STORY, MOBI_STORY_TYPED } from './stories/mobiStory.mjs';
import { LEARN_STORY } from './stories/learnStory.mjs';
import { RIVAL_STORY } from './stories/rivalStory.mjs';
import { MOB_STORY } from './stories/mobStory.mjs';

export const TAKEOVER_HOLD_MS = 8000;
// CursorDemo's own fixed parts: the press, the cursor's entry and its fade at the end.
export const CURSOR_PRESS_MS = 130;
export const CURSOR_ENTER_MS = 220;
export const CURSOR_EXIT_MS = 260;

const click = (target, move, dwell, at, more = {}) => Object.freeze({ target, move, dwell, click: true, ...(at ? { at } : {}), ...more });
// The phone runner's paper (MockMob) and pane (NTA): sized to the window, they may hold more than they show, so a pick
// brings its option into view (CursorDemo `reveal`, the pane's scrollTop, never the page's), and a key that brings a new
// question puts the paper back at its top (`settle`). On the monitor neither selector matches, so they do nothing.
export const PHONE_PANE = '.xs-ph-paper, .xs-ph-pane';
// Where the pane may stop when it reveals an option: the question's head row, its stem, or an option's top, so no row is
// ever left half cut at the pane's top edge.
export const PHONE_ROWS = '.xs-qhead, .xs-stem, .xs-option, .xs-n-qhead, .xs-n-stem, .xs-n-option';

// No camera (21 Nov 2026, round 4): a laptop exam screen squeezed onto a phone cannot show a whole question at a readable
// size (7 to 8 px options at best), so below 640 px the stage is the phone runner itself (ExamStage `inline`).

// A row runs 11 to 13 s of script (owner LK365, 21 Nov 2026: "moving too fast"; it was 8 s or less after his "about 5 s" of
// LK363). Every row explains itself (say beats) and keeps to ROW_MIN_MS..ROW_MAX_MS. 13 s, not 16 (critic round, 21 Nov
// evening): on a 6x-throttled phone the timers and React's work stretch a script by 15 to 25 %, so a 15.7 s script played
// 18.8 s and the whole pass took 1 min 42 s; 13 s of script keeps the measured row at or under 16 s
// (tmp/1121-stories/fix-oneplace/film.mjs measures it).
export const ROW_MAX_MS = 13000;
// 22 Nov 2026 (owner LK366: "both of these first two are quite slow"): Practise and Key cards run three beats in about
// 9 to 10 s; the four row stories, which he likes, keep their 11 to 13 s.
export const ROW_MIN_MS = 8500;
/** Between rows: a row's finished screen holds this long before the next row is dealt (OnePlace.jsx advance). */
export const ROW_HOLD_MS = 700;
/** The pace rules for a script's say beats. */
export const PACE = Object.freeze({ sayMinMs: 2200, readFirstMs: 500 });
/** The longest say line, in characters (the caption strip reserves two lines for it on a phone). */
export const SAY_MAX_CHARS = 58;

// The one part a Key cards line stresses: the Got it key, while the line says when the card comes back. (Until 22 Nov 2026
// the Practise and Key cards lines each stressed a part of the screen; owner LK366 called those boxes wrong, so the two real
// screens play at full strength with no box and no dimming.)
export const CARDS_FOCUS = Object.freeze({ gotIt: '[data-demo="kc-rate"]:nth-child(2)' });
/** Where the cursor rests on the Got it key: its top right corner, clear of both "Got it" and "back in 3 days" (fractions of
 *  the key's box; a fingertip is a 34 px disc centred there, an arrow hangs down and right from it, past the key's edge). */
export const CARDS_REST = Object.freeze([0.93, 0.12]);
// A beat's line: shown as its `wait` begins, with the cursor still, and the part of the screen it is about stressed.
const say = (line, focus, wait) => Object.freeze({ say: line, focus, wait });

export const SCRIPTS = Object.freeze({
  // A look at Q3 opens the row (the camera comes in on the question), then: MockMob pick, chip 4 in the review panel, look
  // at Q4. The switch: the one shot out at scale 1, about 600 ms (move in 380, press, a short dwell), then straight into the
  // NTA question: pick, Save & Next (the palette counts it), look at Q5. Each look pans when the question cannot fit whole.
  // The held shot of Q3; pick B and press Next inside it (the shot eases down just enough for the key: Q4 arrives in the same
  // shot); out to 1 for the switch; the NTA question's held shot as the pick is made; Save & Next (the shot eases to the key);
  // back to the held shot of Q5. About five camera moves a pass.
  // 21 Nov 2026 (LK365): four beats, each with its line. True to ExamScreen.jsx: a MockMob pick is the answer at once
  // (`choose`), and Next keeps it (the header counts "1 answered") and opens the next question (`go`); the switch draws NTA
  // style, which the exam section calls "an exact copy of the real NTA exam screen" (EXAM_HEAD.sub); in NTA style a pick is
  // held until Save & Next saves it (`hold`, `saveAndNext`: "exam-true saving"), as the real exam's screen does.
  // 22 Nov 2026 (owner LK366: "it's just introducing some boxes here and there, which are not looking as they should ...
  // both of these first two are quite slow"): three beats, no stress boxes and no dimming (the exam screen plays at full
  // strength; the cursor and what it changes are the stress), and "Next keeps your answer" is shown, not said.
  practise: Object.freeze([
    // 22 Nov 2026, later (owner LK367): one flow for the monitor and the phone: answer one question, Next, switch to NTA
    // style, and end there on NTA's own keys: pick, Mark for Review & Next, then the question palette (on a phone the
    // palette key raises its sheet inside the device; the monitor's palette is always on show, so that step is skipped).
    say('Answer a question, as you would in the exam.', null, 600),
    click('[data-demo="xs-option"]:nth-child(2)', 500, 500, [0.3, 0.5], { reveal: PHONE_PANE, snap: PHONE_ROWS }),
    click('[data-demo="xs-next"]', 450, 900, null, { settle: PHONE_PANE }),
    say('Switch to NTA style, the real exam\u2019s screen.', null, 500),
    click('[data-demo="xs-nta"]', 500, 1100),
    say('Mark a doubtful one for review, as in NTA.', null, 500),
    click('[data-demo="xs-n-option"]:nth-child(3)', 500, 450, [0.3, 0.5], { reveal: PHONE_PANE, snap: PHONE_ROWS }),
    click('[data-demo="xs-n-mark"]', 450, 900, null, { settle: PHONE_PANE }),
    say('The palette shows every question in NTA\u2019s colours.', null, 600),
    click('[data-demo="xs-n-palette"]', 450, 300),
    Object.freeze({ wait: 1700 }),
  ]),
  // 22 Nov 2026 (owner LK366: "the key cards one is also not looking very good ... quite slow"): no dimmed card and no box
  // round the keys; the third line is now shown: the rated card is filed and a time line says when it returns
  // (KeyCardsDemo.jsx FILE_MS, a second and a half), then the next card rises.
  cards: Object.freeze([
    say('Turn the card to see the answer.', null, 700),
    click('[data-demo="kc-turn"]', 550, 2000),
    say('Say how well you knew it.', null, 600),
    // The cursor rests on the key's very corner, so neither "Got it" nor its "back in 3 days" is covered.
    Object.freeze({ target: '[data-demo="kc-rate"]:nth-child(2)', at: CARDS_REST, move: 550, dwell: 1100 }),
    say('It comes back before you are likely to forget it.', CARDS_FOCUS.gotIt, 700),
    click('[data-demo="kc-rate"]:nth-child(2)', 200, 300, CARDS_REST),
    // The card is filed (its time line plays for a second and a half), then the next card rises and rests.
    Object.freeze({ focus: null, wait: 2700 }),
  ]),
  // Rows 3 to 6 are row stories (21 Nov 2026, owner LK365: "focus more on showing the feature very well through
  // animations"): each is its own screen (stories/<Id>Story.jsx) and its own script (stories/<id>Story.mjs), held by its own
  // test (data/tests/story_<id>_1121.test.mjs). Ask Mobi: photograph the wrong question, Mobi reads the page, names the
  // chapter and the slip, a fresh check, then 10 more from the bank (typed instead of photographed while Mobi does not read
  // photos: SCRIPTS_TYPED). Learn: open a lesson, read the worked example, recall a card, the missed card comes back sooner.
  // Benchmarks: pick a level, race its target, see the gap, a finished mock adds to your standing. The Mob: share the code,
  // the same five for 24 hours, the podium and its trap, fix the trap together.
  mobi: MOBI_STORY.steps,
  learn: LEARN_STORY.steps,
  rival: RIVAL_STORY.steps,
  mob: MOB_STORY.steps,
});

/** The scripts that change with a switch: Ask Mobi typed, while Mobi does not read photos (data/mistake_photo.mjs). */
export const SCRIPTS_TYPED = Object.freeze({ mobi: MOBI_STORY_TYPED.steps });

/** A script's length in ms, as CursorDemo plays it: the entry, each wait, each move, press and dwell, then the fade. */
export function scriptMs(steps = []) {
  let ms = CURSOR_ENTER_MS + CURSOR_EXIT_MS;
  for (const step of steps) {
    if (step.wait) { ms += step.wait; continue; }
    ms += (step.move ?? 0) + (step.click ? CURSOR_PRESS_MS : 0) + (step.dwell ?? 0);
  }
  return ms;
}

/** How many say beats a script has (the caption strip's "step n of m"). */
export const sayCount = (steps = []) => steps.filter((step) => typeof step.say === 'string').length;

/**
 * Each say beat as CursorDemo plays it: { say, at, holds, firstMove }. `at`: when the line appears (ms from the script's
 * start); `holds`: how long it stays (to the next line, or to the script's end); `firstMove`: how long the cursor stays still
 * after it appears (to the start of the beat's first move; Infinity when the beat has none).
 */
export function sayPace(steps = []) {
  const beats = [];
  let t = CURSOR_ENTER_MS;
  let open = null;
  for (const step of steps) {
    if (typeof step.say === 'string') { open = { say: step.say, at: t, holds: 0, firstMove: Infinity }; beats.push(open); }
    if (step.wait) { t += step.wait; continue; }
    if (step.target) {
      if (open && open.firstMove === Infinity) open.firstMove = t - open.at;
      t += (step.move ?? 0) + (step.click ? CURSOR_PRESS_MS : 0) + (step.dwell ?? 0);
    }
  }
  const end = t + CURSOR_EXIT_MS;
  beats.forEach((beat, i) => { beat.holds = (beats[i + 1]?.at ?? end) - beat.at; });
  return beats;
}

/** Every data-demo hook a script aims at, for the test to find in the component's source. */
export function scriptHooks(steps = []) {
  return [...new Set(steps.filter((s) => s.target).map((s) => s.target.match(/data-demo="([^"]+)"/)?.[1]).filter(Boolean))];
}

/** True only when the frame may play by itself. */
export function autoplayRuns({ ready = false, reduced = true, onScreen = false, visible = false, held = true } = {}) {
  return Boolean(ready && !reduced && onScreen && visible && !held);
}

/** The row after `index`, wrapping to the first. */
export const nextIndex = (index, count) => (count > 0 ? (index + 1) % count : 0);

// ------------------------------------------------------------------ when the run starts and stops (owner LK364, 21 Nov 2026)
// "It should detect when a person is scrolling through and when he reaches the 'Your whole CUET prep in one place' sentence
// on top of the screen. Then the autoplay should start automatically and should not stop until all the slides are
// finished." On wider screens the run starts when the heading reaches TRIGGER_LINE, as soon as the controls fit below it.
// If the window is too short at that point, the reader scrolls just far enough to see the working screens.
// Once running it plays every row to the end; only the hidden tab, the frame wholly out of the window and a reader's own tap
// in a stage pause it (and the paused row plays again from its start). After the last row it rests; a new run needs the
// reader to go back above the heading (the heading comes down past the line) and come down to it again.
export const TRIGGER_LINE = 0.15;
// PHONES (critic round, 21 Nov 2026 evening: on a phone the heading crossed 15 % while the stage's working controls were still
// under the window, so presses happened off-screen and results appeared with no cause). In the phone layout (the chips above
// the stage, one-place.css below 640 px) the run starts instead when the stage's working room is wholly in the window: the
// room's foot at least ROOM_FOOT_PX above the window's bottom. The room (one-place.css --op-room, OnePlace.jsx op-room) is
// min(520 px, the window less the site bar, the chips and the caption strip), and every stage keeps the controls the cursor
// presses inside it, so the reader sees the whole screen work. The same events drive runStep: 'up' when the room's foot
// rises past the line, 'down' when it drops back under it, 'arrive' when the frame is here with the foot already above.
export const PHONE_LAYOUT = '(max-width: 639px)';
export const ROOM_FOOT_PX = 8;
/** Place the desktop marker, measured from the stage's top. It crosses the bottom line after both conditions hold. */
export function desktopTriggerFoot({ headingOffset, workingBottom, innerHeight }) {
  const headingFoot = headingOffset + innerHeight * (1 - TRIGGER_LINE) - ROOM_FOOT_PX;
  return Math.max(headingFoot, workingBottom);
}

/** Has the marker reached the viewport's bottom line? */
export function triggerPassed({ roomBottom = Infinity, innerHeight = 0 } = {}) {
  return roomBottom <= innerHeight - ROOM_FOOT_PX + 0.5;
}
/** How long the next row's card takes to slide up over the one on show (one-place.css op-deal), ms. */
export const DEAL_MS = 460;
/** The run's next state: `run` = { phase: 'idle' | 'running' | 'rested', armed }, `event` = 'up' (the heading went above
 *  the line), 'down' (it came back below), 'arrive' (the frame is here with the heading above), 'end' (the last row is done).
 *  `start` says a new run begins from the first row. */
export function runStep(run, event) {
  const { phase = 'idle', armed = true } = run || {};
  if (event === 'end') return { phase: 'rested', armed: false, start: false };
  if (event === 'up') return phase !== 'running' && (armed || phase === 'idle') ? { phase: 'running', armed: false, start: true } : { phase, armed, start: false };
  if (event === 'down') {
    if (phase === 'idle') return { phase: 'running', armed: false, start: true };
    return { phase, armed: phase === 'rested' ? true : armed, start: false };
  }
  if (event === 'arrive') return phase === 'idle' ? { phase: 'running', armed: false, start: true } : { phase, armed, start: false };
  return { phase, armed, start: false };
}

/** After a row's script ends: the next row, or null to rest (the pass ends on the last row). */
export const afterRow = (index, count) => (index < count - 1 ? index + 1 : null);

/** Does a pointer leaving the frame start the takeover's hold timer? Only a mouse: lifting a finger also "leaves". */
export const leaveStartsHold = (pointerType) => pointerType === 'mouse';

/** Where a key moves the selection in a tab list of `count` rows, or null for any other key. */
export function keyStep(key, index, count) {
  if (count <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** Is motion reduced for this reader? The system setting or the app's own switch (html[data-motion]). */
export function motionReduced(win = globalThis.window) {
  if (!win) return true;
  try {
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch { /* an old browser: fall through */ }
  return win.document?.documentElement?.dataset?.motion === 'reduced';
}

/** The live home's old section addresses (the hero strip still links them): which row each opens on this page. */
export const ROW_OF_HASH = Object.freeze({ '#exam-experience': 'practise', '#key-cards': 'cards', '#bring-a-mistake': 'mobi' });

// ------------------------------------------------------------------ which stages are live (21 Nov 2026, load weight)
// The server draws all three stages; in the browser only the row on show is made live (a React component) at first, the
// others stay as the server drew them (OnePlaceGate.jsx keeps that markup), so the frame keeps its height and the page does
// not build three demos at once. The next row's stage is made live in idle time shortly before its turn (STAGE_LEAD_MS
// before the shown row's script ends), or at once when a reader taps its row. Each live stage has a mount generation (its
// React key): a stage that has played is mounted fresh before it plays again, so every run starts from the component's
// start state; a stage made live ahead of its turn has not played, so it is not mounted a second time when its turn comes.
/** How long before the shown row's script ends the next row's stage is made live (in idle time). */
export const STAGE_LEAD_MS = 2500;

/** The stages at the start: `drawn` (the server's markup is kept) makes only the shown row live; otherwise all are. */
export function stagesStart(count, { active = 0, drawn = false } = {}) {
  return {
    live: Array.from({ length: count }, (_, i) => !drawn || i === active),
    gen: Array.from({ length: count }, () => 0),
    used: Array.from({ length: count }, (_, i) => i === active),
  };
}

/** `start`: row `index` begins a run (live, and mounted fresh if it has played). `ready`: make it live, unplayed, ahead of its turn. */
export function stagesStep(state, { type, index }) {
  if (!Number.isInteger(index) || index < 0 || index >= state.live.length) return state;
  if (type === 'ready' && state.live[index] && !state.used[index]) return state;
  if (type !== 'start' && type !== 'ready') return state;
  const live = state.live.slice();
  const gen = state.gen.slice();
  const used = state.used.slice();
  if (used[index]) gen[index] += 1;
  live[index] = true;
  used[index] = type === 'start';
  return { live, gen, used };
}
