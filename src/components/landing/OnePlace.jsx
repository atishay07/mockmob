'use client';

// /home-next's one frame (owner LK363, 20 Nov 2026): "Your whole CUET prep, in one place." Three rows, one stage. Each stage
// IS the landing's own real component (the exam screen with its MockMob / NTA style switch, Key cards, Bring a mistake's
// card), and a demo cursor works it (demo/CursorDemo.jsx): it clicks the real controls, so the screen changes the way it
// does for a student. The scripts and the rules of the frame are in onePlaceModel.mjs; the words in onePlaceCopy.mjs.
//
// Layout (one-place.css): from 960 px the rows stand beside the stage; on a phone they are three chips above it, with the
// row's line under them. The three stages share one grid cell, so the frame is as tall as its tallest stage and never
// changes height between rows (nothing below it moves). Only the shown stage is live; the others are inert and hidden, and
// each is mounted fresh (a new React key) before it plays again, so every demo begins from the component's start state.
//
// Load weight (21 Nov 2026): OnePlaceGate.jsx loads this file only as the frame nears the window and passes `drawn`, the
// stages as the server drew them. Then only the shown row's stage is a live component; the others stay that markup (same
// size, so the frame never changes height) until the next row's stage is made live in idle time shortly before its turn, or
// at once on a tap (stagesStart / stagesStep in onePlaceModel.mjs).
//
// Speed (AGENT-COMMON.md, 20 Nov rules): no frame loop, no interval. One IntersectionObserver, the visibility event, the
// motion setting. The row's line is one CSS transform animation as long as the script; the cursor moves by a CSS transition.
// The only timer here is the 8 s hold after a reader takes over.
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, RotateCw } from 'lucide-react';
import CursorDemo from './demo/CursorDemo';
import { ExamStage } from './ExamScreen';
import KeyCardsDemo from './KeyCardsDemo';
import { BringMistakeCard, BringMistakeValue } from './BringMistakeBlock';
import { STRIP_OBJECT_BOX, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { ONE_PLACE, bankLine, tourRows } from './onePlaceCopy.mjs';
import { EXAM } from './homeCopy.mjs';
import Link from 'next/link';
import { DEAL_MS, ROW_OF_HASH, SCRIPTS, STAGE_LEAD_MS, TAKEOVER_HOLD_MS, TRIGGER_LINE, afterRow, autoplayRuns, keyStep, leaveStartsHold, motionReduced, runStep, scriptMs, stagesStart, stagesStep } from './onePlaceModel.mjs';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';
import { BrandIcon } from '@/components/brand/BrandIcon';
import './one-place.css';

function useOnePlace(rowIds, drawn) {
  const count = rowIds.length;
  const frameRef = useRef(null);
  const holdTimer = useRef(0);
  const [index, setIndex] = useState(0);
  // Bumped at every row start (and whenever a paused row plays again): it keys the shown row's line, so it starts fresh.
  const [cycle, setCycle] = useState(0);
  // Which stages are live components, and each one's mount generation (its key): onePlaceModel.mjs stagesStep.
  const [stages, setStages] = useReducer(stagesStep, null, () => stagesStart(count, { drawn }));
  const indexRef = useRef(0);
  // The row being dealt over: the one on show before, kept drawn under the new card while it slides up (one-place.css).
  const [leaving, setLeaving] = useState(null);
  // A row begins: it is shown, its line restarts, and its stage is live and fresh.
  const start = useCallback((to) => {
    const from = indexRef.current;
    setLeaving(from !== to ? from : null);
    indexRef.current = to;
    setIndex(to);
    setCycle((c) => c + 1);
    setStages({ type: 'start', index: to });
  }, []);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  // Any part of the frame in the window (it pauses only when wholly out), the tab visible, a reader's tap holding it.
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [held, setHeld] = useState(false);
  // The run: idle until the heading reaches the top, running through every row, rested after the last (runStep).
  const [phase, setPhase] = useState('idle');
  const runRef = useRef({ phase: 'idle', armed: true });
  const heldRef = useRef(false);
  useEffect(() => { heldRef.current = held; }, [held]);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(motionReduced(window));
    const first = window.setTimeout(() => { read(); setReady(true); }, 0);
    query?.addEventListener?.('change', read);
    const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(read);
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { window.clearTimeout(first); query?.removeEventListener?.('change', read); watch?.disconnect(); };
  }, []);

  const runEvent = useCallback((event) => {
    const next = runStep(runRef.current, event);
    runRef.current = { phase: next.phase, armed: next.armed };
    setPhase(next.phase);
    if (next.start) { window.clearTimeout(holdTimer.current); setHeld(false); start(0); }
  }, [start]);

  // THE TRIGGER (owner LK364): the section's heading crossing TRIGGER_LINE. One IntersectionObserver on the heading with the
  // window's top TRIGGER_LINE cut off: the heading leaving that box over its top edge is the heading reaching the top of the
  // screen (whatever the scroll speed: the change of state is reported even when frames are skipped); coming back into it
  // from above is the reader going back above it. Read once, as the frame's code arrives: the heading already above the line
  // starts the run at once.
  useEffect(() => {
    const heading = frameRef.current?.closest('section')?.querySelector('h2');
    if (!heading || typeof IntersectionObserver === 'undefined') return undefined;
    let above = null;
    const io = new IntersectionObserver(([entry]) => {
      const line = entry.rootBounds ? entry.rootBounds.top : window.innerHeight * TRIGGER_LINE;
      // The heading's TOP above the line (its lower part may still be under it): thresholds 0 and 1 report the moment its
      // top crosses the line (it stops being whole in the box), and the moment it leaves the box altogether.
      const now = entry.boundingClientRect.top < line;
      if (above === null) { if (now) runEvent('arrive'); } else if (now && !above) runEvent('up'); else if (!now && above) runEvent('down');
      above = now;
    }, { rootMargin: `-${Math.round(TRIGGER_LINE * 100)}% 0px 0px 0px`, threshold: [0, 1] });
    io.observe(heading);
    return () => io.disconnect();
  }, [runEvent]);

  // THE FRAME IN THE WINDOW: the run pauses only while the frame is wholly out of the window, and the row it paused in plays
  // again from its start when the frame comes back. Coming back with the heading above the line (a flick that jumped the
  // heading) also starts a run that never began. A reader who took over is let go once the frame has left.
  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    let was = false;
    const io = new IntersectionObserver(([entry]) => {
      const on = entry.isIntersecting;
      setInView(on);
      if (on && !was) {
        const heading = node.closest('section')?.querySelector('h2');
        if (heading && heading.getBoundingClientRect().top < window.innerHeight * TRIGGER_LINE) runEvent('arrive');
        if (runRef.current.phase === 'running' && !heldRef.current) start(indexRef.current);
      }
      if (!on && was && heldRef.current) { window.clearTimeout(holdTimer.current); setHeld(false); }
      was = on;
    });
    io.observe(node);
    return () => io.disconnect();
  }, [runEvent, start]);

  // The tab hidden pauses the run; shown again, the row plays from its start.
  useEffect(() => {
    const read = () => {
      const shown = document.visibilityState !== 'hidden';
      setVisible(shown);
      if (shown && runRef.current.phase === 'running' && !heldRef.current) start(indexRef.current);
    };
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [start]);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  // The card dealt over is dropped once the new one has settled (the slide is 460 ms).
  useEffect(() => {
    if (leaving === null) return undefined;
    const id = window.setTimeout(() => setLeaving(null), DEAL_MS + 40);
    return () => window.clearTimeout(id);
  }, [leaving, cycle]);

  // A tap on a row plays that row and the rows after it, to the end of the pass.
  const choose = useCallback((to) => {
    window.clearTimeout(holdTimer.current);
    setHeld(false);
    runRef.current = { phase: 'running', armed: false };
    setPhase('running');
    start(to);
  }, [start]);

  // A row's script has ended: the next row, or rest on this one after the last (no remount: its finished screen stays).
  const advance = useCallback(() => {
    const next = afterRow(indexRef.current, count);
    if (next === null) { runEvent('end'); return; }
    start(next);
  }, [count, start, runEvent]);

  const takeover = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    setHeld(true);
  }, []);

  // With a mouse (or the keyboard), the hold ends once the pointer (or the focus) has been outside the frame for 8 s. Never
  // while the exam screen's own full-screen view is open over the page (it lives outside the frame). A finger lifting also
  // fires pointerleave, so on touch nothing here runs: the frame leaving the window, or another row, lets the reader go.
  const armRelease = useCallback((event) => {
    if (!heldRef.current) return;
    if (event?.type === 'pointerleave' && !leaveStartsHold(event.pointerType)) return;
    window.clearTimeout(holdTimer.current);
    const end = () => {
      if (document.querySelector('dialog.xs-full[open]')) { holdTimer.current = window.setTimeout(end, TAKEOVER_HOLD_MS); return; }
      setHeld(false);
      start(indexRef.current);
    };
    holdTimer.current = window.setTimeout(end, TAKEOVER_HOLD_MS);
  }, [start]);
  const stayHeld = useCallback(() => window.clearTimeout(holdTimer.current), []);

  const resting = phase === 'rested';
  const playing = phase === 'running' && autoplayRuns({ ready, reduced, onScreen: inView, visible, held });
  const blurOut = useCallback((event) => { if (!event.currentTarget.contains(event.relatedTarget)) armRelease(); }, [armRelease]);

  // The next row's stage is made live (unplayed) in idle time, STAGE_LEAD_MS before the shown row's script ends; while the
  // frame rests after its pass, the first row's, for the next pass. Nothing is scheduled while nothing plays: a tap makes its
  // row live at once (start).
  const upcoming = resting ? 0 : afterRow(index, count);
  const upcomingReady = upcoming === null || upcoming === index || (stages.live[upcoming] && !stages.used[upcoming]);
  const runMs = scriptMs(SCRIPTS[rowIds[index]]);
  useEffect(() => {
    if (upcomingReady || (!playing && !resting)) return undefined;
    let idle = 0;
    const make = () => setStages({ type: 'ready', index: upcoming });
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(make, { timeout: 1200 }); else make();
    }, resting ? 0 : Math.max(0, runMs - STAGE_LEAD_MS));
    return () => { window.clearTimeout(timer); if (idle) window.cancelIdleCallback?.(idle); };
  }, [upcoming, upcomingReady, cycle, playing, resting, runMs]);

  return { frameRef, index, cycle, stages, leaving, reduced, held, resting, phase, playing, choose, advance, takeover, stayHeld, armRelease, blurOut };
}

function RowObject({ name }) {
  const src = stripObjectSrc(name);
  // The tour's tools (Learn, Benchmarks, the Mob) have no strip object: their own desk object, as the deck's tabs drew it.
  if (!src) return name ? <BrandIcon name={name} size={36} className="op-row__obj op-row__obj--icon" /> : null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the hero strip's pre-cut desk objects (stripObjects.mjs), 48 px
    <img className="op-row__obj" src={src} srcSet={stripObjectSrcSet(name)} sizes="48px" width={STRIP_OBJECT_BOX.width} height={STRIP_OBJECT_BOX.height}
      alt="" decoding="async" loading="lazy" draggable={false} />
  );
}

// The app's window around Key cards and Ask Mobi (21 Nov 2026): the exam monitor's own browser bar (exam-screen.css .xs-browser,
// the same arrows, address pill and scale: --u is 1/880 of the window, as on the monitor's glass) with the address the tool
// really lives at. From 960 px it is a window as wide as the monitor's screen and as tall as the frame; on a phone only the
// slim bar shows over the card (one-place.css). Decorative: the component inside is the thing.
function AppWindow({ path, fill = false, children }) {
  return (
    <div className="op-win">
      <div className="xs-browser op-win__bar" aria-hidden="true">
        <span className="xs-browser__nav"><ChevronLeft /><ChevronRight /><RotateCw /></span>
        <span className="xs-url"><Lock /><span><b>{EXAM.address.host}</b>{path}</span></span>
      </div>
      <div className={fill ? 'op-win__body op-win__body--fill' : 'op-win__body'}>{children}</div>
    </div>
  );
}

// A deck screen (TourScreens.jsx) on the frame's stage: told it is on stage and playing, as the deck told it, with its own
// epoch per run so its short demo starts again from its first frame each time its row starts.
const TourStage = memo(function TourStage({ Screen, active, play, epoch, sample }) {
  const value = useMemo(() => ({ active, reduced: false, paused: false, epoch, held: false }), [active, epoch]);
  return <DemoPlaybackContext.Provider value={value}><Screen play={play} sample={sample} /></DemoPlaybackContext.Provider>;
});

// `price`: Bring a mistake's credit line, worked out on the server from the app's prices (onePlaceCopy.mjs mobiPrice).
// `children`: what goes under the stage (the volt key and the other tools), in the stage's column from 960 px.
// `drawn` (OnePlaceGate.jsx): each row's stage as the server drew it, by row id; kept as markup until that stage goes live.
// `tour` (the tour the server built, live tools only) gives rows 4 to 6; `samples` the Mob screen's question (page.js).
export default function OnePlace({ keyCards = null, photo = false, price = null, tour = null, samples = null, drawn = null, children = null }) {
  const rows = useMemo(() => [...ONE_PLACE.rows.filter((row) => row.id !== 'cards' || keyCards), ...tourRows(tour || [])], [keyCards, tour]);
  const count = rows.length;
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const kept = Boolean(drawn) && rowIds.every((id) => typeof drawn[id] === 'string' && drawn[id].length > 0);
  const { frameRef, index, cycle, stages, leaving, reduced, held, phase, playing, choose, advance, takeover, stayHeld, armRelease, blurOut } = useOnePlace(rowIds, kept);
  const tabs = useRef([]);
  const active = rows[index] || rows[0];

  // The hero strip links the old sections' addresses (#exam-experience, #key-cards): a click on one opens its row.
  useEffect(() => {
    const onClick = (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      const id = link ? ROW_OF_HASH[link.getAttribute('href')] : null;
      const to = id ? rows.findIndex((row) => row.id === id) : -1;
      if (to < 0) return;
      event.preventDefault();
      choose(to);
      const section = frameRef.current?.closest('section');
      section?.scrollIntoView({ behavior: motionReduced(window) ? 'auto' : 'smooth', block: 'start' });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [rows, choose, frameRef]);

  // Arriving at one of those addresses (the app's "/#exam-experience", a hash typed or followed before this code arrived): the
  // page has landed on the section (page.js keeps an anchor for each); the frame opens that row. A tick later, never in the
  // effect's own pass.
  useEffect(() => {
    let tick = 0;
    const open = () => {
      const id = ROW_OF_HASH[window.location.hash];
      const to = id ? rows.findIndex((row) => row.id === id) : -1;
      if (to >= 0) choose(to);
    };
    tick = window.setTimeout(open, 0);
    window.addEventListener('hashchange', open);
    return () => { window.clearTimeout(tick); window.removeEventListener('hashchange', open); };
  }, [rows, choose]);

  // Phones: the chips are one row that scrolls sideways; the shown row's chip is kept in view (one read, one write).
  useEffect(() => {
    const chip = tabs.current[index];
    const list = chip?.parentElement;
    if (!chip || !list || list.scrollWidth <= list.clientWidth + 1) return;
    const left = Math.max(0, Math.min(list.scrollWidth - list.clientWidth, chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2));
    try { list.scrollTo({ left, behavior: motionReduced(window) ? 'auto' : 'smooth' }); } catch { list.scrollLeft = left; }
  }, [index]);

  const onKey = (event, i) => {
    const to = keyStep(event.key, i, count);
    if (to === null) return;
    event.preventDefault();
    choose(to);
    tabs.current[to]?.focus();
  };

  // The exam keeps its monitor and stand. Its NTA line sits right under the switch it describes; its gate card shows on phones
  // only (one-place.css), cut to its title and first sentence.
  // Each row's proof line under its stage: the live section's own words and numbers.
  const bank = bankLine(keyCards?.bank);
  const proof = (row) => {
    if (row.id === 'practise') return null; // its NTA line sits under the switch (ExamStage note)
    if (row.tour) return row.chip ? <p className="op-proof">{row.chip}</p> : null;
    if (row.id === 'cards') return <p className="op-proof">{bank ? <>{bank} </> : null}<Link href={ONE_PLACE.decksHref} prefetch={false} className="lp-link">{ONE_PLACE.decksLink}</Link></p>;
    return price ? <p className="op-proof">{price}</p> : null;
  };

  const stage = (row, i) => {
    if (row.tour) {
      const Screen = TOUR_SCREENS[row.id];
      const on = i === index;
      return (
        <div className="op-td">
          <div className="op-td__copy"><h3 className="op-td__title">{row.title}</h3><p className="op-td__lede">{row.lede}</p></div>
          <div className="op-td__shot">{Screen ? <TourStage Screen={Screen} active={on} play={on && playing} epoch={stages.gen[i]} sample={samples?.[row.id] ?? null} /> : null}</div>
        </div>
      );
    }
    // Below 640 px `inline`: the exam as a phone shows it (the phone runner, then PhoneNta), not the monitor.
    if (row.id === 'practise') return <ExamStage gate="short" inline note={<p className="op-proof op-proof--switch">{ONE_PLACE.practiseProof}</p>} />;
    if (row.id === 'cards') return <AppWindow path={row.path}><div className="op-kc"><KeyCardsDemo cards={keyCards.cards} keys={keyCards.keys} bank={keyCards.bank} subjects={keyCards.subjects} /></div></AppWindow>;
    return <AppWindow path={row.path} fill><div className="bmk op-bmk"><BringMistakeCard photo={photo} /><BringMistakeValue /></div></AppWindow>;
  };

  return (
    <div className="op-frame" ref={frameRef} onPointerEnter={stayHeld} onPointerLeave={armRelease} onFocus={stayHeld} onBlur={blurOut}
      data-play={playing ? 'on' : 'off'} data-run={phase} data-reduced={reduced || undefined} data-held={held || undefined}
      data-deal={leaving === null ? undefined : rows[leaving]?.tour && rows[index]?.tour ? 'card' : 'fade'}>
      <div className="op-rows" role="tablist" aria-label={ONE_PLACE.rowsLabel}>
        {rows.map((row, i) => {
          const on = i === index;
          return (
            <button key={row.id} type="button" role="tab" id={`op-tab-${row.id}`} aria-controls={`op-panel-${row.id}`} aria-selected={on} tabIndex={on ? 0 : -1}
              className="op-row" data-on={on || undefined} ref={(node) => { tabs.current[i] = node; }} onClick={() => choose(i)} onKeyDown={(event) => onKey(event, i)}>
              <RowObject name={row.icon} />
              <span className="op-row__name">{row.name}</span>
              <span className="op-row__line">{row.line}</span>
              <span className="op-row__track" aria-hidden="true">
                {on ? <i key={cycle} className="op-row__fill" style={{ '--op-ms': `${scriptMs(SCRIPTS[row.id])}ms` }} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {/* Phones: the shown row's line under the chips (the rows carry it from 960 px). */}
      <p className="op-caption" aria-hidden="true">{active.line}</p>
      <div className="op-stages">
        {rows.map((row, i) => {
          const on = i === index;
          const slot = { className: 'op-slot', 'data-tool': row.id, 'data-on': on || undefined, 'data-leaving': i === leaving && !on ? '' : undefined, role: 'tabpanel', id: `op-panel-${row.id}`, 'aria-labelledby': `op-tab-${row.id}`, inert: !on || undefined, 'aria-hidden': on ? undefined : true };
          // Not live yet: this stage as the server drew it (the same markup and size, no script).
          if (!stages.live[i]) return <div key={row.id} {...slot} data-drawn="" dangerouslySetInnerHTML={{ __html: drawn[row.id] }} />;
          // Live: keyed by its mount generation, so a stage that has played is mounted fresh before it plays again.
          return (
            <div key={row.id} {...slot}>
              <CursorDemo key={`run-${stages.gen[i]}`} steps={SCRIPTS[row.id]} playing={on && playing} onDone={advance} onTakeover={takeover} className="op-stage">
                {stage(row, i)}
              </CursorDemo>
              {proof(row)}
            </div>
          );
        })}
      </div>
      {children ? <div className="op-foot">{children}</div> : null}
    </div>
  );
}
