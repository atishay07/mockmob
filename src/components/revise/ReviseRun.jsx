"use client";
// Revise: ONE run for everything the student has to bring back (LEARN-REVIEW-1017 5.8, packet P-LR2; rules in
// src/components/revise/reviseQueue.js, the merged list from GET /api/me/revise `queue`, server src/lib/server/revise.js).
// Four sources play as one session with one progress line:
//   questions  wrong answers due today (the same question again; the key stays on the server until the answer)
//   again      repaired mistakes due again (the same question, key hidden; a question due in both plays ONCE, as this)
//   checks     a pending Check it held (a NEW question on the rule of a repair, marked by /api/recovery/check)
//   cards      lesson recall cards due (the study engine's own recall run, played here, ConceptRun below)
// It costs no credits, writes no attempts row and is in no accuracy number; the page says so once, under the options.
//   Top    "8 due today, about 7 minutes." the progress ticks, "5 questions back, 1 Check it held, 2 concept cards"
//   Card   what it is ("A question you got wrong", paper and time), the stem, the options; after the answer the key and Next
//   Fold   "How Revise schedules": the box days, the cap (5 or 10 a day), the lanes
//   End    "6 recalled, 2 come back tomorrow", the checks and cards, Back to Review
// On this route the phone dock steps away, as on test routes (.app-shell:has(.rvs) in revise.css; the page keeps its top bar and
// its way back), and
// the Review badge counts down as each answer is confirmed by the server (src/lib/reviseDue.js).
// ?source=cards|again|questions|checks plays one source (the old /learn?recall=due and the app's /review/again land here).
// Motion: a card rises once on arrival (180 ms); after a recall the old and new lanes pulse once (200 ms); reduced motion
// lands every change at once. Targets are 48 px. Mobi (lib/mobiScreens.js, one at a time): beside a graded answer, at the end
// of a run in proportion to what was recalled, once when nothing is due or Revise failed.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, LoaderCircle, X } from 'lucide-react';
import ArenaHead from '@/components/arena/ArenaHead';
import { StatusIcon } from '@/components/ui/Glyph';
import { SmoothDetails } from '@/components/ui/controls/SmoothDetails';
import { apiGet, apiPost } from '@/lib/fetcher';
import { setReviseDue } from '@/lib/reviseDue';
import MobiReact from '@/components/brand/MobiReact';
import MomentMobi from '@/components/brand/MomentMobi';
import { EmptyMobi } from '@/components/ui/StateMobi';
import { ErrorState } from '@/components/ui/Skeleton';
import StudyRun from '@/components/study/StudyRun';
import { useAuth } from '@/components/AuthProvider';
import { useMobiGate } from '@/lib/mobiHooks';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { reactNow } from '@/lib/mobiRation';
import { reviseAnswerAct, reviseEndAct } from '@/lib/mobiScreens';
import {
  CHECK_COPY, newCheckRequestId, planCheckAnswer, planCheckLoad, requestCheck, safeCheckHref, submitCheck, answeredRows, openRows,
} from '../../../data/repair_check_client.mjs';
import COPY from '../../../data/mistake_lab.copy.json';
import { practiceCostLine } from '../../../data/result_next_move.mjs';
import { useMyDailySet } from '@/components/useMyDailySet';
import { SUBJECTS } from '../../../data/subjects';
import { readCap, saveCap, useRevise } from './useRevise';
import {
  advance, answeredCount, filterSource, footLine, headLine, isFinished, itemKey, kindLine, mergeQueue, mixParts, nextWhen, positionLine, recordAnswer,
  skipItem, startRun, summary,
} from './reviseQueue';
import { KeyCardPlayer, ProGate } from '../keycards/KeyCard';
import { ncertFont } from '../keycards/ncertFont';
import '../study/study.css';
import './revise.css';
import '../keycards/keycards.css';

const R = COPY.revise;
const RUN = R.run;
const LETTERS = 'ABCDEFGH';
const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (w, k) => (k in v ? String(v[k]) : w));
const SEND_FAILED = 'Your answer was not saved. Try again.';
// The head line with the right number word: a short Key cards run can take one minute ("about 1 minute", never "1 minutes").
const runHead = (total, minutes) => headLine(total, minutes).replace(/about 1 minutes/, 'about 1 minute');
const FILTERED_KEYCARDS = 'Showing your Key cards.';
const newKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');

/** "8 recalled, 2 come back tomorrow" (the same words as data/revise.js endLine). */
export function endText(right, wrong) {
  // "1 comes back tomorrow", never "1 come back tomorrow".
  const back = wrong === 1 ? RUN.end.backOne : fill(R.end.wrong, { w: wrong });
  if (right && wrong) return `${fill(R.end.right, { r: right })}, ${back}`;
  if (right) return fill(R.end.right, { r: right });
  if (wrong) return back;
  return null;
}

// One plain line instead of four stat cards: how many cards come back after each wait ("4 back after 1 day, 1 after 3 days").
// A card that just moved pulses its own count once.
function Lanes({ boxes, days, moved }) {
  const parts = boxes.map((count, i) => ({ count, i, words: days?.[String(i + 1)] })).filter((p) => p.count > 0 && p.words);
  if (!parts.length) return null;
  return (
    <p className="rvs-ladder" aria-label="Your cards by how long they wait">
      <span className="rvs-ladder__lead">In rotation:</span>{' '}
      {parts.map((p, k) => (
        <span key={p.i} className="rvs-ladder__part" data-pulse={moved && (moved.from === p.i || moved.to === p.i) ? moved.n : undefined}>
          <b>{p.count}</b> {p.words}{k < parts.length - 1 ? ',' : '.'}{' '}
        </span>
      ))}
    </p>
  );
}

function CapChoice({ cap, onChange, disabled }) {
  return (
    <div className="rvs-cap" role="group" aria-label="Questions a day">
      <span>Questions a day</span>
      {[5, 10].map((n) => (
        <button key={n} type="button" className="rvs-cap__btn" aria-pressed={cap === n} disabled={disabled} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}

// Mounted only for an answer the server has just graded, because asking the gate consumes it.
function AnswerMobi({ result }) {
  const allowed = useMobiGate(() => reactNow('revise:answer'), false);
  const { celebrations } = useMobiPrefs();
  const act = reviseAnswerAct(result);
  if (!allowed || celebrations !== 'full' || !act) return null;
  return <span className="rvs-result__mobi"><MobiReact act={act} size={52} /></span>;
}

/** The kind line above every card: its place in the run, what it is, and where it came from. */
function KindLine({ item, at, total }) {
  const line = kindLine(item);
  return (
    <p className="rvs-kind">
      <b>{positionLine(at, total)}. {line.title}</b>
      {line.detail ? <span>{line.detail}</span> : null}
    </p>
  );
}

function Options({ rows, disabled, onPick, answered }) {
  return (
    <ul className="rvs-options">
      {rows.map((row) => (
        <li key={row.index}>
          <button type="button" className="rvs-option" disabled={answered || disabled} data-state={row.state || undefined} onClick={() => onPick(row.index)}>
            <span className="rvs-option__letter" aria-hidden="true">{row.letter}</span>
            <span className="rvs-option__text"><span className="sr-only">Option {row.letter}. </span>{row.text}</span>
            {row.state === 'key' ? <span className="rvs-option__tag"><Check size={14} strokeWidth={2.4} aria-hidden="true" />{row.tag}</span> : null}
            {row.state === 'mine' ? <span className="rvs-option__tag"><X size={14} strokeWidth={2.4} aria-hidden="true" />{row.tag}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ResultBlock({ result, line, why, rule }) {
  return (
    <div className="rvs-result" data-correct={result.correct || undefined} role="status">
      <div className="rvs-result__head">
        {/* Mobi stands right beside the line he reacts to (as on the end card), never at the far end of the row. */}
        <AnswerMobi result={result} />
        <p className="rvs-result__line">{result.correct ? <Check size={18} strokeWidth={2.4} aria-hidden="true" /> : <X size={18} strokeWidth={2.4} aria-hidden="true" />}{line}</p>
      </div>
      {why ? <p className="rvs-result__why">{why}</p> : null}
      {rule ? <p className="rvs-result__why"><b>Your rule.</b> {rule}</p> : null}
    </div>
  );
}

/** A question you got wrong, or a mistake you repaired: the same question, the key hidden until the server has graded the answer. */
function QuestionCard({ item, at, total, cap, onConfirmed, onNext, last }) {
  const nextRef = useRef(null);
  const stemRef = useRef(null);
  // A new card after the first takes focus at its stem, so a keyboard or screen reader student lands on the next question, not on nothing.
  useEffect(() => { if (at > 0) stemRef.current?.focus({ preventScroll: true }); }, [at]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (result || error) nextRef.current?.focus({ preventScroll: false }); }, [result, error]);
  const answered = Boolean(result);
  const choose = useCallback(async (index) => {
    if (busy || result) return;
    setBusy(true);
    setError(null);
    try {
      const out = await apiPost(`/api/me/revise/answer?cap=${cap}`, { questionId: item.questionId, choice: index });
      if (!out?.ok) throw new Error('unconfirmed');
      setResult({ ...out, chosen: index });
      onConfirmed(item, out);
    } catch (e) {
      setError(e?.status === 409 && e.body?.message ? e.body.message : SEND_FAILED);
    } finally {
      setBusy(false);
    }
  }, [busy, result, cap, item, onConfirmed]);
  const rows = item.options.map((text, j) => {
    const key = answered && result.keyIndex === j;
    const mine = answered && result.chosen === j && !key;
    return { index: j, letter: LETTERS[j], text, state: key ? 'key' : mine ? 'mine' : null, tag: key ? 'Right answer' : mine ? 'Your pick' : null };
  });
  return (
    <section className="rvs-card" aria-labelledby="rvs-q">
      <KindLine item={item} at={at} total={total} />
      {item.passage?.text ? <div className="rvs-passage"><p className="rvs-passage__label">Passage</p><p>{item.passage.text}</p></div> : null}
      <h2 className="rvs-stem" id="rvs-q" tabIndex={-1} ref={stemRef}>{item.question}</h2>
      <Options rows={rows} disabled={busy} answered={answered} onPick={choose} />
      {busy ? <p className="rvs-status" role="status"><LoaderCircle className="rvs-spin" size={16} strokeWidth={2.2} aria-hidden="true" />Checking your answer</p> : null}
      {error ? <p className="rvs-err" role="alert"><StatusIcon kind="error" size={14} />{error}</p> : null}
      {answered ? <ResultBlock result={result} line={result.line} why={result.explanation} /> : null}
      {answered || error ? (
        <button type="button" className="rvs-next" ref={nextRef} onClick={onNext}>{last ? 'Finish' : 'Next question'}</button>
      ) : null}
      <p className="rvs-free">{footLine(item, answered ? null : nextWhen(item.box))}</p>
    </section>
  );
}

/** A pending Check it held: a new question on the rule of a repair, asked and marked by /api/recovery/check (no credit, no model). */
function CheckCard({ item, at, total, onConfirmed, onNext, onSkip, last }) {
  const [view, setView] = useState({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const requestId = useRef(null);
  const nextRef = useRef(null);
  const reported = useRef(false);
  const stemRef = useRef(null);
  const href = safeCheckHref(null, item.attemptId, item.questionId);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    requestId.current = null;
    setError(null);
    setView({ phase: 'loading' });
    const plan = planCheckLoad(await requestCheck(fetch, href));
    if (mine !== seq.current) return;
    if (plan.state === 'ready') setView({ phase: 'ready', check: plan.check });
    else if (plan.state === 'answered') setView({ phase: 'answered', check: plan.check, result: plan.result, replayed: true });
    else if (plan.state === 'none') setView({ phase: 'none', message: plan.message });
    else setView({ phase: 'loadError', message: plan.message });
  }, [href]);
  useEffect(() => {
    queueMicrotask(load);
    return () => { seq.current += 1; };
  }, [load]);

  const answeredNow = view.phase === 'answered';
  const readyNow = view.phase === 'ready';
  useEffect(() => { if (readyNow) stemRef.current?.focus({ preventScroll: true }); }, [readyNow]);
  useEffect(() => {
    if (!answeredNow || reported.current) return;
    reported.current = true;
    onConfirmed(item, { correct: view.result.right === true });
  }, [answeredNow, view, item, onConfirmed]);
  useEffect(() => { if (answeredNow || error || view.phase === 'none') nextRef.current?.focus({ preventScroll: false }); }, [answeredNow, error, view.phase]);

  const choose = useCallback(async (index) => {
    if (busy || view.phase !== 'ready') return;
    setBusy(true);
    setError(null);
    requestId.current ||= newCheckRequestId();
    const plan = planCheckAnswer(await submitCheck(fetch, { attemptId: item.attemptId, questionId: item.questionId, checkQuestionId: view.check.checkQuestionId, pick: index, requestId: requestId.current }));
    setBusy(false);
    if (plan.state === 'answered') { setView({ phase: 'answered', check: view.check, result: plan.result, replayed: plan.replayed }); return; }
    if (plan.refetch) { load(); return; }
    setError(plan.message);
  }, [busy, view, item, load]);

  const rows = view.phase === 'answered' ? answeredRows(view.check, view.result) : view.phase === 'ready' ? openRows(view.check) : [];
  const check = view.check;
  return (
    <section className="rvs-card" aria-labelledby="rvs-q">
      <KindLine item={item} at={at} total={total} />
      {view.phase === 'loading' ? <div className="rvs-skel" role="status" aria-label={CHECK_COPY.loading}><span className="skeleton" /></div> : null}
      {check ? <h2 className="rvs-stem" id="rvs-q" tabIndex={-1} ref={stemRef}>{check.question}</h2> : null}
      {check ? <Options rows={rows} disabled={busy} answered={answeredNow} onPick={choose} /> : null}
      {busy ? <p className="rvs-status" role="status"><LoaderCircle className="rvs-spin" size={16} strokeWidth={2.2} aria-hidden="true" />{CHECK_COPY.marking}</p> : null}
      {error ? <p className="rvs-err" role="alert"><StatusIcon kind="error" size={14} />{error}</p> : null}
      {view.phase === 'loadError' ? <p className="rvs-err" role="alert"><StatusIcon kind="error" size={14} />{view.message}</p> : null}
      {view.phase === 'none' ? <p className="rvs-note">{view.message || RUN.checkNone}</p> : null}
      {answeredNow ? <ResultBlock result={{ correct: view.result.right === true }} line={view.result.line} why={view.result.explanation} rule={view.result.ruleLine} /> : null}
      {answeredNow && view.replayed ? <p className="rvs-note">{CHECK_COPY.answeredEarlier}</p> : null}
      {answeredNow || error ? <button type="button" className="rvs-next" ref={nextRef} onClick={onNext}>{last ? 'Finish' : 'Next question'}</button> : null}
      {view.phase === 'loadError' ? <button type="button" className="rvs-quiet" onClick={load}>{CHECK_COPY.retryLoad}</button> : null}
      {view.phase === 'none' ? <button type="button" className="rvs-next" ref={nextRef} onClick={onSkip}>{RUN.skip}</button> : null}
      <p className="rvs-free">{footLine(item)}</p>
    </section>
  );
}

/**
 * The lesson recall cards due today, played by the study engine's own recall run (POST /api/study/runs {mode:'recall'}, events on
 * /api/study/runs/{id}/events) inside Revise's frame: the same engine, schedule and ratings as /study/{run}, so a rating here is a
 * rating there. The run may hold more cards than are due (new cards of lessons already read); Revise plays the `count` it counted
 * and leaves the rest saved in the run. `onProgress(done)` reports each finished card; `onFinished({ reviewed, units })` the end.
 */
function ConceptRun({ count, position, onProgress, onFinished }) {
  const [state, setState] = useState({ phase: 'starting', run: null, error: null });
  const key = useRef(null);
  const finished = useRef(false);
  const done = useRef(0);
  const start = useCallback(async () => {
    setState({ phase: 'starting', run: null, error: null });
    key.current ||= newKey();
    try {
      const run = await apiPost('/api/study/runs', { mode: 'recall', requestKey: key.current });
      done.current = Math.max(0, Number(run.cursor) || 0);
      setState({ phase: 'running', run, error: null });
    } catch (e) {
      key.current = null;
      setState({ phase: 'error', run: null, error: e?.body?.message || RUN.cardsFailed });
    }
  }, []);
  useEffect(() => { queueMicrotask(start); }, [start]);

  const api = useMemo(() => ({
    get: (path) => apiGet(path),
    post: async (path, input) => {
      const next = await apiPost(path, input);
      if (next && typeof next === 'object' && Number.isFinite(next.cursor)) {
        setState((s) => (s.phase === 'running' ? { ...s, run: next } : s));
        while (done.current < next.cursor && done.current < count) { done.current += 1; onProgress(done.current); }
        if (!finished.current && (next.state === 'complete' || next.cursor >= count)) {
          finished.current = true;
          onFinished({ reviewed: next.reviewed || [], units: next.units || [] });
        }
      }
      return next;
    },
  }), [count, onProgress, onFinished]);

  const run = state.run;
  const lesson = run?.units?.find((u) => u.id === run?.item?.unitId)?.title || run?.units?.[0]?.title || null;
  if (state.phase === 'error') {
    return (
      <section className="rvs-card" aria-live="polite">
        <p className="rvs-err" role="alert"><StatusIcon kind="error" size={14} />{state.error}</p>
        <button type="button" className="rvs-quiet" onClick={start}>Try again</button>
      </section>
    );
  }
  if (state.phase === 'starting') return <div className="rvs-skel" role="status" aria-label="Loading your concept cards"><span className="skeleton" /></div>;
  return (
    <div className="rvs-concept">
      <p className="rvs-kind"><b>{position}. {fill(RUN.kind.card, { lesson: lesson || 'your lessons' })}</b></p>
      <StudyRun run={run} api={api} onOpenRun={() => {}} />
    </div>
  );
}

/**
 * A due Key card (KEYCARDS-BUILD-SPEC.md section 3): the same card player as Study, recorded with mode 'revise'. A rating counts
 * once the server has it, then the run moves on. Free over the day's 10 card reviews (402) says so, offers Pro once, and lets the
 * student skip today's remaining Key cards while the rest of the run carries on. Missed is "not recalled" for the run's tally.
 */
function KeyCardRun({ item, at, total, onConfirmed, onNext, onSkipKeycards, moreAfter }) {
  const { user } = useAuth() || {};
  const [limited, setLimited] = useState(false);
  const card = item.card || item;
  const rated = useCallback(({ rating }) => { onConfirmed(item, { correct: rating > 1 }); onNext(); }, [item, onConfirmed, onNext]);
  return (
    <div className={`kc kc--inline ${ncertFont.variable}`}>
      <KindLine item={item} at={at} total={total} />
      {limited ? (
        <section className="kc-end kc-end--limit" aria-live="polite">
          <h2 className="kc-end__title">Today’s free card reviews are used</h2>
          <p className="kc-end__line">Free includes 10 Key card reviews a day. These cards stay due and come back tomorrow.</p>
          <div className="kc-end__keys"><button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={onSkipKeycards}>{moreAfter ? 'Go on without Key cards' : 'Finish for today'}</button></div>
          <ProGate isPro={user?.isPremium === true} />
        </section>
      ) : (
        <KeyCardPlayer card={card} mode="revise" onRated={rated} onLimit={() => setLimited(true)} />
      )}
    </div>
  );
}

/**
 * Nothing has ever been wrong, so nothing can come back (FA-10: say what will appear, show a sample of it, one key to the next
 * step). The sample is the kind line every card carries, marked Example. The key opens a 10-question set in the student's first
 * subject, with its time and price under it (the same set and words as Review's empty state).
 */
function EmptyRevise() {
  const { user } = useAuth() || {};
  const dailySet = useMyDailySet();
  const first = SUBJECTS.find((s) => s.id === (user?.subjects || [])[0]) || SUBJECTS.find((s) => s.id === 'accountancy');
  const href = `/dashboard?${new URLSearchParams({ subject: first?.id || '', mode: 'quick', count: '10' })}`;
  const E = RUN.empty;
  return (
    <div className="rvs-empty" aria-labelledby="rvs-empty-h">
      <EmptyMobi act="rest" size={72} />
      <h2 className="rvs-empty__title" id="rvs-empty-h">{E.title}</h2>
      <p>{E.body}</p>
      <div className="rvs-sample" aria-label={E.sampleLabel}>
        <p className="rvs-kind"><b>{E.sampleKind}</b><span>{E.sampleSource}</span></p>
        <em>{E.example}</em>
      </div>
      <Link className="rvs-next rvs-next--link rvs-next--wide" href={href}>{E.key}</Link>
      <p className="rvs-fine">{fill(E.time, { subject: first?.name || 'your subject' })} {practiceCostLine({ isPremium: user?.isPremium === true, practiceCredits: null, dailySet })}</p>
    </div>
  );
}

function RunView({ queue, data, cap, onCap, source, backHref, schedule }) {
  const [run, setRun] = useState(() => startRun(queue.items));
  const [moved, setMoved] = useState(null);
  const [boxes, setBoxes] = useState(null);
  const [forgot, setForgot] = useState([]);
  const fullTotal = data.queue?.total ?? queue.total;
  const lanes = boxes || data.boxes || [0, 0, 0, 0];

  const confirmed = useCallback((item, result) => {
    setRun((r) => recordAnswer(r, item, result));
    if (item.kind === 'question' || item.kind === 'again') {
      const from = (item.box || 1) - 1;
      const to = result.retired ? null : (result.box || 1) - 1;
      setBoxes((b) => {
        const next = [...(b || data.boxes || [0, 0, 0, 0])];
        next[from] = Math.max(0, next[from] - 1);
        if (to !== null) next[to] += 1;
        return next;
      });
      setMoved((m) => ({ from, to: to ?? from, n: (m?.n || 0) + 1 }));
    }
  }, [data.boxes]);
  const next = useCallback(() => setRun((r) => advance(r)), []);
  const skip = useCallback((item) => setRun((r) => advance(skipItem(r, item))), []);
  // Free over today's card reviews: every Key card left stays due (skipped, not answered) and the run goes on to what is not a Key card.
  const skipKeycards = useCallback(() => setRun((r) => {
    let state = r;
    for (const i of r.items.slice(r.at)) if (i.kind === 'keycard') state = skipItem(state, i);
    let at = r.at;
    while (at < state.items.length && state.items[at].kind === 'keycard') at += 1;
    return { ...state, at };
  }), []);
  // The badge counts down on the server's acknowledgement (an answer is recorded only after it), never before.
  const left = Math.max(0, fullTotal - answeredCount(run));
  useEffect(() => { setReviseDue(left); }, [left]);

  const firstCard = run.items.findIndex((i) => i.kind === 'card');
  const cardCount = run.items.filter((i) => i.kind === 'card').length;
  const onCardProgress = useCallback((n) => {
    setRun((r) => {
      let state = r;
      for (let k = 0; k < n; k += 1) {
        const slot = r.items.find((i) => i.kind === 'card' && i.slot === k + 1);
        if (slot) state = recordAnswer(state, slot, { correct: true });
      }
      return { ...state, at: Math.max(state.at, firstCard + n) };
    });
  }, [firstCard]);
  const onCardsFinished = useCallback(({ reviewed, units }) => {
    setForgot((reviewed || []).filter((r) => r.rating === 1).map((r) => ({ unitId: r.unitId, title: units.find((u) => u.id === r.unitId)?.title || r.title })));
    setRun((r) => {
      let state = r;
      for (const slot of r.items.filter((i) => i.kind === 'card')) state = recordAnswer(state, slot, { correct: true });
      return { ...state, at: state.items.length };
    });
  }, []);

  const finished = isFinished(run);
  const current = run.items[run.at];
  const sum = summary(run);
  const parts = mixParts({ ...queue.counts, keycards: queue.counts?.keycards ?? queue.items.filter((i) => i.kind === 'keycard').length });
  // Key cards rated Missed in this run: they come back soon on their own schedule.
  const kcMissed = Object.values(run.answers).filter((a) => a.kind === 'keycard' && !a.skipped && !a.correct).length;
  const last = run.at + 1 >= run.items.length;

  return (
    <section className="pr rvs">
      <Link className="rvs-back" href={backHref}><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Your papers</Link>
      <ArenaHead title={R.title} lede={finished ? null : runHead(queue.total, queue.minutes)} />
      {source ? (
        <p className="rvs-filter">{(source === 'keycards' ? FILTERED_KEYCARDS : RUN.filtered[source]) || null}{' '}<Link className="rvs-link" href={schedule.allHref}>{RUN.filtered.all}</Link></p>
      ) : null}
      {finished ? null : (
        <>
          <ol className="rvs-ticks" aria-label={positionLine(run.at, run.items.length)}>
            {run.items.map((item, i) => <li key={itemKey(item)} data-state={i < run.at || run.answers[itemKey(item)] ? 'done' : i === run.at ? 'now' : undefined} />)}
          </ol>
          <p className="rvs-mix">{parts.map((p) => <span key={p.key}><b>{p.n}</b> {p.text.replace(/^\d+ /, '')}</span>)}</p>
        </>
      )}

      {current?.kind === 'keycard' ? (
        <KeyCardRun key={itemKey(current)} item={current} at={run.at} total={run.items.length} onConfirmed={confirmed} onNext={next} onSkipKeycards={skipKeycards} moreAfter={run.items.slice(run.at).some((i) => i.kind !== 'keycard')} />
      ) : current?.kind === 'card' ? (
        <ConceptRun key="cards" count={cardCount} position={positionLine(run.at, run.items.length)} onProgress={onCardProgress} onFinished={onCardsFinished} />
      ) : current?.kind === 'check' ? (
        <CheckCard key={itemKey(current)} item={current} at={run.at} total={run.items.length} onConfirmed={confirmed} onNext={next} onSkip={() => skip(current)} last={last} />
      ) : current ? (
        <QuestionCard key={itemKey(current)} item={current} at={run.at} total={run.items.length} cap={cap} onConfirmed={confirmed} onNext={next} last={last} />
      ) : (
        <div className="rvs-end">
          <div className="rvs-end__top">
            <MomentMobi act={reviseEndAct(sum.recalled, sum.recalled + sum.comeBack) || 'idle'} size={88} />
            <p className="rvs-end__line" role="status">{endText(sum.recalled, sum.comeBack) || RUN.end.title}</p>
          </div>
          {sum.held || sum.slipped ? (
            <p className="rvs-end__sub">{[sum.held ? `${sum.held} ${RUN.end.held.toLowerCase()}` : null, sum.slipped ? `${sum.slipped} ${RUN.end.slipped.toLowerCase()}` : null].filter(Boolean).join('. ')}.</p>
          ) : null}
          {sum.cards ? <p className="rvs-end__sub">{fill(RUN.end.cards, { n: sum.cards })}</p> : null}
          {sum.keycards ? <p className="rvs-end__sub">{sum.keycards} {sum.keycards === 1 ? 'Key card' : 'Key cards'} reviewed{kcMissed ? `, ${kcMissed} missed and coming back soon` : ''}.</p> : null}
          {forgot.length ? (
            <p className="rvs-end__sub">
              {[...new Map(forgot.map((f) => [f.unitId, f])).values()].map((f, i) => (
                <span key={f.unitId}>{i ? ', ' : ''}<Link className="rvs-link" href={`/learn/${f.unitId}`}>{RUN.end.reread}: {f.title}</Link></span>
              ))}
            </p>
          ) : null}
          {data.next ? <p className="rvs-end__sub">{data.next}</p> : null}
          <Link className="rvs-next rvs-next--link" href={backHref}>{RUN.end.back}</Link>
        </div>
      )}

      <SmoothDetails className="rvs-how" chevron summary={<span className="rvs-how__sum"><b>{RUN.schedule.title}</b><span>{schedule.line}</span></span>}>
        <div className="rvs-how__body">
          <CapChoice cap={cap} onChange={onCap} disabled={false} />
          <Lanes boxes={lanes} days={data.labels?.boxes} moved={moved} />
        </div>
      </SmoothDetails>
    </section>
  );
}

/** The queue from the server's `queue`, or, from an older server, the question cards alone (the v1 body). */
function queueFrom(data, cap) {
  if (data?.queue && Array.isArray(data.queue.items)) return data.queue;
  return mergeQueue({ questions: (data?.items || []).map((i) => ({ ...i, dueDay: '' })), cap });
}

export default function ReviseRun() {
  const [cap, setCap] = useState(null);
  useEffect(() => { queueMicrotask(() => setCap(readCap())); }, []);
  const read = useRevise({ cap: cap ?? 10, enabled: cap !== null, queue: true });
  const params = useSearchParams();
  const pathname = usePathname();
  const source = ['cards', 'again', 'questions', 'checks', 'keycards'].includes(params.get('source')) ? params.get('source') : null;
  const data = read.data;
  const full = useMemo(() => (data ? queueFrom(data, cap ?? 10) : null), [data, cap]);
  const queue = useMemo(() => (full ? filterSource(full, source) : null), [full, source]);
  // What is due today, for the badge: set when Revise has read it, counted down as answers are confirmed.
  useEffect(() => { if (full) setReviseDue(full.total); }, [full]);

  const backHref = pathname.startsWith('/preview') ? `${pathname}?${(() => { const q = new URLSearchParams(params.toString()); q.set('view', 'review'); q.delete('source'); return q.toString(); })()}` : '/review';
  const allHref = (() => { const q = new URLSearchParams(params.toString()); q.delete('source'); const s = q.toString(); return s ? `${pathname}?${s}` : pathname; })();
  const back = <Link className="rvs-back" href={backHref}><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Your papers</Link>;
  const head = <ArenaHead title={R.title} />;

  if (read.state === 'error' || read.state === 'unavailable') {
    return (
      <section className="pr rvs">
        {back}{head}
        {/* The shared failed state (as on Weak chapters, Review and Progress): one figure, one sentence, one Try again. */}
        <ErrorState scene="unreachable" title={RUN.failed.title} message={RUN.failed.body} onRetry={read.retry} />
      </section>
    );
  }
  if (!data) {
    return (
      <section className="pr rvs">
        {back}{head}
        <div className="rvs-skel" role="status" aria-label="Loading Revise"><span className="skeleton" /><span className="skeleton" /></div>
      </section>
    );
  }
  if (!queue.total) {
    if (data.state === 'empty' && !source) return <section className="pr rvs">{back}{head}<EmptyRevise /></section>;
    // Coming back after today's run: what was done stays said, and when the next ones are due.
    const cappedOut = data.answeredToday >= (data.cap || 10);
    const doneToday = Number(data.answeredToday) > 0 && !source;
    return (
      <section className="pr rvs">
        {back}{head}
        <div className="rvs-empty" aria-labelledby="rvs-empty-h">
          <EmptyMobi act="rest" size={72} />
          <h2 className="rvs-empty__title" id="rvs-empty-h">{doneToday ? RUN.end.title : RUN.headNone}</h2>
          <p>{doneToday && !cappedOut ? `${fill(RUN.end.doneToday, { n: data.answeredToday })} ` : ''}{cappedOut ? R.capReached : data.next || R.nextNone}</p>
          <Link className="rvs-next rvs-next--link" href={backHref}>{RUN.end.back}</Link>
          {source ? <p><Link className="rvs-link" href={allHref}>{RUN.filtered.all}</Link></p> : null}
        </div>
      </section>
    );
  }

  const boxes = (data.boxes || []).map((n, i) => fill(R.run.schedule.box, { n: i + 1, count: n })).map((t, i) => (i ? t.replace(/^Box/, 'box') : t)).join(', ');
  const schedule = { line: fill(RUN.schedule.line, { boxes: `${boxes}.`, cap: data.cap || cap || 10 }), allHref };
  // A run is keyed by what it plays, so a new queue (another cap, another source) starts clean.
  const runKey = `${source || 'all'}:${cap}:${queue.items.map(itemKey).join('|')}`;
  return <RunView key={runKey} queue={queue} data={data} cap={cap ?? 10} onCap={(n) => { saveCap(n); setCap(n); }} source={source} backHref={backHref} schedule={schedule} />;
}
