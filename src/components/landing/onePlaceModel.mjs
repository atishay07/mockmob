// The one frame on /home-next (owner LK363, 20 Nov 2026, after Preparoo: "a cursor which is updating the screen live ... using
// actual screens and actual UI, because we are showing people how to use it"). Pure, so node --test holds it
// (data/tests/home_next_1120.test.mjs); OnePlace.jsx plays it in the browser.
//
// SCRIPTS: what the demo cursor (demo/CursorDemo.jsx) does on each row's stage, the landing's own real component:
//   practise  ExamStage (ExamScreen.jsx): look at the question, pick an option in MockMob style, chip 4, look, switch to NTA
//             style (answers kept), pick an option, NTA's Save & Next, look at the new question. The palette's counts change
//             as it goes. On a phone the camera frames each step (EXAM_CAMERA, SHOT) and looks at each new question.
//   cards     KeyCardsDemo.jsx: turn the card, rate it Got it (the app's key), the next card rises, turn it.
//   mobi      BringMistakeCard (BringMistakeBlock.jsx): Question, then Read, then Check (the right option of the fresh
//             question), then Practise.
// Every target is a data-demo hook the component itself carries (the test reads them out of the component's source). Every
// step names its own move and dwell, so scriptMs is the script's real length and the row's line fills over exactly that.
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
import { BRING_MISTAKE } from './bringMistakeCopy.mjs';

export const TAKEOVER_HOLD_MS = 8000;
// CursorDemo's own fixed parts: the press, the cursor's entry and its fade at the end.
export const CURSOR_PRESS_MS = 130;
export const CURSOR_ENTER_MS = 220;
export const CURSOR_EXIT_MS = 260;

const click = (target, move, dwell, at, zoom, frame, more = {}) => Object.freeze({ target, move, dwell, click: true, ...(at ? { at } : {}), ...(zoom ? { zoom } : {}), ...(frame ? { frame } : {}), ...more });

// The fresh question's right option in Bring a mistake's Check step (bringMistakeCopy.mjs, held there by its own test).
const RIGHT = BRING_MISTAKE.check.correct + 1;

// The camera on the exam screen (21 Nov 2026): below 640 px the monitor's screen is drawn at about 40% of its design size, so
// its stem came out at 7 px and its options at under 6. Each step on the screen zooms the screen (the frame inside the glass;
// the monitor stays a monitor, LK319) about its target, at least ZOOM_AT and enough that the target's text is drawn at 12 px
// or more. The switch beside the monitor eases back out. CursorDemo's `zoom` prop takes this.
export const ZOOM_AT = 2.1;
export const EXAM_CAMERA = Object.freeze({ el: '.xs-glass > .xs-frame', below: 640, minPx: 12, max: 3.2 });
// The shots are composed, not centred on the key (21 Nov, the coordinator's look at the first camera: a key and blank boxes,
// no question). A pick frames the stem and the four options. A key press frames the key with the palette beside it, whose
// counts and chips change with the press: at the camera's least scale the chosen option (the screen's left) and the key (its
// right) never fit one shot, and between the options and the key bar both screens are blank paper (measured: 60 to 95% of
// the shot blank). So the key the script presses is the one next to the palette (Next; Save & Next), never NTA's Mark key at
// the far left. After a press that brings a new question, a look beat pans to its stem and options and holds. Both screens'
// parts are named, since only the one on show matches.
export const SHOT = Object.freeze({
  question: '.xs-stem, .xs-options, .xs-n-stem, .xs-n-options',
  panel: '.xs-review, .xs-n-palette',
});
// A question shot's least scale comes from its text (21 Nov, the critic's second round: options came out at 11.4 px on a
// 360 px phone): every option's words at 12 px, the stem at 11 px (the stem may go a point under, so more of it fits). The
// option's letter chip (one bold capital) is not held to 12: it would force the scale from 2.2 to 2.5 and cut more stem. The screen is the real one, so its lines cannot rewrap: when the stem and the four options still do not fit, the
// look beat opens on the stem's start and pans to its end and the last option during the hold.
export const QUESTION_TEXT = Object.freeze([
  Object.freeze(['.xs-opt-text, .xs-n-option > span:last-child', 12]),
  Object.freeze(['.xs-stem, .xs-n-stem', 11]),
]);
// Where a look beat pans when the question cannot fit: along the stem's line, to its end (and down to the last option).
export const STEM = '.xs-stem, .xs-n-stem';
export const LOOK_MS = 700;
const look = (move, dwell) => Object.freeze({ look: SHOT.question, text: QUESTION_TEXT, pan: STEM, move, dwell });
const pick = (target, move, dwell, at) => click(target, move, dwell, at, ZOOM_AT, SHOT.question, { text: QUESTION_TEXT });
// A key press: the key and the palette right of it, the shot starting at the key's left edge and below the options.
const key = (target, move, dwell) => click(target, move, dwell, null, ZOOM_AT, SHOT.panel, { anchor: 'key', clear: '.xs-options, .xs-n-options' });
// A palette chip: the shot is the palette (its counts and chips) alone.
const chip = (target, move, dwell) => click(target, move, dwell, null, ZOOM_AT, SHOT.panel, { anchor: 'region' });

// Every row runs 8 s or less (owner: each screen lasts about 5 s; the critic timed 9.7 and 10.4).
export const ROW_MAX_MS = 8000;

export const SCRIPTS = Object.freeze({
  // A look at Q3 opens the row (the camera comes in on the question), then: MockMob pick, chip 4 in the review panel, look
  // at Q4. The switch: the one shot out at scale 1, about 600 ms (move in 380, press, a short dwell), then straight into the
  // NTA question: pick, Save & Next (the palette counts it), look at Q5. Each look pans when the question cannot fit whole.
  practise: Object.freeze([
    look(400, LOOK_MS),
    pick('[data-demo="xs-option"]:nth-child(2)', 440, 250, [0.25, 0.5]),
    // MockMob's Next sits under the options' right ends, which no shot at a readable scale can leave out (the critic's
    // "empty option boxes"), so the move to Q4 is the review panel's own chip 4: the same real control a student uses.
    chip('[data-demo="xs-chip"]:nth-child(4)', 380, 150),
    look(400, LOOK_MS),
    click('[data-demo="xs-nta"]', 380, 150),
    pick('[data-demo="xs-n-option"]:nth-child(3)', 440, 250, [0.3, 0.5]),
    key('[data-demo="xs-n-save"]', 380, 300),
    look(400, LOOK_MS),
  ]),
  cards: Object.freeze([
    Object.freeze({ wait: 400 }),
    click('[data-demo="kc-turn"]', 520, 1500),
    click('[data-demo="kc-rate"]:nth-child(2)', 500, 900),
    click('[data-demo="kc-turn"]', 520, 1600),
  ]),
  mobi: Object.freeze([
    Object.freeze({ wait: 500 }),
    click('[data-demo="bmk-tab"]:nth-child(2)', 420, 1200),
    click('[data-demo="bmk-tab"]:nth-child(3)', 420, 1200),
    click(`[data-demo="bmk-option"]:nth-child(${RIGHT})`, 420, 1200, [0.25, 0.5]),
    click('[data-demo="bmk-tab"]:nth-child(4)', 420, 1200),
  ]),
});

/** A script's length in ms, as CursorDemo plays it: the entry, each wait, each move, press and dwell, then the fade. */
export function scriptMs(steps = []) {
  let ms = CURSOR_ENTER_MS + CURSOR_EXIT_MS;
  for (const step of steps) {
    if (step.wait) { ms += step.wait; continue; }
    if (step.look) { ms += (step.move ?? 0) + (step.dwell ?? 0); continue; }
    ms += (step.move ?? 0) + (step.click ? CURSOR_PRESS_MS : 0) + (step.dwell ?? 0);
  }
  return ms;
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
