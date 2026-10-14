"use client";
// The repair ending: what the run really did, in one centred group with the next move pinned under
// it. The same beat and words as the app's repair ending screen: the handed-back sheet arrives, the
// rings of the repairs the server acknowledged draw one by one, the number rolls in, and as it lands
// Mobi stands proud. Nothing here says the repair holds; Checked comes later, on fresh questions.
// Mobi reacts to the real outcome (proud for a repair, encouraging for nothing repaired), answers a
// tap with a cycle of small acts and a long press with the ending's own reaction again. The beat is
// Celebrations Full only; Quiet, Off and Reduce motion show the final state at once, with the words.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MobiReact from '@/components/brand/MobiReact';
import { MOBI_ACTS, SPEC } from '@/components/brand/mobiActs';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { RUN_COPY, LONG_PRESS_MS, createTapCycle, endingAct, endingFact, finishFor, nothingLine, retryIds, retryLine } from './repairRun';
import './repair-run.css';

const RINGS_START_MS = 200;
const RINGS_MS = 400;
const NUMBER_DELAY_MS = 300;
const ROLL_MS = 500;

const timeOf = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap]m)/i, ' $1').toUpperCase();

function Sheet({ ids, numbers, model, animate }) {
  const now = new Set(model.repairedNow);
  const earlier = new Set(model.repairedEarlier);
  const aside = new Set(model.setAside);
  const ringed = model.repairedNow;
  return (
    <ol className="re__sheet" aria-label="Mistakes of this run">
      {ids.map((id) => {
        const kind = now.has(id) ? 'now' : earlier.has(id) ? 'earlier' : aside.has(id) ? 'aside' : 'open';
        const at = Math.max(0, ringed.indexOf(id));
        return (
          <li key={id} className="re__bubble" data-kind={kind} data-animate={animate && kind === 'now' ? true : undefined}
            style={{ '--re-d': `${RINGS_START_MS + (ringed.length > 1 ? (RINGS_MS * at) / (ringed.length - 1) : 0)}ms` }}>
            <svg viewBox="0 0 34 34" focusable="false" aria-hidden="true"><circle cx="17" cy="17" r="15.5" pathLength="100" /></svg>
            <span>{numbers[id]}</span>
          </li>
        );
      })}
    </ol>
  );
}

// The number rolls from 0 to its value once, then lands. Without the beat it is simply the number.
function Roll({ value, animate, onLanded }) {
  const [rolled, setRolled] = useState(0);
  const shown = animate ? rolled : value;
  const landed = useRef(onLanded);
  useEffect(() => { landed.current = onLanded; }, [onLanded]);
  useEffect(() => {
    if (!animate) return undefined;
    let raf; let start; let timer;
    const step = (t) => {
      start ??= t;
      const p = Math.min((t - start) / ROLL_MS, 1);
      setRolled(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step); else landed.current?.();
    };
    timer = setTimeout(() => { raf = requestAnimationFrame(step); }, NUMBER_DELAY_MS);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [animate, value]);
  return <b className="re__num" aria-hidden="true">{shown}</b>;
}

export default function RepairEnding({ ids, numbers, model, ackedAt, chapter = '', onClose, onRetry, reviewHref = '/review', withMobi = true }) {
  const prefs = useMobiPrefs();
  const dialogRef = useRef(null);
  const [replay, setReplay] = useState(0);
  const full = prefs.celebrations === 'full';
  const animate = model.repaired > 0 && full && !prefs.reduced;
  const [landedFor, setLandedFor] = useState(null); // the beat (replay count) whose number has landed
  const landed = !animate || landedFor === replay;
  const [play, setPlay] = useState(null); // { act, n }: a tap or a long press on Mobi

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    // No close in the cleanup: leaving the page removes the dialog, and a close event here would end the screen a beat after it opened.
    return undefined;
  }, []);

  const onLanded = useCallback(() => setLandedFor(replay), [replay]);

  const retry = retryIds(model);
  const real = endingAct(model);
  const standing = animate && !landed ? 'rest' : real;

  // Tap: the cycle. Long press: the ending's own reaction and the beat again.
  const [cycle] = useState(() => createTapCycle({ repaired: model.repaired > 0, has: (a) => MOBI_ACTS.includes(a) }));
  const press = useRef({ timer: null, long: false });
  const startPress = () => {
    press.current.long = false;
    clearTimeout(press.current.timer);
    press.current.timer = setTimeout(() => { press.current.long = true; setReplay((n) => n + 1); setPlay(null); }, LONG_PRESS_MS);
  };
  const endPress = () => clearTimeout(press.current.timer);
  const tap = () => {
    if (press.current.long) { press.current.long = false; return; }
    const act = cycle.tap();
    if (act) setPlay((p) => ({ act, n: (p?.n || 0) + 1 }));
  };
  useEffect(() => {
    if (!play) return undefined;
    const t = setTimeout(() => setPlay(null), SPEC[play.act]?.ms || 900);
    return () => clearTimeout(t);
  }, [play]);
  useEffect(() => () => clearTimeout(press.current.timer), []);

  const act = play ? play.act : standing;
  const mobi = full && withMobi ? (
    <button type="button" className="re__mobi" aria-label={model.nothing ? RUN_COPY.mobiNothing : RUN_COPY.mobiRepaired}
      onClick={tap} onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}>
      <MobiReact key={`${replay}-${play ? `p${play.n}` : act}`} act={act} size={model.nothing ? 120 : 104} mood={model.nothing ? 'calm' : landed ? 'proud' : 'calm'} />
    </button>
  ) : null;

  const unit = RUN_COPY.endingUnit(model.repaired);
  return (
    <dialog ref={dialogRef} className="re" aria-labelledby="re-title" onClose={onClose} data-celebrate={animate || undefined}>
      <div className="re__scroll">
        <div className="re__group" key={replay}>
          <Sheet ids={ids} numbers={numbers} model={model} animate={animate} />
          {model.nothing ? (
            <div className="re__hero re__hero--nothing">
              <h2 id="re-title" className="re__title">{RUN_COPY.nothingTitle}</h2>
              {mobi}
            </div>
          ) : (
            <div className="re__hero" data-landed={landed || undefined}>
              <h2 id="re-title" className="re__sr">{`${model.repaired} ${unit}`}</h2>
              <div className="re__count" aria-hidden="true">
                <Roll value={model.repaired} animate={animate} onLanded={onLanded} />
                <span className="re__unit">{unit}</span>
              </div>
              {mobi}
            </div>
          )}
          <p className="re__fact">{model.nothing ? nothingLine({ setAside: model.setAside.length }) : endingFact({ left: model.left, setAside: model.setAside.length })}</p>
          {model.nothing ? null : (
            <>
              <ol className="re__life" aria-label="Stages: Found, Repaired, Checked, Holds">
                <li data-lit>Found</li>
                <li data-lit data-inked={animate ? undefined : true} style={{ '--re-d': `${RINGS_START_MS + RINGS_MS}ms` }}>Repaired</li>
                <li>Checked</li>
                <li>Holds</li>
              </ol>
              <p className="re__later">{RUN_COPY.checkedLater}</p>
              {ackedAt ? <p className="re__receipt" role="status">Recorded at {timeOf(ackedAt)}.</p> : null}
            </>
          )}
        </div>
      </div>
      <div className="re__band">
        {retry.length ? (
          <>
            <button type="button" className="re__key" data-autofocus onClick={() => onRetry(retry)}>{RUN_COPY.trySameAgain}</button>
            <p className="re__caption">{retryLine(retry.length, chapter)}</p>
            <button type="button" className="re__quiet" onClick={onClose}>{finishFor(new Date())}</button>
          </>
        ) : (
          <>
            <button type="button" className="re__key" data-autofocus onClick={onClose}>{finishFor(new Date())}</button>
            <Link className="re__quiet" href={reviewHref}>{RUN_COPY.openReview}</Link>
          </>
        )}
      </div>
    </dialog>
  );
}
