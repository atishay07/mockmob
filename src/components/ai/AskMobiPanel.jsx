"use client";

// Ask Mobi, one conversation in two frames (ASK-MOBI-1018; a chat since 16 Nov 2026, the owner that evening: "It should feel
// like a proper AI agent ... but even better than that"). The /mentor page (form 'page') and the floating window over a
// question, a mock, Today or Practice (form 'window', or a phone's 'sheet') are this one engine and the same parts: the thread
// (ChatThread.jsx), the composer with its Photo key (ChatComposer.jsx) and the words (chatCopy.mjs). The page adds its own head
// and its start (ChatEmpty.jsx); the panel adds its header, its context row and the opening for what it was opened about.
//
// Kept from R4 as it was: free answers from the record (answerFromInsights), the question hand-off (questionRef and
// /api/recovery/ask-context), the price shown before every paid reply (W-060), one request id per student action that is
// reused only after an unknown outcome so a retry can never charge twice, and the wallet broadcast to the top bar.
//
// v13 (C-dec 3 and 3b, D157): a written reply that opens a doubt is a finished job: Mobi's answer, one free follow-up (sent
// with the thread's id) and 2 new CUET-style questions answered right here (DoubtChecks). The follow-up is offered in the
// composer; after it, the composer is a new ask again, with its price. "What should I revise tonight?" is read from the record
// by the server, free (replyKind 'tonight').
//
// "A question I got wrong" (bring a mistake, 16 Nov 2026; rules and words in src/services/mobi/bringMistake.mjs, the server
// POST /api/ai/mentor/mistake): typed, pasted or a photo, sent from the composer and answered as a turn of the same thread:
// what it tests, why the answer is what it is (or that Mobi is not sure), the likely slip, the chapter from MockMob's own list,
// 2 checks answered in place and one next move. States: sending, answered, failed (Try again, a NEW request), unknown (Try
// again, the SAME request, so it can never be charged twice), over this month's AI limit, no credits, paused, offline, refused
// and the fixed support reply. Nothing is shown as answered before the server says so, and nothing is faked as streaming.
//
// A refusal or a failure is a turn: what happened, what it used (the server's amount, never assumed) and the way forward.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { walletFromResponse, isPaidUser } from '@/services/credits/aiWalletState';
import { announceWallet, cachedWallet } from '@/components/useWalletSummary';
import { answerFromInsights } from '../../../data/prepos_insights';
import { needsSupport, SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { MOBI_JOB_CREDITS, creditCount } from '@/lib/creditCopy.mjs';
import {
  MISTAKE_COPY, MISTAKE_PHOTO_ON, cleanText, mistakeCredits, mistakeOutcome, mistakeSubjects, photoOverCapLine,
} from '@/services/mobi/bringMistake.mjs';
import { useInsights } from './useInsights';
import { FIRST_SET_HREF, FIRST_SET_LABEL } from '@/lib/firstSet.mjs';
import { planStart } from './startPlan.mjs';
import MobiMark from './MobiMark';
import { DoubtChecks, TonightBlock } from './MobiJobParts';
import ChatComposer from './ChatComposer';
import ChatEmpty from './ChatEmpty';
import {
  MistakeAnswer, MobiTurn, NextMove, PhotoView, Prose, SavedExchange, StatusTurn, TurnMeta, UserTurn, Waiting, mistakeUsed, showTurn, turnAsText,
} from './ChatThread';
import { CHAT_COPY, canAfford, chargedOf, refusalParts, savedCost, usedWords, waysForward } from './chatCopy.mjs';
import { clockStamp } from './askDoors.mjs';
import { DRAFT_KEY } from './askMobi.mjs';
import { JOB_COPY, chatFailure, followUpOpen, isTonightAsk, threadFromReply } from './mobiJobs.mjs';
import {
  answerFree, inSentence, modeFor, openingFor, paidState, priceForText, productAskFor, recordSource, recordSummary, sessionsLabel,
  suggestionsFor,
  askIdForText,
} from './askSuggestions.mjs';
import './ask-mobi.css';
import './ask-chat.css';

// Offline: a written reply needs a connection, so nothing is sent and nothing is charged; answers from the record already on
// screen still work.
const subscribeOnline = (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
const onlineNow = () => navigator.onLine !== false;

// L1: the support reply as a turn of the thread (src/services/ai/supportCheck.js), for offline or a server out of reach.
const supportTurn = (reply = SUPPORT_REPLY) => ({ id: `a_${Date.now()}`, role: 'assistant', response: { reply, actions: [], origin: 'safety' } });

// The development preview (/preview/arena &photo=off) can show the composer with the photo switch off. It can only turn
// photos off, never on.
const previewPhotoOff = () => typeof window !== 'undefined' && window.__mmPreviewMistakePhotoOff === true;

// A question brought from another test. The model has 35 s; the route's own reads sit around it. A reply later than this is an
// unknown outcome: Try again sends the same request, which the server answers from what it stored (never a second charge).
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

const X = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
);
// The window's size key: two corners pointing out (Make larger) or in (Make smaller).
const Grow = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
);
const Shrink = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
);

export default function AskMobiPanel(props) {
  const { user } = useAuth();
  // Remount on account change so no transcript or wallet from another account survives.
  return <Panel key={user?.id || 'guest'} {...props} />;
}

/**
 * `form`: 'page' (the /mentor chat) | 'window' (the floating window over a page) | 'sheet' (a phone). `context`: what the panel
 * was opened about. The window adds `size` ('small' | 'large'), `onSize` (its Make larger and Make smaller key) and `pageHref`
 * (Ask Mobi's own page, linked from the larger window); `draft` is words carried to the page from the window, put in the composer.
 * The page hands over what it has already read and what only it can draw:
 *   `record`    its read of the record ({ status, insights }), so an ask never depends on a second read that can fail;
 *   `start`     what the start of a chat draws from (ChatEmpty's props: the record's asks, where the student stands), drawn
 *               while nothing has been asked; `start.adapt(ask)` may hand an ask its page-made answer;
 *   `saved`     a saved exchange opened from History, shown read-only until `onLeaveSaved`;
 *   `onExchange` is told when a new exchange has been answered (History reads again); `onBusy(bool)` while a reply is on its
 *   way (New chat waits for it); `onApi({ ask })` hands the page the way to run a question from Your record in this chat.
 */
function Panel({ context: opened, onClose, form = 'window', titleId = 'ask-mobi-title', record = null, onRecordRetry = null, start = null, saved = null, onLeaveSaved = null, onExchange = null, onBusy = null, onApi = null, size = null, onSize = null, pageHref = null, draft = '' }) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id || null;
  const pro = isPaidUser(user);
  const offline = !useSyncExternalStore(subscribeOnline, onlineNow, () => true);

  // On the /mentor page (form 'page') the conversation is the page: there is no close, and leaving through a link is plain
  // navigation.
  const onPage = form === 'page';
  const leave = () => { if (!onPage) onClose?.(); };
  const [context, setContext] = useState(opened);
  const [recordTry, setRecordTry] = useState(0);
  // The page hands over the record it has already read, so a start's ask never depends on a second read that can fail. Without
  // one (the window or the phone sheet), the panel reads the record itself.
  const handed = record || null;
  const fetched = useInsights(handed ? null : userId, recordTry);
  const insightsState = handed || fetched;
  const status = insightsState.status;
  const insights = insightsState.insights;
  const [showRecord, setShowRecord] = useState(opened?.record === true);

  // The wallet: the balance this tab read in the last five minutes paints at once; the server's answer replaces it, and
  // every fresh read is announced so the top bar chip shows the same number (W-060).
  const [wallet, setWallet] = useState(null);
  const walletSequence = useRef(0);
  const readWallet = useCallback(async () => {
    const sequence = ++walletSequence.current;
    try {
      const res = await fetch('/api/ai/credits', { cache: 'no-store' });
      const data = await res.json();
      const next = walletFromResponse(data, { ok: res.ok });
      if (sequence === walletSequence.current) setWallet(next);
      announceWallet(userId, next);
    } catch { if (sequence === walletSequence.current) setWallet(walletFromResponse(null, { ok: false })); }
  }, [userId]);
  useEffect(() => {
    const fence = walletSequence;
    let active = true;
    const cached = cachedWallet(userId);
    if (userId) Promise.resolve().then(() => { if (!active) return; if (cached) setWallet((prev) => prev || cached); readWallet(); });
    return () => { active = false; fence.current++; };
  }, [readWallet, userId]);

  // A question handed over by its reference: its short context is read from the server (free). The reply is written about
  // that one question, so a typed ask with the question attached is always a written reply.
  const questionRef = context?.kind === 'question' ? context.ref : null;
  const [questionCtx, setQuestionCtx] = useState(questionRef ? { status: 'loading' } : null);
  useEffect(() => {
    if (!questionRef) return undefined;
    let alive = true;
    fetch(`/api/recovery/ask-context?q=${encodeURIComponent(questionRef)}`, { cache: 'no-store' })
      .then(async (res) => ({ res, data: await res.json().catch(() => null) }))
      .then(({ res, data }) => { if (alive) setQuestionCtx(res.ok && data?.ok ? { status: 'ready', ...data.context } : { status: 'error' }); })
      .catch(() => { if (alive) setQuestionCtx({ status: 'error' }); });
    return () => { alive = false; };
  }, [questionRef]);

  const withQuestion = Boolean(questionRef) && questionCtx?.status === 'ready';
  const opening = Boolean(questionRef) && questionCtx?.status === 'loading';
  const questionFailed = Boolean(questionRef) && questionCtx?.status === 'error';
  const chapter = context?.chapter || questionCtx?.chapter || null;
  const scoped = useMemo(() => ({ ...context, chapter }), [context, chapter]);
  const qName = context?.number ? `Q${context.number}` : 'this question';
  const paid = paidState(wallet);
  // A typed ask with the question attached is a written reply. When written replies cannot be bought, the composer asks
  // the record instead (free), and says so; it never claims the record can discuss the question.
  const questionTyping = withQuestion && (!wallet || paid.open);

  const [turns, setTurns] = useState([]);
  const [asked, setAsked] = useState([]);
  const [input, setInput] = useState('');
  // Words carried from the window to Ask Mobi's page go into the composer once, never over what is already typed.
  const [seenDraft, setSeenDraft] = useState('');
  if (draft && draft !== seenDraft) { setSeenDraft(draft); if (!input) setInput(draft); }
  const [pending, setPending] = useState(null);
  const [retry, setRetry] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  // The open doubt: { id, followUpsLeft, subject, chapter }. Its one follow-up is free; after it, a new doubt is a new job.
  const [doubtThread, setDoubtThread] = useState(null);
  // The ask the page's start handed over (a tile, a starter, a record question): { text, free?, doubt?, answer? }.
  const [initial, setInitial] = useState(null);
  const [startedFor, setStartedFor] = useState(null);
  const anchorRef = useRef(null);
  const inFlight = useRef(false);
  const pendingRef = useRef(null);
  const bodyRef = useRef(null);
  const rootRef = useRef(null);
  const composerRef = useRef(null);

  // "A question I got wrong": the request on its way or held ({ id, payload, credits, photo }), the photo switch as this page
  // was built (the server's own "photos are off" turns it off here too), and the photos this thread shows.
  const mistakeRef = useRef(null);
  const [mistakeHold, setMistakeHold] = useState(null);
  const [stopped, setStopped] = useState(false);
  const [photoOn, setPhotoOn] = useState(() => MISTAKE_PHOTO_ON && !previewPhotoOff());
  const photoUrls = useRef([]);
  const [viewing, setViewing] = useState(null);
  const subjects = useMemo(() => mistakeSubjects(user?.subjects), [user?.subjects]);
  useEffect(() => { const urls = photoUrls.current; return () => { for (const url of urls) URL.revokeObjectURL(url); }; }, []);

  // The free answer already there when Mobi opens from a mock, Today or Practice (no tap, no credit).
  const first = useMemo(() => openingFor({ context: scoped, insights, status, pro }), [scoped, insights, status, pro]);
  const asks = suggestionsFor({ context: scoped, insights, status, pro, asked, limit: turns.length || first ? 2 : 3 });
  const isNew = status === 'empty' && scoped.kind !== 'question';

  // A new turn comes into view once, under the reader's control: the question it answers when that is short, else the
  // answer's own top. Nothing scrolls again while they read.
  useEffect(() => {
    if (!turns.length && !pending) return;
    showTurn(bodyRef.current);
  }, [turns, pending]);

  function navigate(route) {
    if (!route) return;
    router.push(route);
    leave();
  }

  function logLocal(message, response) {
    fetch('/api/ai/mentor/local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, message, response: { reply: response.reply, actions: response.actions, cards: [], confidence: 0, deterministic: true }, mode: 'guide' }) })
      .then((res) => res.json()).then((data) => { if (data?.sessionId) setSessionId(data.sessionId); onExchange?.(); }).catch(() => {});
  }

  function pushFree(label, answer) {
    const response = { reply: answer.reply, actions: (answer.actions || []).map((a) => ({ label: a.label, route: a.route })), origin: 'record', source: answer.source };
    setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: label }, { id: `a_${Date.now()}`, role: 'assistant', response }]);
    logLocal(label, response);
  }

  function askRow(ask) {
    if (inFlight.current || pending || retry || mistakeHold) return;
    if (ask.price !== 'free' && offline) return;
    setAsked((prev) => [...prev, ask.id]);
    if (ask.price === 'free') {
      const answer = answerFree(ask.id, { context: scoped, insights, pro });
      if (answer) { pushFree(ask.label, answer); return; }
    }
    sendPaid(ask.label);
  }

  function submit() {
    const text = input.trim();
    if (!text || inFlight.current || opening || retry || mistakeHold) return;
    if (saved) onLeaveSaved?.();
    // L1: words that sound like distress always reach the support reply, free: before a follow-up, a record or product
    // answer, and whatever the wallet says (src/services/ai/supportCheck.js).
    if (needsSupport(text)) { setInput(''); sendSupport(text); return; }
    // An open doubt: the words are its free follow-up, never a record answer (talk inside a job is included).
    if (!questionTyping && followUpOpen(doubtThread)) {
      if (offline) return;
      setInput('');
      sendFree(text, 'followup');
      return;
    }
    const product = !questionTyping ? productAskFor(text) : null;
    if (product) { setInput(''); pushFree(text, answerFree(product, { context: scoped, insights, pro })); return; }
    // Questions about the student's own record are answered from the record: free, instant, no model. Never while a
    // question is attached and written replies are open: a record answer cannot discuss a question.
    const fromRecord = !questionTyping && (status === 'ready' || status === 'empty') ? answerFromInsights(text, insights ?? { state: 'empty' }, { pro }) : null;
    if (fromRecord) {
      setInput('');
      pushFree(text, { reply: fromRecord.reply, actions: (fromRecord.actions || []).slice(0, 1), source: recordSource(insights) });
      return;
    }
    // "What should I revise tonight?": the server reads it from the record, free.
    if (!questionTyping && isTonightAsk(text)) {
      if (offline) return;
      setInput('');
      sendFree(text, 'tonight');
      return;
    }
    if (!paid.open || offline) return;
    setInput('');
    sendPaid(text);
  }

  async function sendPaid(text, isRetry = false) {
    const finalText = String(text || '').trim();
    if (!finalText || inFlight.current || opening || (retry && !isRetry)) return;
    if (!isRetry && !paid.open) return;
    if (!isRetry && offline) return;
    inFlight.current = true;
    if (!isRetry) setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: finalText }]);
    // One request id per student action. It is reused only if the last attempt ended with an unknown outcome (network
    // error), so a retry can never be charged twice. A new doubt opens a new thread, so the old one closes here.
    if (!isRetry) pendingRef.current = { message: finalText, id: crypto.randomUUID().replace(/-/g, ''), mode: modeFor(scoped.kind), questionRef: withQuestion ? questionRef : null, anchor: withQuestion ? null : takeAnchor(), kind: 'paid' };
    if (!isRetry && !pendingRef.current.questionRef) setDoubtThread(null);
    await deliver();
  }

  // The follow-up inside an open doubt, and tonight's set from the record: never charged (C-dec 3b). The same request-id
  // rule as a paid reply; Retry sends the same request.
  async function sendFree(text, kind) {
    const finalText = String(text || '').trim();
    if (!finalText || inFlight.current || opening || retry || offline) return;
    if (kind === 'followup' && !followUpOpen(doubtThread)) return;
    inFlight.current = true;
    setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: finalText }]);
    pendingRef.current = { message: finalText, id: crypto.randomUUID().replace(/-/g, ''), mode: modeFor(scoped.kind), questionRef: null, anchor: null, kind, threadId: kind === 'followup' ? doubtThread.id : null };
    await deliver();
  }

  // L1: the server answers it with the support reply and saves the turn; offline, or if the server cannot be reached, the
  // same reply is shown here (supportTurn), so it never waits on a connection or a credit.
  function sendSupport(text) {
    if (offline) { setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text }, supportTurn()]); return; }
    sendFree(text, 'support');
  }

  function takeAnchor() {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    return anchor;
  }

  async function deliver() {
    const sent = pendingRef.current;
    setPending({ question: Boolean(sent.questionRef), free: sent.kind === 'followup' || sent.kind === 'tonight' || sent.kind === 'support', kind: sent.kind });
    try {
      const res = await fetch('/api/ai/mentor/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        message: sent.message, mode: sent.mode, replyKind: replyKindOf(sent), sessionId, requestId: sent.id,
        ...(sent.threadId ? { threadId: sent.threadId } : {}),
        ...(sent.anchor?.subject ? { subject: sent.anchor.subject, ...(sent.anchor.chapter ? { chapter: sent.anchor.chapter } : {}) } : {}),
        ...(pendingRef.current.questionRef ? { questionRef: pendingRef.current.questionRef } : {}),
      }) });
      const data = await res.json();
      if (res.ok && !data?.response?.reply && !data?.reply) throw new Error('Reply outcome unreadable');
      const about = pendingRef.current.questionRef;
      pendingRef.current = null; // the server gave a definite answer
      setRetry(null);
      let response;
      if (res.ok) {
        const job = threadFromReply(data);
        response = { ...normalizeResponse({ ...(data.response || data), runtimeState: data.runtimeState }), about, followUp: sent.kind === 'followup', tonight: job.tonight };
        if (job.thread) {
          setDoubtThread(job.thread);
          // The reply that opened the doubt carries its 2 questions; a follow-up keeps the thread's own.
          if (!sent.threadId) Object.assign(response, { thread: job.thread, checks: job.checks, checksNote: job.checksNote });
        }
      } else if (sent.kind === 'support') {
        response = supportTurn().response;
      } else {
        const failure = chatFailure(res.status, data);
        if (failure.full) setDoubtThread((t) => (t ? { ...t, followUpsLeft: 0 } : t));
        if (failure.gone) setDoubtThread(null);
        response = {
          reply: data.message || res.status === 429 || res.status === 402 ? failure.reply : 'Mobi could not answer just now. Nothing is charged for a reply that fails.',
          // What the failure used is the amount the server said (0 unless it says otherwise).
          origin: 'status', actions: failure.actions, charged: chargedOf(data),
        };
      }
      setTurns((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', response, requestId: sent.id }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (res.ok) onExchange?.();
    } catch {
      if (sent.kind === 'support') { pendingRef.current = null; setTurns((prev) => [...prev, supportTurn()]); }
      else setRetry({ ...pendingRef.current });
    } finally {
      setPending(null);
      inFlight.current = false;
      readWallet();
    }
  }

  // ---- "A question I got wrong": typed, pasted or a photo -----------------------------------------------------------------------
  // The composer hands over what was composed; `true` back means it left (the composer clears). One request id per send; it is
  // reused only after an unknown outcome.
  function sendMistake(fields) {
    if (inFlight.current || opening || retry || mistakeHold || stopped) return false;
    const question = String(fields.question || '');
    const chosen = String(fields.chosen || '').trim() || null;
    const key = String(fields.key || '').trim() || null;
    // As the server checks: the words as typed and as cleaned, so an invisible character cannot split a phrase.
    const distress = [question, chosen, key].some((t) => needsSupport(t) || needsSupport(cleanText(t)));
    const photo = fields.photo?.data && photoOn ? fields.photo : null;
    if (!photo && !question.trim()) return false;
    const userTurn = { id: `u_${newRequestId()}`, role: 'user', text: question.trim(), photo: photo ? { url: photo.url } : null, chosen };
    if (saved) onLeaveSaved?.();
    // Words that sound like distress: the support reply, free, offline too (the server answers it too, before anything else).
    if (distress && offline) { setTurns((prev) => [...prev, userTurn, supportTurn()]); return true; }
    if (!distress && (!paid.open || offline)) return false;
    const payload = { question, chosen, key, subject: fields.subject };
    // The prepared JPEG only (never the original file), and only with the switch on.
    if (photo) payload.photo = { mime: 'image/jpeg', data: photo.data };
    mistakeRef.current = { id: newRequestId(), payload, credits: mistakeCredits(payload), photo: Boolean(photo) };
    if (photo?.url) photoUrls.current.push(photo.url);
    setTurns((prev) => [...prev, userTurn]);
    deliverMistake();
    return true;
  }

  async function deliverMistake() {
    const sent = mistakeRef.current;
    if (!sent || inFlight.current) return;
    inFlight.current = true;
    setMistakeHold(null);
    setPending({ kind: 'mistake', photo: sent.photo, free: false });
    let plan;
    let charged = 0;
    try {
      const outcome = await postMistake({ ...sent.payload, requestId: sent.id });
      // What it used is the amount in the server's own answer, for a refusal as much as for an answer.
      charged = outcome.kind === 'response' ? chargedOf(outcome.body) : 0;
      plan = mistakeOutcome(outcome, { credits: sent.credits });
    } catch {
      plan = { state: 'unknown', message: MISTAKE_COPY.lost };
    } finally {
      inFlight.current = false;
      setPending(null);
      // The wallet is read again after every definite or unknown outcome, so the balance shown is the one stored.
      readWallet();
    }
    const push = (turn) => setTurns((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', ...turn }]);
    // An unknown outcome holds the conversation: only Try again (the same request) goes out.
    if (plan.state === 'unknown') { setMistakeHold({ message: plan.message }); return; }
    mistakeRef.current = null;
    if (plan.state === 'answered') {
      const subject = subjects.find((s) => s.id === sent.payload.subject) || subjects[0] || null;
      push({ mistake: { mistake: plan.mistake, charged: plan.charged, replayed: plan.replayed, credits: sent.credits, subject, photo: sent.photo }, requestId: sent.id });
      onExchange?.();
      return;
    }
    if (plan.state === 'support') { push({ response: { reply: plan.reply, actions: [], origin: 'safety' } }); return; }
    if (plan.photoOff) { setPhotoOn(false); composerRef.current?.photoOff(); }
    let state = plan.state;
    let message = plan.message;
    // A photo ask past this month's AI limit: a typed question reserves less, so it may still fit, and the words say so
    // (review, 16 Nov). A typed ask that meets the limit stops written asks for this conversation.
    if (state === 'over' && sent.photo) { state = 'photo_over'; message = photoOverCapLine(plan.message); }
    else if (state === 'over') setStopped(true);
    const noCredits = Boolean(wallet?.known) && Number.isFinite(wallet?.total) && wallet.total <= 0;
    push({
      response: { reply: message, origin: 'status', actions: [], charged, state, photo: sent.photo, ways: waysForward({ state, photo: sent.photo, noCredits: noCredits || state === 'blocked' }) },
      // A failed reply's Try again sends the same words as a NEW request.
      again: state === 'failed' ? { payload: sent.payload, credits: sent.credits, photo: sent.photo } : null,
    });
  }

  function onWay(id, turn) {
    if (id === 'retake') composerRef.current?.photo();
    else if (id === 'type') composerRef.current?.mistake();
    else if (id === 'retry' && turn?.again && !inFlight.current) {
      mistakeRef.current = { id: newRequestId(), ...turn.again };
      setTurns((prev) => prev.filter((t) => t.id !== turn.id));
      deliverMistake();
    }
  }

  // The page's start hands the conversation one ask to run: a tile, a starter, or a record question (the page's own answer for
  // "my last paper" comes with it). The same checks as typing here: a record answer waits for the record, a written reply
  // waits for the wallet, and nothing is sent unless the wallet is open and the connection is up. A reply that cannot go
  // says why, in the thread, and says that nothing was charged.
  const started = useRef(false);
  const startNow = useRef(null);
  const [failedStart, setFailedStart] = useState(null);
  const run = useCallback((ask) => {
    if (!ask?.text || inFlight.current) return;
    started.current = false;
    setFailedStart(null);
    setInitial({ ...ask });
  }, []);
  useEffect(() => {
    startNow.current = () => {
      if (!initial?.text || started.current) return;
      const plan = planStart({ initial, status, insights, pro, wallet, offline, paid });
      anchorRef.current = plan.anchor || null;
      const ask = (reply, actions = []) => setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: plan.text }, { id: `a_${Date.now()}`, role: 'assistant', response: { reply, origin: 'status', actions } }]);
      if (plan.kind === 'none' || plan.kind === 'wait') return;
      started.current = true;
      setStartedFor(initial);
      // A start's ask that is also an "Ask next" row is marked asked, so Mobi never offers back what it just answered.
      const handedId = askIdForText(plan.text, scoped);
      if (handedId) setAsked((prev) => (prev.includes(handedId) ? prev : [...prev, handedId]));
      if (plan.kind === 'page') pushFree(plan.text, initial.answer);
      else if (plan.kind === 'product') pushFree(plan.text, answerFree(plan.product, { context: scoped, insights, pro }));
      else if (plan.kind === 'record') pushFree(plan.text, plan.answer);
      else if (plan.kind === 'record-failed') {
        // A "Free" ask is never sent as a written reply: it says what happened, that nothing was charged, and offers Try again.
        const turnId = `u_${Date.now()}`;
        setTurns((prev) => [...prev, { id: turnId, role: 'user', text: plan.text }]);
        setFailedStart({ reply: plan.reply, turnId });
      } else if (plan.kind === 'say') ask(plan.reply, plan.actions);
      else if (plan.kind === 'support') sendSupport(plan.text);
      else if (plan.kind === 'tonight') sendFree(plan.text, 'tonight');
      else sendPaid(plan.text);
    };
  });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) startNow.current?.(); });
    return () => { active = false; };
  }, [initial, status, wallet, offline]);
  function tryStartAgain() {
    const failed = failedStart;
    if (!failed) return;
    setFailedStart(null);
    setTurns((prev) => prev.filter((turn) => turn.id !== failed.turnId));
    started.current = false;
    // Handed a record that is read: there is nothing to read again, so the ask runs again now. Otherwise the record is read
    // again (by the page that handed it, or here), and the ask runs when that read settles (its status re-runs the effect above).
    if (handed && (handed.status === 'ready' || handed.status === 'empty')) window.setTimeout(() => startNow.current?.(), 0);
    else if (handed) onRecordRetry?.();
    else setRecordTry((n) => n + 1);
  }

  const dropQuestion = () => { setContext((prev) => ({ ...prev, kind: 'page', ref: null, number: null, pickLabel: null, keyLabel: null })); setQuestionCtx(null); setAsked([]); };
  const threadOpen = !questionTyping && followUpOpen(doubtThread);
  const threadDone = !questionTyping && Boolean(doubtThread) && !threadOpen;
  const price = threadOpen && input.trim() ? 'followup' : !questionTyping && isTonightAsk(input) ? 'free' : priceForText(input, { insights, status, pro, hasQuestion: questionTyping });
  const busy = Boolean(pending) || Boolean(retry) || Boolean(mistakeHold);
  // A written reply must be affordable as well as open: the price is the constant the server charges by.
  const affordable = canAfford({ kind: 'doubt', wallet });
  const canSend = Boolean(input.trim()) && !busy && !opening && (price === 'free' || (price === 'followup' && !offline) || (paid.open && affordable && !offline) || needsSupport(input));
  const placeholder = questionTyping ? `Ask about ${qName}` : scoped.kind === 'mock' ? `Ask about ${inSentence(scoped.label)}` : null;
  const sessions = sessionsLabel(insights, status);
  const summary = recordSummary(insights, { pro });
  const subjectChip = withQuestion || opening
    ? { name: qName, detail: chapter }
    : scoped.kind === 'mock' ? { name: scoped.label || 'This mock', detail: null }
      : scoped.kind === 'today' ? { name: 'Today', detail: null }
        : scoped.kind === 'practice' ? { name: 'Practice', detail: chapter }
          : null;
  const lastIndex = turns.length - 1;
  // The start's ask, waiting for the record or the wallet before it can run: shown at once as the student's own turn.
  const waitingStart = Boolean(initial?.text) && startedFor !== initial && !failedStart;
  const talking = turns.length > 0 || Boolean(pending) || Boolean(retry) || Boolean(failedStart) || Boolean(mistakeHold) || waitingStart;
  // The page's start (ChatEmpty) is drawn while nothing has been asked and the page is not about one question.
  const idle = onPage && !saved && !talking && !questionRef && Boolean(start);
  // One volt key per view: the floating window sits outside the page (#app-main), beside the sidebar's lime Start key. While it
  // is open its send key is the view's volt, so a marker in the page steps that Start key back (the shell's own data-owns-start
  // contract, AppLayoutClient). The phone sheet covers the dock itself; the page's send key marks itself.
  const [shellMain] = useState(() => (typeof document !== 'undefined' && form === 'window' ? document.getElementById('app-main') : null));
  const large = size === 'large';
  // "Open Ask Mobi's page" from the larger window: the page starts a new chat, so typed words go with the student (DRAFT_KEY).
  const carryDraft = () => {
    try { if (input.trim()) window.sessionStorage.setItem(DRAFT_KEY, input); } catch { /* The link still opens the page. */ }
    leave();
  };

  // The phone's keyboard. The sheet rests on the visible part of the screen (the visual viewport), and the page's composer is
  // pinned above the keyboard, so the send key is never under it and nothing jumps when it opens.
  useLayoutEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const target = form === 'sheet' ? rootRef.current?.closest('.amb-panel--sheet') : onPage ? rootRef.current : null;
    if (!target || !vv) return undefined;
    const names = form === 'sheet' ? ['--amb-kb', '--amb-vh'] : ['--ach-kb', '--ach-vh'];
    const update = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      target.style.setProperty(names[0], `${kb}px`);
      target.style.setProperty(names[1], `${Math.round(vv.height)}px`);
      target.toggleAttribute('data-keyboard', kb > 80);
      // The field being typed in stays in view, above the keyboard.
      const active = document.activeElement;
      if (form === 'sheet' && kb > 80 && active && rootRef.current?.contains(active) && /^(TEXTAREA|INPUT|SELECT)$/.test(active.tagName)) {
        window.requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }));
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      for (const name of names) target.style.removeProperty(name);
      target.removeAttribute('data-keyboard');
    };
  }, [form, onPage]);

  // The composer's own height, so a turn scrolled into view never stops under it (the page's composer is pinned).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const foot = root?.querySelector('.ach-foot');
    if (!root || !foot || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => root.style.setProperty('--ach-foot-h', `${Math.round(foot.getBoundingClientRect().height)}px`));
    ro.observe(foot);
    return () => ro.disconnect();
  }, []);

  const focusDoubt = useCallback(() => composerRef.current?.doubt(), []);
  const openMistake = useCallback(() => composerRef.current?.mistake(), []);
  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);
  useEffect(() => { onApi?.({ ask: run }); }, [onApi, run]);

  return (
    <div className="amb ach" data-form={form} data-idle={idle || undefined} ref={rootRef}>
      {shellMain ? createPortal(<span hidden data-owns-start="" />, shellMain) : null}
      {onPage ? null : (
        <header className="amb-head">
          <MobiMark size={24} />
          <h2 id={titleId}>Ask Mobi</h2>
          {large && pageHref ? (
            <Link href={pageHref} className="amb-away" onClick={carryDraft} aria-describedby="amb-away-note">Open Ask Mobi&rsquo;s page</Link>
          ) : null}
          {onSize ? (
            <button type="button" className="amb-icon" onClick={() => onSize(large ? 'small' : 'large')} aria-label={large ? 'Make smaller' : 'Make larger'} title={large ? 'Make smaller' : 'Make larger'}>
              {large ? <Shrink /> : <Grow />}
            </button>
          ) : null}
          <button type="button" className="amb-icon" onClick={onClose} aria-label="Close Ask Mobi" title="Close"><X /></button>
        </header>
      )}
      {large && pageHref ? (
        <p className="amb-away-note" id="amb-away-note">
          {input.trim() ? 'Ask Mobi’s page starts a new chat. What you have typed goes with you.' : 'Ask Mobi’s page starts a new chat.'}
        </p>
      ) : null}

      {!onPage || subjectChip ? (
        <div className="amb-ctx">
          {subjectChip ? (
            <span className="amb-chip">
              <b>{subjectChip.name}</b>{subjectChip.detail ? <span><i aria-hidden="true">·</i> {subjectChip.detail}</span> : null}
              <button type="button" onClick={() => (withQuestion || opening ? dropQuestion() : setContext((prev) => ({ ...prev, kind: 'page', lines: [] })))} aria-label={`Stop asking about ${subjectChip.name}`}><X /></button>
            </span>
          ) : null}
          {onPage ? null : status === 'unavailable' ? (
            <button type="button" className="amb-chip amb-chip--rec" onClick={() => setRecordTry((n) => n + 1)}>
              <b>Record not loaded</b><span><i aria-hidden="true">·</i> Retry</span>
            </button>
          ) : (
            <button type="button" className="amb-chip amb-chip--rec" aria-expanded={showRecord} aria-controls="amb-record" onClick={() => setShowRecord((v) => !v)} disabled={status === 'loading'}>
              <b>Your record</b><span><i aria-hidden="true">·</i> {status === 'loading' ? 'reading' : sessions}</span>
            </button>
          )}
        </div>
      ) : null}

      <div className="amb-body ach-thread" ref={bodyRef}>
        {!onPage && showRecord && status !== 'loading' && status !== 'unavailable' ? (
          <section id="amb-record" className="amb-record amb-rise" aria-label="Your record">
            {summary.length ? (
              <dl>{summary.map((row) => <div key={row.id}><dt>{row.label}</dt><dd>{row.text}</dd></div>)}</dl>
            ) : <p>No sessions yet. After one session your record shows your marks ledger, your biggest leak and your pace.</p>}
            <Link href="/mentor?tab=record" className="amb-link" onClick={leave}>Full record</Link>
          </section>
        ) : null}

        {opening ? <p className="amb-quiet" role="status">Opening {qName}</p> : null}
        {questionFailed ? (
          <div className="amb-notice" role="status">
            <b>That question could not be opened.</b>
            <span>You can still ask about your record.</span>
            <button type="button" className="amb-btn amb-btn--line" onClick={dropQuestion}>Ask about my record</button>
          </div>
        ) : null}

        {withQuestion ? (
          <figure className="amb-quote" aria-label={`${qName}, the question you are asking about`}>
            <p>{questionCtx.question}</p>
            <figcaption>
              {questionCtx.pick ? <span className="amb-quote__pick">You picked <b>{questionCtx.pick.letter}{context.pickLabel ? `, ${context.pickLabel}` : ''}</b></span> : <span>You left it blank</span>}
              {questionCtx.hasKey
                ? (context.keyLabel ? <span className="amb-quote__key">Key <b>{context.keyLabel}</b></span> : null)
                : <span>The key is being re-checked, so Mobi will not name an answer.</span>}
            </figcaption>
          </figure>
        ) : null}

        {idle ? (
          <ChatEmpty
            user={user} record={insightsState} standing={start.standing} asks={start.asks} photoOn={photoOn} busy={busy} now={start.now}
            onAsk={(ask) => run(start.adapt ? start.adapt(ask) : ask)} onDoubt={focusDoubt} onMistake={openMistake} onRecord={start.onRecord} onRetry={onRecordRetry}
          />
        ) : null}

        {saved ? (
          <div className="ach-saved">
            <SavedExchange row={saved} cost={savedCost(saved)} when={clockStamp(saved.at)} />
            <div className="ach-saved__foot">
              <p className="ach-fine">{CHAT_COPY.savedNote}</p>
              <button type="button" className="ach-key" onClick={onLeaveSaved}>{CHAT_COPY.askNew}</button>
            </div>
          </div>
        ) : null}

        {!onPage && isNew && !talking ? (
          <div className="amb-new">
            {/* The real character, never cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mascot/attentive.webp" alt="" width="104" height="118" />
            <p>Mobi answers from your own practice. After one session it can show where your marks went.</p>
            <button type="button" className="amb-btn amb-btn--line" onClick={() => navigate(FIRST_SET_HREF)}>{FIRST_SET_LABEL}</button>
          </div>
        ) : null}

        {/* The thread: a log that says a new reply politely. Reading order is the head, the thread, then the composer. */}
        {saved ? null : (
          <div className="ach-log" role="log" aria-live="polite" aria-relevant="additions" aria-label={CHAT_COPY.log}>
            {first ? (
              <>
                <UserTurn turn={{ text: first.ask }} />
                <Answer response={{ reply: first.reply, actions: first.actions, origin: 'record', source: first.source }} onNavigate={navigate} />
              </>
            ) : null}

            {turns.map((turn, index) => {
              const last = index === lastIndex;
              if (turn.role === 'user') return <UserTurn key={turn.id} turn={turn} last={last} onPhoto={(url) => setViewing(url)} />;
              if (turn.mistake) {
                return (
                  <MobiTurn key={turn.id} last={last} origin="model" meta={<TurnMeta used={mistakeUsed(turn.mistake)} text={turnAsText(turn, MISTAKE_COPY)} report={turn.mistake.charged > 0 || turn.mistake.replayed ? { requestId: turn.requestId, sessionId } : null} />}>
                    <MistakeAnswer answer={turn.mistake} onLeave={leave} />
                  </MobiTurn>
                );
              }
              return (
                <Answer
                  key={turn.id} response={turn.response} qName={qName} onNavigate={navigate} last={last} insights={insights} subjects={user?.subjects || []} offline={offline}
                  requestId={turn.requestId} sessionId={sessionId} busy={busy} onWay={(id) => onWay(id, turn)} onLeave={leave}
                />
              );
            })}

            {waitingStart ? <UserTurn turn={{ text: initial.text }} provisional /> : null}

            {failedStart ? (
              <StatusTurn said={refusalParts(failedStart.reply, 0).said} used={usedWords(0)} last ways={[{ id: 'again', label: CHAT_COPY.tryAgain }]} onWay={tryStartAgain} />
            ) : null}

            {pending ? <Waiting pending={pending} qName={qName} /> : null}

            {retry ? (
              <StatusTurn
                alert last busy={Boolean(pending)}
                said={'The reply could not be confirmed.\n\nRetry sends the same request, so you will not be charged twice. Your credits page shows any credit used.'}
                ways={[{ id: 'same', label: 'Retry this question' }]} onWay={() => sendPaid(retry.message, true)}
              />
            ) : null}

            {/* A question brought from another test whose outcome is not known: only Try again (the same request) goes out. */}
            {mistakeHold && !pending ? (
              <StatusTurn alert last said={mistakeHold.message} ways={waysForward({ state: 'unknown' })} onWay={() => deliverMistake()} />
            ) : null}
          </div>
        )}

        {/* Why the written asks wait (offline, paused or out of credits), in plain words, right above the rows it explains. */}
        {offline && !idle ? (
          <p className="amb-notice" role="status">
            <b>You are offline.</b>
            <span>Questions about your record still work. A written reply needs a connection, so nothing is sent and nothing is charged.</span>
          </p>
        ) : null}

        {!onPage && !offline && (withQuestion || questionRef === null) && !paid.open && wallet && asks.some((a) => a.price === 'paid') && !busy ? (
          <p className="amb-notice" role="status">{paid.why}</p>
        ) : null}

        {!idle && !saved && !opening && !questionFailed && asks.length && !pending && !retry && !mistakeHold && !waitingStart && (!onPage || turns.length || questionRef) ? (
          <section className="amb-asks" aria-label={turns.length || first ? 'Ask next' : withQuestion ? 'Ask about this question' : 'You can ask now'}>
            <h3>{turns.length || first ? CHAT_COPY.askNext : withQuestion ? 'Ask about this question' : 'You can ask now'}</h3>
            <ul>
              {asks.map((ask, i) => {
                const off = ask.price === 'paid' && (!paid.open || offline);
                return (
                  <li key={ask.id} style={{ '--i': i }}>
                    <button type="button" className="amb-ask" disabled={off} onClick={() => askRow(ask)}>
                      <b>{ask.label}</b>
                      {off ? <span>{offline && paid.open ? 'Needs a connection' : 'Needs a written reply'}</span> : ask.line ? <span>{ask.line}</span> : null}
                      <em data-price={ask.price}>{ask.price === 'free' ? 'Free' : creditCount(MOBI_JOB_CREDITS)}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      <ChatComposer
        ref={composerRef} form={form} value={input} onChange={setInput} onSubmit={submit} onMistake={sendMistake}
        canSendText={canSend} busy={busy} opening={opening} price={price} wallet={wallet} paid={paid} offline={offline}
        followUp={threadOpen} question={questionTyping} placeholder={threadDone ? JOB_COPY.newDoubtPlaceholder : placeholder}
        subjects={subjects} photoOn={photoOn} mistakeOn={Boolean(userId)} stopped={stopped} needsNet={!questionTyping && isTonightAsk(input)}
        onLeave={leave}
      />

      {viewing ? <PhotoView url={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

// What the chat route is asked for: tonight's set from the record, the follow-up of an open doubt, a reply about one question,
// or a doubt (an Ask now question; the server opens its thread and never answers it from the record's keywords).
function replyKindOf(sent) {
  if (sent.kind === 'tonight') return 'tonight';
  if (sent.kind === 'followup' || sent.questionRef) return 'model';
  return 'doubt';
}

/** What one of Mobi's turns used, in words: the server's amount for a written reply, and that a record answer is free. */
function usedFor(response, qName) {
  const tonight = Boolean(response.tonight);
  let source = response.source || null;
  if (response.origin === 'model') {
    // What a written reply used is the amount the server said it charged (chatCopy.mjs usedWords), never an assumed one.
    const spent = usedWords(response.charged);
    source = response.followUp && !response.charged ? JOB_COPY.followUpSource : response.about ? `${spent} Written about ${qName} and its key.` : spent;
  } else if (response.origin === 'status' || response.origin === 'safety') source = null;
  else if (tonight) source = JOB_COPY.tonightSource;
  else source = `${CHAT_COPY.free}. ${source || 'From your record'}.`;
  return source;
}

function Answer({ response, qName = 'this question', onNavigate, last = false, insights = null, subjects = [], offline = false, requestId = null, sessionId = null, busy = false, onWay = null, onLeave = null }) {
  const tonight = Boolean(response.tonight);
  const next = tonight ? null : response.actions?.[0];
  if (response.origin === 'status') {
    // A refusal or a failure: what happened, what it used (the server's amount), and the way forward.
    const parts = refusalParts(response.reply, response.charged);
    const ways = response.ways?.length ? response.ways : next ? [{ id: 'go', label: next.label, href: next.route || next.target }] : [];
    return <StatusTurn said={parts.said} used={parts.used} ways={ways} onWay={onWay} busy={busy} last={last} onLeave={onLeave} />;
  }
  const source = usedFor(response, qName);
  const text = turnAsText({ response });
  const report = response.origin === 'model' && response.charged > 0 && requestId ? { requestId, sessionId } : null;
  return (
    <MobiTurn last={last} origin={response.origin} meta={<TurnMeta used={source} text={text} report={report} />}>
      <Prose text={response.reply} />
      {tonight ? <TonightBlock tonight={response.tonight} actions={response.actions} onNavigate={onNavigate} /> : null}
      {response.thread ? (
        <DoubtChecks
          threadId={response.thread.id} checks={response.checks || []} note={response.checksNote || null}
          subject={response.thread.subject} chapter={response.thread.chapter} insights={insights} subjects={subjects} offline={offline}
        />
      ) : null}
      {next ? <NextMove label={next.label} onClick={() => onNavigate(next.route || next.target)} /> : null}
    </MobiTurn>
  );
}

function normalizeResponse(response) {
  const r = response && typeof response === 'object' ? response : {};
  const actions = Array.isArray(r.actions) ? r.actions.filter((a) => a && (a.route || a.target) && a.label) : [];
  return {
    reply: String(r.reply || ''), actions,
    origin: r.origin || (r.runtimeState === 'live' || r.charge?.kind === 'prepos_credit' ? 'model' : r.runtimeState === 'record' ? 'record' : r.runtimeState === 'paused' ? 'status' : null),
    charged: Math.max(0, Number(r.charge?.amount) || 0),
  };
}
