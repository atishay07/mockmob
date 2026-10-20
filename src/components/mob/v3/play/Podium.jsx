"use client";
// R7, the podium (Live's staging, Arena's content; motion M7 in spec 5.6).
// The lamp narrows, the title and the collective line come first with the floor members (never alone on stage,
// F11), then the plinths unfold third, second, first (shared places together). Each count rolls up from the marks
// of the place below, so the order is true in every frame (F10). "So far" until the game closes. A visible Skip
// lands the end state in 200 ms; reduced motion is three 120 ms fades 300 ms apart.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Repeat2 } from 'lucide-react';
import { mobGameApi } from './playApi';
import { PlayFold } from './PlayFold';
import { RunHead } from './GameRun';
import { COPY, FOLD_CREASES, PODIUM_END_MS, errorSentence, lampVars, podiumLayout, shownMarks } from './playModel.mjs';

const LAMP_VARS = lampVars();

const T_TITLE = 120;
const T_FLOOR = 400;
const T_CROWN = 2820;
const T_TIE = 3700;
const T_KEYS = 4200;
const BITS = 24;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function Podium({ gameId, game, hrefs }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [t, setT] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [reduced] = useState(reducedMotion);
  const [now] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const [asking, setAsking] = useState(false);
  const start = useRef(0);

  useEffect(() => {
    let on = true;
    mobGameApi.podium(gameId).then((d) => { if (on) setData(d); }).catch((e) => { if (on) setError(e); });
    return () => { on = false; };
  }, [gameId]);

  useEffect(() => {
    if (!data) return undefined;
    let raf = 0;
    if (reduced) { raf = requestAnimationFrame(() => setT(PODIUM_END_MS)); return () => cancelAnimationFrame(raf); }
    start.current = performance.now();
    const step = (now) => {
      const next = Math.min(PODIUM_END_MS, now - start.current);
      setT(next);
      if (next < PODIUM_END_MS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [data, reduced]);

  useEffect(() => {
    if (!toast) return undefined;
    const h = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(h);
  }, [toast]);

  const layout = useMemo(() => (data ? podiumLayout(data, now) : null), [data, now]);

  const skip = () => { start.current = performance.now() - PODIUM_END_MS; setSkipped(true); setT(PODIUM_END_MS); };
  const askRematch = async () => {
    if (asking || !game?.mobId) return;
    setAsking(true);
    try { await mobGameApi.sticker(game.mobId, gameId, 'again'); setToast(COPY.rematchAsked); } catch (e) { setToast(errorSentence(e)); } finally { setAsking(false); }
  };

  const title = COPY.gameTitle(game);
  if (error) {
    const notYet = error.code === 'PODIUM_NOT_YET';
    return (
      <section className="mp-pod">
        <RunHead title={title} sub="" hrefs={hrefs} />
        <div className="mp-card mp-card--center" role="alert">
          <h2 className="mp-h2">{errorSentence(error)}</h2>
          <div className="mp-keys">
            {notYet ? <Link className="btn-volt md mp-key-primary" href={hrefs.run}>{COPY.playKey(game)}</Link> : null}
            <Link className={notYet ? 'mp-link' : 'mp-key'} href={hrefs.den}>{COPY.backToDen}</Link>
          </div>
        </div>
      </section>
    );
  }
  if (!layout) {
    return (
      <section className="mp-pod" aria-busy="true">
        <RunHead title={title} sub="" hrefs={hrefs} />
        <div className="mp-pod__stage mp-pod__stage--podium mp-skel" style={LAMP_VARS} aria-hidden="true" />
      </section>
    );
  }

  const done = t >= PODIUM_END_MS;
  const shown = (at) => t >= at;
  const crowned = layout.mode === 'podium' && shown(T_CROWN);
  const cls = `mp-pod${reduced ? ' is-reduced' : ''}${skipped ? ' is-skipped' : ''}${done ? ' is-done' : ''}`;
  return (
    <section className={cls}>
      <RunHead title={title} sub={layout.sub} hrefs={hrefs} chip={!done ? <button type="button" className="mp-skip" onClick={skip}>{COPY.skipShow}</button> : null} />
      <div className={`mp-pod__words${shown(T_TITLE) ? ' is-in' : ''}`}>
        <h2 className="mp-h1">{layout.title}</h2>
        {layout.line ? <p className="mp-line">{layout.line}</p> : null}
      </div>

      <div className={`mp-pod__stage mp-pod__stage--${layout.mode}`} style={LAMP_VARS} aria-label={layout.title}>
        <span className={`mp-pod__cone${shown(0) ? ' is-narrow' : ''}${crowned ? ' is-swell' : ''}`} aria-hidden="true"><span className="mp-pod__bulb" /></span>
        {layout.mode === 'podium' ? (
          <ol className="mp-plinths">
            {layout.stage.map((p) => {
              const inAt = reduced ? 0 : p.unfoldAt;
              const marks = reduced || skipped ? p.marks : shownMarks(p, t);
              const first = p.place === 1;
              return (
                <li key={p.memberId} className={`mp-plinth${shown(inAt) ? ' is-in' : ''}${first ? ' is-first' : ''}${first && crowned ? ' is-crowned' : ''}${p.you ? ' is-you' : ''}`} style={{ '--h': `${p.height}px`, '--fade': `${(3 - Math.min(3, p.place)) * 300}ms` }} aria-label={`${p.shownName}, ${COPY.placeOf(p.place).toLowerCase()}, ${COPY.marks(p.marks)}`}>
                  <span className="mp-plinth__fold"><PlayFold fold={p.fold} pose={first && crowned ? 'cheer' : 'idle'} size={first ? 96 : 80} name={p.shownName} colour={p.colour} /></span>
                  <span className="mp-plinth__block">
                    <span className="mp-plinth__num">{p.place}</span>
                    <span className="mp-plinth__creases" aria-hidden="true">{Array.from({ length: FOLD_CREASES[p.fold] || 1 }, (_, i) => <i key={i} />)}</span>
                    {first ? <span className="mp-plinth__sheen" aria-hidden="true" /> : null}
                  </span>
                  <span className="mp-plinth__name">{p.shownName}</span>
                  <span className="mp-plinth__marks"><b>{marks ?? ' '}</b>{marks === null ? '' : ` ${COPY.marksWord(p.marks)}`}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {layout.floor.length ? (
          <ul className={`mp-floor${layout.mode !== 'podium' ? ' mp-floor--table' : ''}${shown(T_FLOOR) ? ' is-in' : ''}`}>
            {layout.floor.map((p) => (
              <li key={p.memberId} className={`mp-floor__one${p.you ? ' is-you' : ''}`} aria-label={`${p.shownName}, ${p.private ? COPY.private : COPY.marks(p.marks)}`}>
                <PlayFold fold={p.fold} size={layout.mode === 'podium' ? 64 : 84} name={p.shownName} colour={p.colour} />
                <span className="mp-plinth__name">{p.shownName}</span>
                <span className="mp-plinth__marks">{p.private ? COPY.private : <><b>{p.marks}</b> {COPY.marksWord(p.marks)}</>}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {crowned && !reduced && !skipped ? (
          <span className="mp-bits" aria-hidden="true">{Array.from({ length: BITS }, (_, i) => <i key={i} style={{ '--i': i, '--x': `${((i * 37) % 100) - 50}`, '--r': `${(i * 53) % 360}deg` }} />)}</span>
        ) : null}
      </div>

      <div className={`mp-pod__lines${shown(T_FLOOR) ? ' is-in' : ''}`}>
        {layout.together ? <p className="mp-together">{layout.together}</p> : null}
        {layout.tieLine ? <p className={`mp-line mp-pod__tie${shown(T_TIE) ? ' is-in' : ''}`}>{layout.tieLine}</p> : null}
      </div>

      <div className={`mp-keys mp-keys--row mp-pod__keys${shown(T_KEYS) ? ' is-in' : ''}`}>
        <Link className="btn-volt md mp-key-primary" data-page-primary="" href={hrefs.moments}>{COPY.everyonesMoment}</Link>
        <button type="button" className="mp-icon mp-icon--ring" onClick={askRematch} disabled={asking} aria-label={COPY.askRematch} title={COPY.askRematch}><Repeat2 size={22} aria-hidden="true" /></button>
      </div>
      {toast ? <p className="mp-toast" role="status">{toast}</p> : null}
    </section>
  );
}
