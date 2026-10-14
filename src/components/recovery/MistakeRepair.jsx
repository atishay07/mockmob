"use client";
// Score Recovery · Mistake Repair for one wrong answer. The server works the question and must
// match the answer key before any repair is shown; a mismatch holds the question for review instead.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Wrench, Check, ArrowRight, Copy } from 'lucide-react';
import { REPAIR_OUTCOMES, hasExplanation, isKeyReview, repairBlocks, marksAtStake, foldedQuestionLine } from '@/../data/repair_presentation.mjs';
import { requestRepair, planRepairFailure } from '@/../data/repair_client.mjs';
import KeyReviewNotice from './KeyReviewNotice';
import AnswerCorrectionNotice from './AnswerCorrectionNotice';
import RepairMobi from './RepairMobi';
import { RUN_COPY, arrowIntent, swipeIntent } from './repairRun';
import './mistake-repair.css';

const newRequestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(16, '0');
// The stages the server runs, in order. The display advances on a timer; the result decides the outcome.
const STAGES = ['Working through the question', 'Checking against the answer key', 'Writing your repair'];
// After this long the screen says plainly that the repair is still running (the route allows 90 s).
const SLOW_AFTER_MS = 8000;

// "Q7. Your pick B. Key C." as a small reveal: the pick settles, then the key's ring draws and fills.
// A stored repair (or reduced motion, via CSS) paints the final state at once.
function FoldLine({ number, chosen, answer, folded, onToggle, animate }) {
  const line = foldedQuestionLine({ number, chosen, answer });
  return (
    <div className="mr-fold" data-animate={animate || undefined}>
      <p className="mr-fold__line">
        <span className="mr-sr">{line}</span>
        {Number.isInteger(number) ? <b className="mr-fold__q" aria-hidden="true">Q{number}</b> : null}
        {chosen ? <span className="mr-pick" data-kind="mine" aria-hidden="true"><i className="mr-bubble">{chosen}</i><span className="mr-pick__label">Your answer</span></span> : null}
        {answer ? (
          <span className="mr-pick" data-kind="key" aria-hidden="true">
            <i className="mr-bubble">
              <svg viewBox="0 0 34 34" focusable="false"><circle cx="17" cy="17" r="15.5" pathLength="100" /></svg>
              <span>{answer}</span>
            </i>
            <span className="mr-pick__label">Correct answer</span>
          </span>
        ) : null}
      </p>
      <button type="button" className="mr-fold__toggle" aria-expanded={!folded} onClick={onToggle}>{folded ? 'Show the question' : 'Hide the question'}</button>
    </div>
  );
}

function RuleCard({ rule }) {
  const [copy, setCopy] = useState('idle');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyRule() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(rule);
      setCopy('done');
    } catch {
      setCopy('failed');
    }
    timer.current = setTimeout(() => setCopy('idle'), 2200);
  }
  return (
    <div className="mr-rule">
      <div className="mr-rule__head">
        <span>Keep this</span>
        <button type="button" className="mr-copy" data-state={copy} onClick={copyRule}>
          {copy === 'done' ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copy === 'done' ? 'Copied' : copy === 'failed' ? 'Could not copy' : 'Copy'}
        </button>
      </div>
      <p>{rule}</p>
      <span className="mr-sr" role="status">{copy === 'done' ? 'Rule copied.' : copy === 'failed' ? 'The rule could not be copied.' : ''}</span>
    </div>
  );
}

// The run props (all optional; without them this is one repair on its own):
//   isCurrent  this is the mistake on screen, so it is the one that shows Mobi
//   earlier    { line, onOpen }: the same question was also answered wrong in another paper (from the record)
//   onStart    the student began this repair (the run's track follows)
//   onStep     (questionId, -1 | 1): a swipe or an arrow key asks for the mistake before or after
//   onFinish   there is nothing left to open: the last key says Finish and shows the ending
//   handover   'a' | 'b': this panel was just brought back by the track and rises in over 160 ms
export default function MistakeRepair({ attemptId, questionId, chosen, answer, number = null, scheme = 'cuet', nta = false, autoStart = false, onSettled, onReview, initialReview = null, next = null, isCurrent = true, earlier = null, onStart, onStep, onFinish, handover = null }) {
  const [state, setState] = useState({ status: 'idle' });
  const [stage, setStage] = useState(0);
  const [slow, setSlow] = useState(false);
  const [folded, setFolded] = useState(true);
  // One request ID per repair attempt: a retry after a lost response reuses it, so it is never charged twice.
  // After a failure the server reports as `charged: 0` the request is released, so the next try gets a fresh one.
  const requestId = useRef(null);
  const started = useRef(false);
  const inFlight = useRef(false);

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      onStart?.(questionId);
      requestId.current ??= newRequestId();
      setStage(0);
      setSlow(false);
      setState({ status: 'loading' });
      // Stops waiting after 95 s (the route's own budget is 90 s), then says so calmly.
      const outcome = await requestRepair(fetch, '/api/recovery/repair', { attemptId, questionId, requestId: requestId.current });
      if (outcome.kind !== 'response') {
        const failure = planRepairFailure(outcome);
        setState({ status: failure.status, message: failure.message, canRetry: failure.canRetry });
        return;
      }
      const { res, body } = outcome;
      if (!res.ok || !body?.ok) {
        if (body?.review) {
          onReview?.(questionId, body.review);
          setState({ status: 'answer_review', review: body.review });
          return;
        }
        // Already being re-checked (earlier, or after a reload): same acknowledgement, no retry.
        if (isKeyReview(null, body?.error)) {
          setState({ status: 'held_for_recheck', ...body, ok: true });
          onSettled?.(questionId, 'held_for_recheck');
          return;
        }
        // A released attempt (`charged: 0`) cannot be reused; the next try starts a fresh request.
        // The server's own message is shown whenever it sent one.
        const failure = planRepairFailure(outcome);
        if (failure.resetRequest) requestId.current = null;
        setState({ status: failure.status, message: failure.message, canRetry: failure.canRetry });
        return;
      }
      // Both payload versions: v2 (trap, another way, rule) and v1 (the three blocks) must be complete to show.
      if (!REPAIR_OUTCOMES.includes(body.status) || (hasExplanation(body.status) && !repairBlocks(body.repair))) {
        setState({ status: 'error', message: 'The repair response was incomplete. Try again with the same request.', canRetry: true });
        return;
      }
      setFolded(true);
      setState({ status: body.status, ...body });
      onSettled?.(questionId, body.status);
    } finally { inFlight.current = false; }
  }

  useEffect(() => {
    if (state.status !== 'loading') return undefined;
    const timer = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 1)), 1400);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => { clearInterval(timer); clearTimeout(slowTimer); };
  }, [state.status]);

  useEffect(() => {
    if (!autoStart || started.current || initialReview) return;
    started.current = true;
    queueMicrotask(run);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialReview]);

  // `next` is computed by the page from the mistakes not yet handled, never counting this one.
  const nextButton = next
    ? <button type="button" className="mr-next-btn" onClick={next.go}>Next mistake: Q{next.number} <ArrowRight size={16} aria-hidden="true" /></button>
    : onFinish ? <button type="button" className="mr-next-btn" onClick={onFinish}>{RUN_COPY.finish}</button> : null;
  const pickName = chosen ? chosen : 'your answer';
  const mobi = nta ? null : <RepairMobi status={state.status} slow={slow} stepKey={`${attemptId}/${questionId}`} visible={isCurrent} />;

  const review = state.review || initialReview;

  // The run's gestures live on the panel: a flick sideways or the arrow keys step to a mistake already reached.
  const touch = useRef(null);
  const shellProps = onStep ? {
    onPointerDown: (e) => { touch.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; },
    onPointerUp: (e) => {
      const from = touch.current; touch.current = null;
      if (!from) return;
      const intent = swipeIntent({ dx: e.clientX - from.x, dy: e.clientY - from.y, ms: performance.now() - from.t });
      if (intent) onStep(questionId, intent === 'prev' ? -1 : 1);
    },
    onPointerCancel: () => { touch.current = null; },
    onKeyDown: (e) => { const intent = arrowIntent(e); if (intent) { e.preventDefault(); onStep(questionId, intent === 'prev' ? -1 : 1); } },
  } : {};
  const earlierEl = earlier && !review ? (
    <Link className="mr-earlier" href={earlier.href} aria-label={`${earlier.line} ${RUN_COPY.openThatResult}`}>
      <svg className="mr-earlier__glyph" viewBox="0 0 20 14" focusable="false" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><circle cx="13" cy="7" r="5.5" /></svg>
      <span className="mr-earlier__text">{earlier.line}</span>
      <i className="mr-earlier__chev" aria-hidden="true" />
    </Link>
  ) : null;

  const content = (() => {
    if (review?.state === 'corrected' || review?.state === 'key_changed_unverified') return <AnswerCorrectionNotice review={review} next={nextButton} />;
    if (review) return <KeyReviewNotice chosenLetter={chosen} keyLetter={answer} reviewState={review.state} next={nextButton} />;

    if (state.status === 'idle') {
      return (
        <div className="mr">
          <button type="button" className="mr-start" onClick={() => { started.current = true; run(); }}>
            <span className="mr-start__icon" aria-hidden="true"><Wrench size={18} strokeWidth={2.4} /></span>
            <span className="mr-start__text"><b>Repair this mistake</b><small>Why {chosen ? `option ${chosen}` : 'your answer'} looked right, where it breaks, and the rule to keep</small></span>
            <span className="mr-start__cost">1 credit</span>
          </button>
        </div>
      );
    }
    if (state.status === 'loading') {
      return (
        <div className="mr mr--panel" role="status" aria-live="polite" data-has-mobi={mobi ? true : undefined}>
          <div className="mr-top">
            {mobi}
            <div className="mr-top__text">
              <b className="mr-title">Repairing this mistake</b>
              <p className="mr-slow" data-on={slow || undefined}>{slow ? 'Still working on this one. It can take up to a minute.' : 'This usually takes a few seconds.'}</p>
            </div>
          </div>
          <ol className="mr-stages">
            {STAGES.map((s, i) => <li key={s} data-state={i < stage ? 'done' : i === stage ? 'active' : 'todo'}>{s}</li>)}
          </ol>
        </div>
      );
    }
    if (state.status === 'error' || state.status === 'waiting') {
      return (
        <div className="mr mr--panel" role={state.status === 'waiting' ? 'status' : 'alert'}>
          <div className="mr-top">
            {mobi}
            <p className="mr-note">{state.message}</p>
          </div>
          {state.canRetry ? <button type="button" className="mr-retry" onClick={run}>{state.status === 'waiting' ? 'Check again' : 'Try again'}</button> : null}
        </div>
      );
    }
    if (state.status === 'held_for_recheck') {
      return <KeyReviewNotice chosenLetter={chosen} keyLetter={answer} dispute={state.dispute} message={state.message} next={nextButton} practiceHref={state.practiceHref} />;
    }
    if (state.status === 'not_explained') {
      return (
        <div className="mr mr--panel" role="status" data-tone="warn">
          <div className="mr-top">
            {mobi}
            <div className="mr-top__text">
              <b className="mr-title">No repair for this one</b>
              <p className="mr-note">{state.message}</p>
            </div>
          </div>
          <div className="mr-foot">
            {nextButton}
            {state.practiceHref ? <Link className="mr-practice mr-practice--quiet" href={state.practiceHref}>Practise 5 on this chapter</Link> : null}
          </div>
        </div>
      );
    }
    const blocks = repairBlocks(state.repair);
    if (!blocks) return null;
    const fresh = state.status === 'explained';
    const stake = marksAtStake(scheme);
    return (
      <section className="mr mr--panel mr--done" data-fold={folded ? 'folded' : 'open'} data-fresh={fresh || undefined} data-version={blocks.version} aria-label="Mistake Repair">
        <FoldLine number={number} chosen={chosen} answer={answer} folded={folded} onToggle={() => setFolded(f => !f)} animate={fresh} />
        <header className="mr-head">
          {mobi}
          <div className="mr-head__text">
            <h4 className="mr-title">{blocks.heading || 'Mistake Repair'}</h4>
            <span className="mr-check"><Check size={14} strokeWidth={3} aria-hidden="true" />Checked against the answer key{answer ? ` (${answer})` : ''}</span>
          </div>
        </header>
        <div className="mr-cards">
          <div className="mr-card" data-kind="trap"><span>Why {pickName} looked right</span><p>{blocks.tempting}</p></div>
          <div className="mr-card" data-kind="wrong"><span>Where it breaks</span><p>{blocks.wrong}</p></div>
        </div>
        {blocks.anotherWay ? (
          <div className="mr-another">
            <span>Another way to see it</span>
            <p>{blocks.anotherWay}</p>
            {blocks.contrast ? <blockquote className="mr-contrast"><p>{blocks.contrast}</p></blockquote> : null}
          </div>
        ) : null}
        <RuleCard rule={blocks.rule} />
        {blocks.nextStep ? <div className="mr-next"><span>Do this next</span><p>{blocks.nextStep}</p></div> : null}
        {stake ? <p className="mr-marks">{stake.line}</p> : null}
        <footer className="mr-foot">
          {nextButton || <p className="mr-left">No other mistakes left to repair in this session.</p>}
          {state.practiceHref ? <Link className={`mr-practice${next ? ' mr-practice--quiet' : ''}`} href={state.practiceHref}>Practise 5 on this chapter</Link> : null}
          <span className="mr-fine">{state.status === 'stored' ? 'Saved repair. No credit used.' : state.charged ? `1 credit used${state.wallet ? `. ${state.wallet.total} left.` : '.'}` : 'No credit used.'}</span>
        </footer>
      </section>
    );

  })();
  return <div className="mr-shell" data-handover={handover || undefined} {...shellProps}>{earlierEl}{content}</div>;
}
