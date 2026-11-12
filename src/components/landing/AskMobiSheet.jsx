'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { readSample } from './sampleCarry.mjs';
import { ASK_FIRST, askPlan } from './askMobiSample.mjs';
import './ask-sheet.css';

// Round 14: Ask Mobi for guests. A bottom sheet (a 420 px panel from 900 px) that asks the real model through
// POST /api/mobi/guest: three free questions a visitor, no sign-up (src/lib/server/guestMobi.js holds the rules and the cost).
// Opens on the window event `mm:ask-mobi` ({ question?, sample?, source? }) and on a tap of any `[data-ask-mobi]` link (the
// hero strip's Ask Mobi row, which still goes to #your-prep without JavaScript). While open, <html data-ask-mobi="open"> locks
// the page's scroll and tells the companion to step aside. Nothing here is shown as answered before the server answers; when
// the result's own "What should I do tonight?" cannot reach the model, the page's local answer (askMobiSample.mjs) stands in.

const ENDPOINT = '/api/mobi/guest';
const FREE = 3;
const LEFT_KEY = 'mm:ask-guest:v1';
const TIMEOUT_MS = 20_000;
const MESSAGE_MAX = 280;
const CHIPS = Object.freeze(['How should I plan the last three months?', 'Which subjects should I pick for B.Com?']);
const COPY = Object.freeze({
  intro: 'Ask me about CUET, your prep, or MockMob.',
  offline: 'You’re offline. Reconnect and send it again.',
  down: 'Mobi can’t answer right now. Try again in a minute.',
  slow: 'Mobi took too long to answer. Send it again.',
  spent: 'That was your three free questions.',
  spentFine: 'Free to start. Mobi answers from your own mocks there.',
});

const leftLine = (left) => (left >= FREE ? '3 free questions. No sign-up.' : left === 1 ? '1 question left' : left <= 0 ? 'No free questions left' : `${left} questions left`);

function readLeft() {
  try {
    const value = Number(JSON.parse(window.sessionStorage.getItem(LEFT_KEY) || 'null')?.left);
    return Number.isInteger(value) && value >= 0 && value <= FREE ? value : FREE;
  } catch { return FREE; }
}
function writeLeft(left) {
  try { window.sessionStorage.setItem(LEFT_KEY, JSON.stringify({ left })); } catch { /* the count line falls back to three */ }
}

/** The five-question result in the route's shape, from DemoDrill's event or the note kept in this browser (sampleCarry.mjs). */
function guestSample(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const score = Number(raw.score);
  if (!Number.isInteger(score) || score < 0 || score > 5) return null;
  const source = Array.isArray(raw.misses) ? raw.misses : Array.isArray(raw.chapters) ? raw.chapters.map((chapter) => ({ chapter })) : [];
  const seen = new Set();
  const misses = [];
  for (const miss of source) {
    if (misses.length >= 5 - score) break;
    const chapter = typeof miss?.chapter === 'string' ? miss.chapter.trim().slice(0, 80) : '';
    if (!chapter) continue;
    const n = Number.isInteger(miss.n) && miss.n >= 1 && miss.n <= 5 && !seen.has(miss.n) ? miss.n : null;
    if (n) seen.add(n);
    misses.push(n ? { n, chapter } : { chapter });
  }
  if (score < 5 && misses.length === 0) return null;
  const subject = typeof raw.subject === 'string' && raw.subject.trim() ? raw.subject.trim().slice(0, 40) : null;
  return { score, total: 5, subject, misses };
}

/** The local answer for "What should I do tonight?", when every miss carries its question number. */
function localPlan(sample) {
  if (!sample || !sample.misses.every((m) => Number.isInteger(m.n))) return null;
  const plan = askPlan({ missed: sample.misses });
  return { step: plan.step, lines: plan.lines };
}

const asText = (m) => (m.local ? [m.local.step, ...m.local.lines].join(' ') : m.text);
/** The last two exchanges, as the route takes them. */
const toHistory = (messages) => messages.slice(-4).map((m) => ({ role: m.role === 'user' ? 'user' : 'mobi', text: asText(m).slice(0, 400) }));

function MobiMark({ size = 20 }) {
  const src = stripObjectSrc('mobi');
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- the hero strip's pre-cut Mobi object, drawn small here
  return <img className="mm-ask__mark" src={src} srcSet={stripObjectSrcSet('mobi')} sizes={`${size + 2}px`} width={size} height={Math.round(size * 11 / 12)} alt="" decoding="async" draggable={false} />;
}

export default function AskMobiSheet() {
  const [phase, setPhase] = useState('closed'); // closed | enter | open | closing
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // offline | down | slow | busy
  const [left, setLeft] = useState(FREE);
  const [spent, setSpent] = useState(false);
  const [sample, setSample] = useState(null);
  const [opens, setOpens] = useState(0);
  const sheetRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const openerRef = useRef(null);
  const requestRef = useRef(null);
  const ids = useRef(0);
  const messagesRef = useRef(messages);
  const pendingRef = useRef(null);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const nextId = () => { ids.current += 1; return ids.current; };

  const open = useCallback((detail = {}) => {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    let stored = null;
    try { stored = readSample(); } catch { stored = null; }
    setSample(guestSample(detail?.sample) || guestSample(stored));
    const count = readLeft();
    setLeft(count);
    if (count <= 0) setSpent(true);
    setNotice(null);
    setPhase((p) => (p === 'open' ? p : 'enter'));
    const question = typeof detail?.question === 'string' ? detail.question.trim().slice(0, MESSAGE_MAX) : '';
    // The same question asked again (the result's key tapped twice) only reopens the thread that already answers it.
    const asked = messagesRef.current.some((m) => m.role === 'user' && m.text === question);
    pendingRef.current = question && !asked ? question : null;
    setOpens((n) => n + 1);
  }, []);

  const close = useCallback(() => setPhase((p) => (p === 'closed' ? p : 'closing')), []);

  // Doors: the window event, and any a[data-ask-mobi] link (a plain click only; a modified click keeps the link's own way).
  // Links only: <html> itself carries data-ask-mobi while the sheet is open.
  useEffect(() => {
    const onAsk = (event) => open(event.detail || {});
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[data-ask-mobi]') : null;
      if (!link) return;
      event.preventDefault();
      open({ source: link.getAttribute('data-ask-mobi') || 'link' });
    };
    window.addEventListener('mm:ask-mobi', onAsk);
    document.addEventListener('click', onClick);
    return () => { window.removeEventListener('mm:ask-mobi', onAsk); document.removeEventListener('click', onClick); };
  }, [open]);

  // Enter, then open on the next frame so the slide runs; closing waits for the slide out (or the fade) before unmounting.
  useEffect(() => {
    if (phase === 'enter') {
      let second = 0;
      const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setPhase('open')); });
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    }
    if (phase === 'closing') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
      const id = window.setTimeout(() => setPhase('closed'), reduced ? 130 : 250);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [phase]);

  // The page under the sheet: scroll locked and the companion told, from the first frame to the last.
  useEffect(() => {
    const root = document.documentElement;
    if (phase === 'closed') {
      delete root.dataset.askMobi;
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      return undefined;
    }
    root.dataset.askMobi = 'open';
    return undefined;
  }, [phase]);
  useEffect(() => () => { delete document.documentElement.dataset.askMobi; }, []);
  // Escape closes the sheet wherever focus is (a tap on a chip can leave it on the page behind).
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && document.documentElement.dataset.askMobi === 'open') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // Focus into the sheet once it is up: the field where a keyboard is (a fine pointer), the dialog itself on a phone, so the
  // on-screen keyboard does not cover the suggestions before the visitor has read them.
  useEffect(() => {
    if (phase !== 'open') return;
    const sheet = sheetRef.current;
    if (!sheet || sheet.contains(document.activeElement)) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    (fine && inputRef.current && !inputRef.current.readOnly ? inputRef.current : sheet).focus({ preventScroll: true });
  }, [phase]);

  // The third answer swaps the field for the sign-up key: focus that was on the field or the send key stays inside the dialog.
  useEffect(() => {
    if (!spent || phase !== 'open') return;
    const sheet = sheetRef.current;
    if (sheet && !sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
  }, [spent, phase]);

  // The on-screen keyboard: the sheet sits on the visual viewport's foot and never grows past it.
  useLayoutEffect(() => {
    if (phase === 'closed') return undefined;
    const sheet = sheetRef.current;
    const vv = window.visualViewport;
    if (!sheet) return undefined;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      sheet.style.setProperty('--ask-kb', `${kb}px`);
      sheet.style.setProperty('--ask-vh', `${Math.round(height)}px`);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { vv?.removeEventListener('resize', update); vv?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [phase]);

  // A new line: the thread shows it. A reply taller than the thread shows its first line, not its last.
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const last = thread.lastElementChild;
    if (last && last.offsetHeight > thread.clientHeight - 16) thread.scrollTop = Math.max(0, last.offsetTop - 8);
    else thread.scrollTop = thread.scrollHeight;
  }, [messages, busy, phase]);

  const send = useCallback(async (raw, { first = false } = {}) => {
    const text = String(raw || '').trim().slice(0, MESSAGE_MAX);
    if (!text || requestRef.current || spent) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setNotice('offline'); setDraft(text); return; }
    const history = toHistory(messagesRef.current);
    const mine = { id: nextId(), role: 'user', text };
    setMessages((list) => [...list, mine]);
    setDraft('');
    setNotice(null);
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    let slow = false;
    // A plain timer, not AbortSignal.timeout, which older Android WebViews lack.
    const timer = window.setTimeout(() => { slow = true; controller.abort(); }, TIMEOUT_MS);
    let status = 0;
    let body = null;
    let failed = false;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        body: JSON.stringify({ message: text, history, ...(sample ? { sample } : {}) }),
      });
      status = response.status;
      body = await response.json().catch(() => null);
    } catch { failed = true; }
    window.clearTimeout(timer);
    requestRef.current = null;
    setBusy(false);
    const answer = body && typeof body === 'object' ? body : {};
    if (Number.isInteger(answer.left) && answer.left >= 0 && answer.left <= FREE) { setLeft(answer.left); writeLeft(answer.left); }
    const out = (Number.isInteger(answer.left) && answer.left === 0) || (answer.state === 'limit' && answer.scope === 'visitor');
    if (out) { setSpent(true); setLeft(0); writeLeft(0); }

    if (status === 200 && answer.state === 'answered' && typeof answer.reply === 'string' && answer.reply.trim()) {
      setMessages((list) => [...list, { id: nextId(), role: 'mobi', text: answer.reply.trim() }]);
      return;
    }
    // No answer from the model. The result's own question still gets the page's local answer, so nobody leaves empty-handed.
    const local = first && text === ASK_FIRST ? localPlan(sample) : null;
    if (local) { setMessages((list) => [...list, { id: nextId(), role: 'mobi', local }]); return; }
    setMessages((list) => list.filter((m) => m.id !== mine.id));
    if (out) return;
    setDraft(text);
    if (answer.state === 'limit') setNotice('busy');
    else if (failed) setNotice(slow ? 'slow' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'down');
    else setNotice('down');
  }, [sample, spent]);

  // A question handed in with the event is sent once the sheet is up.
  useEffect(() => {
    if (phase !== 'open' || !pendingRef.current) return undefined;
    const question = pendingRef.current;
    const id = window.setTimeout(() => { pendingRef.current = null; send(question, { first: true }); }, 0);
    return () => window.clearTimeout(id);
  }, [phase, opens, send]);

  function onKeyDown(event) {
    if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...sheetRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')].filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === firstNode || document.activeElement === sheetRef.current)) { event.preventDefault(); lastNode.focus(); }
    else if (!event.shiftKey && document.activeElement === lastNode) { event.preventDefault(); firstNode.focus(); }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!busy) send(draft);
  }

  if (phase === 'closed') return null;
  const chips = sample ? [ASK_FIRST, ...CHIPS] : CHIPS;
  const firstMobi = messages.findIndex((m) => m.role === 'mobi');

  return (
    <div className="mm-ask" data-phase={phase}>
      <div className="mm-ask__scrim" aria-hidden="true" onClick={close} />
      <div className="mm-ask__sheet" role="dialog" aria-modal="true" aria-label="Ask Mobi" tabIndex={-1} ref={sheetRef} onKeyDown={onKeyDown}>
        <div className="mm-ask__grab" aria-hidden="true" />
        <div className="mm-ask__head">
          <MobiMark size={30} />
          <div className="mm-ask__titles">
            <h2 className="mm-ask__title">Ask Mobi</h2>
            <p className="mm-ask__left">{leftLine(left)}</p>
          </div>
          <button type="button" className="mm-ask__close" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="mm-ask__thread" ref={threadRef} role="log" aria-label="Conversation with Mobi">
          {messages.length === 0 ? (
            <div className="mm-ask__intro">
              <div className="mm-ask__mobi">
                <p className="mm-ask__who"><MobiMark />Mobi</p>
                <p>{COPY.intro}</p>
              </div>
              {!spent ? (
                <div className="mm-ask__chips">
                  {chips.map((chip) => (
                    <button type="button" key={chip} className="mm-ask__chip" disabled={busy} onClick={() => send(chip, { first: true })}>{chip}</button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : messages.map((m, i) => (m.role === 'user' ? (
            <p key={m.id} className="mm-ask__you">{m.text}</p>
          ) : (
            <div key={m.id} className="mm-ask__mobi">
              {i === firstMobi ? <p className="mm-ask__who"><MobiMark />Mobi</p> : null}
              {m.local ? (
                <>
                  <p className="mm-ask__step">{m.local.step}</p>
                  {m.local.lines.map((line) => <p key={line}>{line}</p>)}
                </>
              ) : m.text.split('\n').map((line, j) => <p key={j}>{line}</p>)}
            </div>
          )))}
          {busy ? (
            <div className="mm-ask__mobi mm-ask__wait">
              {firstMobi < 0 && messages.length > 0 ? <p className="mm-ask__who"><MobiMark />Mobi</p> : null}
              <p className="mm-ask__dots" aria-hidden="true"><i /><i /><i /></p>
              <p className="sr-only" aria-live="polite">Mobi is answering</p>
            </div>
          ) : null}
        </div>

        {notice ? (
          <p className="mm-ask__notice" role="status">
            {notice === 'busy' ? <>Mobi is busy right now. Try again later, or <Link href="/signup">sign up free</Link> to ask without the wait.</> : COPY[notice]}
          </p>
        ) : null}

        {spent ? (
          <div className="mm-ask__spent">
            <p className="mm-ask__spent-line">{COPY.spent}</p>
            <Link href="/signup" className="mm-btn mm-btn--primary">Sign up free</Link>
            <p className="mm-ask__fine">{COPY.spentFine}</p>
          </div>
        ) : (
          <form className="mm-ask__form" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              className="mm-ask__input"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MESSAGE_MAX}
              enterKeyHint="send"
              placeholder="Type your question"
              aria-label="Your question"
              autoComplete="off"
              // Read-only, not disabled, while Mobi answers: a disabled field drops focus and the phone's keyboard with it.
              readOnly={busy}
              aria-disabled={busy ? 'true' : undefined}
            />
            <button type="submit" className="mm-ask__send" aria-label="Send" disabled={busy || !draft.trim()}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
