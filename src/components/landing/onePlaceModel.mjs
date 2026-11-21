// The one frame on /home-next (owner LK363, 20 Nov 2026, after Preparoo: "a cursor which is updating the screen live ... using
// actual screens and actual UI, because we are showing people how to use it"). Pure, so node --test holds it
// (data/tests/home_next_1120.test.mjs); OnePlace.jsx plays it in the browser.
//
// SCRIPTS: what the demo cursor (demo/CursorDemo.jsx) does on each row's stage, the landing's own real component:
//   practise  ExamStage (ExamScreen.jsx): pick an option in MockMob style, Next (the next question appears), switch to NTA
//             style (answers kept), pick an option, NTA's Save & Next. From 640 px it plays on the monitor; below, on the
//             exam as a phone shows it (ExamStage `inline`: the MockMob phone runner, then PhoneNta), in real pixels. The
//             same hooks are on both, so one script serves both.
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

const click = (target, move, dwell, at) => Object.freeze({ target, move, dwell, click: true, ...(at ? { at } : {}) });

// The fresh question's right option in Bring a mistake's Check step (bringMistakeCopy.mjs, held there by its own test).
const RIGHT = BRING_MISTAKE.check.correct + 1;

// No camera (21 Nov 2026, round 4): a laptop exam screen squeezed onto a phone cannot show a whole question at a readable
// size (7 to 8 px options at best), so below 640 px the stage is the phone runner itself (ExamStage `inline`).

// Every row runs 8 s or less (owner: each screen lasts about 5 s; the critic timed 9.7 and 10.4).
export const ROW_MAX_MS = 8000;

export const SCRIPTS = Object.freeze({
  // A look at Q3 opens the row (the camera comes in on the question), then: MockMob pick, chip 4 in the review panel, look
  // at Q4. The switch: the one shot out at scale 1, about 600 ms (move in 380, press, a short dwell), then straight into the
  // NTA question: pick, Save & Next (the palette counts it), look at Q5. Each look pans when the question cannot fit whole.
  // The held shot of Q3; pick B and press Next inside it (the shot eases down just enough for the key: Q4 arrives in the same
  // shot); out to 1 for the switch; the NTA question's held shot as the pick is made; Save & Next (the shot eases to the key);
  // back to the held shot of Q5. About five camera moves a pass.
  practise: Object.freeze([
    Object.freeze({ wait: 400 }),
    click('[data-demo="xs-option"]:nth-child(2)', 450, 350, [0.3, 0.5]),
    click('[data-demo="xs-next"]', 420, 750),
    click('[data-demo="xs-nta"]', 450, 550),
    click('[data-demo="xs-n-option"]:nth-child(3)', 450, 350, [0.3, 0.5]),
    click('[data-demo="xs-n-save"]', 420, 1000),
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
