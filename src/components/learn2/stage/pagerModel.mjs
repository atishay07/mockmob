// The study stage's pager rules (BUILD-1101 B1, A1 section 3.7): pure, no DOM, no clock, so node --test holds them
// (pagerModel.test.mjs). usePager.js applies them to real wheel, touch and key events.
//   wheel     one gesture moves one item: a notch (50 px or more in one event) at once, a trackpad after 60 px summed;
//             the rest of that gesture is swallowed until the wheel has been quiet for 220 ms
//   release   a touch drag moves one item past 18% of the item area or at 0.35 px/ms in that direction; never more than one
//   rubber    0.35 resistance past the first and the last page
//   scroller  an item's own scroller that can still move in a direction owns the gesture (the edge rule)
//   keys      the key table of A1 3.7

export const PAGER = Object.freeze({
  distance: 0.18, // share of the item area a drag must pass
  velocity: 0.35, // px per ms over the last 80 ms
  window: 80, // ms of samples for the release velocity
  resistance: 0.35,
  slop: 8, // px before a direction is chosen; under it a touch is a tap
  ms: 320,
  ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
});

export const WHEEL = Object.freeze({ notch: 50, step: 60, quiet: 220, line: 40 });

/** A fresh wheel state. */
export const wheelState = () => ({ acc: 0, lastAt: -Infinity, spent: false, innerAtStart: false });

/**
 * One wheel event. e = { dy, dx, mode (deltaMode), t (timeStamp ms), ctrl, page (item area height for mode 2), inner (an
 * item scroller can move in this direction), moving (the pager is mid-move) }. Returns { state, prevent, move } where move
 * is -1, 0 or 1 and prevent says the page behind must not scroll.
 */
export function wheelStep(state, e) {
  const s = { ...state };
  if (e.ctrl) return { state: s, prevent: false, move: 0 }; // a trackpad pinch zooms
  const unit = e.mode === 1 ? WHEEL.line : e.mode === 2 ? (e.page || 600) : 1;
  const dy = (Number(e.dy) || 0) * unit;
  const dx = (Number(e.dx) || 0) * unit;
  if (Math.abs(dx) > Math.abs(dy)) return { state: s, prevent: false, move: 0 }; // sideways is not ours
  const fresh = e.t - s.lastAt > WHEEL.quiet;
  s.lastAt = e.t;
  if (fresh) { s.acc = 0; s.spent = false; s.innerAtStart = Boolean(e.inner); }
  if (e.inner) return { state: s, prevent: false, move: 0 }; // the content scrolls first, natively
  if (s.innerAtStart || s.spent || e.moving || dy === 0) return { state: s, prevent: true, move: 0 };
  s.acc += dy;
  if (Math.abs(dy) >= WHEEL.notch || Math.abs(s.acc) >= WHEEL.step) {
    const move = Math.sign(Math.abs(dy) >= WHEEL.notch ? dy : s.acc);
    s.spent = true;
    s.acc = 0;
    return { state: s, prevent: true, move };
  }
  return { state: s, prevent: true, move: 0 };
}

/** The drag offset drawn on screen: 1:1, with resistance past the first and the last page. */
export function rubber(dy, index, count) {
  const atStart = index <= 0 && dy > 0;
  const atEnd = index >= count - 1 && dy < 0;
  return atStart || atEnd ? dy * PAGER.resistance : dy;
}

/** Release velocity (px/ms, positive = finger moving down) from samples [{ t, y }], over the last PAGER.window ms. */
export function releaseVelocity(samples) {
  const list = (samples || []).filter((p) => Number.isFinite(p?.t) && Number.isFinite(p?.y));
  if (list.length < 2) return 0;
  const last = list[list.length - 1];
  const from = list.find((p) => last.t - p.t <= PAGER.window) || list[0];
  const dt = last.t - from.t;
  return dt > 0 ? (last.y - from.y) / dt : 0;
}

/**
 * Where a released drag goes. dy = finger travel (positive = down, toward the previous item), v = release velocity,
 * height = the item area. A quick flick decides by its own direction; otherwise the distance does. Never more than one.
 */
export function releaseTarget({ dy = 0, v = 0, height = 1, index = 0, count = 1 } = {}) {
  let dir = 0;
  if (Math.abs(v) > PAGER.velocity) dir = v < 0 ? 1 : -1;
  else if (Math.abs(dy) > PAGER.distance * Math.max(1, height)) dir = dy < 0 ? 1 : -1;
  return Math.max(0, Math.min(count - 1, index + dir));
}

/** A touch's role once it moved: 'tap' under the slop, 'side' for a sideways gesture, else 'vertical'. */
export function touchLock(dx, dy) {
  if (Math.abs(dx) < PAGER.slop && Math.abs(dy) < PAGER.slop) return 'tap';
  return Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'side';
}

/** Can a scroll box move in `dir` (1 = down, -1 = up)? box = { scrollTop, scrollHeight, clientHeight }. */
export function canScroll(box, dir) {
  if (!box) return false;
  const { scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = box;
  if (scrollHeight <= clientHeight + 1) return false;
  return dir > 0 ? scrollTop + clientHeight < scrollHeight - 1 : dir < 0 ? scrollTop > 1 : false;
}

/**
 * The first element from `el` up to (not past) `root` that scrolls vertically and can still move in `dir`, else null.
 * `styleOf(el)` returns its computed style (getComputedStyle in the browser; a stub in the tests).
 */
export function scrollerThatCanMove(el, dir, root, styleOf) {
  for (let node = el; node && node !== root; node = node.parentElement) {
    const oy = styleOf ? styleOf(node)?.overflowY : null;
    if ((oy === 'auto' || oy === 'scroll') && canScroll(node, dir)) return node;
  }
  return null;
}

const ARROWS = { ArrowDown: 'next', PageDown: 'next', j: 'next', J: 'next', ArrowUp: 'prev', PageUp: 'prev', k: 'prev', K: 'prev', Home: 'first', End: 'last' };

/**
 * What a key does on the stage (A1 3.7). ctx = {
 *   typing      focus is in a text field
 *   mods        Ctrl, Alt or Meta held
 *   onControl   focus is on a button or a link (Space and Enter then belong to it)
 *   foreign     focus is on a control outside the current item (Close, Chapter): letter keys are left alone
 *   scrollable  for 'up' / 'down': the focused region can still scroll that way (the arrow scrolls it)
 *   turnable    the item is a card still face up
 *   answerable  the item is a question not yet answered; options = its option count
 *   saveable    the item has a Keep (a card) or a Save (a question) key to press
 * }. Returns 'next' | 'prev' | 'first' | 'last' | 'turn' | 'help' | 'escape' | 'save' | { answer: index } | null.
 */
export function keyAction(key, ctx = {}) {
  if (ctx.mods || ctx.typing) return null;
  if (key === 'Escape') return 'escape';
  if (key === '?') return 'help';
  if (ARROWS[key]) {
    const dir = ARROWS[key] === 'next' ? 1 : ARROWS[key] === 'prev' ? -1 : 0;
    if (dir && /^Arrow|^Page/.test(key) && ctx.scrollable?.(dir)) return null;
    if (/^[jkJK]$/.test(key) && ctx.foreign) return null;
    return ARROWS[key];
  }
  if (key === ' ' || key === 'Enter') {
    if (ctx.onControl) return null;
    return ctx.turnable ? 'turn' : 'next';
  }
  if (ctx.saveable && !ctx.foreign && (key === 's' || key === 'S')) return 'save';
  if (ctx.answerable && !ctx.foreign) {
    const n = Math.max(0, Math.min(6, Number(ctx.options) || 0));
    let i = '123456'.indexOf(key);
    if (i < 0 && key.length === 1) i = 'abcdef'.indexOf(key.toLowerCase());
    if (i >= 0 && i < n) return { answer: i };
  }
  return null;
}

/**
 * Where a box scrolls after a wrong answer (R4 ui-correctness#7), from rects measured in one frame (px, viewport space):
 *   box     { top, bottom, scrollTop }  the scroll box; `bottom` already stops at the action bar when the bar covers it
 *   head    { top }                     the question's head line (the context: "You missed this in Mock 3 on 16 Oct")
 *   target  { top, bottom }             the verdict, or the line you needed under it
 *   fade    the box's head fade (24 px): the head line stays below it
 * It scrolls only as far as needed to bring `target` into view (up to 200 px of it, 16 px clear of the foot), and never so far
 * that the head line (so the stem's first line under it) goes under the top. Returns the new scrollTop, or null to stay.
 */
export function verdictScrollTop({ box, head, target, fade = 24, show = 200, clear = 16 } = {}) {
  if (!box || !target) return null;
  const want = box.scrollTop + Math.min(target.bottom, target.top + show) + clear - box.bottom;
  const cap = head ? box.scrollTop + head.top - box.top - fade : Infinity;
  const top = Math.max(0, Math.min(want, cap));
  return top > box.scrollTop + 1 ? Math.round(top) : null;
}

/**
 * Whether option A waits below the fold (M10, R4 ui-correctness#5): less than 28 px of it above `edge`. Every rect is the
 * page's own (option A and the page's visible foot move together while the pager slides), so a read in mid-slide is still
 * true; the bar's top joins `edge` only where the bar covers the page.
 */
export const optionsBelow = ({ optionTop, edge, peek = 28 } = {}) => Number.isFinite(optionTop) && Number.isFinite(edge) && optionTop + peek > edge;
