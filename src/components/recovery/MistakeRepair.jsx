"use client";
// Score Recovery · Mistake Repair for one wrong answer. The server works the question and must
// match the answer key before any repair is shown; a mismatch holds the question for review instead.
import { useContext, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Wrench, Check, Copy, KeyRound, ChevronRight } from 'lucide-react';
import {
  REPAIR_OUTCOMES, hasExplanation, isKeyReview, repairBlocks, marksAtStake, foldedQuestionLine,
  checkChip, REPAIR_COPY, REPAIR_LOADING, recordLines,
} from '@/../data/repair_presentation.mjs';
import { requestRepair, planRepairFailure } from '@/../data/repair_client.mjs';
import { AuthContext } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { usedLine, usesLine } from '@/lib/creditCopy.mjs';
import KeyReviewNotice from './KeyReviewNotice';
import AnswerCorrectionNotice from './AnswerCorrectionNotice';
import RepairMobi from './RepairMobi';
import RepairCheck from './RepairCheck';
import RepairAsk from './RepairAsk';
import RepairTry, { RepairVerdict } from './RepairTry';
import { RETRY_COPY, requestRetry, retryKind, retryMood } from '@/../data/repair_retry.mjs';
import { RUN_COPY, arrowIntent, swipeIntent } from './repairRun';
import './mistake-repair.css';

const newRequestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(16, '0');
// While the repair is written the screen shows one line that changes on real elapsed time (8 s, then 45 s); the route
// allows 90 s. There are no invented stages.
const SLOW_AFTER_MS = REPAIR_LOADING.slowAfterMs;
const LONG_AFTER_MS = REPAIR_LOADING.longAfterMs;

// What a repair costs and what the student has, in the one spend line: "This repair uses 1 AI credit. You have 9."
// The balance is the one the top bar already read (reused for five minutes); unknown shows no number.
// `what` is "The reason" under the try step's "Check my answer"; a repair already saved is free to open again and says so.
function RepairCost({ what = 'This repair', repaired = false }) {
  const auth = useContext(AuthContext);
  const wallet = useWalletSummary(auth?.user?.id, { reuseFresh: true });
  if (repaired) return <p className="mr-cost">{RETRY_COPY.reopenLead}</p>;
  return <p className="mr-cost">{usesLine({ what, cost: 1, pool: 'ai', balance: wallet.wallet?.known ? wallet.wallet.total : null })}</p>;
}

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

function RuleCard({ rule, hook = null, style }) {
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
    <div className="mr-rule" data-stagger style={style}>
      <div className="mr-rule__head">
        <span>{REPAIR_COPY.keepThis}</span>
        <button type="button" className="mr-copy" data-state={copy} onClick={copyRule}>
          {copy === 'done' ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copy === 'done' ? 'Copied' : copy === 'failed' ? 'Could not copy' : 'Copy'}
        </button>
      </div>
      <p>{rule}</p>
      {hook ? <p className="mr-hook"><span>{REPAIR_COPY.toRemember}</span> {hook}</p> : null}
      <span className="mr-sr" role="status">{copy === 'done' ? 'Rule copied.' : copy === 'failed' ? 'The rule could not be copied.' : ''}</span>
    </div>
  );
}

// "The other options (2)": closed by default, opened in place. Rows in the order the student saw the options.
function OtherOptions({ rows, style }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <div className="mr-block mr-others" data-stagger style={style}>
      <button type="button" className="mr-disclose" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((o) => !o)}>
        <ChevronRight className="mr-disclose__icon" size={16} strokeWidth={2.4} aria-hidden="true" />
        <span>{REPAIR_COPY.otherOptionsCount(rows.length)}</span>
      </button>
      <div className="mr-reveal" id={regionId} hidden={!open}>
        <ul className="mr-others__list">
          {rows.map((r) => <li key={r.letter}><b className="mr-others__letter">{r.letter}.</b><span>{r.why}</span></li>)}
        </ul>
      </div>
    </div>
  );
}

// "Explain it another way": the second explanation came in the same response, so this reveals it in place. No call,
// no credit. Focus moves to the revealed heading and the button goes away.
function AnotherWay({ text, style }) {
  const [shown, setShown] = useState(false);
  const heading = useRef(null);
  useEffect(() => { if (shown) heading.current?.focus(); }, [shown]);
  return (
    <div className="mr-block mr-another" data-stagger style={style}>
      {shown ? (
        <div className="mr-reveal">
          <div className="mr-reveal__inner">
            <h5 className="mr-label" ref={heading} tabIndex={-1}>{REPAIR_COPY.anotherWay}</h5>
            <p>{text}</p>
          </div>
        </div>
      ) : (
        <button type="button" className="mr-textbtn" onClick={() => setShown(true)}>{REPAIR_COPY.explainAnother}</button>
      )}
    </div>
  );
}

// A finished repair (spec A.1): blocks 1 to 12 in order, one column. Exported so fixture payloads can be rendered
// on their own (data/tests/repair_wiring.test.mjs): v1, v2 and v3 payloads each keep their own set of blocks.
export function RepairDone({ state, attemptId = null, questionId = null, chosen = null, answer = null, number = null, scheme = 'cuet', insights = null, folded = true, onToggleFold, mobi = null, nextButton = null, next = null, retry = null }) {
  const blocks = repairBlocks(state.repair);
  if (!blocks) return null;
  const fresh = state.status === 'explained';
  const stake = marksAtStake(scheme);
  const v3 = blocks.version === 3;
  const record = recordLines(insights, state.pattern);
  // "Ask Mobi about Q3" follows the explanation (it is about this mistake), then "Check it held" (the fresh question). Both need the ids
  // and the repair response's `check` field.
  const showCheck = !!(state.check && attemptId && questionId);
  // Blocks 2 onwards rise in order on a fresh repair (50 ms apart); a stored repair renders at once.
  const tried = !!retryKind(retry);
  const order = [
    tried && 'verdict', 'head', 'trap', 'wrong', v3 && 'right', v3 && blocks.others.length > 0 && 'others', !v3 && blocks.anotherWay && 'v2another',
    'rule', v3 && blocks.anotherWay && 'another', !v3 && blocks.nextStep && 'nextStep', showCheck && 'ask', showCheck && 'check', record.length > 0 && 'record',
    stake && 'marks', state.practiceHref && 'do', 'foot',
  ].filter(Boolean);
  const stagger = (id) => ({ '--mr-i': order.indexOf(id) });
  const practiceLabel = REPAIR_COPY.practise(state.practiceAction?.chapter || null);
  return (
    <section className="mr mr--panel mr--done" data-fold={folded ? 'folded' : 'open'} data-fresh={fresh || undefined} data-version={blocks.version} aria-label="Mistake Repair">
      <FoldLine number={number} chosen={chosen} answer={answer} folded={folded} onToggle={onToggleFold} animate={fresh && !tried} />
      {tried ? <RepairVerdict retry={retry} stagger={stagger('verdict')} /> : null}
      <header className="mr-head" data-stagger style={stagger('head')}>
        {mobi}
        <div className="mr-head__text">
          <h4 className="mr-title">{blocks.heading || REPAIR_COPY.fallbackHeading}</h4>
          <span className="mr-check"><KeyRound size={14} strokeWidth={2.4} aria-hidden="true" />{checkChip(answer)}</span>
        </div>
      </header>
      <div className="mr-block" data-kind="trap" data-stagger style={stagger('trap')}><h5 className="mr-label">{REPAIR_COPY.whyLooked(chosen)}</h5><p>{blocks.tempting}</p></div>
      <div className="mr-block" data-kind="wrong" data-stagger style={stagger('wrong')}><h5 className="mr-label">{REPAIR_COPY.whereBreaks}</h5><p>{blocks.wrong}</p></div>
      {v3 ? (
        <div className="mr-block" data-kind="right" data-stagger style={stagger('right')}>
          <h5 className="mr-label">{REPAIR_COPY.whyRight(answer)}</h5>
          <p>{blocks.right}</p>
          {blocks.contrast ? <blockquote className="mr-contrast"><p>{blocks.contrast}</p></blockquote> : null}
        </div>
      ) : null}
      {v3 && blocks.others.length ? <OtherOptions rows={blocks.others} style={stagger('others')} /> : null}
      {!v3 && blocks.anotherWay ? (
        <div className="mr-block mr-another" data-stagger style={stagger('v2another')}>
          <h5 className="mr-label">{REPAIR_COPY.anotherWay}</h5>
          <p>{blocks.anotherWay}</p>
          {blocks.contrast ? <blockquote className="mr-contrast"><p>{blocks.contrast}</p></blockquote> : null}
        </div>
      ) : null}
      <RuleCard rule={blocks.rule} hook={v3 ? blocks.hook : null} style={stagger('rule')} />
      {v3 && blocks.anotherWay ? <AnotherWay text={blocks.anotherWay} style={stagger('another')} /> : null}
      {!v3 && blocks.nextStep ? <div className="mr-block mr-next" data-stagger style={stagger('nextStep')}><h5 className="mr-label">{REPAIR_COPY.doThisNext}</h5><p>{blocks.nextStep}</p></div> : null}
      {showCheck ? <RepairAsk attemptId={attemptId} questionId={questionId} number={number} askHref={state.check.askHref} style={stagger('ask')} /> : null}
      {showCheck ? <RepairCheck attemptId={attemptId} questionId={questionId} check={state.check} style={stagger('check')} /> : null}
      {record.length ? (
        <div className="mr-block mr-record" data-stagger style={stagger('record')}>
          <h5 className="mr-label">{REPAIR_COPY.fromRecord}</h5>
          <ul>{record.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </div>
      ) : null}
      {stake ? <p className="mr-marks" data-stagger style={stagger('marks')}>{stake.line}</p> : null}
      {state.practiceHref ? (
        <div className="mr-block mr-do" data-stagger style={stagger('do')}>
          {v3 ? <h5 className="mr-label">{REPAIR_COPY.doThisNext}</h5> : null}
          <Link className={`mr-practice${next ? ' mr-practice--quiet' : ''}`} href={state.practiceHref}>{practiceLabel}</Link>
        </div>
      ) : null}
      <footer className="mr-foot" data-stagger style={stagger('foot')}>
        <span className="mr-fine">{state.status === 'stored' ? 'Saved repair. No credit used.' : state.charged ? usedLine({ cost: typeof state.charged === 'number' ? state.charged : 1, pool: 'ai', balance: state.wallet?.known === false ? null : state.wallet?.total ?? null }) : 'No credit used.'}</span>
        {nextButton || <p className="mr-left">No other mistakes left to repair in this session.</p>}
      </footer>
    </section>
  );
}

// The run props (all optional; without them this is one repair on its own):
//   isCurrent  this is the mistake on screen, so it is the one that shows Mobi
//   earlier    { line, onOpen }: the same question was also answered wrong in another paper (from the record)
//   onStart    the student began this repair (the run's track follows)
//   onStep     (questionId, -1 | 1): a swipe or an arrow key asks for the mistake before or after
//   onFinish   there is nothing left to open: the last key says Finish and shows the ending
//   handover   'a' | 'b': this panel was just brought back by the track and rises in over 160 ms
//   insights   { lines: [{ kind, text }] } | null: this answer's "From your record" sentences, built on the server
export default function MistakeRepair({ attemptId, questionId, chosen, answer, number = null, scheme = 'cuet', nta = false, autoStart = false, question = null, before = null, source = null, repaired = false, onSettled, onReview, initialReview = null, next = null, isCurrent = true, earlier = null, onStart, onStep, onFinish, handover = null, insights = null }) {
  const [state, setState] = useState({ status: 'idle' });
  const [slow, setSlow] = useState(false);
  const [long, setLong] = useState(false);
  const [folded, setFolded] = useState(true);
  // One request ID per repair attempt: a retry after a lost response reuses it, so it is never charged twice.
  // After a failure the server reports as `charged: 0` the request is released, so the next try gets a fresh one.
  const requestId = useRef(null);
  const started = useRef(false);
  const inFlight = useRef(false);
  // The try before the key. `retry` is the server's marking of the student's second try; `retryRef` is what the paid call carries.
  const [pick, setPick] = useState(null);
  const [retry, setRetry] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const retryRef = useRef(null);
  const canTry = !!(question && Array.isArray(question.options) && question.options.length >= 2) && !repaired;

  // "Check my answer": the server marks the pick at once (free), the verdict shows, and the reason is written under it.
  async function check() {
    if (pick === null || checking || inFlight.current) return;
    setChecking(true);
    setCheckFailed(false);
    const outcome = await requestRetry(fetch, { attemptId, questionId, retry_pick: pick });
    setChecking(false);
    if (outcome.kind === 'failed') { setCheckFailed(true); return; }
    // Declined (a key under review, not a mistake): the repair says why in its own words, with no verdict.
    retryRef.current = outcome.kind === 'marked' ? outcome.retry : null;
    setRetry(retryRef.current);
    run();
  }
  // "Show the reason now": the same repair with no try and no verdict.
  function skip() { retryRef.current = null; setRetry(null); run(); }
  function openTry() { started.current = true; onStart?.(questionId); setState({ status: 'try' }); }

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      onStart?.(questionId);
      requestId.current ??= newRequestId();
      setSlow(false);
      setLong(false);
      setState({ status: 'loading' });
      // Stops waiting after 95 s (the route's own budget is 90 s), then says so calmly.
      const outcome = await requestRepair(fetch, '/api/recovery/repair', { attemptId, questionId, requestId: requestId.current, ...(retryRef.current ? { retry_pick: retryRef.current.pick } : {}) });
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
        setState({ status: failure.status, message: failure.message, canRetry: failure.canRetry, code: body?.error || null });
        return;
      }
      // Every payload version (v3, v2 and v1) must be complete to show; half a repair is never shown.
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
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    const longTimer = setTimeout(() => setLong(true), LONG_AFTER_MS);
    return () => { clearTimeout(slowTimer); clearTimeout(longTimer); };
  }, [state.status]);

  useEffect(() => {
    if (!autoStart || started.current || initialReview) return;
    started.current = true;
    queueMicrotask(canTry ? openTry : run);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialReview]);

  // `next` is computed by the page from the mistakes not yet handled, never counting this one.
  const nextButton = next
    ? <button type="button" className="mr-next-btn" onClick={next.go}>Next mistake: Q{next.number}</button>
    : onFinish ? <button type="button" className="mr-next-btn" onClick={onFinish}>{RUN_COPY.finish}</button> : null;
  // With a verdict on screen Mobi keeps its act while the reason is written; before it he listens.
  const verdicted = !!retryKind(retry);
  const mobiStatus = verdicted && (state.status === 'try' || state.status === 'loading') ? retryMood(retryKind(retry)) : state.status;
  const mobi = nta ? null : <RepairMobi status={mobiStatus} slow={slow} stepKey={`${attemptId}/${questionId}`} visible={isCurrent} />;

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
          <button type="button" className="mr-start" onClick={() => { if (canTry) openTry(); else { started.current = true; run(); } }}>
            <span className="mr-start__icon" aria-hidden="true"><Wrench size={18} strokeWidth={2.4} /></span>
            <span className="mr-start__text"><b>{repaired ? 'Open your repair' : 'Repair this mistake'}</b><small>Why {chosen ? `option ${chosen}` : 'your answer'} looked right, why the key is right and one rule to keep</small></span>
            <span className="mr-start__cost">{repaired ? 'Free' : '1 AI credit'}</span>
          </button>
          <RepairCost repaired={repaired} />
        </div>
      );
    }
    // The try step: the question again with no key (pick, checking), then the verdict with the reason being written under it.
    const tryPanel = (phase, under = null) => (
      <RepairTry number={number} question={question} options={question.options} before={before} source={source} phase={phase} pick={pick} retry={retry}
        failed={checkFailed} onPick={setPick} onCheck={check} onSkip={skip} cost={<RepairCost what="The reason" />} mobi={mobi}>{under}</RepairTry>
    );
    if (state.status === 'try') return tryPanel(checking ? 'checking' : 'pick');
    if (state.status === 'loading') {
      const line = long ? REPAIR_LOADING.long : slow ? REPAIR_LOADING.slow : REPAIR_LOADING.writing(number);
      if (verdicted) {
        return tryPanel('checked', (
          <div role="status" aria-live="polite"><p className="mr-wait" data-phase={long ? 'long' : slow ? 'slow' : 'writing'}><span className="mr-wait__ring" aria-hidden="true" /><span key={line} className="mr-wait__line">{line}</span></p></div>
        ));
      }
      return (
        <div className="mr mr--panel mr--loading" role="status" aria-live="polite" data-has-mobi={mobi ? true : undefined}>
          <div className="mr-top">
            {mobi}
            <p className="mr-wait" data-phase={long ? 'long' : slow ? 'slow' : 'writing'}>
              <span className="mr-wait__ring" aria-hidden="true" />
              <span key={line} className="mr-wait__line">{line}</span>
            </p>
          </div>
        </div>
      );
    }
    if ((state.status === 'error' || state.status === 'waiting') && verdicted) {
      return tryPanel('checked', (
        <>
          <p className="mr-note" role={state.status === 'waiting' ? 'status' : 'alert'}>{state.message}</p>
          {state.canRetry ? <button type="button" className="mr-retry" onClick={run}>{state.status === 'waiting' ? 'Check again' : 'Try again'}</button> : null}
          {state.code === 'insufficient_ai_credits' ? (
            <p className="mr-note mr-ways"><Link href="/dashboard?mode=quick&count=5">Practise 5 fresh questions</Link> <Link href="/pricing/ai-credits">See your AI credits</Link></p>
          ) : null}
        </>
      ));
    }
    if (state.status === 'error' || state.status === 'waiting') {
      return (
        <div className="mr mr--panel" role={state.status === 'waiting' ? 'status' : 'alert'}>
          <div className="mr-top">
            {mobi}
            <p className="mr-note">{state.message}</p>
          </div>
          {state.canRetry ? <button type="button" className="mr-retry" onClick={run}>{state.status === 'waiting' ? 'Check again' : 'Try again'}</button> : null}
          {/* Out of AI credits: the free ways forward, not a dead end. */}
          {state.code === 'insufficient_ai_credits' ? (
            <p className="mr-note mr-ways"><Link href="/dashboard?mode=quick&count=5">Practise 5 fresh questions</Link> <Link href="/pricing/ai-credits">See your AI credits</Link></p>
          ) : null}
        </div>
      );
    }
    if (state.status === 'held_for_recheck') {
      return <KeyReviewNotice chosenLetter={chosen} keyLetter={answer} dispute={state.dispute} message={state.message} next={nextButton} practiceHref={state.practiceHref} />;
    }
    if (state.status === 'not_explained') {
      return (
        <div className="mr mr--panel" role="status" data-tone="warn">
          {verdicted ? <RepairVerdict retry={retry} focus={false} /> : null}
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
    return <RepairDone state={state} attemptId={attemptId} questionId={questionId} chosen={chosen} answer={answer} number={number} scheme={scheme} insights={insights}
      folded={folded} onToggleFold={() => setFolded(f => !f)} mobi={mobi} nextButton={nextButton} next={next} retry={state.retry || retry} />;
  })();
  return <div className="mr-shell" data-handover={handover || undefined} {...shellProps}>{earlierEl}{content}</div>;
}
