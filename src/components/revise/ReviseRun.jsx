"use client";
// Revise: the student's own wrong answers come back after 1, 3, 7 and 21 days, at most 10 a day (feature wave F1; rules in
// data/revise.js, server in src/lib/server/revise.js; spec tmp/mistake-lab-v4/SPEC.md 4.8 "Same mistakes later").
// One card at a time. The key never reaches the page before the answer: choosing an option posts it to the server, which
// grades it, moves the card and answers with the right option, the stored explanation (no AI) and when the card comes back.
// It costs no credits, writes no attempts row and is in no accuracy number; the page says so. It is a page of its own, never
// part of a timed paper.
//   Top    "N questions to revise today", about how long, the four box lanes with their counts, 5 or 10 a day
//   Card   the stem (and passage), the options as buttons; after the answer the key, the line and Next
//   End    "8 recalled, 2 come back tomorrow"
// Motion: a card rises once on arrival (180 ms); after a recall the card's old and new lanes pulse once (200 ms); reduced
// motion lands every change at once. Targets are 48 px.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, LoaderCircle, RefreshCw, X } from 'lucide-react';
import ArenaHead from '@/components/arena/ArenaHead';
import { StatusIcon } from '@/components/ui/Glyph';
import { apiPost } from '@/lib/fetcher';
import COPY from '../../../data/mistake_lab.copy.json';
import { readCap, saveCap, useRevise } from './useRevise';
import './revise.css';

const R = COPY.revise;
const LETTERS = 'ABCDEFGH';
const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (w, k) => (k in v ? String(v[k]) : w));
const SEND_FAILED = 'Your answer was not saved. Try again.';

/** "8 recalled, 2 come back tomorrow" (the same words as data/revise.js endLine). */
export function endText(right, wrong) {
  if (right && wrong) return fill(R.end.both, { r: right, w: wrong });
  if (right) return fill(R.end.right, { r: right });
  if (wrong) return fill(R.end.wrong, { w: wrong });
  return null;
}

function Lanes({ boxes, days, moved }) {
  return (
    <ol className="rv-lanes" aria-label="Your cards by box">
      {boxes.map((count, i) => (
        <li key={i} className="rv-lane" data-pulse={moved && (moved.from === i || moved.to === i) ? moved.n : undefined}>
          <span className="rv-lane__name">{fill(R.boxes, { n: i + 1 })}</span>
          <b className="rv-lane__count">{count}</b>
          <span className="rv-lane__days">{days?.[String(i + 1)]}</span>
        </li>
      ))}
    </ol>
  );
}

function CapChoice({ cap, onChange, disabled }) {
  return (
    <div className="rv-cap" role="group" aria-label="Questions a day">
      <span>Questions a day</span>
      {[5, 10].map((n) => (
        <button key={n} type="button" className="rv-cap__btn" aria-pressed={cap === n} disabled={disabled} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}

function Card({ item, number, total, result, busy, error, onChoose, onNext, last }) {
  const nextRef = useRef(null);
  useEffect(() => { if (result || error) nextRef.current?.focus({ preventScroll: false }); }, [result, error]);
  const answered = Boolean(result);
  return (
    <section className="rv-card" aria-labelledby="rv-q">
      <p className="rv-card__meta">
        <span>Question {number} of {total}</span>
        {item.chapter ? <span>{item.chapter}</span> : null}
      </p>
      {item.passage?.text ? <div className="rv-passage"><p className="rv-passage__label">Passage</p><p>{item.passage.text}</p></div> : null}
      <h2 className="rv-stem" id="rv-q">{item.question}</h2>
      <ul className="rv-options">
        {item.options.map((text, j) => {
          const key = answered && result.keyIndex === j;
          const mine = answered && result.chosen === j && !key;
          return (
            <li key={j}>
              <button type="button" className="rv-option" disabled={answered || busy} data-state={key ? 'key' : mine ? 'mine' : undefined}
                onClick={() => onChoose(j)}>
                <span className="rv-option__letter" aria-hidden="true">{LETTERS[j]}</span>
                <span className="rv-option__text"><span className="sr-only">Option {LETTERS[j]}. </span>{text}</span>
                {key ? <span className="rv-option__tag"><Check size={14} strokeWidth={2.4} aria-hidden="true" />Right answer</span> : null}
                {mine ? <span className="rv-option__tag"><X size={14} strokeWidth={2.4} aria-hidden="true" />Your pick</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {busy ? <p className="rv-status" role="status"><LoaderCircle className="rv-spin" size={16} strokeWidth={2.2} aria-hidden="true" />Checking your answer</p> : null}
      {error ? <p className="rv-err" role="alert"><StatusIcon kind="error" size={14} />{error}</p> : null}
      {answered ? (
        <div className="rv-result" data-correct={result.correct || undefined} role="status">
          <p className="rv-result__line">{result.correct ? <Check size={18} strokeWidth={2.4} aria-hidden="true" /> : <X size={18} strokeWidth={2.4} aria-hidden="true" />}{result.line}</p>
          {result.explanation ? <p className="rv-result__why">{result.explanation}</p> : null}
        </div>
      ) : null}
      {answered || error ? (
        <button type="button" className="rv-next" ref={nextRef} onClick={onNext}>{last ? 'Finish' : 'Next question'}</button>
      ) : null}
    </section>
  );
}

export default function ReviseRun() {
  const [cap, setCap] = useState(null);
  useEffect(() => { queueMicrotask(() => setCap(readCap())); }, []);
  const read = useRevise({ cap: cap ?? 10, enabled: cap !== null });
  const [at, setAt] = useState(0);
  const [done, setDone] = useState([]); // [{ questionId, correct }]
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [boxes, setBoxes] = useState(null);
  const [moved, setMoved] = useState(null);
  const data = read.data;
  const items = useMemo(() => data?.items || [], [data]);
  const lanes = boxes || data?.boxes || [0, 0, 0, 0];

  const choose = useCallback(async (index) => {
    const item = items[at];
    if (!item || busy || result) return;
    setBusy(true);
    setError(null);
    try {
      const out = await apiPost(`/api/me/revise/answer?cap=${cap}`, { questionId: item.questionId, choice: index });
      if (!out?.ok) throw new Error('unconfirmed');
      setResult({ ...out, chosen: index });
      setDone((d) => [...d, { questionId: item.questionId, correct: out.correct }]);
      const from = (item.box || 1) - 1;
      const to = out.retired ? null : (out.box || 1) - 1;
      setBoxes((b) => {
        const next = [...(b || data.boxes)];
        next[from] = Math.max(0, next[from] - 1);
        if (to !== null) next[to] += 1;
        return next;
      });
      setMoved((m) => ({ from, to: to ?? from, n: (m?.n || 0) + 1 }));
    } catch (e) {
      setError(e?.status === 409 && e.body?.message ? e.body.message : SEND_FAILED);
    } finally {
      setBusy(false);
    }
  }, [items, at, busy, result, cap, data]);

  const next = useCallback(() => { setResult(null); setError(null); setAt((i) => i + 1); }, []);
  const changeCap = useCallback((n) => { saveCap(n); setCap(n); setAt(0); setDone([]); setResult(null); setError(null); setBoxes(null); setMoved(null); }, []);

  const back = <Link className="rv-back" href="/review"><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Review</Link>;
  const head = <ArenaHead title={R.title} lede={R.sub} />;

  if (read.state === 'error' || read.state === 'unavailable') {
    return (
      <section className="pr rv">
        {back}{head}
        <div className="rv-fail" role="alert">
          <StatusIcon kind="error" />
          <p>{read.message || R.unavailable}</p>
          <button type="button" className="rv-next" onClick={read.retry}><RefreshCw size={16} strokeWidth={2.1} aria-hidden="true" />Try again</button>
        </div>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="pr rv">
        {back}{head}
        <div className="rv-skel" role="status" aria-label="Loading Revise"><span className="skeleton" /><span className="skeleton" /></div>
      </section>
    );
  }

  const finished = items.length > 0 && at >= items.length;
  const right = done.filter((d) => d.correct).length;
  const wrong = done.length - right;
  const current = items[at];

  return (
    <section className="pr rv">
      {back}{head}
      <div className="rv-top">
        <div className="rv-top__text">
          {finished ? null : <p className="rv-top__head">{data.head}</p>}
          {!finished && data.shown ? <p className="rv-top__sub">{fill(R.minutes, { m: data.minutes })}</p> : null}
          {data.summary ? <p className="rv-top__sub">{data.summary}</p> : null}
        </div>
        <CapChoice cap={cap} onChange={changeCap} disabled={busy} />
      </div>
      <Lanes boxes={lanes} days={data.labels?.boxes} moved={moved} />

      {current ? (
        <Card key={current.questionId} item={current} number={at + 1} total={items.length} result={result} busy={busy} error={error} last={at + 1 >= items.length}
          onChoose={choose} onNext={next} />
      ) : finished ? (
        <div className="rv-end">
          <p className="rv-end__line">{endText(right, wrong)}</p>
          {data.next ? <p className="rv-end__sub">{data.next}</p> : null}
          <Link className="rv-next rv-next--link" href="/review">Back to Review</Link>
        </div>
      ) : (
        <div className="rv-empty">
          <p>{data.answeredToday >= (data.cap || 10) ? R.capReached : data.next || R.nextNone}</p>
          <Link className="rv-next rv-next--link" href="/review">Back to Review</Link>
        </div>
      )}
      <p className="rv-fine">{data.labels?.fine || R.fine}</p>
    </section>
  );
}
