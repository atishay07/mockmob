"use client";

// "What if my score were ...": a ladder of published DU cutoffs controlled by the visitor (R19, 18 Nov 2026: one card, the
// answer "n of m cleared" under the score, the colleges as a two-state list with pen ticks).
// Every number is a minimum allocation score printed
// in DU's own round lists (CSAS UG 2026-27). It states a gap to a past cutoff and nothing else:
// no admission chance, no prediction, no conversion of practice marks into a CUET score.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Doodle from '@/components/doodle/Doodle';
import { Play, Pause } from 'lucide-react';

const AXIS_MIN = 0;
const AXIS_MAX = 1000;
const pct = (v) => Math.min(100, Math.max(0, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));
const ROUND_LABEL = { 'round-1': 'Round 1', 'round-2': 'Round 2', 'round-3': 'Round 3' };
// The tour eases back and forth across the band where the list's cutoffs sit (bandOf). 23 Nov 2026 (LK427): it swept 600 to
// 960 for every list, so on the first list (lowest cutoff 793.5) every row read "Short by ..." and the count "0 of 10
// cleared" for half of each round. Its lowest score is now the lowest listed cutoff rounded up to a step (one college
// cleared), its highest a little past the highest (all cleared). A list with no cutoff keeps the old band.
const SWEEP_FALLBACK = Object.freeze({ low: 600, high: 960 });
const SWEEP_PAST = 20;
const SWEEP_MIN_SPAN = 60;
const SWEEP_PERIOD_MS = 11000;
// The tour moves in steps of 10 points: at most about 10 steps a second at the middle of the sweep, fewer at its ends
// (fix-misc, 21 Nov 2026, evening: a step costs a phone's main thread about 30 ms of style, layout and paint at CPU 6x, and
// 5-point steps came up to 20 times a second). The quick scores (650, 800, 950) and the band's ends are on the grid.
const SWEEP_STEP = 10;
// After the reader takes the score (the slider or a quick score), the tour waits this long after their last touch, then goes
// on from their score. Only the Pause key stops it until Play.
const READER_HOLD_MS = 8000;
// One formatter, kept: the ladder formats every row on each step of the sweep.
const ONE_DECIMAL = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (n) => ONE_DECIMAL.format(n);

// Where the card stands before the tour first plays: inside the first list's band, so a few colleges are cleared (was 780,
// under every cutoff of that list).
const INITIAL_SCORE = 860;
// The clock, read only from the reader's own events (take, hold) and the tour's effect, never while rendering.
const now = () => performance.now();
// The reader's motion setting: the system's, or the site's own (html[data-motion='reduced']).
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const motionReduced = () => window.matchMedia(REDUCED_QUERY).matches || document.documentElement.dataset.motion === 'reduced';
const PRESETS = [650, 800, 950];
// A college's words for a score: the one rule, used by the render and by the tour's direct writes.
const gapFor = (cutoff, value) => (cutoff === null ? 'Not listed' : value >= cutoff ? (value === cutoff ? 'At cutoff' : fmt(cutoff)) : `Short by ${fmt(cutoff - value)}`);
// The tour's score at a phase of the sweep: a cosine ping-pong, so it slows at each end instead of bouncing.
const sweepAt = (phase, band) => band.low + ((band.high - band.low) * (1 - Math.cos(phase * 2 * Math.PI))) / 2;
/** The band the tour sweeps for a list of cutoffs (null where a college lists none). */
export function bandOf(cutoffs) {
  const listed = cutoffs.filter((c) => c !== null && Number.isFinite(c));
  if (!listed.length) return SWEEP_FALLBACK;
  const up = (v) => Math.ceil(v / SWEEP_STEP) * SWEEP_STEP;
  const high = Math.min(AXIS_MAX, up(Math.max(...listed) + SWEEP_PAST));
  const low = Math.min(up(Math.min(...listed)), high - SWEEP_MIN_SPAN);
  return { low: Math.max(AXIS_MIN, low), high };
}
/** The sweep's phase that lands on a score in a band. */
const phaseOf = (value, band) => Math.acos(1 - 2 * Math.min(1, Math.max(0, (value - band.low) / (band.high - band.low)))) / (2 * Math.PI);
const scaleOf = (value) => `scaleX(${pct(value) / 100})`;

// The bars glide (owner LK366, 22 Nov 2026: "these bars used to be very smooth previously, and now they are a bit choppy").
// Since 21 Nov the digits and the words step in 10s for speed, and the bars stepped with them. Now the bars do not step:
// while the tour plays, every bar runs one Web Animation of the whole sweep (tourFrames, the same cosine sampled 96 times,
// linear between), so they move every frame on the compositor while the main thread only writes a step's words. The tour's
// clock is that animation's own time, so the digits and the bars never drift apart. When the reader takes the score, or the
// tour rests, the bars ease from where they are drawn to the new score in GLIDE_MS. Not a CSS transition: the steps come
// about 100 ms apart in the middle of the band and over 500 ms apart at its ends, so no one length joins them, and ten
// transitions a step sent about thirty transition events through React's root listener (fix-misc, 21 Nov 2026). A Web
// Animation fires no DOM event. Reduced motion: no tour and no glide; a bar is set at once.
const GLIDE_MS = 180;
const GLIDE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const tourFrames = (band) => Array.from({ length: 97 }, (_, k) => ({ offset: k / 96, transform: scaleOf(sweepAt(k / 96, band)) }));
const barsOf = (root) => (root ? [...root.querySelectorAll('.cl__track u')] : []);
function makeGlide(initial) {
  let anims = [];
  let mode = 'still';
  let from = initial;
  let to = initial;
  let band = SWEEP_FALLBACK;
  const clock = () => (mode === 'tour' && anims[0]?.currentTime != null ? anims[0] : null);
  // The score the bars are drawn at now, from the running animation's own time (no style or layout read).
  const drawn = () => {
    const tour = clock();
    if (tour) return sweepAt((Number(tour.currentTime) / SWEEP_PERIOD_MS) % 1, band);
    const progress = mode === 'ease' ? anims[0]?.effect?.getComputedTiming().progress : null;
    return progress == null ? to : from + (to - from) * progress;
  };
  const stop = () => { anims.forEach((a) => a.cancel()); anims = []; };
  return {
    clock,
    touring: () => mode === 'tour',
    // The whole sweep from `phase` on, round and round; each bar's own --fill stays under it for when it stops.
    tour(root, phase, sweep) {
      stop();
      mode = 'tour';
      band = sweep;
      const frames = tourFrames(sweep);
      anims = barsOf(root).map((u) => {
        const a = u.animate(frames, { duration: SWEEP_PERIOD_MS, iterations: Infinity });
        a.currentTime = phase * SWEEP_PERIOD_MS;
        return a;
      });
    },
    // From where the bars are drawn to `value` (already written to each bar's --fill), with a short ease-out.
    ease(root, value, still) {
      from = drawn();
      stop();
      mode = 'ease';
      to = value;
      if (still || Math.abs(from - to) < 0.05) return;
      anims = barsOf(root).map((u) => u.animate([{ transform: scaleOf(from) }, { transform: scaleOf(to) }], { duration: GLIDE_MS, easing: GLIDE_EASE }));
    },
    stop,
  };
}
// Each bar's own fill (--fill on the bar): what it shows when no animation runs.
function paintBars(root, value) {
  const fill = String(pct(value) / 100);
  barsOf(root).forEach((u) => u.style.setProperty('--fill', fill));
}

// Writes a score straight into the boxes React drew (the tour's steps, and the reader's own takes so both stay one truth):
// the digits' and each college's text node (nodeValue on the node React keeps, so React's own later updates still land),
// the slider's value and its fill (--p on the slider itself), which quick score is pressed, and, unless the tour's glide
// draws them, each bar's fill (--fill on the bar itself). Measured on a
// phone at CPU 6x (tmp/1121-stories/fix-misc/costs.mjs): about 7 ms of style and layout a step, where --fill set on the
// list restyled its 112 children for about 25 ms. Words and paint only, inside boxes of fixed size in a contained card.
function paintScore(root, rows, value, bars = true) {
  if (!root) return;
  const digits = String(value);
  const num = root.querySelector('.cl__num');
  if (num?.firstChild) { num.firstChild.nodeValue = digits; num.dataset.digits = String(digits.length); }
  const input = root.querySelector('#cl-score');
  if (input) { input.value = digits; input.style.setProperty('--p', `${pct(value)}%`); input.setAttribute('aria-valuetext', `${digits} out of 1000`); }
  root.querySelectorAll('.cl__presets button').forEach((button, i) => {
    const on = String(PRESETS[i] === value);
    if (button.getAttribute('aria-pressed') !== on) button.setAttribute('aria-pressed', on);
  });
  const fill = String(pct(value) / 100);
  root.querySelectorAll('.cl__list > li').forEach((li, i) => {
    if (bars) li.querySelector('.cl__track u')?.style.setProperty('--fill', fill);
    const cutoff = rows[i]?.cutoff ?? null;
    const words = li.querySelector('.cl__gap')?.firstChild;
    if (cutoff !== null && words) words.nodeValue = gapFor(cutoff, value);
  });
}

/** One college. Re-renders only when its state flips (cleared or short) or the picks give it another cutoff. Its gap's
 * words follow the score without React: every change of the score is written by paintScore before React hears of it, so
 * a render skipped for the gap alone leaves the right words on screen, and the next render that does run writes the same. */
const LadderRow = memo(function LadderRow({ college, women, cutoff, state, gap }) {
  return (
    <li data-state={state}>
      <span className="cl__mark" aria-hidden="true">{state === 'none' ? null : <Doodle mark="tick" tone="brand" when={state === 'clear'} className="cl__tick" />}</span>
      <span className="cl__name">{college}{women ? <i> (W)</i> : null}</span>
      {/* The spoken ", cutoff cleared" is always there and only its words change: adding and removing an element as a row
          flips set off the page's whole-document watchers (MobileDock's MutationObserver re-scans main on any child change). */}
      <span className="cl__gap">{gap}<span className="lp-sr">{state === 'clear' ? ', cutoff cleared' : ' '}</span></span>
      <span className="cl__track" aria-hidden="true">
        <u />
        {state === 'none' ? null : <b style={{ left: `${pct(cutoff)}%` }} />}
      </span>
    </li>
  );
}, (was, now) => was.college === now.college && was.women === now.women && was.cutoff === now.cutoff && was.state === now.state);

// The two ways on: one element made once, so the tour's renders never walk the links.
const CTA = (
  <div className="cl__cta">
    <Link href="/cuet-cutoff-calculator" prefetch={false} className="mm-btn mm-btn--primary">Check my subjects</Link>
    <Link href="/admission-compass" prefetch={false} className="lp-link">Open Compass</Link>
  </div>
);

export default function CompassLadder({ data }) {
  const rootRef = useRef(null);
  const [programme, setProgramme] = useState(0);
  const [category, setCategory] = useState('UR');
  const [round, setRound] = useState('round-1');
  const [score, setScore] = useState(INITIAL_SCORE);
  // Phones show every other college (five across the list's range) until the reader asks for all (26 Nov 2026).
  const [all, setAll] = useState(false);
  // Changes only when the reader presses the Pause / Play key (owner LK365, 21 Nov 2026: "It should never be paused. The
  // pause button just exists. If someone clicks it explicitly ..."). Nothing else ever sets it.
  const [paused, setPaused] = useState(false);
  // The sweep's phase; null until the tour first starts, when it is read from the score on screen in the list's own band.
  const phaseRef = useRef(null);
  const bandRef = useRef(SWEEP_FALLBACK);
  const [inView, setInView] = useState(false);
  const [shown, setShown] = useState(true);
  const [reduced, setReduced] = useState(false);
  // When the reader last took the score (performance.now()); the tour rests until READER_HOLD_MS after it.
  const [heldAt, setHeldAt] = useState(0);
  // The score on screen. Between the renders the tour asks for, it writes the score's own words and paint straight into the
  // card (see the tour), so this, not `score`, is what the reader sees while it plays.
  const liveRef = useRef(INITIAL_SCORE);
  // The bars' glide (see makeGlide): one per card, made once.
  const [glide] = useState(() => makeGlide(INITIAL_SCORE));

  useEffect(() => {
    const query = window.matchMedia(REDUCED_QUERY);
    const sync = () => setReduced(motionReduced());
    sync();
    query.addEventListener('change', sync);
    window.addEventListener('mm-prefs', sync);
    return () => { query.removeEventListener('change', sync); window.removeEventListener('mm-prefs', sync); };
  }, []);
  useEffect(() => {
    const node = rootRef.current;
    const sync = () => setShown(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    if (!node || typeof IntersectionObserver === 'undefined') { setInView(true); return () => document.removeEventListener('visibilitychange', sync); }
    // Any part of the card in the window counts: the tour rests only while the card is wholly out of it.
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    observer.observe(node);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  // Plays by itself, round and round: an eased, time-based sweep (cosine ping-pong, so it slows at each end instead of
  // bouncing) across the band where the showcased cutoffs sit. Owner LK365 (21 Nov 2026) replaces LK322's "once through,
  // then pause" and the scroll wait of lane compass-gap (21 Nov): the tour plays whenever any of the card is in the window,
  // keeps playing while the page scrolls, and never stops by itself. It rests, silently and with the key still saying Pause,
  // only while the card is wholly out of the window or the tab is hidden, and carries on by itself from where it was when
  // the card is back. The reader taking the score (the slider, a quick score) holds it for READER_HOLD_MS after their last
  // touch; then it goes on from their score. Only the key stops it, and that stop holds until the reader presses Play.
  // Filters can change while it plays. Reduced motion: no tour and no key; the ladder is worked by hand.
  // Speed (critic, 21 Nov 2026, evening: with a React render for every 5-point step, about one frame in three took over
  // 50 ms on a phone at CPU 6x while the card was in view, scrolling or parked). Each step now writes its words and paint
  // straight into the card (paintScore), and React renders only when the ladder's state flips: a college turns cleared or
  // short (the "n of m" count changes; its pen tick is React's). When the tour rests, React's score is set to the one on
  // screen. Measured with tmp/1121-stories/fix-misc/park.mjs and compass.mjs (results in the lane's notes.txt).
  const rows = useMemo(() => {
    const listed = data.programmes[programme].rows.map((r) => ({ ...r, cutoff: r.cutoffs[round]?.[category] ?? null }));
    return [...listed.filter((r) => r.cutoff !== null).sort((a, b) => b.cutoff - a.cutoff), ...listed.filter((r) => r.cutoff === null)];
  }, [data, programme, round, category]);
  // New rows (another course, round or category) start with their bars at the score on screen, before they are drawn.
  useLayoutEffect(() => { paintBars(rootRef.current, liveRef.current); }, [rows]);
  useEffect(() => {
    // motionReduced() too: on a reload with the card in view, the window's own setting can reach this effect before the
    // `reduced` state does (lane compass, 22 Nov 2026: one step of the tour ran under reduced motion).
    if (paused || !inView || !shown || reduced || motionReduced()) return undefined;
    const root = rootRef.current;
    const cutoffs = rows.map((r) => r.cutoff);
    const band = bandOf(cutoffs);
    // The tour goes on from the score on screen: a first start, and a list whose band differs (another course, round or
    // category), find their place in the band; a resume keeps the phase it was left at.
    if (phaseRef.current === null || bandRef.current.low !== band.low || bandRef.current.high !== band.high) phaseRef.current = phaseOf(liveRef.current, band);
    bandRef.current = band;
    const flipKey = (value) => cutoffs.filter((c) => c !== null && value >= c).length;
    let frame = 0;
    let last = 0;
    let stepShown = null;
    // The first step after a (re)start goes through React too, so React's score and the screen agree from there on.
    let keyShown = null;
    const tick = (now) => {
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      // The bars' animation is the clock, so the digits step exactly where the gliding bars are.
      const clock = glide.clock();
      phaseRef.current = clock ? (Number(clock.currentTime) / SWEEP_PERIOD_MS) % 1 : (phaseRef.current + dt / SWEEP_PERIOD_MS) % 1;
      // Steps of SWEEP_STEP points for the words, never a step a frame (round 13, audit F10); the bars glide between them.
      const next = Math.round(sweepAt(phaseRef.current, band) / SWEEP_STEP) * SWEEP_STEP;
      if (next !== stepShown) {
        stepShown = next;
        liveRef.current = next;
        paintScore(root, rows, next, false);
        const key = flipKey(next);
        if (key !== keyShown) { keyShown = key; setScore(next); }
      }
      frame = window.requestAnimationFrame(tick);
    };
    const wait = heldAt ? heldAt + READER_HOLD_MS - now() : 0;
    const start = window.setTimeout(() => { glide.tour(root, phaseRef.current, band); frame = window.requestAnimationFrame(tick); }, Math.max(0, wait));
    return () => {
      window.clearTimeout(start);
      window.cancelAnimationFrame(frame);
      // The bars settle on the score on screen; a reader's take has already eased them to theirs.
      if (glide.touring()) { paintBars(root, liveRef.current); glide.ease(root, liveRef.current, false); }
      setScore(liveRef.current);
    };
  }, [paused, inView, shown, reduced, heldAt, rows, glide]);
  useEffect(() => () => glide.stop(), [glide]);

  // The sweep's phase that lands on a score, so the tour goes on from the reader's score rather than jumping.
  const phaseFrom = (value) => { phaseRef.current = phaseOf(value, bandRef.current); };
  const toggle = () => {
    if (paused) { phaseFrom(liveRef.current); setHeldAt(0); setPaused(false); } else setPaused(true);
  };
  // The reader takes the score: the tour holds (the key still says Pause) and later goes on from their score.
  const take = (value) => { phaseFrom(value); liveRef.current = value; paintScore(rootRef.current, rows, value); glide.ease(rootRef.current, value, reduced); setHeldAt(now()); setScore(value); };
  const touring = !paused && !reduced;
  const current = data.programmes[programme];
  const listed = rows.filter((r) => r.cutoff !== null);
  const cleared = listed.filter((r) => score >= r.cutoff).length;
  const digits = String(Math.round(score));
  // The picks do not depend on the score: one element kept between the tour's renders, so a flip does not walk them.
  const controls = useMemo(() => (
    <div className="cl__controls">
      <div className="cl__group cl__courses" role="group" aria-label="Course">
        {data.programmes.map((p, i) => (
          <button key={p.id} type="button" aria-pressed={programme === i} onClick={() => setProgramme(i)}>{p.label}</button>
        ))}
      </div>
      <div className="cl__row">
        <div className="cl__pick">
          <span className="cl__pick-label" aria-hidden="true">Category</span>
          <div className="cl__seg" role="group" aria-label="Category">
            {data.categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
        </div>
        <div className="cl__pick">
          <span className="cl__pick-label" aria-hidden="true">Round</span>
          <div className="cl__seg" role="group" aria-label="Round">
            {data.rounds.map((r) => <button key={r} type="button" aria-pressed={round === r} aria-label={ROUND_LABEL[r]} onClick={() => setRound(r)}>{ROUND_LABEL[r].replace('Round ', '')}</button>)}
          </div>
        </div>
      </div>
    </div>
  ), [data, programme, category, round]);

  return (
    <div className="cl" ref={rootRef}>
      {/* R19 (18 Nov 2026): one card that answers "which colleges would this score have cleared?" as the score moves. The
          picks on top (the course as one row that scrolls sideways, then category and round as two segmented controls on one
          line), the score as the card's largest figure with its slider, the answer under it, then the colleges as a two-state
          list: a cleared college carries a pen tick, drawn as it flips to cleared and gone at once when it flips back; the
          rest say how far short they are. */}
      <div className="cl__card">
        {controls}

        {/* --p, how far along the track the score sits (the track's fill reads it, r10-tools.css), is set on the group and
            inherited by the slider: an inline style on the input itself is rewritten by a screenshot tool that touches
            inputs before the page hydrates, and React then reports a hydration mismatch for it (10 Nov 2026). */}
        <div className="cl__score" style={{ '--p': `${pct(score)}%` }}>
          <div className="cl__score-top">
            <label htmlFor="cl-score">If your score were</label>
            {!reduced ? <button className="cl__demo" type="button" onClick={toggle}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{paused ? 'Play' : 'Pause'}<span className="lp-sr"> the score tour</span></button> : null}
          </div>
          <div className="cl__score-row">
            {/* The digits sit in a box as wide as their count (tabular figures), so a step of the tour never moves the
                denominator or anything else. */}
            <output htmlFor="cl-score" className="cl__big"><span className="cl__num" data-digits={digits.length}>{digits}</span><span className="cl__denominator"> / 1000</span></output>
            <div className="cl__group cl__group--small cl__presets" role="group" aria-label="Try a score">
              {PRESETS.map((value) => <button key={value} type="button" aria-pressed={score === value} onClick={() => take(value)}>{value}</button>)}
            </div>
          </div>
          <input id="cl-score" type="range" data-cursor="Drag" min={AXIS_MIN} max={AXIS_MAX} step={1} value={score} onChange={(event) => take(Number(event.target.value))} aria-describedby="cl-score-help" aria-valuetext={`${digits} out of 1000`} />
          <small id="cl-score-help">Drag the slider, or use the arrow keys.</small>
        </div>

        <figure className="cl__stage" aria-label={`${current.label} ${ROUND_LABEL[round]} cutoffs for ${category}`}>
          <p className="cl__answer" aria-live={touring ? 'off' : 'polite'}>
            {listed.length ? (
              <><b><Doodle mark="highlight" when={!touring} inkKey={!touring ? cleared : null}>{`${cleared} of ${listed.length}`}</Doodle></b> cleared</>
            ) : (
              <span className="cl__none">No {ROUND_LABEL[round]} {category} cutoff was published for these colleges in <b>{data.cycle}</b>. Try another round or category.</span>
            )}
          </p>
          <p className="cl__top"><span>{current.label}</span> <span className="cl__tag">{data.cycle}, {ROUND_LABEL[round]}, {category}</span></p>
          {/* --fill, how far along the axis the score sits (0 to 1): the list carries only the first score, for the page as
              the server sends it, and never changes (a change restyled the list's 112 children); each bar's own --fill
              (paintBars) and the glide's animations carry the score after that (compass-ladder.css reads it as a transform). */}
          <ul className="cl__list" data-all={all ? 'true' : 'false'} style={{ '--fill': pct(INITIAL_SCORE) / 100 }}>
            {rows.map((r) => {
              const none = r.cutoff === null;
              const clear = !none && score >= r.cutoff;
              return <LadderRow key={r.college} college={r.college} women={r.women} cutoff={r.cutoff} state={none ? 'none' : clear ? 'clear' : 'short'} gap={gapFor(r.cutoff, score)} />;
            })}
          </ul>
          {rows.length > 5 ? <button type="button" className="cl__all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? 'Show fewer colleges' : `Show all ${rows.length} colleges`}</button> : null}
          <figcaption>Closing scores from DU’s published round lists. (W) marks a women’s college.</figcaption>
        </figure>
      </div>
      {CTA}
    </div>
  );
}
