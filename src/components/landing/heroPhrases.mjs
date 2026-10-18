// The hero headline's changing third line (L-016, D38, 18 Oct 2026): "CUET 2027. / One mock. / <phrase>".
// Pure, so node --test can hold the words and the timing (heroPhrases.test.mjs) and HeroMorph.jsx renders them.
//
// Every phrase is true and short enough to sit on ONE line of the headline at 320 px and up, at the hero's size
// (the widest, "Every mark traced.", is 8.7 em; the copy column holds 9 em on a phone and 8.8 em on a desktop).
// Where each one is true:
//   "No more guessing."  the copy deck's line 3 (docs/design-decisions/landing-copy-bolder-1018.md); the lead under
//                        it says what replaces the guessing: a timed mock and where every mark went.
//   "Every mark traced." the Mistake Lab ledger sorts every missed mark into one group (labStory.mjs marksLedger)
//                        and its heading is the owner's praised "Every mark, traced back to a moment."
//   "Know what to fix."  chapter review names the chapter to fix first, and the free SWOT gives the sets to do next
//                        (data/mock_swot.js).
//   "Fresh every time."  every mock is built fresh from one live bank (practiceSessions.js builds the paper at
//                        start; QuestionBankLine, ONBOARDING_LEAD). It says fresh, never "never repeats".

export const HERO_LINES = Object.freeze(['CUET 2027.', 'One mock.']);
export const HERO_PHRASES = Object.freeze(['No more guessing.', 'Every mark traced.', 'Know what to fix.', 'Fresh every time.']);
// What a screen reader and a search engine read: the headline with its first phrase, never the cycle.
export const HERO_SENTENCE = [...HERO_LINES, HERO_PHRASES[0]].join(' ');

// The motion, per letter: the old letter rises 0.35 em and fades (gone by 60% of OUT_MS, so it has left before the
// new letter under it shows), the new one rises in from 0.35 em below. A letter's change takes CHANGE_MS (out starts
// at 0, in starts at IN_DELAY_MS and ends at CHANGE_MS); the letters follow each other STAGGER_MS apart. Each phrase holds HOLD_MS once its last letter lands; the first
// change waits FIRST_MS so Mobi has landed and waved and the reader has read the line once.
export const MORPH = Object.freeze({
  STAGGER_MS: 20,
  OUT_MS: 240,
  IN_DELAY_MS: 120,
  IN_MS: 360,
  CHANGE_MS: 480,
  HOLD_MS: 2600,
  FIRST_MS: 3600,
  RISE_EM: 0.35,
  EASE: 'cubic-bezier(0.23, 1, 0.32, 1)',
});

/** The letters of a phrase, grouped into words so a narrow window (200% zoom) can still wrap at a space. Each
 * letter carries its index in the whole phrase (spaces count), which sets its place in the stagger. */
export function phraseWords(phrase) {
  const words = [];
  let i = 0;
  for (const word of String(phrase).split(' ')) {
    words.push(Array.from(word).map((ch) => ({ ch, i: i++ })));
    i++; // the space
  }
  return words;
}

/** How long a whole change takes on screen, from the first old letter leaving to the last new letter landing. */
export function changeSpanMs(from, to) {
  const last = Math.max(String(from).length, String(to).length) - 1;
  return last * MORPH.STAGGER_MS + MORPH.CHANGE_MS;
}

export const nextPhrase = (index, count = HERO_PHRASES.length) => (index + 1) % count;

/** Whether the line may change at all right now. Reduce motion (the system's or MockMob's own) keeps the first
 * phrase, still; so does a hidden tab or a hero that has scrolled out of view (the cycle pauses there). */
export function mayMorph({ reduced = false, hidden = false, inView = true, count = HERO_PHRASES.length } = {}) {
  return !reduced && !hidden && inView && count > 1;
}

// ================================================================================================================
// OPTION C, "select and type" (G30; D112 C-pick 3, 19 Oct 2026; docs/design-decisions/pass-1019/HERO-MOTION-1019.md).
// Built behind a flag (D115): the live hero above (HeroMorph, MORPH) stays exactly as it is until the owner has seen
// option C live. HeroType.jsx renders it, hero-motion.css holds its keyframes, and HeroLine.jsx picks between the two.
//
// The old line is selected from its end back to its start (as Shift+Home does), held a beat, then replaced by the new
// line typed at a natural rhythm behind a solid brand-colour caret that blinks twice and leaves. Nothing glows and
// nothing loops (L-016, L-019). It runs only once the first screen has settled, and it pauses while the page moves.
// ================================================================================================================

// The phrases option C types. Each is persuasive, specific, true and grammatical (R6), and each sits on one line at
// every width. Measured at the hero's own face, weight and tracking on 19 Oct: the copy column holds 8.85 em on a
// desktop and 9.09 em on a phone; the widest phrase below is 8.66 em, under the live set's widest ("Every mark
// traced.", 8.69 em), so the headline keeps its size and its height.
//   "No more guessing."   unchanged: the copy deck's line 3, the sentence screen readers and search read, and the
//                         one still line under Reduce motion.
//   "See the lost marks." replaces "Every mark traced." (a clipped participle, R6). It is the page's own promise in a
//                         student's words ("Your lost marks went somewhere. MockMob shows you where", Mobi's "Let's
//                         find the lost marks.") and what the result shows ("You missed N marks. Here's where they
//                         went.", labStory.mjs marksLedger).
//   "Know what to fix."   unchanged: chapter review names the chapter to fix first; the free SWOT gives the sets next.
//   "Fresh every time."   unchanged: every mock is built fresh from one live bank (the USP, said truthfully: fresh,
//                         never "never repeats").
export const HERO_PHRASES_V2 = Object.freeze(['No more guessing.', 'See the lost marks.', 'Know what to fix.', 'Fresh every time.']);

// The timing rule (C-pick 3). Settled = the web fonts are ready AND the hero's entrance is done AND nothing has moved
// the page for QUIET_MS AND the line is fully on screen AND the tab is visible. The first change comes READ_MS after
// that, and each line holds HOLD_MS once it lands. Any scroll, wheel, touch or scroll key pauses the cycle (a change
// already under way finishes); coming back on screen, or back to the tab, owes READ_MS again.
export const RULE = Object.freeze({
  ENTRANCE_MS: 1000, // the hero's own entrance: the last data-hero rise ends about 960 ms after first paint
  QUIET_MS: 1200,    // no scroll input for this long = the page has settled (page load counts as movement)
  READ_MS: 1800,     // once settled, the student reads the current line once more before it changes
  HOLD_MS: 3000,     // each line holds this long after it lands
});

// One change, in ms from its start. The selection grows from the line's end to its start on out-quart, holds a beat,
// and goes with the old line at the first keystroke; then each letter fades in over FADE_MS at a human rhythm.
export const TYPE = Object.freeze({
  SELECT_MS: 320,
  SELECT_EASE: 'cubic-bezier(0.25, 1, 0.5, 1)',
  BEAT_MS: 200,
  LETTER_MS: 46,
  JITTER: Object.freeze([0, 9, -6, 12, -3, 5, -8, 10, -4, 7, -5, 3]), // fixed, so every visit types the same way
  SPACE_MS: 38, // after a space
  STOP_MS: 110, // before the full stop
  FADE_MS: 70,
  CARET_IN_MS: 100,
  BLINK_AFTER_MS: 420, // after the last letter lands
  BLINK_MS: Object.freeze([400, 500, 400, 160]), // off, on, off, on: two blinks
  CARET_OUT_MS: 240, // then it fades away, inside the hold
  LAND_FALLBACK_MS: 1500, // a browser that never ends the last letter's animation still lands
});

/** When each letter of a phrase appears (ms from the change's start), when the old line is replaced, when the new line
 * has landed, when the caret starts blinking and when it has gone. A space counts as a keystroke. */
export function typingSchedule(phrase) {
  const chars = Array.from(String(phrase));
  const replaceAt = TYPE.SELECT_MS + TYPE.BEAT_MS;
  const times = [];
  let t = replaceAt;
  chars.forEach((ch, k) => {
    if (k > 0) {
      t += TYPE.LETTER_MS + TYPE.JITTER[k % TYPE.JITTER.length];
      if (chars[k - 1] === ' ') t += TYPE.SPACE_MS;
      if (k === chars.length - 1 && /[.!?]/.test(ch)) t += TYPE.STOP_MS;
    }
    times.push(t);
  });
  const land = (times.length ? times[times.length - 1] : replaceAt) + TYPE.FADE_MS;
  const blinkAt = land + TYPE.BLINK_AFTER_MS;
  const caretEnd = blinkAt + TYPE.BLINK_MS.reduce((a, b) => a + b, 0) + TYPE.CARET_OUT_MS;
  return Object.freeze({ replaceAt, times: Object.freeze(times), land, blinkAt, caretEnd });
}

/** The caret's keyframes for one change. It fades in at the line's start (its wrapper rides the selection's left
 * edge), jumps to the right of each letter as it lands, blinks twice and fades out. `edges` holds each letter's right
 * edge (x, px from the line's left) and its line offset (y, px), measured after layout. Each jump is instant: a pair of
 * keyframes half a millisecond apart, under linear easing. Returns { keyframes, duration }. */
export function caretKeyframes(schedule, edges) {
  const { replaceAt, times, blinkAt, caretEnd: duration } = schedule;
  const keyframes = [];
  const at = (ms) => Math.min(1, Math.max(0, ms / duration));
  const push = (ms, p, opacity) => keyframes.push({ offset: at(ms), transform: `translate(${p.x}px, ${p.y}px)`, opacity });
  const home = { x: 0, y: 0 };
  const after = (k) => (k < 0 || !edges[k] ? home : { x: Math.round((edges[k].x + 1) * 100) / 100, y: Math.round((edges[k].y || 0) * 100) / 100 });
  push(0, home, 0);
  push(TYPE.CARET_IN_MS, home, 1);
  push(replaceAt - 1, home, 1);
  times.forEach((ms, k) => { push(ms - 0.5, after(k - 1), 1); push(ms, after(k), 1); });
  const end = after(times.length - 1);
  const [off1, on1, off2, on2] = TYPE.BLINK_MS;
  let t = blinkAt;
  push(t, end, 1); push(t + 1, end, 0);
  t += off1; push(t, end, 0); push(t + 1, end, 1);
  t += on1; push(t, end, 1); push(t + 1, end, 0);
  t += off2; push(t, end, 0); push(t + 1, end, 1);
  t += on2; push(t, end, 1);
  push(duration, end, 0);
  return { keyframes, duration };
}

/** How many changes one visit makes: one lap through the set and back to the line it started on, where it rests for
 * good (CTO addition, WCAG 2.2.2: it never loops forever). The resting line is "No more guessing.", the sentence screen
 * readers, search and Reduce motion get, so what is seen at rest and what is read always agree. */
export const cycleChanges = (count) => (count > 1 ? count : 0);

/**
 * The settle-and-pause controller. It is pure: the clock and the timers are passed in, so node --test drives it with
 * fake timers. The component reports what the page is doing; the controller calls onChange({ from, to, n }) when a
 * change starts and onLand({ index, n }) when it lands. The component reports each landing with landed() (from the
 * last letter's animationend); given `landMs(from, to)`, the controller lands by itself after that long (tests).
 */
export function createHeroCycle({
  count,
  onChange = () => {},
  onLand = () => {},
  onReset = () => {},
  landMs = null,
  now = () => performance.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  rule = RULE,
} = {}) {
  const total = cycleChanges(count);
  let t0 = 0; // first paint (0 = not yet)
  let lastInput = 0; // the last scroll input
  let backAt = 0; // the line came back on screen, or the tab came back
  let fontsAt = 0; // the web fonts arrived
  let needRead = true;
  let landedAt = 0;
  let fontsReady = false;
  let inView = false;
  let hidden = false;
  let reduced = false;
  let flight = null;
  let timer = null;
  let nextAt = 0;
  let index = 0;
  let changes = 0;
  let state = 'loading';
  let disposed = false;

  const settleAt = () => Math.max(t0 + rule.ENTRANCE_MS, lastInput + rule.QUIET_MS, backAt, fontsAt);
  const stop = () => { if (timer != null) clearTimer(timer); timer = null; nextAt = 0; };

  function arm() {
    stop();
    if (disposed) return;
    if (total === 0) { state = 'still'; return; }
    if (reduced) { state = 'reduced'; return; }
    if (flight) { state = 'changing'; return; }
    if (changes >= total) { state = 'rest'; return; }
    if (!fontsReady || !t0) { state = 'loading'; return; }
    if (hidden) { state = 'hidden'; return; }
    if (!inView) { state = 'away'; return; }
    const s = settleAt();
    // A line always gets its full hold after it lands; after any movement it also gets READ once the page is still.
    nextAt = Math.max(needRead ? s + rule.READ_MS : s, landedAt ? landedAt + rule.HOLD_MS : 0);
    const t = now();
    state = t < s ? (lastInput > t0 ? 'scrolling' : 'settling') : needRead ? 'reading' : 'holding';
    timer = setTimer(fire, Math.max(0, nextAt - t));
  }

  function fire() {
    timer = null;
    if (disposed) return;
    if (flight || reduced || hidden || !inView || changes >= total || now() < settleAt()) { arm(); return; }
    const from = index;
    const to = (index + 1) % count;
    changes += 1;
    flight = { from, to, n: changes, startedAt: now(), timer: null };
    state = 'changing';
    if (landMs) flight.timer = setTimer(landed, landMs(from, to));
    onChange({ from, to, n: changes });
  }

  function landed() {
    if (!flight || disposed) return;
    const f = flight;
    flight = null;
    if (f.timer != null) clearTimer(f.timer);
    index = f.to;
    landedAt = now();
    // A scroll during the change keeps READ owed: the next change waits for stillness, then reading time.
    if (lastInput < f.startedAt && backAt < f.startedAt) needRead = false;
    onLand({ index, n: f.n });
    arm();
  }

  return {
    /** A scroll, wheel, touch or scroll key. */
    input() { lastInput = now(); needRead = true; if (!flight) arm(); },
    /** First paint: the latest report wins (two frames after mount; the browser's first-contentful-paint). */
    painted(t = now()) { if (t > t0) { t0 = t; if (lastInput < t0) lastInput = t0; if (!flight) arm(); } },
    fontsReady() { if (fontsReady) return; fontsReady = true; fontsAt = now(); if (!flight) arm(); },
    setInView(v) { v = !!v; if (v === inView) return; inView = v; if (v) { backAt = now(); needRead = true; } if (!flight) arm(); },
    setHidden(h) { h = !!h; if (h === hidden) return; hidden = h; if (!h) { backAt = now(); needRead = true; } if (!flight) arm(); },
    setReduced(r) {
      r = !!r;
      if (r === reduced) return;
      reduced = r;
      if (r) {
        // Reduce motion mid-change: the change stops where it is and the line goes back to the first phrase, still.
        if (flight?.timer != null) clearTimer(flight.timer);
        const moved = !!flight || index !== 0;
        flight = null;
        index = 0;
        if (moved) onReset({ index: 0 });
      }
      arm();
    },
    landed,
    dispose() { disposed = true; stop(); if (flight?.timer != null) clearTimer(flight.timer); flight = null; },
    snapshot: () => ({ state, index, changes, total, nextAt, changing: !!flight }),
  };
}

/** Which hero line the page mounts (D115: option C ships OFF, and the owner sees it LIVE on the production site
 *  through the preview link ?hero=v2 before it is switched on for everyone).
 *  'preview' the default on every build, production included. Everyone gets the released line (HeroMorph), served
 *            byte for byte as before; only an address carrying ?hero=v2 swaps in option C after hydration, and only
 *            then is option C's code downloaded (HeroLine.jsx).
 *  'v2'      option C for everyone, served with the page: HERO_MOTION_V2=1, or HERO_MOTION_V2_DEFAULT = true below.
 *            This is the switch to flip after his OK.
 *  'v1'      the released line with the preview link turned off as well: HERO_MOTION_V2=0. */
export const HERO_MOTION_V2_DEFAULT = false;
export function heroMotionMode(env = {}) {
  const flag = String(env.HERO_MOTION_V2 ?? '').trim().toLowerCase();
  if (['1', 'true', 'on'].includes(flag)) return 'v2';
  if (['0', 'false', 'off'].includes(flag)) return 'v1';
  return HERO_MOTION_V2_DEFAULT ? 'v2' : 'preview';
}

/** Whether an address asks for option C: exactly ?hero=v2. */
export function asksForHeroV2(search = '') {
  try { return new URLSearchParams(search).get('hero') === 'v2'; } catch { return false; }
}
