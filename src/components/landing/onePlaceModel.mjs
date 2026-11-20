// The one frame on /home-next (owner LK363, 20 Nov 2026, after Preparoo: "a cursor which is updating the screen live ... using
// actual screens and actual UI, because we are showing people how to use it"). Pure, so node --test holds it
// (data/tests/home_next_1120.test.mjs); OnePlace.jsx plays it in the browser.
//
// SCRIPTS: what the demo cursor (demo/CursorDemo.jsx) does on each row's stage, the landing's own real component:
//   practise  ExamStage (ExamScreen.jsx): pick an option in MockMob style, Next, switch to NTA style (answers kept), pick an
//             option, NTA's Save & Next, pick again, NTA's Mark for Review & Next. The palette's counts change as it goes.
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
//   * A row plays its script once, then the frame moves to the next row (after the last, the first). Each row starts from
//     the component's start state (a fresh mount).
//   * A tap or click on a row jumps there and plays that row. A press inside the stage is the reader taking over: autoplay
//     holds until the pointer (or the focus) has been outside the frame for TAKEOVER_HOLD_MS, or another row is chosen.
import { BRING_MISTAKE } from './bringMistakeCopy.mjs';

export const TAKEOVER_HOLD_MS = 8000;
// CursorDemo's own fixed parts: the press, the cursor's entry and its fade at the end.
export const CURSOR_PRESS_MS = 130;
export const CURSOR_ENTER_MS = 220;
export const CURSOR_EXIT_MS = 260;

const click = (target, move, dwell, at) => Object.freeze({ target, move, dwell, click: true, ...(at ? { at } : {}) });

// The fresh question's right option in Bring a mistake's Check step (bringMistakeCopy.mjs, held there by its own test).
const RIGHT = BRING_MISTAKE.check.correct + 1;

export const SCRIPTS = Object.freeze({
  practise: Object.freeze([
    click('[data-demo="xs-option"]:nth-child(2)', 520, 600),
    click('[data-demo="xs-next"]', 480, 650),
    click('[data-demo="xs-nta"]', 560, 850),
    click('[data-demo="xs-n-option"]:nth-child(3)', 520, 500, [0.3, 0.5]),
    click('[data-demo="xs-n-save"]', 460, 650),
    click('[data-demo="xs-n-option"]:nth-child(1)', 480, 450, [0.3, 0.5]),
    click('[data-demo="xs-n-mark"]', 460, 1400),
  ]),
  cards: Object.freeze([
    Object.freeze({ wait: 700 }),
    click('[data-demo="kc-turn"]', 560, 1700),
    click('[data-demo="kc-rate"]:nth-child(2)', 520, 1000),
    click('[data-demo="kc-turn"]', 560, 2000),
  ]),
  mobi: Object.freeze([
    Object.freeze({ wait: 1300 }),
    click('[data-demo="bmk-tab"]:nth-child(2)', 560, 1900),
    click('[data-demo="bmk-tab"]:nth-child(3)', 440, 800),
    click(`[data-demo="bmk-option"]:nth-child(${RIGHT})`, 520, 1700, [0.25, 0.5]),
    click('[data-demo="bmk-tab"]:nth-child(4)', 560, 1600),
  ]),
});

/** A script's length in ms, as CursorDemo plays it: the entry, each wait, each move, press and dwell, then the fade. */
export function scriptMs(steps = []) {
  let ms = CURSOR_ENTER_MS + CURSOR_EXIT_MS;
  for (const step of steps) {
    if (step.wait) { ms += step.wait; continue; }
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
