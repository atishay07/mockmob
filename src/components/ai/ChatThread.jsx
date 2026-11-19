"use client";

// The thread of Ask Mobi's chat (16 Nov 2026), shared by the /mentor page, the floating window and the phone sheet: one set of
// parts, two frames. The engine and its rules are in AskMobiPanel.jsx; the words in chatCopy.mjs; this file only draws.
//
//  * UserTurn: the student's words, right, on ink. A photo is a thumbnail in the bubble that opens to a full view.
//  * MobiTurn: Mobi's mark and name, then a full-width reading column (no bubble). The study blocks sit in the same column,
//    set apart by space and hairlines, never a card in a card: the 2 questions of a doubt, tonight's set, a mistake read in
//    its three parts, and the one next move as a full-width key.
//  * TurnMeta: under each of Mobi's turns, quiet, on one line: what it used (the server's amount), Copy, and Report where
//    the reply can be reported (POST /api/ai/mentor/report, the route the app's "Report this reply" uses).
//  * Waiting: Mobi's mark and the one real step, in words. A thin indeterminate line shows that the wait is real; nothing is
//    drawn as progress and nothing is typed out. A second line states the true ceiling after ten seconds, where one exists.
//  * StatusTurn: a refusal or a failure is a turn: what happened, what it used, and the way forward as keys.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, Copy, Flag, X } from 'lucide-react';
import MobiMark from './MobiMark';
import { MISTAKE_COPY, checksTally, nextStep, optionState, verdictLine } from '@/services/mobi/bringMistake.mjs';
import { CHAT_COPY, WAIT_NOTE_AFTER_MS, turnAsText, usedWords, waitCeiling, waitLine } from './chatCopy.mjs';
import { inlineParts, proseBlocks } from './chatProse.mjs';

const LETTERS = 'ABCD';
// The four reasons the report route takes (src/lib/server/aiReplyReport.js REPORT_REASONS; chatCopy.test.mjs holds them equal).
export const REPORT_LABELS = Object.freeze(['It is wrong about my record', 'It is wrong about the subject', 'It is unsafe or unkind', 'Something else']);

function reducedMotion() {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

// ---- Reading text -------------------------------------------------------------------------------------------------------------

const Inline = ({ text }) => inlineParts(text).map((part, i) => (part.bold ? <strong key={i}>{part.text}</strong> : part.text));

/** A written answer as a reading column: headings bold, steps on their own lines, a worked sum kept on its lines. */
export function Prose({ text }) {
  return proseBlocks(text).map((block, i) => {
    if (block.type === 'h') return <h4 key={i} className="ach-h">{block.text}</h4>;
    if (block.type === 'ol') return <ol key={i} className="ach-steps" start={block.start}>{block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</ol>;
    if (block.type === 'ul') return <ul key={i} className="ach-points">{block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</ul>;
    return <p key={i} className="ach-p">{block.lines.map((line, j) => <span key={j} className="ach-ln"><Inline text={line} /></span>)}</p>;
  });
}

// ---- The student's turn -------------------------------------------------------------------------------------------------------

export function UserTurn({ turn, last = false, onPhoto = null, provisional = false }) {
  return (
    <div className="ach-you ach-rise" data-last={last ? '' : undefined} data-turn="user" data-provisional={provisional || undefined}>
      <span className="sr-only">{CHAT_COPY.you}: </span>
      {turn.photo?.url ? (
        <button type="button" className="ach-you__photo" onClick={(event) => onPhoto?.(turn.photo.url, event.currentTarget)} aria-label={CHAT_COPY.photoOpen}>
          {/* A blob: URL of the photo made ready in this browser; nothing for the image optimiser to fetch. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={turn.photo.url} alt={CHAT_COPY.photoAlt} />
        </button>
      ) : null}
      {turn.text ? <p className="ach-you__text">{turn.text}</p> : null}
      {turn.chosen ? <p className="ach-you__chose">{CHAT_COPY.youChose(turn.chosen)}</p> : null}
    </div>
  );
}

/** The photo, whole. It closes with a tap anywhere, Escape, or the phone's back. */
export function PhotoView({ url, onClose }) {
  const closeRef = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  // Back closes the photo: one history entry while it is open. A tap or Escape goes back through that entry, so the photo
  // closes one way only and the phone's back never leaves the page instead.
  const shut = () => {
    let viaBack = false;
    try { if (window.history.state?.mmPhoto) { window.history.back(); viaBack = true; } } catch { viaBack = false; }
    if (!viaBack) close.current?.();
  };
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    try { if (!window.history.state?.mmPhoto) window.history.pushState({ ...(window.history.state || {}), mmPhoto: true }, ''); } catch { /* the photo still closes with a tap or Escape */ }
    const onPop = () => close.current?.();
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); shut(); } };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="ach-photoview" role="dialog" aria-modal="true" aria-label={CHAT_COPY.photoAlt} onClick={shut}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={CHAT_COPY.photoAlt} />
      <button type="button" ref={closeRef} className="ach-photoview__close" aria-label={CHAT_COPY.photoClose}><X size={22} aria-hidden="true" /></button>
    </div>,
    document.body,
  );
}

// ---- Under each of Mobi's turns: what it used, Copy, Report ---------------------------------------------------------------------

function CopyKey({ text }) {
  const [state, setState] = useState('idle');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
    setState(ok ? 'done' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1800);
  }
  return (
    <button type="button" className="ach-metakey" data-state={state} onClick={copy}>
      {state === 'done' ? <Check size={15} strokeWidth={2.4} aria-hidden="true" /> : <Copy size={15} strokeWidth={2} aria-hidden="true" />}
      <span aria-live="polite">{state === 'done' ? CHAT_COPY.copied : state === 'failed' ? CHAT_COPY.copyFailed : CHAT_COPY.copy}</span>
    </button>
  );
}

function ReportKey({ text, requestId, sessionId }) {
  const [state, setState] = useState('idle'); // idle | open | sending | sent | failed
  const titleId = useId();
  const firstRef = useRef(null);
  useEffect(() => { if (state === 'open') firstRef.current?.focus({ preventScroll: true }); }, [state]);
  async function send(reason) {
    setState('sending');
    try {
      const res = await fetch('/api/ai/mentor/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason, reply: String(text || '').slice(0, 1200), requestId, ...(sessionId ? { sessionId } : {}) }) });
      setState(res.ok ? 'sent' : 'failed');
    } catch { setState('failed'); }
  }
  if (state === 'sent') return <span className="ach-meta__said" role="status">{CHAT_COPY.reportSent}</span>;
  return (
    <>
      <button type="button" className="ach-metakey" aria-expanded={state !== 'idle'} onClick={() => setState((s) => (s === 'idle' ? 'open' : 'idle'))} disabled={state === 'sending'}>
        <Flag size={15} strokeWidth={2} aria-hidden="true" /><span>{CHAT_COPY.report}</span>
      </button>
      {state !== 'idle' ? (
        <div className="ach-report" role="group" aria-labelledby={titleId}>
          <p id={titleId} className="ach-report__title">{state === 'failed' ? CHAT_COPY.reportFailed : CHAT_COPY.reportTitle}</p>
          <div className="ach-report__keys">
            {REPORT_LABELS.map((label, i) => (
              <button key={label} type="button" ref={i === 0 ? firstRef : null} className="ach-chipkey" disabled={state === 'sending'} onClick={() => send(label)}>{label}</button>
            ))}
            <button type="button" className="ach-textkey" disabled={state === 'sending'} onClick={() => setState('idle')}>{CHAT_COPY.reportCancel}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** `used`: what the turn used, in words (already written from the server's amount). `text`: the answer as plain text. */
export function TurnMeta({ used = null, text = '', report = null }) {
  if (!used && !text) return null;
  return (
    <footer className="ach-meta">
      {used ? <span className="ach-meta__used">{used}</span> : null}
      {text ? <CopyKey text={text} /> : null}
      {report?.requestId ? <ReportKey text={text} requestId={report.requestId} sessionId={report.sessionId} /> : null}
    </footer>
  );
}

// ---- Mobi's turn --------------------------------------------------------------------------------------------------------------

export function MobiTurn({ children, last = false, origin = null, meta = null }) {
  return (
    <article className="ach-mobi ach-rise" data-last={last ? '' : undefined} data-turn="mobi" data-origin={origin || undefined}>
      <header className="ach-mobi__who"><MobiMark size={22} /><b>{CHAT_COPY.mobi}</b></header>
      <div className="ach-mobi__body">{children}</div>
      {meta}
    </article>
  );
}

/** The one next move, as a full-width key. */
export function NextMove({ label, onClick = null, href = null, onLeave = null }) {
  if (href) return <Link href={href} className="ach-next" onClick={onLeave}>{label}</Link>;
  return <button type="button" className="ach-next" onClick={onClick}>{label}</button>;
}

/** Waiting for a reply: the real step in words, and a calm line that shows the wait is real. */
export function Waiting({ pending, qName }) {
  const [late, setLate] = useState(false);
  const ceiling = waitCeiling(pending);
  useEffect(() => {
    if (!ceiling) return undefined;
    const timer = window.setTimeout(() => setLate(true), WAIT_NOTE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [ceiling]);
  return (
    <div className="ach-wait" role="status" data-last="" data-turn="wait">
      <span className="ach-wait__line">
        {/* Mobi at work, still: the magnifier over a photo, a book over typed words. Other waits keep his mark. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a 46 px still from the brand's own art */}
        {pending?.kind === 'mistake' || pending?.kind === 'paid' ? <img className="ach-wait__mobi" src={pending.kind === 'mistake' && pending.photo ? '/brand/mascot/mobi-magnifier.webp' : '/brand/mascot/mobi-reading.webp'} width={pending.kind === 'mistake' && pending.photo ? 31 : 29} height={46} alt="" /> : <MobiMark size={20} blinking />}
        {waitLine(pending, { qName })}
      </span>
      <span className="ach-wait__bar" aria-hidden="true" />
      {late && ceiling ? <span className="ach-wait__note">{ceiling}</span> : null}
    </div>
  );
}

/**
 * A refusal, a failure or a notice, as a turn: what happened, what it used, the way forward.
 * `ways`: [{ id, label }]; `onWay(id)` runs one; `busy` holds the keys while a reply is on its way.
 */
export function StatusTurn({ said, used = null, ways = [], onWay = null, busy = false, last = false, alert = false, creditsHref = '/wallet', onLeave = null }) {
  return (
    <article className="ach-mobi ach-status ach-rise" role={alert ? 'alert' : 'status'} data-last={last ? '' : undefined} data-turn="status">
      <header className="ach-mobi__who"><MobiMark size={22} /><b>{CHAT_COPY.mobi}</b></header>
      <div className="ach-mobi__body">
        {String(said || '').split(/\n{2,}/).map((para, i) => <p key={i} className="ach-p">{para}</p>)}
        {ways.length ? (
          <div className="ach-ways">
            {ways.map((way) => (way.id === 'credits' || way.href
              ? <Link key={way.id} href={way.href || creditsHref} className="ach-key" onClick={onLeave}>{way.label}</Link>
              : <button key={way.id} type="button" className="ach-key" disabled={busy} onClick={() => onWay?.(way.id)}>{way.label}</button>))}
          </div>
        ) : null}
      </div>
      {used ? <footer className="ach-meta"><span className="ach-meta__used">{used}</span></footer> : null}
    </article>
  );
}

// ---- A question brought from another test, answered ---------------------------------------------------------------------------

function MistakeCheck({ check, i, n, picked, onPick }) {
  const stemId = useId();
  const answered = Number.isInteger(picked);
  return (
    <fieldset className="bm-q" data-answered={answered || undefined}>
      <legend className="bm-q__n">{MISTAKE_COPY.questionOf(i + 1, n)}</legend>
      <p className="bm-q__stem" id={stemId}>{check.question}</p>
      <div className="bm-opts" role="group" aria-labelledby={stemId}>
        {check.options.map((text, index) => {
          const state = optionState({ picked, answer: check.answer, index });
          return (
            <button key={index} type="button" className="bm-opt" data-state={state} disabled={answered} aria-pressed={answered ? index === picked : false} onClick={() => onPick(index)}>
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
            <p className="bm-verdict" data-right={picked === check.answer || undefined}>{verdictLine(check, picked)}</p>
            <p className="bm-reason">{check.reason}</p>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

/** What Mobi read from the photo: a short quote that opens to the whole reading, so a misreading shows at once. */
function PhotoReading({ read }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const long = read.length > 150 || read.split('\n').length > 2;
  return (
    <figure className="ach-read">
      <figcaption>{CHAT_COPY.readTitle}</figcaption>
      <blockquote id={bodyId} data-open={open || !long || undefined}>{read}</blockquote>
      {long ? <button type="button" className="ach-textkey" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>{open ? CHAT_COPY.readClose : CHAT_COPY.readOpen}</button> : null}
    </figure>
  );
}

/**
 * The mistake read in its three labelled parts, with the chapter named, the 2 checks answered in place and the one next move.
 * `answer` is { mistake, subject, charged, replayed, credits } as the engine stored it once the server's answer passed the
 * contract again (bringMistake.mjs readStoredMistake).
 */
export function MistakeAnswer({ answer, onLeave = null, headRef = null }) {
  const { mistake, subject } = answer;
  const [picks, setPicks] = useState([null, null]);
  const tally = checksTally(mistake.checks, picks);
  const next = nextStep(subject, mistake.chapter);
  const titleId = useId();
  return (
    <div className="ach-mistake">
      {mistake.read ? <PhotoReading read={mistake.read} /> : null}
      {mistake.chapter ? <p className="ach-chapter">{CHAT_COPY.chapterIs(mistake.chapter, subject?.name || null)}</p> : null}
      <section className="ach-part">
        <h4 className="ach-h" tabIndex={-1} ref={headRef}>{MISTAKE_COPY.tests}</h4>
        <p className="ach-p">{mistake.tests}</p>
      </section>
      <section className="ach-part">
        <h4 className="ach-h">{MISTAKE_COPY.why}</h4>
        {mistake.answer.sure
          ? <p className="ach-keyline">{MISTAKE_COPY.answerIs(mistake.answer.text)}</p>
          : <p className="ach-unsure">{MISTAKE_COPY.notSure}</p>}
        <Prose text={mistake.why} />
      </section>
      {mistake.slip ? (
        <section className="ach-part">
          <h4 className="ach-h">{MISTAKE_COPY.slip}</h4>
          <p className="ach-p">{mistake.slip}</p>
        </section>
      ) : null}
      <section className="ach-part bm-checks" aria-labelledby={titleId}>
        <h4 className="ach-h" id={titleId}>{MISTAKE_COPY.checksTitle}</h4>
        <p className="ach-fine">{MISTAKE_COPY.honesty}</p>
        {mistake.checks.map((check, i) => (
          <MistakeCheck key={i} check={check} i={i} n={mistake.checks.length} picked={picks[i]} onPick={(index) => setPicks((prev) => prev.map((p, j) => (j === i && !Number.isInteger(p) ? index : p)))} />
        ))}
        {tally ? <p className="bm-tally" role="status">{tally}</p> : null}
      </section>
      <div className="ach-nextwrap">
        <NextMove label={next.label} href={next.href} onLeave={onLeave} />
        <p className="ach-fine">{MISTAKE_COPY.bank}</p>
      </div>
    </div>
  );
}

/** What a mistake answer used: an answer shown again says it was charged once, when first sent. */
export function mistakeUsed(answer) {
  if (answer.replayed && !answer.charged) return MISTAKE_COPY.replayedCharge(answer.credits);
  return usedWords(answer.charged);
}

/** A saved exchange from History, read as it was. */
export function SavedExchange({ row, cost = null, when = null }) {
  return (
    <>
      <UserTurn turn={{ text: row.askFull || row.ask }} />
      <MobiTurn meta={<TurnMeta used={[cost, when ? `${when}.` : null].filter(Boolean).join(' ') || null} text={row.replyFull || row.reply || ''} />}>
        {row.replyFull || row.reply ? <Prose text={row.replyFull || row.reply} /> : <p className="ach-p">{CHAT_COPY.savedNoReply}</p>}
      </MobiTurn>
    </>
  );
}

/** Scrolls a new turn into view once: the question it answers when that is short, else the answer's own top. */
export function showTurn(container) {
  const turns = container?.querySelectorAll?.('[data-turn]');
  const node = turns?.[turns.length - 1] || null;
  if (!node) return;
  let target = node;
  const before = turns.length > 1 ? turns[turns.length - 2] : null;
  if (node.dataset.turn !== 'user' && before?.dataset.turn === 'user' && before.offsetHeight < 160) target = before;
  target.scrollIntoView({ block: node.dataset.turn === 'user' || node.dataset.turn === 'wait' ? 'nearest' : 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

export { turnAsText };
