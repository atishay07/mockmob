'use client';

// /home-next's one frame (owner LK363, 20 Nov 2026): "Your whole CUET prep, in one place." Three rows, one stage. Each stage
// IS the landing's own real component (the exam screen with its MockMob / NTA style switch, Key cards, Bring a mistake's
// card), and a demo cursor works it (demo/CursorDemo.jsx): it clicks the real controls, so the screen changes the way it
// does for a student. The scripts and the rules of the frame are in onePlaceModel.mjs; the words in onePlaceCopy.mjs.
//
// Layout (one-place.css): from 960 px the rows stand beside the stage; on a phone they are three chips above it, with the
// row's line under them. The three stages share one grid cell, so the frame is as tall as its tallest stage and never
// changes height between rows (nothing below it moves). Only the shown stage is live; the others are inert and hidden, and
// each is mounted fresh (a new React key) whenever it starts, so every demo begins from the component's start state.
//
// Speed (AGENT-COMMON.md, 20 Nov rules): no frame loop, no interval. One IntersectionObserver, the visibility event, the
// motion setting. The row's line is one CSS transform animation as long as the script; the cursor moves by a CSS transition.
// The only timer here is the 8 s hold after a reader takes over.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, RotateCw } from 'lucide-react';
import CursorDemo from './demo/CursorDemo';
import { ExamStage } from './ExamScreen';
import KeyCardsDemo from './KeyCardsDemo';
import { BringMistakeCard } from './BringMistakeBlock';
import { STRIP_OBJECT_BOX, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { ONE_PLACE, bankLine } from './onePlaceCopy.mjs';
import { EXAM } from './homeCopy.mjs';
import Link from 'next/link';
import { EXAM_CAMERA, ROW_OF_HASH, SCRIPTS, TAKEOVER_HOLD_MS, afterRow, autoplayRuns, keyStep, leaveStartsHold, motionReduced, scriptMs } from './onePlaceModel.mjs';
import './one-place.css';

function useOnePlace(count) {
  const frameRef = useRef(null);
  const holdTimer = useRef(0);
  const [index, setIndex] = useState(0);
  // Bumped at every row start (and whenever a run was cut short): it keys the shown stage and its line, so both start fresh.
  const [cycle, setCycle] = useState(0);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [held, setHeld] = useState(false);
  // After one full pass the frame rests on the last finished screen, until it comes back into the window or a row is chosen.
  const [resting, setResting] = useState(false);
  const heldRef = useRef(false);
  const restRef = useRef(false);
  useEffect(() => { heldRef.current = held; restRef.current = resting; }, [held, resting]);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(motionReduced(window));
    const first = window.setTimeout(() => { read(); setReady(true); }, 0);
    query?.addEventListener?.('change', read);
    const watch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(read);
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { window.clearTimeout(first); query?.removeEventListener?.('change', read); watch?.disconnect(); };
  }, []);

  // "On screen" is the middle band of the window. Leaving it cuts a run short: the stage is mounted fresh, so the next run
  // starts from the beginning, never from a half-worked screen. A reader who took over is let go once the frame has left
  // (their screen is no longer in front of them). Coming back after a finished pass starts the pass again from the top.
  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    let was = false;
    const io = new IntersectionObserver(([entry]) => {
      const on = entry.isIntersecting;
      setOnScreen(on);
      if (was && !on) {
        if (heldRef.current) { window.clearTimeout(holdTimer.current); setHeld(false); }
        if (!restRef.current) setCycle((c) => c + 1);
      }
      if (!was && on && restRef.current) { setResting(false); setIndex(0); setCycle((c) => c + 1); }
      was = on;
    }, { rootMargin: '-20% 0px -20% 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const read = () => {
      const shown = document.visibilityState !== 'hidden';
      setVisible(shown);
      if (!shown && !heldRef.current && !restRef.current) setCycle((c) => c + 1);
    };
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, []);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const choose = useCallback((to) => {
    window.clearTimeout(holdTimer.current);
    setHeld(false);
    setResting(false);
    setIndex(to);
    setCycle((c) => c + 1);
  }, []);

  // A row's script has ended: the next row, or rest on this one after the last (no remount: its finished screen stays).
  const advance = useCallback(() => {
    const next = afterRow(index, count);
    if (next === null) { setResting(true); return; }
    setIndex(next);
    setCycle((c) => c + 1);
  }, [index, count]);

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
      setCycle((c) => c + 1);
    };
    holdTimer.current = window.setTimeout(end, TAKEOVER_HOLD_MS);
  }, []);
  const stayHeld = useCallback(() => window.clearTimeout(holdTimer.current), []);

  const playing = autoplayRuns({ ready, reduced, onScreen, visible, held }) && !resting;
  const blurOut = useCallback((event) => { if (!event.currentTarget.contains(event.relatedTarget)) armRelease(); }, [armRelease]);
  return { frameRef, index, cycle, reduced, held, resting, playing, choose, advance, takeover, stayHeld, armRelease, blurOut };
}

function RowObject({ name }) {
  const src = stripObjectSrc(name);
  if (!src) return null;
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

// `price`: Bring a mistake's credit line, worked out on the server from the app's prices (onePlaceCopy.mjs mobiPrice).
// `children`: what goes under the stage (the volt key and the other tools), in the stage's column from 960 px.
export default function OnePlace({ keyCards = null, photo = false, price = null, children = null }) {
  const rows = useMemo(() => ONE_PLACE.rows.filter((row) => row.id !== 'cards' || keyCards), [keyCards]);
  const count = rows.length;
  const { frameRef, index, cycle, reduced, held, playing, choose, advance, takeover, stayHeld, armRelease, blurOut } = useOnePlace(count);
  const tabs = useRef([]);
  const active = rows[index] || rows[0];

  // The hero strip still links the live home's old addresses (#exam-experience, #key-cards): here they open their row.
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

  const onKey = (event, i) => {
    const to = keyStep(event.key, i, count);
    if (to === null) return;
    event.preventDefault();
    choose(to);
    tabs.current[to]?.focus();
  };

  // The exam keeps its monitor and stand; its NTA gate card shows on phones only (one-place.css), where it fills the stage.
  // Each row's proof line under its stage: the live section's own words and numbers.
  const bank = bankLine(keyCards?.bank);
  const proof = (row) => {
    if (row.id === 'practise') return <p className="op-proof">{ONE_PLACE.practiseProof}</p>;
    if (row.id === 'cards') return <p className="op-proof">{bank ? <>{bank} </> : null}<Link href={ONE_PLACE.decksHref} prefetch={false} className="lp-link">{ONE_PLACE.decksLink}</Link></p>;
    return price ? <p className="op-proof">{price}</p> : null;
  };

  const stage = (row) => {
    if (row.id === 'practise') return <ExamStage />;
    if (row.id === 'cards') return <AppWindow path={row.path}><div className="op-kc"><KeyCardsDemo cards={keyCards.cards} keys={keyCards.keys} bank={keyCards.bank} subjects={keyCards.subjects} foot={false} /></div></AppWindow>;
    return <AppWindow path={row.path} fill><div className="bmk op-bmk"><BringMistakeCard photo={photo} /></div></AppWindow>;
  };

  return (
    <div className="op-frame" ref={frameRef} onPointerEnter={stayHeld} onPointerLeave={armRelease} onFocus={stayHeld} onBlur={blurOut}
      data-play={playing ? 'on' : 'off'} data-reduced={reduced || undefined} data-held={held || undefined}>
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
          return (
            <div key={row.id} className="op-slot" data-tool={row.id} data-on={on || undefined} role="tabpanel" id={`op-panel-${row.id}`} aria-labelledby={`op-tab-${row.id}`}
              inert={!on || undefined} aria-hidden={on ? undefined : true}>
              <CursorDemo key={on ? `on-${cycle}` : 'idle'} steps={SCRIPTS[row.id]} playing={on && playing} onDone={advance} onTakeover={takeover}
                zoom={row.id === 'practise' ? EXAM_CAMERA : null} className="op-stage">
                {stage(row)}
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
