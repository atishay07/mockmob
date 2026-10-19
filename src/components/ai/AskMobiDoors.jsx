"use client";

// Ask Mobi's own page (ASK-MOBI-1019, option B; the owner's D114: "For the Ask Mob, I like the direction of B."). Mobi's
// greeting sits above two big doors, one to one with the app's /ask screen:
//
//  * Ask now: any CUET doubt. A big field, then three starters, each marked "1 credit" before the tap. A starter sends at once
//    (D53: no consent sheet), the price of what is typed is said under the field before anything is sent, and the wait is
//    honest: "Writing a reply" while the reply is on its way, then the whole reply. Nothing is faked as streaming.
//  * Ask your record: it leads with the student's real biggest marks leak, then the record questions, each labelled Free,
//    1 credit or Pro. A fresh account is told plainly that the record needs a paper, with one key. Pro asks stay visible with
//    a quiet Pro tag (R3, D101); a tap opens the Upgrade sheet (D80), because Pro is sold on the web.
//
// Under the doors: the true credit line (the one balance) and "Your recent questions". Once something is asked, the doors
// give way to the conversation (the same panel that docks beside a question or a mock) with "Ask something new" to come back.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUp, ChevronDown, ChevronRight, ChevronUp, Lock } from 'lucide-react';
import { walletFromResponse } from '@/services/credits/aiWalletState';
import { announceWallet, cachedWallet } from '@/components/useWalletSummary';
import { openUpgrade } from '@/components/pro';
import MobiReact from '@/components/brand/MobiReact';
import { useMobiGate } from '@/lib/mobiHooks';
import { greeting as mobiGreeting } from '@/lib/mobiRation';
import { analyseSession } from '../../../data/session_recovery.js';
import AskMobiPanel from './AskMobiPanel';
import {
  DOOR_COPY, askNowStarters, creditLine, fewerIdeasLabel, greeting, greetName, lastPaper, moreIdeasLabel, moreStarters, noteFor, paperIsOpen,
  priceOfTyped, priceWord, recordDoorAsks, recordLead, recordLine, seeAll, seeFewer, clockStamp, costOf,
} from './askDoors.mjs';
import { exchangesFrom } from './mentorHistory.mjs';
import './ask-doors.css';

const subscribeOnline = (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
const onlineNow = () => navigator.onLine !== false;
const SHOWN_AFTER_LEAD = 3;

/** The wallet this page reads: what this tab read in the last five minutes paints at once; the server's answer replaces it. */
function useWallet(userId) {
  const [wallet, setWallet] = useState(null);
  const sequence = useRef(0);
  const read = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const res = await fetch('/api/ai/credits', { cache: 'no-store' });
      const next = walletFromResponse(await res.json(), { ok: res.ok });
      if (mine === sequence.current) setWallet(next);
      announceWallet(userId, next);
    } catch { if (mine === sequence.current) setWallet(walletFromResponse(null, { ok: false })); }
  }, [userId]);
  useEffect(() => {
    const fence = sequence;
    let active = true;
    const cached = cachedWallet(userId);
    if (userId) Promise.resolve().then(() => { if (!active) return; if (cached) setWallet((prev) => prev || cached); read(); });
    return () => { active = false; fence.current += 1; };
  }, [read, userId]);
  return wallet;
}

/** The newest paper, read from its own answers: the summary row first, then the saved paper for the chapters that cost the most. */
function useLastPaper(enabled, userId) {
  const [state, setState] = useState({ userId: null, item: null, analysis: null });
  useEffect(() => {
    if (!enabled || !userId) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/attempts/summary?limit=1', { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        const item = res.ok && Array.isArray(body?.items) ? body.items[0] || null : null;
        if (!alive) return;
        if (!paperIsOpen(item)) { setState({ userId, item, analysis: null }); return; }
        setState({ userId, item, analysis: null });
        const paper = await fetch(`/api/attempts/${encodeURIComponent(item.id)}`, { cache: 'no-store' });
        if (!paper.ok) return;
        const attempt = await paper.json();
        if (alive) setState({ userId, item, analysis: analyseSession(attempt) });
      } catch { /* Without the paper the ask is simply not offered (or answers from its marks alone). */ }
    })();
    return () => { alive = false; };
  }, [enabled, userId]);
  return state.userId === userId ? state : { item: null, analysis: null };
}

/** Your recent questions: what the history route saved, newest first. null while reading. */
function useRecent(userId) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    fetch('/api/ai/mentor/history', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => { if (alive) setRows(res.ok && data?.ok ? exchangesFrom(data.messages) : []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [userId]);
  return rows;
}

function PriceTag({ price }) {
  if (price === 'pro') return <span className="amd-price amd-price--pro"><Lock size={13} aria-hidden="true" />{DOOR_COPY.pro}</span>;
  return <span className="amd-price" data-price={price}>{price === 'free' ? DOOR_COPY.free : DOOR_COPY.oneCredit}</span>;
}

function Row({ text, preview, price, onClick, locked = false }) {
  return (
    <button type="button" className="amd-row" data-locked={locked || undefined} onClick={onClick} aria-label={`Ask: ${text}. ${preview ? `${preview}. ` : ''}${priceWord(price)}`}>
      <span className="amd-row__text"><b>{text}</b>{preview ? <small>{preview}</small> : null}</span>
      <PriceTag price={price} />
    </button>
  );
}

export default function AskMobiDoors({ user, insightsState, pro, onRetry }) {
  const router = useRouter();
  const userId = user?.id || null;
  const status = insightsState.status;
  const insights = insightsState.insights;
  const ready = status === 'ready' && insights?.state === 'ready';
  const offline = !useSyncExternalStore(subscribeOnline, onlineNow, () => true);
  const wallet = useWallet(userId);
  const paper = useLastPaper(ready, userId);
  const recent = useRecent(userId);
  const [now] = useState(() => Date.now());

  const name = greetName(user);
  const subjects = user?.subjects || [];
  const sessions = ready ? insights.sessions : 0;
  const starters = askNowStarters({ insights: ready ? insights : null, subjects });
  const more = moreStarters({ insights: ready ? insights : null, subjects });
  const last = lastPaper(paper.item, { analysis: paper.analysis, now });
  const asks = recordDoorAsks(ready ? insights : null, { pro, last, now: new Date(now) });
  const lead = recordLead(ready ? insights : null);
  const credits = creditLine(wallet);

  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [thread, setThread] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [open, setOpen] = useState(null);
  const fieldRef = useRef(null);
  const threadRef = useRef(null);
  const threadCount = useRef(0);

  // Mobi waves hello the first time Ask Mobi opens each day (late at night he is sleepy), and is simply there after that.
  const hello = useMobiGate(() => mobiGreeting('mentor'));
  const act = waiting ? 'think' : focused ? 'listen' : hello || 'idle';

  const price = priceOfTyped(text, { insights, status, pro });
  const note = noteFor(price, wallet);

  function start(ask) {
    const body = String(ask.text || '').trim();
    if (!body) return;
    threadCount.current += 1;
    setThread({ key: threadCount.current, text: body, answer: ask.answer ? { reply: ask.answer.reply, actions: ask.answer.actions, source: 'From your last paper' } : null });
    setText('');
    window.requestAnimationFrame(() => threadRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
  }

  function askRecord(ask, event) {
    if (ask.locked) {
      // Pro is sold on the web: the existing Upgrade sheet (D80), never a dead tap. Without a host (a Pro student) it is the plan page.
      if (!openUpgrade({ trigger: 'review', opener: event.currentTarget })) router.push('/pricing');
      return;
    }
    start({ text: ask.text, answer: ask.id === 'last' ? ask.answer : null });
  }

  const visible = allOpen ? asks.slice(1) : asks.slice(1, 1 + SHOWN_AFTER_LEAD);
  const idle = !thread;

  return (
    <section className="amd" aria-labelledby="amd-title">
      <h1 id="amd-title" className="sr-only">{DOOR_COPY.title}</h1>

      <div className="amd-hello">
        <span className="amd-hello__mobi"><MobiReact act={act} size={104} label="Mobi" interactive /></span>
        <p className="amd-hello__line">{greeting(name, sessions)}</p>
      </div>

      {offline ? <p className="amd-offline" role="status">{DOOR_COPY.offline}</p> : null}

      {thread ? (
        <div className="amd-thread amb-panel amb-panel--page" ref={threadRef}>
          <AskMobiPanel
            key={thread.key}
            form="page"
            context={{ kind: 'page', ref: null, label: null, number: null, chapter: null, lines: [] }}
            initial={{ text: thread.text, answer: thread.answer }}
            onClose={() => { setThread(null); setWaiting(false); }}
            onPending={setWaiting}
          />
        </div>
      ) : null}

      {idle ? (
        <div className="amd-doors">
          <article className="amd-door amd-door--now" aria-labelledby="amd-now-title">
            <header className="amd-door__head">
              <div>
                <h2 id="amd-now-title">{DOOR_COPY.nowTitle}</h2>
                <p>{DOOR_COPY.nowLine}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="amd-bell" src="/brand/mascot/ask-deskbell.webp" alt="" width="70" height="64" />
            </header>
            <form className="amd-field" data-focused={focused || undefined} onSubmit={(event) => { event.preventDefault(); start({ text }); }}>
              <label htmlFor="amd-field" className="sr-only">{DOOR_COPY.nowHint}</label>
              <textarea
                id="amd-field"
                ref={fieldRef}
                rows={1}
                maxLength={1500}
                value={text}
                placeholder={DOOR_COPY.nowHint}
                onChange={(event) => { setText(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 132)}px`; }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); start({ text }); } }}
              />
              <button type="submit" className="amd-send" disabled={!text.trim()} aria-label="Ask Mobi"><ArrowUp size={22} aria-hidden="true" /></button>
            </form>
            <p className="amd-note" aria-live="polite">{note}</p>
            <p className="amd-tip">{DOOR_COPY.nowTip}</p>
            <ul className="amd-list">
              {[...starters, ...(moreOpen ? more : [])].map((s, i) => (
                <li key={s} style={{ '--i': i }}><Row text={s} price="credit" onClick={() => start({ text: s })} /></li>
              ))}
            </ul>
            {more.length ? (
              <button type="button" className="amd-link" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
                {moreOpen ? fewerIdeasLabel : moreIdeasLabel(subjects)}
                {moreOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
              </button>
            ) : null}
          </article>

          <article id="ask-record" className="amd-door amd-door--record" aria-labelledby="amd-record-title">
            <header className="amd-door__head">
              <div>
                <h2 id="amd-record-title">{DOOR_COPY.recordTitle}</h2>
                {ready ? <p>{recordLine(sessions)}</p> : null}
              </div>
            </header>

            {status === 'loading' ? <p className="amd-quiet" role="status">{DOOR_COPY.reading}</p> : null}
            {status === 'unavailable' ? (
              <div className="amd-empty">
                <p className="amd-quiet" role="status">{offline ? DOOR_COPY.readOffline : DOOR_COPY.readFailed}</p>
                <button type="button" className="amd-key" onClick={onRetry}>{DOOR_COPY.tryAgain}</button>
              </div>
            ) : null}
            {status === 'empty' ? (
              <div className="amd-empty">
                <p className="amd-empty__say">{DOOR_COPY.emptySay}</p>
                <p className="amd-quiet amd-quiet--body">{DOOR_COPY.emptyBody}</p>
                <Link href="/dashboard?mode=quick&count=10" className="amd-key">{DOOR_COPY.emptyKey}</Link>
                <p className="amd-quiet">{DOOR_COPY.emptyAfter}</p>
              </div>
            ) : null}

            {ready ? (
              <>
                <button
                  type="button"
                  className="amd-lead"
                  onClick={(event) => askRecord(asks[0], event)}
                  aria-label={lead ? `Ask: ${asks[0].text}. ${lead.lost} ${leadLine(lead)}. ${DOOR_COPY.free}` : `Ask: ${asks[0].text}. ${asks[0].preview}. ${DOOR_COPY.free}`}
                >
                  <span className="amd-lead__top"><b>{asks[0].text}</b><PriceTag price="free" /></span>
                  {lead ? (
                    <span className="amd-lead__figure"><strong>{lead.lost}</strong><small>{leadLine(lead)}</small></span>
                  ) : <small className="amd-lead__plain">{asks[0].preview}</small>}
                </button>
                <p className="amd-tip">{DOOR_COPY.recordTip}</p>
                <ul className="amd-list">
                  {visible.map((a, i) => (
                    <li key={a.id} style={{ '--i': i }}><Row text={a.text} preview={a.preview} price={a.price} locked={a.locked} onClick={(event) => askRecord(a, event)} /></li>
                  ))}
                </ul>
                {asks.length - 1 > SHOWN_AFTER_LEAD ? (
                  <button type="button" className="amd-link" aria-expanded={allOpen} onClick={() => setAllOpen((v) => !v)}>
                    {allOpen ? seeFewer : seeAll(asks.length)}
                    {allOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                  </button>
                ) : null}
                <a className="amd-link amd-link--quiet" href="#record" >{DOOR_COPY.recordInFullLink}<ChevronDown size={18} aria-hidden="true" /></a>
              </>
            ) : null}
          </article>
        </div>
      ) : null}

      <div className="amd-credit">
        <Link href="/wallet" className="amd-credit__first">{credits.first}</Link>
        <p>{credits.second}</p>
      </div>

      {recent && recent.length ? (
        <section className="amd-recent" aria-labelledby="amd-recent-title">
          <h2 id="amd-recent-title">{DOOR_COPY.recentTitle}</h2>
          <ul>
            {recent.map((row) => {
              const expanded = open === row.id;
              const cost = costOf(row);
              return (
                <li key={row.id}>
                  <button type="button" className="amd-recent__row" aria-expanded={expanded} aria-controls={`amd-r-${row.id}`} onClick={() => setOpen(expanded ? null : row.id)}>
                    <b>{row.ask}</b>
                    <span className="amd-recent__cost">{cost || DOOR_COPY.earlierReply}</span>
                    <time className="amd-recent__time" dateTime={row.at || undefined}>{clockStamp(row.at)}</time>
                    <ChevronRight size={18} className="amd-recent__chev" aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <div className="amd-recent__reply" id={`amd-r-${row.id}`}>
                      {row.reply ? <p>{row.reply}</p> : <p>No reply was saved for this question.</p>}
                      {row.source ? <small>{row.source}</small> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

const leadLine = (lead) => `marks lost in ${lead.chapter}, your biggest leak`;
