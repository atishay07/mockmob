"use client";

// "Bring a mistake from any test" (16 Nov 2026), drawn inside Ask Mobi's own surface: the docked panel, the overlay, the phone
// sheet and the /mentor page. The words, the request rules, the reply contract and the state mapping are in
// src/services/mobi/bringMistake.mjs (pure, tested); the server is POST /api/ai/mentor/mistake.
//
//  * MistakeDoor: the one quiet door, "Got one wrong in another test? Paste it here.", with its price said before the tap.
//  * BringMistake: the form (the question with its options, counted to 1,500; the answer chosen and the right answer, both
//    optional; the subject, the student's own), the price before sending and the one volt key. Then the answer, drawn only
//    once the server has answered and the answer has passed the contract again here: what it tests, why the answer is what
//    it is (or that Mobi is not sure), the likely slip, and 2 checks answered in place with the home sample's option grammar.
//
// States: idle, typing (the count), sending, answered, failed (Try again, a new request), unknown (Try again, the SAME request,
// so it can never be charged twice), over this month's AI limit, no credits, paused, offline, refused (not a test question)
// and the fixed support reply. Nothing is shown as answered before the server says so.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import MobiMark from './MobiMark';
import { needsSupport, SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { usedLine } from '@/lib/creditCopy.mjs';
import {
  MISTAKE_COPY, MISTAKE_LIMITS, checksTally, cleanText, countLine, mistakeOutcome, mistakeSubjects, nextStep, optionState, priceLine,
  verdictLine,
} from '@/services/mobi/bringMistake.mjs';
import './bring-mistake.css';

const LETTERS = 'ABCD';
// The model has 35 s; the route's own reads sit around it. A reply later than this is an unknown outcome: Try again sends the
// same request, which the server answers from what it stored (never a second charge).
const SEND_TIMEOUT_MS = 60_000;
const newRequestId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`);

async function postMistake(payload) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SEND_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ai/mentor/mistake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const body = await res.json().catch(() => null);
    return timedOut ? { kind: 'timeout' } : { kind: 'response', res: { ok: res.ok, status: res.status }, body };
  } catch {
    return { kind: timedOut ? 'timeout' : 'network' };
  } finally { clearTimeout(timer); }
}

/** The one quiet door into the form. Its price is said on it, before the tap. */
export function MistakeDoor({ onOpen, variant = 'panel' }) {
  return (
    <button type="button" className="bm-door" data-variant={variant} onClick={onOpen}>
      <span className="bm-door__text">{MISTAKE_COPY.door}</span>
      <em className="bm-door__price">{MISTAKE_COPY.doorPrice}</em>
    </button>
  );
}

function CheckBlock({ check, i, n, picked, onPick }) {
  const stemId = useId();
  const answered = Number.isInteger(picked);
  const verdict = verdictLine(check, picked);
  return (
    <fieldset className="bm-q" data-answered={answered || undefined}>
      <legend className="bm-q__n">{MISTAKE_COPY.questionOf(i + 1, n)}</legend>
      <p className="bm-q__stem" id={stemId}>{check.question}</p>
      <div className="bm-opts" role="group" aria-labelledby={stemId}>
        {check.options.map((text, index) => {
          const state = optionState({ picked, answer: check.answer, index });
          return (
            <button
              key={index} type="button" className="bm-opt" data-state={state} disabled={answered}
              aria-pressed={answered ? index === picked : false} onClick={() => onPick(index)}
            >
              <span className="bm-opt__key" aria-hidden="true">{LETTERS[index]}</span>
              <span className="bm-opt__text">{text}</span>
              {state === 'correct' ? <Check className="bm-opt__mark" size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
              {state === 'wrong' ? <X className="bm-opt__mark" size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
              {state === 'correct' ? <span className="sr-only">, the right answer</span> : state === 'wrong' ? <span className="sr-only">, your pick</span> : null}
            </button>
          );
        })}
      </div>
      <div className="bm-q__foot" aria-live="polite">
        {answered ? (
          <div className="bm-why">
            <p className="bm-verdict" data-right={picked === check.answer || undefined}>{verdict}</p>
            <p className="bm-reason">{check.reason}</p>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function Answer({ answer, wallet, onLeave, onAnother, headRef }) {
  const { mistake, subject, question, chosen, charged, replayed } = answer;
  const [picks, setPicks] = useState([null, null]);
  const tally = checksTally(mistake.checks, picks);
  const next = nextStep(subject);
  const spent = replayed && !charged ? MISTAKE_COPY.replayedCharge
    : charged ? usedLine({ cost: charged, pool: 'ai', balance: wallet?.known ? wallet.total : null }) : 'No credit used.';
  return (
    <article className="bm-answer amb-rise" aria-labelledby="bm-tests">
      <figure className="amb-quote bm-quote">
        <figcaption>{MISTAKE_COPY.yourQuestion}{subject?.name ? `, ${subject.name}` : ''}</figcaption>
        <p>{question}</p>
        {chosen ? <span className="bm-quote__pick">You chose <b>{chosen}</b></span> : null}
      </figure>

      <section className="bm-part">
        <h3 id="bm-tests" tabIndex={-1} ref={headRef}>{MISTAKE_COPY.tests}</h3>
        <p>{mistake.tests}</p>
      </section>
      <section className="bm-part">
        <h3>{MISTAKE_COPY.why}</h3>
        {mistake.answer.sure
          ? <p className="bm-key">{MISTAKE_COPY.answerIs(mistake.answer.text)}</p>
          : <p className="bm-unsure">{MISTAKE_COPY.notSure}</p>}
        <p>{mistake.why}</p>
      </section>
      {mistake.slip ? (
        <section className="bm-part">
          <h3>{MISTAKE_COPY.slip}</h3>
          <p>{mistake.slip}</p>
        </section>
      ) : null}

      <section className="bm-checks" aria-labelledby="bm-checks-title">
        <h3 id="bm-checks-title">{MISTAKE_COPY.checksTitle}</h3>
        <p className="bm-honest">{MISTAKE_COPY.honesty}</p>
        {mistake.checks.map((check, i) => (
          <CheckBlock key={i} check={check} i={i} n={mistake.checks.length} picked={picks[i]} onPick={(index) => setPicks((prev) => prev.map((p, j) => (j === i && !Number.isInteger(p) ? index : p)))} />
        ))}
        {tally ? <p className="bm-tally" role="status">{tally}</p> : null}
      </section>

      <p className="bm-next"><Link href={next.href} className="amb-link bm-next__link" onClick={onLeave}>{next.label}</Link></p>
      <span className="amb-src"><MobiMark size={15} />Written reply. {spent}</span>
      <button type="button" className="amb-btn amb-btn--line bm-another" onClick={onAnother}>{MISTAKE_COPY.another}</button>
    </article>
  );
}

/**
 * The form and its answer. `wallet`/`paid` are the panel's (paidState); `form` is the panel's form ('dock' | 'overlay' |
 * 'sheet' | 'page'). `onSpent` reads the wallet again after any answer; `onPending(bool)` lets the page's Mobi think.
 */
export default function BringMistake({ user, wallet, paid, offline, form = 'dock', onBack = null, onSpent = null, onPending = null, onLeave = null }) {
  const subjects = useMemo(() => mistakeSubjects(user?.subjects), [user?.subjects]);
  const [question, setQuestion] = useState('');
  const [chosen, setChosen] = useState('');
  const [key, setKey] = useState('');
  const [subject, setSubject] = useState(subjects[0]?.id || '');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [answer, setAnswer] = useState(null);
  const pendingRef = useRef(null);
  const inFlight = useRef(false);
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  const fieldRef = useRef(null);
  const headRef = useRef(null);
  const ids = { q: useId(), count: useId(), photos: useId(), chosen: useId(), key: useId(), subject: useId(), price: useId() };
  // One volt key per view: the docked panel and the overlay sit outside the page (#app-main), beside the sidebar's lime Start
  // key. While the form's key is on screen, a marker in the page says the view owns its primary (the shell's own data-owns-start
  // contract, AppLayoutClient), so that Start key steps back. The phone sheet covers the dock itself; the page form marks its key.
  const [shellMain] = useState(() => (typeof document !== 'undefined' && (form === 'dock' || form === 'overlay') ? document.getElementById('app-main') : null));

  // On a phone the form opens without the keyboard (focus on its title); with a mouse the question box takes focus at once.
  useEffect(() => {
    let fine = false;
    try { fine = window.matchMedia('(pointer: fine)').matches; } catch { fine = false; }
    (fine && form !== 'sheet' ? fieldRef.current : titleRef.current)?.focus({ preventScroll: true });
  }, [form]);

  // The phone's keyboard: the sheet sits on the visible part of the screen (the visual viewport), so the send key at its foot
  // is never under the keyboard. Only the sheet moves; the page and the docked panel scroll as they always did.
  useLayoutEffect(() => {
    if (form !== 'sheet') return undefined;
    const sheet = rootRef.current?.closest('.amb-panel--sheet');
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!sheet || !vv) return undefined;
    const update = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      sheet.style.setProperty('--amb-kb', `${kb}px`);
      sheet.style.setProperty('--amb-vh', `${Math.round(vv.height)}px`);
      sheet.toggleAttribute('data-keyboard', kb > 80);
      // The field being typed in stays in the shorter body, above the key.
      const active = document.activeElement;
      if (kb > 80 && active && rootRef.current?.contains(active) && /^(TEXTAREA|INPUT|SELECT)$/.test(active.tagName)) {
        window.requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }));
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      sheet.style.removeProperty('--amb-kb');
      sheet.style.removeProperty('--amb-vh');
      sheet.removeAttribute('data-keyboard');
    };
  }, [form]);

  useEffect(() => { onPending?.(sending); }, [sending, onPending]);
  useEffect(() => () => onPending?.(false), [onPending]);

  useEffect(() => {
    if (!answer) return;
    let reduced = false;
    try { reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { reduced = true; }
    headRef.current?.focus({ preventScroll: true });
    // In the panel the answer is the body's first thing: the body goes back to its top. On the page, the answer comes into view
    // under the top bar (its scroll-margin).
    if (form === 'page') rootRef.current?.querySelector('.bm-answer')?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    else rootRef.current?.querySelector('.bm-body')?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [answer, form]);

  const typed = question.trim();
  // As the server checks: the words as typed and as cleaned, so an invisible character cannot split a phrase.
  const distress = [question, chosen, key].some((t) => needsSupport(t) || needsSupport(cleanText(t)));
  const held = notice?.state === 'unknown'; // a request whose outcome is not known: only Try again (the same request) goes out
  const stopped = notice?.state === 'over';
  const canSend = Boolean(typed) && question.length <= MISTAKE_LIMITS.question && !sending && !held && !stopped
    && (distress || (paid?.open && !offline));
  const balance = wallet?.known && Number.isFinite(wallet.total) ? wallet.total : null;
  // The line before sending says what sending does: free for the support reply, nothing at all past this month's AI limit (the
  // notice above says why), else the price with the balance, or why written answers wait.
  const priceWords = distress ? MISTAKE_COPY.free
    : stopped ? MISTAKE_COPY.recordFree
      : offline ? MISTAKE_COPY.offline : paid?.open ? priceLine(balance) : paid?.why || priceLine(balance);
  const noCredits = Boolean(wallet?.known) && Number.isFinite(wallet?.total) && wallet.total <= 0;

  async function send({ again = false } = {}) {
    if (inFlight.current) return;
    if (!again) {
      if (!typed) return;
      // Words that sound like distress: the support reply, free, offline too (the server answers it too, before anything else).
      if (distress && offline) { setNotice({ state: 'support', reply: SUPPORT_REPLY }); return; }
      if (!distress && (!paid?.open || offline)) return;
      pendingRef.current = { id: newRequestId(), payload: { question, chosen: chosen.trim() || null, key: key.trim() || null, subject } };
    }
    if (!pendingRef.current) return;
    inFlight.current = true;
    setSending(true);
    setNotice(null);
    const sent = pendingRef.current;
    let plan;
    try {
      plan = mistakeOutcome(await postMistake({ ...sent.payload, requestId: sent.id }));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
    // The wallet is read again after every definite or unknown outcome, so the balance shown is the one stored.
    onSpent?.();
    if (plan.state === 'unknown') { setNotice(plan); return; }
    pendingRef.current = null;
    if (plan.state === 'answered') {
      const picked = subjects.find((s) => s.id === sent.payload.subject) || subjects[0] || null;
      setAnswer({ mistake: plan.mistake, charged: plan.charged, replayed: plan.replayed, subject: picked, question: sent.payload.question.trim(), chosen: sent.payload.chosen });
      return;
    }
    setNotice(plan);
  }

  function another() {
    setAnswer(null);
    setQuestion(''); setChosen(''); setKey('');
    setNotice(null);
    window.requestAnimationFrame(() => (titleRef.current || fieldRef.current)?.focus({ preventScroll: false }));
  }

  if (answer) {
    return (
      <div className="bm" data-form={form} ref={rootRef}>
        <div className="amb-body bm-body">
          <h3 className="sr-only" tabIndex={-1} ref={titleRef}>{MISTAKE_COPY.title}</h3>
          <Answer answer={answer} wallet={wallet} onLeave={onLeave} onAnother={another} headRef={headRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="bm" data-form={form} ref={rootRef}>
      {shellMain ? createPortal(<span hidden data-owns-start="" />, shellMain) : null}
      <form className="bm-form" aria-labelledby="bm-title" onSubmit={(event) => { event.preventDefault(); send(); }} noValidate>
        <div className="amb-body bm-body">
          <div className="bm-head">
            <h3 id="bm-title" className="bm-title" tabIndex={-1} ref={titleRef}>{MISTAKE_COPY.title}</h3>
            {onBack ? <button type="button" className="bm-back" onClick={onBack} disabled={sending}>{MISTAKE_COPY.back}</button> : null}
          </div>
          <p className="bm-lead">{MISTAKE_COPY.lead}</p>

          <div className="bm-field">
            <label htmlFor={ids.q} className="bm-label">{MISTAKE_COPY.questionLabel}</label>
            <textarea
              id={ids.q} ref={fieldRef} className="bm-input bm-input--q" rows={6} maxLength={MISTAKE_LIMITS.question} value={question}
              placeholder={MISTAKE_COPY.questionHint} disabled={sending || held} aria-describedby={`${ids.photos} ${ids.count}`}
              onChange={(event) => { setQuestion(event.target.value); if (notice && notice.state !== 'unknown' && notice.state !== 'over') setNotice(null); }}
            />
            <div className="bm-under">
              <span id={ids.photos}>{MISTAKE_COPY.photos}</span>
              {/* A paste past the limit is cut by the box itself; the count says the box is full. */}
              <span id={ids.count} className="bm-count" data-full={question.length >= MISTAKE_LIMITS.question || undefined}>{countLine(question.length)}{question.length >= MISTAKE_LIMITS.question ? `, ${MISTAKE_COPY.full}` : ''}</span>
            </div>
          </div>

          {/* tabIndex 0 on the inputs and the select: the overlay and sheet keep Tab inside the panel by the controls they list
              (AssistantDrawer: links, enabled buttons, textareas, [tabindex="0"]), so with the send key still off, Tab from the
              subject wraps to the top instead of leaving the dialog. */}
          <div className="bm-pair">
            <div className="bm-field">
              <label htmlFor={ids.chosen} className="bm-label">{MISTAKE_COPY.chosenLabel} <span>({MISTAKE_COPY.optional})</span></label>
              <input id={ids.chosen} className="bm-input" type="text" tabIndex={0} maxLength={MISTAKE_LIMITS.answer} value={chosen} disabled={sending || held} autoComplete="off" enterKeyHint="next" onChange={(event) => setChosen(event.target.value)} />
            </div>
            <div className="bm-field">
              <label htmlFor={ids.key} className="bm-label">{MISTAKE_COPY.keyLabel} <span>({MISTAKE_COPY.optional})</span></label>
              <input id={ids.key} className="bm-input" type="text" tabIndex={0} maxLength={MISTAKE_LIMITS.answer} value={key} disabled={sending || held} autoComplete="off" enterKeyHint="next" onChange={(event) => setKey(event.target.value)} />
            </div>
          </div>

          <div className="bm-field bm-field--subject">
            <label htmlFor={ids.subject} className="bm-label">{MISTAKE_COPY.subjectLabel}</label>
            <select id={ids.subject} className="bm-input bm-select" tabIndex={0} value={subject} disabled={sending || held} onChange={(event) => setSubject(event.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {notice ? <Notice notice={notice} sending={sending} noCredits={noCredits} onRetry={() => send({ again: notice.state === 'unknown' })} onLeave={onLeave} /> : null}
        </div>

        <div className="bm-foot">
          {sending ? (
            <p className="amb-reading bm-reading" role="status"><MobiMark size={20} blinking />{MISTAKE_COPY.sending}</p>
          ) : (
            <p className="bm-price" id={ids.price} aria-live="polite">
              {priceWords}
              {!offline && !paid?.open && noCredits ? <> <Link href="/wallet" className="bm-price__link" onClick={onLeave}>{MISTAKE_COPY.seeCredits}</Link></> : null}
            </p>
          )}
          {/* The view's one volt key; on the page it steps the shell's Start key back (data-page-primary, U3). */}
          <button type="submit" className="btn-volt md bm-send" disabled={!canSend} aria-describedby={ids.price} aria-busy={sending || undefined} {...(form === 'page' ? { 'data-page-primary': '' } : {})}>{MISTAKE_COPY.send}</button>
        </div>
      </form>
    </div>
  );
}

function Notice({ notice, sending, noCredits, onRetry, onLeave }) {
  if (notice.state === 'support') {
    return <div className="amb-notice bm-notice" role="status" data-last=""><span>{notice.reply}</span></div>;
  }
  const retry = notice.state === 'failed' || notice.state === 'unknown';
  return (
    <div className="amb-notice bm-notice" role={notice.state === 'refused' ? 'status' : 'alert'} data-state={notice.state}>
      <span>{notice.message}</span>
      {retry ? <button type="button" className="amb-btn amb-btn--line" disabled={sending} onClick={onRetry}>{MISTAKE_COPY.tryAgain}</button> : null}
      {notice.state === 'blocked' && noCredits ? <Link href="/wallet" className="amb-btn amb-btn--line" onClick={onLeave}>{MISTAKE_COPY.seeCredits}</Link> : null}
    </div>
  );
}
