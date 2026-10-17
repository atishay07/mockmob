"use client";
// "Play your paper back" (owner D29, 18 Oct 4:10 am IST; REVIEW-RESULT-1018 and the replay engine in data/replay.js).
// A reel of the student's own paper, about 20 seconds: the sheet plays question by question, each bubble lighting right,
// wrong or blank as the score counts to the paper's own score; it pauses on the real moments the record shows ("Q31: you
// changed a right answer to wrong. It cost 6 marks."); it lands on the costliest chapter and ends on the one next move.
// Nothing here is invented and there is no wait: the frames come from reelScript() over the attempt record (the same engine
// as the replay's Play), and one tap on Skip leaves. Under reduced motion it opens settled (every bubble lit, the moments
// said as sentences) and "Next moment" steps one real moment a press. Motion is transform and opacity only, 180 ms.
// The opener row sits under the result's front, never inside it. Words: data/mistake_lab.copy.json replay.reel.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import COPY from '@/../data/mistake_lab.copy.json';
import { fill } from '@/../data/paper_trace';
import { reelFrameAt, reelKeyFrames, reelSeconds, reelScript, replayView } from '@/../data/replay';
import './paper-reel.css';


const W = COPY.replay.reel;
const readReduced = () => { try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

/** The script for one result, from what the page already holds. null when there is nothing to play back. */
export function useReelScript({ analysis, attempt, timeRead, finding, move }) {
  const rows = analysis?.rows;
  const replay = attempt?.lab?.replay || null;
  const paceMs = timeRead?.pace?.perQuestionMs || null;
  const rec = attempt?.selectionMeta?.recovery || null;
  const kind = move?.kind || null;
  const label = move?.label || null;
  const target = move?.target || null;
  const line = finding?.line || null;
  const detail = finding?.detail || null;
  const chapter = finding?.chapter || null;
  return useMemo(() => {
    if (!rows?.length) return null;
    const view = replay ? replayView(replay, { total: rows.length }) : null;
    const paceSec = paceMs ? paceMs / 1000 : replay?.durationSec ? replay.durationSec / rows.length : null;
    const changes = rec?.telemetry === 'self_reported' && Array.isArray(rec.observed?.answerChanges) ? rec.observed.answerChanges : [];
    return reelScript({
      rows, changes, view, paceSec,
      finding: line ? { line, detail, chapter } : null,
      next: label ? { kind, label, target, href: (kind === 'practise' || kind === 'harder') && target?.href ? target.href : null } : null,
    });
  }, [rows, replay, paceMs, rec, kind, label, target, line, detail, chapter]);
}

function Play({ className }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
}

/** The quiet row under the result's front that opens the reel. */
export function ReelRow({ script, onOpen }) {
  if (!script) return null;
  const s = reelSeconds(script);
  return (
    <section className="pbk-row" aria-label={fill(W.open, { s })}>
      <div className="pbk-row__text">
        <h2>{fill(W.open, { s })}</h2>
        <p>{W.openLine}</p>
      </div>
      <button type="button" className="pbk-open mk-press" onClick={onOpen}>
        <Play />
        <span>{W.openButton}</span>
      </button>
    </section>
  );
}

function Key({ next, onAct, onClose }) {
  if (!next) return null;
  if (next.href) return <Link href={next.href} className="btn-volt pbk-key mk-press" onClick={onClose}>{next.label}</Link>;
  return <button type="button" className="btn-volt pbk-key mk-press" onClick={() => { onClose(); onAct?.({ kind: next.kind, target: next.target }); }}>{next.label}</button>;
}

/** The reel itself: a full-screen dialog over the result. */
export default function PaperReel({ script, onClose, onAct, autoplay = true }) {
  const [reduced] = useState(readReduced);
  const frames = script.frames;
  const last = frames.length - 1;
  const [idx, setIdx] = useState(reduced || !autoplay ? last : 0);
  const [playing, setPlaying] = useState(!reduced && autoplay);
  const keys = useMemo(() => reelKeyFrames(script).map((f) => frames.indexOf(f)), [script, frames]);
  const [stepAt, setStepAt] = useState(-1); // reduced motion: which key frame the student stepped to
  const [run, setRun] = useState(0); // Play again starts the clock over
  const progress = useRef(null);
  const raf = useRef(0);
  const dialog = useRef(null);
  const skip = useRef(null);

  // The clock: one rAF loop from the first frame to the last; a state change only when the showing frame changes.
  useEffect(() => {
    if (!playing) return undefined;
    const began = performance.now();
    let shown = -1;
    const tick = (now) => {
      const t = Math.min(script.durationMs, now - began);
      const f = reelFrameAt(script, t);
      const i = frames.indexOf(f);
      if (i !== shown) { shown = i; setIdx(i); }
      if (progress.current) progress.current.style.transform = `scaleX(${t / script.durationMs})`;
      if (t < script.durationMs) raf.current = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, run, script, frames]);
  useEffect(() => { if (!playing && progress.current) progress.current.style.transform = `scaleX(${idx === last ? 1 : 0})`; }, [playing, idx, last]);

  // A dialog: focus in, Escape leaves, Tab stays inside, the page behind does not scroll, focus returns on close.
  useEffect(() => {
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skip.current?.focus();
    return () => { document.body.style.overflow = overflow; try { before?.focus?.({ preventScroll: true }); } catch { /* focus returns when it can */ } };
  }, []);
  const onKeyDown = useCallback((event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...(dialog.current?.querySelectorAll('button:not([disabled]), a[href]') || [])];
    if (!nodes.length) return;
    const first = nodes[0];
    const end = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end.focus(); }
    else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
  }, [onClose]);

  const again = () => { cancelAnimationFrame(raf.current); setIdx(0); setStepAt(-1); setRun((r) => r + 1); setPlaying(true); };
  const stepThrough = () => {
    const to = stepAt + 1;
    if (to >= keys.length) { setStepAt(-1); setIdx(last); return; }
    setStepAt(to); setIdx(keys[to]);
  };

  const f = frames[idx];
  const finished = idx === last && !playing;
  const atEnd = f.kind === 'next';
  const inChapter = f.chapter ? new Set(f.chapter.numbers) : null;
  const cols = script.total <= 10 ? Math.min(5, script.total) : 10;
  const caption = f.kind === 'moment' || f.kind === 'chapter' || f.kind === 'next' ? f : null;

  return createPortal(
    <div className="pbk-scrim" role="dialog" aria-modal="true" aria-labelledby="pbk-title" ref={dialog} onKeyDown={onKeyDown}>
      <div className="pbk-stage">
        <header className="pbk-head">
          <h2 id="pbk-title">{W.title}</h2>
          <button type="button" className="pbk-skip mk-press" ref={skip} onClick={onClose}>{finished || reduced ? W.close : W.skip}</button>
        </header>

        <p className="pbk-score" aria-hidden="true"><b>{f.marks < 0 ? `−${-f.marks}` : f.marks}</b><span>{fill(W.marksOf, { max: script.max })}</span></p>
        <p className="sr-only" aria-live="polite">{atEnd ? `${script.score} ${fill(W.marksOf, { max: script.max })}` : ''}</p>

        <ol className="pbk-sheet" style={{ '--cols': cols }} aria-label={`Your ${script.total} answers`}>
          {script.sheet.map((q) => {
            const lit = q.n <= f.lit;
            return (
              <li key={q.n} data-lit={lit || undefined} data-v={lit ? q.v : undefined} data-ring={f.ring === q.n || undefined}
                data-chapter={inChapter ? (inChapter.has(q.n) ? 'in' : 'out') : undefined}>
                <span className="sr-only">{`Question ${q.n}: ${q.v === 'correct' ? 'right' : q.v === 'wrong' ? 'wrong' : 'blank'}`}</span>
                <span aria-hidden="true">{q.n}</span>
              </li>
            );
          })}
        </ol>

        <div className="pbk-cap" aria-live="polite" data-kind={f.kind}>
          {caption ? (
            <>
              <p className="pbk-cap__line">{caption.caption.at ? <b>{caption.caption.at}</b> : null}{caption.caption.text}</p>
              {caption.caption.detail ? <p className="pbk-cap__sub">{caption.caption.detail}</p> : null}
            </>
          ) : <p className="pbk-cap__line pbk-cap__quiet">{W.start}</p>}
        </div>

        <div className="pbk-bar" aria-hidden="true"><i ref={progress} /></div>

        <div className="pbk-end" data-show={atEnd || undefined}>
          {atEnd ? (
            <>
              {script.moments.length ? (
                <div className="pbk-moments">
                  <h3>{W.standout}</h3>
                  <ul>{script.moments.map((m) => <li key={m.n}>{m.at ? <b>{m.at}</b> : null}{m.text}</li>)}</ul>
                </div>
              ) : null}
              {script.next ? <h3 className="pbk-nexthead">{W.next}</h3> : null}
              <Key next={script.next} onAct={onAct} onClose={onClose} />
              <div className="pbk-more">
                {reduced ? <button type="button" className="pbk-link" onClick={stepThrough}>{W.step}</button> : <button type="button" className="pbk-link" onClick={again}>{W.again}</button>}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The opener row and its reel, from what the result page already holds. Draws nothing when there is nothing to play. */
export function ReelEntry({ analysis, attempt, timeRead, finding, move, onAct }) {
  const script = useReelScript({ analysis, attempt, timeRead, finding, move });
  const [open, setOpen] = useState(false);
  if (!script) return null;
  return (
    <>
      <ReelRow script={script} onOpen={() => setOpen(true)} />
      {open ? <PaperReel script={script} onClose={() => setOpen(false)} onAct={onAct} /> : null}
    </>
  );
}
