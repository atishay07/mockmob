"use client";

// /mentor, Ask Mobi (a chat since 16 Nov 2026; the owner that evening: "This is an AI chatbot. It should feel like a proper AI
// agent ... but even better than that"). The page IS the conversation from the first second: a head (the title, History, New
// chat, and a two-part control), then one of two views:
//
//  * Chat (default): the start of a chat (ChatEmpty: Mobi's greeting, one line from the student's own record, four starters,
//    then doubts from their practice), the thread, and the composer pinned above the dock with its visible Photo key. It is the
//    same engine and parts as the window that opens over a question or a mock (AskMobiPanel, form 'page').
//  * Your record (?tab=record): everything the page showed about the record before it was a chat, nothing removed (R3): Where
//    you stand, the questions the record answers (each runs in the chat), "Your record in full" (the marks ledger, what stands
//    out, the chapters costing the most, changed answers, pace and the two weeks) and the credits link.
//
// History is the saved exchanges ("Your recent questions" before): a sheet on a phone, a quiet column beside the chat on a
// wide screen. A row opens that exchange in the thread, read as it was. New chat clears the view to the start; it never
// deletes history. Deep links keep working: ?tab=record opens Your record, ?tab=ask&q=<attempt>:<question> opens the chat on
// that question, ?tab=plan goes to Today and ?tab=tools to the credits page.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, Lock, SquarePen } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { isPaidUser } from '@/services/credits/aiWalletState';
import { openUpgrade } from '@/components/pro';
import { FIRST_SET_HREF } from '@/lib/firstSet.mjs';
import RecordView from './RecordView';
import AskMobiPanel from './AskMobiPanel';
import { HistoryColumn, HistorySheet } from './ChatHistory';
import { StandingCard } from './MobiJobParts';
import { useInsights } from './useInsights';
import { useLastPaper, useRecent, useStanding } from './useMentorData';
import { DRAFT_KEY, normalizeContext } from './askMobi.mjs';
import { answerFree } from './askSuggestions.mjs';
import { standingView } from './mobiJobs.mjs';
import { DOOR_COPY, lastPaper, priceWord, recordDoorAsks, recordLine } from './askDoors.mjs';
import { CHAT_COPY } from './chatCopy.mjs';
import './mentor-page.css';

// The History column needs room beside the chat; below this it is a sheet.
const WIDE = '(min-width: 1180px)';
const subscribeWide = (cb) => { const mq = window.matchMedia(WIDE); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); };
const wideNow = () => window.matchMedia(WIDE).matches;

export default function MentorRecordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id || null;
  const [recordTry, setRecordTry] = useState(0);
  const insightsState = useInsights(userId, recordTry);
  const pro = isPaidUser(user);
  const tab = params.get('tab');
  const q = params.get('q');
  const status = insightsState.status;
  const insights = insightsState.insights;
  const ready = status === 'ready' && insights?.state === 'ready';
  const paper = useLastPaper(ready, userId);
  const standing = useStanding(userId);
  const [historyTick, setHistoryTick] = useState(0);
  const recent = useRecent(userId, historyTick);
  const [now] = useState(() => Date.now());
  const last = lastPaper(paper.item, { analysis: paper.analysis, now });
  const asks = recordDoorAsks(ready ? insights : null, { pro, last, now: new Date(now) });
  const wide = useSyncExternalStore(subscribeWide, wideNow, () => false);

  // The view follows the link (?tab=record) and the two-part control; the control keeps the address in step without a load.
  const [view, setView] = useState(tab === 'record' ? 'record' : 'chat');
  const [seenTab, setSeenTab] = useState(tab);
  if (tab !== seenTab) { setSeenTab(tab); setView(tab === 'record' ? 'record' : 'chat'); }
  const [recordSeen, setRecordSeen] = useState(tab === 'record');
  const [chatKey, setChatKey] = useState(0);
  const [saved, setSaved] = useState(null);
  // null: not chosen yet (a wide screen shows the column from the start, so nothing moves when the list arrives); true or false
  // once the student has chosen.
  const [historyChoice, setHistoryChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const chat = useRef(null);
  const takeApi = useCallback((api) => { chat.current = api; }, []);
  // Words typed in the Ask Mobi window before "Open Ask Mobi's page" come with the student into this page's composer, once.
  const [draft, setDraft] = useState('');
  useEffect(() => {
    let carried = '';
    try { carried = window.sessionStorage.getItem(DRAFT_KEY) || ''; window.sessionStorage.removeItem(DRAFT_KEY); } catch { carried = ''; }
    // Read once and removed at once, so it is set after this effect (a development double run would find nothing the second time).
    if (carried) Promise.resolve().then(() => setDraft(carried));
  }, []);
  const historyOpen = historyChoice ?? (wide && view === 'chat');

  useEffect(() => {
    if (tab === 'plan') { router.replace('/today'); return undefined; }
    if (tab === 'tools') { router.replace('/wallet'); return undefined; }
    return undefined;
  }, [tab, router]);

  // ?tab=ask&q=<attempt>:<question>: the chat opens about that question (the repair's own link). Anything else is the page.
  const context = useMemo(() => normalizeContext(tab === 'ask' && q ? { kind: 'question', ref: q } : { kind: 'page' }), [tab, q]);

  function show(next) {
    setView(next);
    if (next === 'record') setRecordSeen(true);
    try {
      const url = new URL(window.location.href);
      if (next === 'record') url.searchParams.set('tab', 'record'); else if (url.searchParams.get('tab') === 'record') url.searchParams.delete('tab');
      window.history.replaceState(window.history.state, '', url);
    } catch { /* The view still changes; only the address stays as it was. */ }
  }

  function newChat() {
    setSaved(null);
    setChatKey((n) => n + 1);
    show('chat');
  }

  function openSaved(row) {
    setSaved(row);
    show('chat');
    if (!wide) setHistoryChoice(false);
  }

  // A question from Your record runs in the chat: the view changes, and the conversation that is already there takes it.
  function askInChat(ask, event) {
    if (ask.locked) {
      // Pro is sold on the web: the existing Upgrade sheet (D80), never a dead tap. Without a host (a Pro student) it is the plan page.
      if (!openUpgrade({ trigger: 'review', opener: event.currentTarget })) router.push('/pricing');
      return;
    }
    setSaved(null);
    show('chat');
    chat.current?.ask({ text: ask.text, answer: ask.id === 'last' ? ask.answer : null, free: ask.price === 'free' });
  }

  if (tab === 'plan' || tab === 'tools') return <p className="mrp-note" role="status">Taking you there.</p>;

  const fresh = status === 'empty';
  // A fresh account's two record tiles say plainly that there is nothing to read yet, with the one first-set key.
  const freshAnswer = fresh ? answerFree('marks_leak', { insights: null }) : null;

  return (
    // pp-arena maps the record view's own tokens (--pp-ink and the rest) onto the Arena's Night and Day colours (arena.css).
    // Without it the view falls back to the dark defaults in prepos.css and reads near-white on near-white in Day (W-078).
    <div className="mrp pp-arena">
      <div className="ach-page" data-view={view} data-history={historyOpen && wide && view === 'chat' ? '' : undefined}>
        <header className="ach-head">
          <div className="ach-head__row">
            <h1 id="ach-title">{CHAT_COPY.title}</h1>
            <div className="ach-head__keys">
              <button type="button" className="ach-headkey" aria-expanded={historyOpen} onClick={() => { if (view !== 'chat') { show('chat'); setHistoryChoice(true); } else setHistoryChoice(!historyOpen); }}>
                <History size={18} strokeWidth={2.1} aria-hidden="true" /><span>{CHAT_COPY.history}</span>
              </button>
              <button type="button" className="ach-headkey" disabled={busy} onClick={newChat}>
                <SquarePen size={18} strokeWidth={2.1} aria-hidden="true" /><span>{CHAT_COPY.newChat}</span>
              </button>
            </div>
          </div>
          <div className="ach-tabs" role="tablist" aria-label={CHAT_COPY.views}>
            <button type="button" role="tab" id="ach-tab-chat" aria-selected={view === 'chat'} aria-controls="ach-view-chat" tabIndex={view === 'chat' ? 0 : -1} onClick={() => show('chat')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show('record'); document.getElementById('ach-tab-record')?.focus(); } }}>{CHAT_COPY.tabChat}</button>
            <button type="button" role="tab" id="ach-tab-record" aria-selected={view === 'record'} aria-controls="record" tabIndex={view === 'record' ? 0 : -1} onClick={() => show('record')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show('chat'); document.getElementById('ach-tab-chat')?.focus(); } }}>{CHAT_COPY.tabRecord}</button>
          </div>
        </header>

        {/* The conversation stays mounted while Your record is open, so looking at the record never loses a thread. */}
        <div className="ach-main" id="ach-view-chat" role="tabpanel" aria-labelledby="ach-tab-chat" hidden={view !== 'chat'}>
          <div className="amb-panel amb-panel--page">
            <AskMobiPanel
              key={`${chatKey}:${context.ref || 'page'}`}
              form="page"
              context={context}
              record={insightsState}
              onRecordRetry={() => setRecordTry((n) => n + 1)}
              saved={saved}
              onLeaveSaved={() => setSaved(null)}
              onExchange={() => setHistoryTick((n) => n + 1)}
              onBusy={setBusy}
              onApi={takeApi}
              draft={chatKey === 0 ? draft : ''}
              start={{
                standing: standing.read, asks, now: new Date(now), onRecord: () => show('record'),
                adapt: (ask) => (freshAnswer && ask.free && !ask.answer && /losing marks/i.test(ask.text) ? { text: ask.text, answer: freshAnswer } : ask),
              }}
            />
          </div>
        </div>

        {historyOpen && wide && view === 'chat' ? (
          <HistoryColumn rows={recent} current={saved?.id || null} onOpen={openSaved} onClose={() => setHistoryChoice(false)} />
        ) : null}

        {/* Drawn the first time it is opened (its figures count up as they come into view), then kept. */}
        <section id="record" className="mrp-record" role="tabpanel" aria-labelledby="ach-tab-record" hidden={view !== 'record'}>
          {recordSeen ? (
          <>
            <div className="mrp-record__head">
              <h2 id="mrp-record-title">{CHAT_COPY.recordTitle}</h2>
              {ready ? <p>{recordLine(insights.sessions)}</p> : null}
            </div>

            {status === 'loading' ? <p className="mrp-quiet" role="status">{DOOR_COPY.reading}</p> : null}
            {status === 'unavailable' ? (
              <div className="ace-fresh">
                <p className="ace-fresh__body" role="status">{typeof navigator !== 'undefined' && navigator.onLine === false ? DOOR_COPY.readOffline : DOOR_COPY.readFailed}</p>
                <button type="button" className="ach-key" onClick={() => setRecordTry((n) => n + 1)}>{DOOR_COPY.tryAgain}</button>
              </div>
            ) : null}
            {fresh ? (
              <div className="ace-fresh">
                <p className="ace-fresh__say">{DOOR_COPY.emptySay}</p>
                <p className="ace-fresh__body">{DOOR_COPY.emptyBody}</p>
                <Link href={FIRST_SET_HREF} className="ach-key">{DOOR_COPY.emptyKey}</Link>
                <p className="mrp-quiet">{DOOR_COPY.emptyAfter}</p>
              </div>
            ) : null}

            {ready || status === 'unavailable' ? <StandingCard view={standingView(standing.read)} onRetry={standing.retry} /> : null}

            {ready ? (
              <div className="mrp-asks">
                <h3>{CHAT_COPY.recordAsk}</h3>
                <p>{CHAT_COPY.recordAskLine}</p>
                <ul className="ace-list">
                  {asks.map((a) => (
                    <li key={a.id}>
                      <button type="button" className="ace-row" data-locked={a.locked || undefined} disabled={busy && !a.locked} onClick={(event) => askInChat(a, event)} aria-label={`Ask: ${a.text}. ${a.preview ? `${a.preview}. ` : ''}${priceWord(a.price)}`}>
                        <span className="ace-row__text"><b>{a.text}</b>{a.preview ? <small>{a.preview}</small> : null}</span>
                        {a.price === 'pro'
                          ? <span className="ace-price ace-price--pro"><Lock size={13} aria-hidden="true" />{DOOR_COPY.pro}</span>
                          : <span className="ace-price" data-price="free">{DOOR_COPY.free}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* A new account has no record to show, and the lines above already say so with their one key: the empty view would say it twice. */}
            {fresh ? null : (
              <div className="mrp-full">
                <h3>{DOOR_COPY.recordInFull}</h3>
                <p>{DOOR_COPY.recordInFullLede}</p>
                <RecordView state={insightsState} onNavigate={(route) => router.push(route)} pro={pro} />
              </div>
            )}
            <p className="mrp-foot"><Link href="/wallet" className="ame ame--text">Your credits and how they work</Link></p>
          </>
          ) : null}
        </section>
      </div>

      {historyOpen && !wide ? (
        <HistorySheet rows={recent} current={saved?.id || null} onOpen={openSaved} onClose={() => setHistoryChoice(false)} />
      ) : null}
    </div>
  );
}
