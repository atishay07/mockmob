"use client";
// Mistake Repair, "Check it held": after the explanation, one fresh bank question tied to the mistake, answered here and marked
// by the server. It is part of the repair's credit (no second charge, no model call). Then the Revise line. The Ask Mobi
// follow-up is not here: it belongs to the original mistake and lives in RepairAsk. The key stays visible: the answered rows show it.
// Pure logic (requests, plans, lines, copy) is in data/repair_check_client.mjs; the contract is in
// data/tests/fixtures/repair4/contract_check_v1.json.
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Minus, Repeat } from 'lucide-react';
import {
  CHECK_COPY, checkAvailability, safeCheckHref, newCheckRequestId, requestCheck, submitCheck, planCheckLoad, planCheckAnswer,
  openRows, answeredRows, poolLine, reviseLine, leadLine,
} from '@/../data/repair_check_client.mjs';
import './repair-check.css';

function Verdict({ right, line, innerRef }) {
  return (
    <p className="mr-chk__verdict" data-right={right ? '' : undefined} tabIndex={-1} ref={innerRef} data-rise style={{ '--mr-rise': 0 }}>
      <span className="mr-chk__mark" aria-hidden="true">
        {right ? <Check size={16} strokeWidth={2.6} /> : <Minus size={15} strokeWidth={2.6} />}
      </span>
      <span>{line}</span>
    </p>
  );
}

// onResult({ right, replayed }): the server marked this check (now, or earlier: replayed). Called once per marked answer,
// only after the server's acknowledgement, so the result row's chip and Mobi's one cheer never run ahead of it.
export default function RepairCheck({ attemptId, questionId, check, style, onResult }) {
  const availability = checkAvailability(check);
  const titleId = useId();
  const stemId = useId();
  const [view, setView] = useState(() => (availability.mode === 'message'
    ? { phase: 'none', message: availability.message, canRetry: availability.canRetry }
    : { phase: 'loading' }));
  const [pick, setPick] = useState(null);
  const seq = useRef(0);
  const requestId = useRef(null);
  const inFlight = useRef(false);
  const focusVerdict = useRef(false);
  const verdict = useRef(null);
  const href = safeCheckHref(check?.href, attemptId, questionId);

  async function load() {
    const mine = ++seq.current;
    requestId.current = null;
    setPick(null);
    setView({ phase: 'loading' });
    const plan = planCheckLoad(await requestCheck(fetch, href));
    if (mine !== seq.current) return;
    if (plan.state === 'ready') setView({ phase: 'ready', check: plan.check, pool: plan.check.pool ?? null });
    else if (plan.state === 'answered') setView({ phase: 'answered', check: plan.check, result: plan.result, replayed: true });
    else if (plan.state === 'none') setView({ phase: 'none', message: plan.message, canRetry: plan.canRetry });
    else setView({ phase: 'loadError', message: plan.message, canRetry: plan.canRetry });
  }

  useEffect(() => {
    if (availability.mode !== 'load') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => { seq.current += 1; };
  // The repair response is read once, when the repair appears; the screen then follows the server's own answers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, questionId]);

  const told = useRef(null);
  useEffect(() => {
    if (view.phase !== 'answered' || !view.result || told.current === view.result) return;
    told.current = view.result;
    onResult?.({ right: view.result.right === true, replayed: !!view.replayed });
  }, [view, onResult]);

  // After the student's own answer the verdict takes focus (the button that sent it is gone). A stored answer does not steal focus.
  useEffect(() => {
    if (view.phase === 'answered' && focusVerdict.current) { focusVerdict.current = false; verdict.current?.focus({ preventScroll: false }); }
  }, [view.phase]);

  async function onSubmit(event) {
    event.preventDefault();
    const open = view.check;
    if (view.phase !== 'ready' || !open || pick === null || inFlight.current) return;
    inFlight.current = true;
    const mine = seq.current;
    try {
      requestId.current ??= newCheckRequestId();
      setView({ phase: 'sending', check: open, pool: view.pool });
      const plan = planCheckAnswer(await submitCheck(fetch, { attemptId, questionId, checkQuestionId: open.checkQuestionId, pick, requestId: requestId.current }));
      if (mine !== seq.current) return;
      if (plan.state === 'answered') {
        focusVerdict.current = true;
        setView({ phase: 'answered', check: open, result: plan.result, replayed: plan.replayed });
      } else if (plan.refetch) {
        setView({ phase: 'ready', check: open, pool: view.pool, error: plan.message, refetch: true });
      } else {
        setView({ phase: 'ready', check: open, pool: view.pool, error: plan.message, canRetry: plan.canRetry });
      }
    } finally { inFlight.current = false; }
  }

  if (!availability.show) return null;
  const { phase } = view;
  const open = view.check;
  const answered = phase === 'answered';
  const rows = answered ? answeredRows(open, view.result) : open ? openRows(open) : [];
  const pool = open ? poolLine(view.pool ?? open.pool) : null;
  const revise = answered ? reviseLine(view.result.revise, view.result.right) : null;
  const sending = phase === 'sending';

  return (
    <section className="mr-chk" data-stagger style={style} data-phase={phase} aria-labelledby={titleId}>
      <header className="mr-chk__head">
        <h5 className="mr-chk__title" id={titleId}>{CHECK_COPY.title}</h5>
        {phase === 'none' || phase === 'loadError' ? null : <p className="mr-chk__lead">{leadLine(open?.basis)}</p>}
      </header>

      {phase === 'loading' ? (
        <div className="mr-chk__load" role="status" aria-live="polite">
          <p className="mr-chk__fine">{CHECK_COPY.loading}</p>
          <div className="mr-chk__skel" aria-hidden="true"><s /><s /><i /><i /><i /><i /><i /><b /><b /><b /><b /><u /></div>
        </div>
      ) : null}

      {phase === 'none' || phase === 'loadError' ? (
        <div className="mr-chk__quiet" role={phase === 'loadError' ? 'alert' : 'status'}>
          <p className="mr-chk__note">{view.message}</p>
          {view.canRetry ? <button type="button" className="mr-retry" onClick={load}>{CHECK_COPY.retryLoad}</button> : null}
        </div>
      ) : null}

      {open && phase !== 'loading' && phase !== 'none' && phase !== 'loadError' ? (
        <form className="mr-chk__body" onSubmit={onSubmit} noValidate>
          {open.basisLine || (!answered && pool) ? (
            <div className="mr-chk__tie">
              {open.basisLine ? <p className="mr-chk__basis">{open.basisLine}</p> : null}
              {!answered && pool ? <p className="mr-chk__fine">{pool}</p> : null}
            </div>
          ) : null}
          <p className="mr-chk__stem" id={stemId}>{open.question}</p>
          <ul className="rp-options mr-chk__opts" role="radiogroup" aria-labelledby={stemId} data-answered={answered || undefined} data-stale={(!answered && view.refetch) || undefined}>
            {rows.map((row) => {
              const optionId = `${stemId}-o${row.index}`;
              const picked = !answered && !view.refetch && pick === row.index;
              return (
                <li
                  key={row.index}
                  data-state={answered ? row.state || undefined : undefined}
                  data-picked={picked || undefined}
                >
                  {/* The radio covers the whole row (invisible), so a click or tap lands on the real control and focus behaves natively. */}
                  <input
                    type="radio" className="mr-chk__radio" name={`${stemId}-pick`} value={row.index} checked={answered ? row.isPick : !view.refetch && pick === row.index}
                    disabled={answered || sending || !!view.refetch} aria-labelledby={optionId} aria-describedby={answered && row.tag ? `${optionId}-tag` : undefined}
                    onChange={() => setPick(row.index)}
                  />
                  <span className="rp-options__letter" aria-hidden="true">{row.letter}</span>
                  <span className="rp-options__text" id={optionId}>{row.text}</span>
                  {answered && row.tag ? <span className="rp-options__tag" id={`${optionId}-tag`}>{row.tag}</span> : null}
                </li>
              );
            })}
          </ul>

          {!answered ? (
            <div className="mr-chk__actions">
              {view.refetch ? (
                <button type="button" className="mr-retry" onClick={load}>{CHECK_COPY.another}</button>
              ) : (
                <button type="submit" className="mr-chk__submit" disabled={pick === null || sending} data-sending={sending || undefined}>
                  {sending ? <><span className="mr-chk__ring" aria-hidden="true" />{CHECK_COPY.marking}</> : view.error && view.canRetry ? CHECK_COPY.retryMark : pick === null ? 'Tap an option above first' : CHECK_COPY.submit}
                </button>
              )}
              {/* A withdrawn question has no first answer to count: the only thing on offer is another question. */}
              {view.refetch ? null : <span className="mr-chk__fine">{CHECK_COPY.firstCounts}</span>}
            </div>
          ) : null}
          {view.error ? <p className="mr-chk__err" role="alert">{view.error}</p> : null}

          {answered ? (
            <div className="mr-chk__result">
              <Verdict right={view.result.right} line={view.result.line} innerRef={verdict} />
              {view.replayed ? <p className="mr-chk__fine" data-rise style={{ '--mr-rise': 1 }}>{CHECK_COPY.answeredEarlier}</p> : null}
              {view.result.explanation ? (
                <div className="mr-block" data-rise style={{ '--mr-rise': 1 }}>
                  <h5 className="mr-label">{CHECK_COPY.explanation}</h5>
                  <p>{view.result.explanation}</p>
                </div>
              ) : null}
              {!view.result.right && view.result.ruleLine ? (
                <div className="mr-block" data-rise style={{ '--mr-rise': 2 }}>
                  <h5 className="mr-label">{CHECK_COPY.yourRule}</h5>
                  <p className="mr-chk__rule">{view.result.ruleLine}</p>
                </div>
              ) : null}
              {revise ? (
                <p className="mr-chk__revise" data-rise style={{ '--mr-rise': 2 }}>
                  <Repeat size={14} strokeWidth={2.3} aria-hidden="true" />
                  <span><Link className="mr-chk__revlink" href="/review/revise">{CHECK_COPY.reviseLabel}</Link> {revise}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
