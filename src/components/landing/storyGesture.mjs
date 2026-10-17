// One gesture, one step (owner L-027 to L-029: "One scroll should be one slide only, no matter what the speed is").
// The decisions ScrollStory makes about wheel and touch input inside a held story, kept free of the DOM so a test
// can feed them synthetic flicks of any size.
//
// A wheel gesture is one stroke: a notch, a burst of notches, a trackpad swipe with its inertia tail, a fling. It
// lasts until the wheel has been quiet for QUIET_MS or turns the other way. A gesture the story claims (the stage
// holds the screen and the story has a step that way) is cancelled whole and moves exactly one step, however many
// pixels it carries. Only a stream that is still pushing hard (at least RESTEP_SHARE of its own peak) RESTEP_MS
// of flowing stream after its step counts as a new push: a spinning wheel steps on about once a second instead of trapping the page,
// and at the story's end that push is handed back to the page (released), so the reader always gets out.

export const QUIET_MS = 160;
export const STEP_MS = 440;
export const WHEEL_MIN = 12;
export const RESTEP_MS = 1100;
export const RESTEP_SHARE = 0.6;
// Active time: the gaps inside a stream count up to ACTIVE_GAP_MS each, so a page busy drawing a step (its events
// queue, or arrive late) never makes one push look like a long spin.
export const ACTIVE_GAP_MS = 50;
export const SWIPE_MIN = 28;
export const FLICK_MIN = 12;
export const FLICK_MS = 300;
export const TOUCH_TAIL_MS = 250;

// g: the gesture so far (null before the first event). event: { t, dy, h } with dy in pixels, t the input's own time
// and h when the page could handle it (defaults to t). The quiet gap that ends a gesture is measured from the later of
// the previous event's input time and the moment the page last handled one: input queued while the page drew a step
// (or sent only once the page had answered the previous one) is still the same push.
// ctx.claim(dir): does a new gesture this way belong to the story now? ctx.busyUntil: the step's glide runs until then.
// Returns { gesture, cancel, step }: cancel the event (the story owns it) and step (-1, 0 or 1) to take.
export function wheelStep(g, { t, dy, h = t }, { claim, busyUntil = 0 }) {
  if (!dy) return { gesture: g, cancel: !!g?.own, step: 0 };
  const dir = dy > 0 ? 1 : -1;
  const size = Math.abs(dy);
  let next;
  if (!g || t - Math.max(g.last, g.seen ?? g.last) > QUIET_MS || dir !== g.dir) {
    const own = !!claim(dir);
    // Begun while a step still glides: more of the same push, swallowed whole (never a queued step).
    const spent = own && t < busyUntil;
    next = { dir, last: t, seen: h, sum: 0, peak: 0, own, done: spent, active: 0 };
  } else {
    next = { ...g, active: g.active + Math.min(ACTIVE_GAP_MS, Math.max(0, t - g.last)) };
  }
  next.last = Math.max(next.last, t);
  next.seen = Math.max(next.seen ?? h, h);
  if (!next.own) return { gesture: next, cancel: false, step: 0 };
  next.sum += size;
  next.peak = Math.max(next.peak, size);
  if (!next.done) {
    if (t >= busyUntil && next.sum >= WHEEL_MIN) {
      next.done = true;
      next.active = 0;
      return { gesture: next, cancel: true, step: dir };
    }
    return { gesture: next, cancel: true, step: 0 };
  }
  // A long stream still pushing hard is a new push, not an inertia tail.
  if (t >= busyUntil && next.active >= RESTEP_MS && size >= next.peak * RESTEP_SHARE) {
    if (claim(dir)) {
      next.active = 0;
      next.peak = size;
      return { gesture: next, cancel: true, step: dir };
    }
    // Nothing left that way: the rest of the stream belongs to the page.
    next.own = false;
    return { gesture: next, cancel: false, step: 0 };
  }
  return { gesture: next, cancel: true, step: 0 };
}

// Touch: one finger from down to up is one gesture. start(y, t), then move(y, x, t) and end(y, t).
// Returns, like wheelStep, { gesture, cancel, step }. The direction is read once the finger has moved 6px;
// a mostly sideways move is never the story's (a slide row may swipe).
export function touchStart({ x, y, t }) {
  return { x, y, t, dir: 0, decided: false, own: false, done: false };
}
export function touchMove(g, { x, y, t }, { claim, busyUntil = 0 }) {
  if (!g) return { gesture: g, cancel: false, step: 0 };
  const dx = g.x - x;
  const dy = g.y - y;
  const next = { ...g };
  if (!next.decided) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return { gesture: next, cancel: false, step: 0, waiting: true };
    next.decided = true;
    next.dir = dy > 0 ? 1 : -1;
    next.own = Math.abs(dy) >= Math.abs(dx) && !!claim(next.dir);
    next.done = next.own && next.t < busyUntil;
  }
  if (!next.own) return { gesture: next, cancel: false, step: 0 };
  if (!next.done && t >= busyUntil && dy * next.dir >= SWIPE_MIN) {
    next.done = true;
    return { gesture: next, cancel: true, step: next.dir };
  }
  return { gesture: next, cancel: true, step: 0 };
}
export function touchEnd(g, { x, y, t }, { claim = () => false, busyUntil = 0 } = {}) {
  if (!g) return { gesture: g, step: 0 };
  const dy = g.y - y;
  if (!g.decided) {
    // No move reached the page (the browser coalesced the whole swipe into its end): the end decides once.
    const dx = x === undefined ? 0 : g.x - x;
    if (Math.abs(dy) < FLICK_MIN || Math.abs(dx) > Math.abs(dy)) return { gesture: g, step: 0 };
    const dir = dy > 0 ? 1 : -1;
    if (t < busyUntil || !claim(dir)) return { gesture: g, step: 0 };
    return { gesture: { ...g, decided: true, dir, own: true, done: true }, step: dir };
  }
  if (!g.own || g.done) return { gesture: g, step: 0 };
  // A quick flick shorter than a swipe still counts once.
  if (t >= busyUntil && dy * g.dir >= FLICK_MIN && t - g.t < FLICK_MS) return { gesture: { ...g, done: true }, step: g.dir };
  return { gesture: g, step: 0 };
}

// Replays a list of wheel events against a story of `steps` steps resting on `from`, as ScrollStory does
// (claim: the story has a step that way; each step glides for STEP_MS). Returns the step it ends on and how many
// events reached the page. Used by the tests and the browser harness.
export function replayWheel(events, { steps, from = 0, holding = () => true }) {
  let at = from;
  let busyUntil = 0;
  let gesture = null;
  let passed = 0;
  const moves = [];
  for (const event of events) {
    const claim = (dir) => holding() && (event.t < busyUntil || (dir > 0 ? at < steps - 1 : at > 0));
    const out = wheelStep(gesture, event, { claim, busyUntil });
    gesture = out.gesture;
    if (!out.cancel) passed += 1;
    if (out.step) {
      const n = at + out.step;
      if (n >= 0 && n < steps) { at = n; busyUntil = event.t + STEP_MS; moves.push(n); }
    }
  }
  return { step: at, passed, moves };
}
