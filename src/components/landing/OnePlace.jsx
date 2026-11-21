'use client';

// The home page's one frame (owner LK363, 20 Nov 2026): "Your whole CUET prep, in one place." Six rows, one stage. Each stage
// IS a real screen of the product (the exam screen with its MockMob / NTA style switch, Key cards, and since 21 Nov 2026,
// owner LK365, the row stories of Ask Mobi, Learn, Benchmarks and the Mob: stories/<Id>Story.jsx), and a demo cursor works
// it (demo/CursorDemo.jsx): it clicks the real controls, so the screen changes the way it does for a student, one beat at a
// time under the caption strip. The scripts and the rules of the frame are in onePlaceModel.mjs; the words in
// onePlaceCopy.mjs.
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
// The caption strip (21 Nov 2026, owner LK365: "the screens are moving too fast and without much explanation"): right above
// the stage, the tool's name with where its story is ("Practise, step 2 of 4") and the beat's line in bold, as the cursor's
// script says it (CursorDemo onSay; the lines are the scripts' `say` steps). It keeps two lines' height at every width, so
// nothing under it moves. While nothing plays (idle, rested, held, reduced motion) it shows the row's own line. On a phone it
// is the beat's line alone with "2 of 5" before it (the chip above names the tool), two lines' height (critic round, 21 Nov
// evening: the stack above a phone's stage was 271 px). The strip is its own component (SayStrip) holding the line: a new
// line re-renders the strip only, never the stages (on a slow phone each re-render of the six stages stretched the script).
//
// THE ROW REGISTRY (ROW_STAGES below): each row's stage (a render function) and its cursor's script, by row id. A row story
// (stories/<Id>Story.jsx, its steps in stories/<id>Story.mjs) joins the frame with one entry there.
//
// Speed (AGENT-COMMON.md, 20 Nov rules): no frame loop, no interval. One IntersectionObserver, the visibility event, the
// motion setting. The row's line is one CSS transform animation as long as the script; the cursor moves by a CSS transition.
// The timers here: the 8 s hold after a reader takes over, and the 700 ms a finished row's screen holds before the next.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, RotateCw } from 'lucide-react';
import CursorDemo from './demo/CursorDemo';
import { ExamStage } from './ExamScreen';
import KeyCardsDemo from './KeyCardsDemo';
import { STRIP_OBJECT_BOX, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { ONE_PLACE, bankLine, sayWhere, tourRows } from './onePlaceCopy.mjs';
import { EXAM } from './homeCopy.mjs';
import Link from 'next/link';
import { DEAL_MS, PHONE_LAYOUT, ROOM_FOOT_PX, ROW_HOLD_MS, ROW_OF_HASH, SCRIPTS, SCRIPTS_TYPED, STAGE_LEAD_MS, TAKEOVER_HOLD_MS, afterRow, autoplayRuns, desktopTriggerFoot, keyStep, leaveStartsHold, motionReduced, runStep, sayCount, scriptMs, stagesStart, stagesStep, triggerPassed } from './onePlaceModel.mjs';
// The row stories (21 Nov 2026, owner LK365). Each is imported WITH its extension: on Windows an extensionless
// './stories/MobiStory' also matches mobiStory.mjs (the story's data, no default export), and the page then fails.
import MobiStory from './stories/MobiStory.jsx';
import LearnStory from './stories/LearnStory.jsx';
import RivalStory from './stories/RivalStory.jsx';
import MobStory from './stories/MobStory.jsx';
import { BrandIcon } from '@/components/brand/BrandIcon';
import './one-place.css';

// Read the layout position without the row's entrance transform. The monitor stand and proof lines sit outside the screens.
const WORKING_SCREENS = '.xs-glass, .op-kc .kc-demo, .op-win__body > .st, .op-td__shot > .st';
function layoutTop(element) {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop + (node === element ? 0 : node.clientTop);
  return top;
}

function useOnePlace(rowIds, drawn, photo) {
  const count = rowIds.length;
  const frameRef = useRef(null);
  // The trigger watches the foot of the stage's working room.
  const roomRef = useRef(null);
  const holdTimer = useRef(0);
  const [index, setIndex] = useState(0);
  // Bumped at every row start (and whenever a paused row plays again): it keys the shown row's line, so it starts fresh.
  const [cycle, setCycle] = useState(0);
  // Which stages are live components, and each one's mount generation (its key): onePlaceModel.mjs stagesStep.
  const [stages, setStages] = useReducer(stagesStep, null, () => stagesStart(count, { drawn }));
  const indexRef = useRef(0);
  // The row being dealt over: the one on show before, kept drawn under the new card while it slides up (one-place.css).
  const [leaving, setLeaving] = useState(null);
  // The row the shown one was dealt over, kept after the slide (`leaving` is dropped then): the shown card keeps the deal it
  // came in with. Were it dropped with `leaving`, the card's animation would change from op-deal-card back to op-deal, which
  // starts again from nothing: a card dealt onto a card blinked out and faded in a second time (21 Nov 2026, integrate).
  const [dealtFrom, setDealtFrom] = useState(null);
  // The caption strip's line, as the shown row's script says it: { at: row index, cycle, text, beat } (CursorDemo onSay). It
  // goes straight to the strip (SayStrip binds `sayTo`): the frame itself does not re-render for a line.
  const sayTo = useRef(null);
  const cycleRef = useRef(0);
  const onSay = useCallback((text, beat) => sayTo.current?.({ at: indexRef.current, cycle: cycleRef.current, text, beat }), []);
  // The 700 ms a finished row's screen holds before the next row is dealt (ROW_HOLD_MS).
  const dealTimer = useRef(0);
  // A row begins: it is shown, its line restarts, and its stage is live and fresh.
  const start = useCallback((to) => {
    window.clearTimeout(dealTimer.current);
    sayTo.current?.(null);
    cycleRef.current += 1;
    const from = indexRef.current;
    setLeaving(from !== to ? from : null);
    setDealtFrom(from !== to ? from : null);
    indexRef.current = to;
    setIndex(to);
    setCycle(cycleRef.current);
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

  // Has the reader passed the trigger right now? One read (as the frame comes into the window, never per frame).
  const passed = useCallback(() => triggerPassed({
    roomBottom: roomRef.current?.getBoundingClientRect().bottom,
    innerHeight: window.innerHeight,
  }), []);

  // Phones use the CSS room as drawn. Wider screens observe a point placed at whichever needs more scroll: the heading's
  // 15% line or the foot of the lowest working screen. Measure at setup and when the layout or viewport changes.
  useEffect(() => {
    const heading = frameRef.current?.closest('section')?.querySelector('h2');
    const room = roomRef.current;
    const stages = room?.parentElement;
    if (!stages || typeof IntersectionObserver === 'undefined') return undefined;

    const phone = window.matchMedia?.(PHONE_LAYOUT);
    const measure = () => {
      if (phone?.matches || !heading) return;
      const stagesTop = layoutTop(stages) + stages.clientTop;
      const bottoms = Array.from(stages.querySelectorAll(WORKING_SCREENS), (screen) => layoutTop(screen) + screen.offsetHeight - stagesTop);
      const foot = desktopTriggerFoot({
        headingOffset: layoutTop(heading) - stagesTop,
        workingBottom: Math.max(0, ...bottoms),
        innerHeight: window.innerHeight,
      });
      room.style.setProperty('--op-trigger-foot', `${foot}px`);
    };
    measure();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(stages);
    if (heading) resize?.observe(heading);
    window.addEventListener('resize', measure);

    let above = null;
    const io = new IntersectionObserver(([entry]) => {
      const now = triggerPassed({ roomBottom: entry.boundingClientRect.bottom, innerHeight: window.innerHeight });
      if (above === null) { if (now) runEvent('arrive'); } else if (now && !above) runEvent('up'); else if (!now && above) runEvent('down');
      above = now;
    }, { rootMargin: `0px 0px -${ROOM_FOOT_PX}px 0px`, threshold: [0, 1] });
    io.observe(room);
    return () => {
      io.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', measure);
    };
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
        if (passed()) runEvent('arrive');
        if (runRef.current.phase === 'running' && !heldRef.current) start(indexRef.current);
      }
      if (!on && was && heldRef.current) { window.clearTimeout(holdTimer.current); setHeld(false); }
      // Gone between rows: the next row is not dealt out of sight (the finished one plays again when the frame is back).
      if (!on) window.clearTimeout(dealTimer.current);
      was = on;
    });
    io.observe(node);
    return () => io.disconnect();
  }, [runEvent, start, passed]);

  // The tab hidden pauses the run; shown again, the row plays from its start.
  useEffect(() => {
    const read = () => {
      const shown = document.visibilityState !== 'hidden';
      setVisible(shown);
      if (!shown) window.clearTimeout(dealTimer.current);
      if (shown && runRef.current.phase === 'running' && !heldRef.current) start(indexRef.current);
    };
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [start]);

  useEffect(() => () => { window.clearTimeout(holdTimer.current); window.clearTimeout(dealTimer.current); }, []);

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

  // A row's script has ended: its finished screen holds ROW_HOLD_MS, then the next row is dealt; or the frame rests on it
  // after the last (no remount: its finished screen stays).
  const advance = useCallback(() => {
    const next = afterRow(indexRef.current, count);
    if (next === null) { runEvent('end'); return; }
    window.clearTimeout(dealTimer.current);
    dealTimer.current = window.setTimeout(() => start(next), ROW_HOLD_MS);
  }, [count, start, runEvent]);

  const takeover = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    window.clearTimeout(dealTimer.current);
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
  const runMs = scriptMs(stepsOf(rowIds[index], photo));
  useEffect(() => {
    if (upcomingReady || (!playing && !resting)) return undefined;
    let idle = 0;
    const make = () => setStages({ type: 'ready', index: upcoming });
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(make, { timeout: 1200 }); else make();
    }, resting ? 0 : Math.max(0, runMs - STAGE_LEAD_MS));
    return () => { window.clearTimeout(timer); if (idle) window.cancelIdleCallback?.(idle); };
  }, [upcoming, upcomingReady, cycle, playing, resting, runMs]);

  return { frameRef, roomRef, index, cycle, stages, leaving, dealtFrom, reduced, held, resting, phase, playing, sayTo, onSay, choose, advance, takeover, stayHeld, armRelease, blurOut };
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
function AppWindow({ path, children }) {
  return (
    <div className="op-win">
      <div className="xs-browser op-win__bar" aria-hidden="true">
        <span className="xs-browser__nav"><ChevronLeft /><ChevronRight /><RotateCw /></span>
        <span className="xs-url"><Lock /><span><b>{EXAM.address.host}</b>{path}</span></span>
      </div>
      <div className="op-win__body">{children}</div>
    </div>
  );
}

// A deck row (Learn, Benchmarks, the Mob): the row's story on the old tour deck's card. The caption strip above the stage
// explains each beat (the card's paragraph went, 21 Nov 2026, LK365), and the card's short title went too (critic round, 21
// Nov evening): it repeated the strip's line right above it, cost a phone 117 px, and as one card was dealt over another the
// two titles printed over each other for the 460 ms of the deal. Now only the screens slide.
// `row` names the card's tool (data-row), for the checks that read the frame.
function StoryCard({ row, children }) {
  return (
    <div className="op-td op-td--story" data-row={row?.id}>
      <div className="op-td__shot">{children}</div>
    </div>
  );
}

// THE CAPTION STRIP, right above the stage: where the story is, and the beat's line (two lines' room at every width). It
// holds the line itself: the frame hands it each line through `bindRef` (useOnePlace sayTo), so a new line re-renders this strip
// alone. A line counts only while its row and its run are the ones on show (`at`, `cycle`). On a phone the quiet "where" line
// gives way to "2 of 5" before the beat's line (one-place.css), since the chip above already names the tool.
function SayStrip({ bindRef, index, cycle, playing, name, line, beats }) {
  const [say, setSay] = useState(null);
  useEffect(() => {
    bindRef.current = setSay;
    return () => { if (bindRef.current === setSay) bindRef.current = null; };
  }, [bindRef]);
  const live = playing && say && say.at === index && say.cycle === cycle ? say : null;
  return (
    <div className="op-say" aria-hidden="true" data-live={live ? '' : undefined}>
      <p className="op-say__where">{sayWhere(name, live ? live.beat : -1, live ? beats : 0)}</p>
      <p className="op-say__line"><span key={live ? `${cycle}-${live.beat}` : `row-${index}`} className="op-say__text">
        {live && beats > 0 ? <span className="op-say__n">{Math.min(live.beat + 1, beats)} of {beats}</span> : null}{live ? live.text : line}
      </span></p>
    </div>
  );
}

// THE ROW REGISTRY: by row id, the row's stage and the script its cursor plays.
//   steps   the script (CursorDemo steps; `say` and `focus` beats feed the caption strip and the stress).
//   stage   (ctx) => the stage's content, the product's own screen. ctx = { row, i, on, playing, stages, keyCards, photo,
//           samples, study }: the row (onePlaceCopy.mjs ONE_PLACE.rows or tourRows) and its index, whether it is the row on show,
//           whether the frame plays, the stages' state (stages.gen[i]: this stage's mount generation), and the server's
//           props (page.js: KEY_CARDS, MISTAKE_PHOTO_ON, TOUR_SAMPLES, the study release's counts).
// A row story joins with one entry: its steps in SCRIPTS (onePlaceModel.mjs), its component here.
// A row whose id has no entry draws nothing on its stage and plays no script.
const ROW_STAGES = {
  // Below 640 px `inline`: the exam as a phone shows it (the phone runner, then PhoneNta), not the monitor.
  practise: { steps: SCRIPTS.practise, stage: () => <ExamStage gate="short" inline note={<p className="op-proof op-proof--switch">{ONE_PLACE.practiseProof}</p>} /> },
  cards: { steps: SCRIPTS.cards, stage: ({ row, keyCards }) => <AppWindow path={row.path}><div className="op-kc"><KeyCardsDemo cards={keyCards.cards} keys={keyCards.keys} bank={keyCards.bank} subjects={keyCards.subjects} /></div></AppWindow> },
  // Ask Mobi in the app's window at its real address (/mentor); typed instead of photographed while Mobi does not read
  // photos (MISTAKE_PHOTO_ON, then the typed script: SCRIPTS_TYPED, stepsOf).
  mobi: { steps: SCRIPTS.mobi, stage: ({ row, photo }) => <AppWindow path={row.path}><MobiStory photo={photo} /></AppWindow> },
  // The study release's counts (page.js STUDY_LESSONS, STUDY_SUBJECTS) for the lesson list's foot line.
  learn: { steps: SCRIPTS.learn, stage: ({ row, study }) => <StoryCard row={row}><LearnStory lessons={study?.lessons ?? 0} subjects={study?.subjects ?? 0} /></StoryCard> },
  rival: { steps: SCRIPTS.rival, stage: ({ row }) => <StoryCard row={row}><RivalStory /></StoryCard> },
  // The fresh question of Fix it together: the home page's public Economics sample (page.js TOUR_SAMPLES.mob).
  mob: { steps: SCRIPTS.mob, stage: ({ row, samples }) => <StoryCard row={row}><MobStory sample={samples?.mob ?? null} /></StoryCard> },
};
/** A row's script, from the registry (Ask Mobi's typed script while the photo switch is off). */
function stepsOf(id, photo = true) { return (photo === false && SCRIPTS_TYPED[id]) || ROW_STAGES[id]?.steps || []; }

// `price`: Bring a mistake's credit line, worked out on the server from the app's prices (onePlaceCopy.mjs mobiPrice).
// `children`: what goes under the stage (the volt key and the other tools), in the stage's column from 960 px.
// `drawn` (OnePlaceGate.jsx): each row's stage as the server drew it, by row id; kept as markup until that stage goes live.
// `tour` (the tour the server built, live tools only) gives rows 4 to 6; `samples` the Mob story's fresh question; `study`
// the study release's counts, { lessons, subjects } (page.js).
export default function OnePlace({ keyCards = null, photo = false, price = null, tour = null, samples = null, study = null, drawn = null, children = null }) {
  const rows = useMemo(() => [...ONE_PLACE.rows.filter((row) => row.id !== 'cards' || keyCards), ...tourRows(tour || [])], [keyCards, tour]);
  const count = rows.length;
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const kept = Boolean(drawn) && rowIds.every((id) => typeof drawn[id] === 'string' && drawn[id].length > 0);
  const { frameRef, roomRef, index, cycle, stages, leaving, dealtFrom, reduced, held, phase, playing, sayTo, onSay, choose, advance, takeover, stayHeld, armRelease, blurOut } = useOnePlace(rowIds, kept, photo);
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

  // Phones: the chips are one row that scrolls sideways; the shown row's chip is kept in view (one read, one write), also
  // when a row plays again after the reader swiped the strip away from it (cycle).
  useEffect(() => {
    const chip = tabs.current[index];
    const list = chip?.parentElement;
    if (!chip || !list || list.scrollWidth <= list.clientWidth + 1) return;
    const left = Math.max(0, Math.min(list.scrollWidth - list.clientWidth, chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2));
    if (Math.abs(list.scrollLeft - left) < 2) return;
    try { list.scrollTo({ left, behavior: motionReduced(window) ? 'auto' : 'smooth' }); } catch { list.scrollLeft = left; }
  }, [index, cycle]);

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
    if (row.tour) return row.proof ? <p className="op-proof">{row.proof}</p> : null;
    if (row.id === 'cards') return <p className="op-proof">{bank ? <>{bank} </> : null}<Link href={ONE_PLACE.decksHref} prefetch={false} className="lp-link">{ONE_PLACE.decksLink}</Link></p>;
    // Ask Mobi carries its tag (owner LK367, 22 Nov 2026: "add a label somewhere ... for the marketing"), then the price line.
    return <p className="op-proof op-proof--mobi"><b className="op-ai">{ONE_PLACE.mobiTag}</b>{price ? <span>{price}</span> : null}</p>;
  };

  const stage = (row, i) => ROW_STAGES[row.id]?.stage({ row, i, on: i === index, playing, stages, keyCards, photo, samples, study }) ?? null;

  // The caption strip: the beat's line while the shown row's script plays and says one; the row's own line otherwise.
  const steps = stepsOf(active.id, photo);

  return (
    <div className="op-frame" ref={frameRef} onPointerEnter={stayHeld} onPointerLeave={armRelease} onFocus={stayHeld} onBlur={blurOut}
      data-play={playing ? 'on' : 'off'} data-run={phase} data-reduced={reduced || undefined} data-held={held || undefined}
      data-deal={dealtFrom === null ? undefined : rows[dealtFrom]?.tour && rows[index]?.tour ? 'card' : 'fade'}>
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
                {on ? <i key={cycle} className="op-row__fill" style={{ '--op-ms': `${scriptMs(stepsOf(row.id, photo))}ms` }} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {/* The caption strip, right above the stage: where the story is, and the beat's line (two lines' room at every width). */}
      <SayStrip bindRef={sayTo} index={index} cycle={cycle} playing={playing} name={active.name} line={active.line} beats={sayCount(steps)} />
      <div className="op-stages">
        {/* The bottom of the working room is the autoplay trigger. */}
        <span className="op-room" ref={roomRef} aria-hidden="true" />
        {rows.map((row, i) => {
          const on = i === index;
          const slot = { className: 'op-slot', 'data-tool': row.id, 'data-on': on || undefined, 'data-leaving': i === leaving && !on ? '' : undefined, role: 'tabpanel', id: `op-panel-${row.id}`, 'aria-labelledby': `op-tab-${row.id}`, inert: !on || undefined, 'aria-hidden': on ? undefined : true };
          // Not live yet: this stage as the server drew it (the same markup and size, no script).
          if (!stages.live[i]) return <div key={row.id} {...slot} data-drawn="" dangerouslySetInnerHTML={{ __html: drawn[row.id] }} />;
          // Live: keyed by its mount generation, so a stage that has played is mounted fresh before it plays again.
          return (
            <div key={row.id} {...slot}>
              <CursorDemo key={`run-${stages.gen[i]}`} steps={stepsOf(row.id, photo)} playing={on && playing} onDone={advance} onTakeover={takeover} onSay={onSay} className="op-stage">
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
