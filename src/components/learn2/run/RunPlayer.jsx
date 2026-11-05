'use client';
// Learn v2, the run player (A4-chapter-run.md 3.3 as amended by BUILD-1101 B2 and B7; the values it shares with the feed are
// A1 3.2 to 3.6). A focus page above the shell (no dock, no sidebar):
//   Phone (under 768)    a top bar (Close, the chapter, the In Revise count, "3 of 21", the ticks, "about 9 min left"), the
//                        item, and a bottom action bar with the item's keys and one status line
//   768 to 1199          one 600 px column; the action bar right under the item
//   1200 and up          session panel 240 | stage 640 | side column 72 (gaps 40): the panel holds the chapter, where you
//                        are, the piles you chose worked down, the In Revise pile (the flight's target) and Stop here
// A Key card fits its content (both faces in one grid cell, so the turn never jumps) and turns in 340 ms; Show answer, then
// Missed / Got it / Easy (Got it is the volt key). The card leaves only after the server has the rating; Got it and Easy fly
// into the Revise pile. A question sits on the page: the server grades it, a wrong pick keeps the options in view and opens
// the line you needed in place, the explanation folds behind "Why C". Every server error kind is drawn (A8 F8): a changed or
// held question is skipped with one line, an ended or expired run goes to its end, Free's second-tab 402 ends the run calmly.
// LK137: a turned card can also be dragged to rate it, right Got it, left Missed it, down Easy (useRateSwipe.js): the card holds
// where it was let go until the server has the rating, then leaves on the way it was going; the keys and 1 2 3 stay; reduced motion
// keeps the keys only. A one-time coach line says it, after the ratings' own line.
// Reload or resume: ?run=<id> (getRun) or ?resume=<id>; the ticks and the counter continue from the resumed point (A8 F11).
// A run started or resumed in place (an end key, Continue, Try again) writes its own address, ?run=<id> without end=1 or fresh,
// so a reload or Back lands in that run (R4 client-code#1); a start that a newer one overtook is ignored (client-code#10).
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderCircle, X } from 'lucide-react';
import { ReportForm } from '@/components/keycards/KeyCard';
import { RATINGS } from '@/components/keycards/kinds';
import { SWIPE_RATINGS, clearPose, poseTransform, swipeHint, swipeLeaveTo, swipePose } from '@/components/keycards/rateSwipe.mjs';
import { useRateSwipe } from '@/components/keycards/useRateSwipe';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { isMotionReduced } from '@/lib/motion';
import { useAuth } from '@/components/AuthProvider';
import { answerItem, getRun, isQuestionSkipped, isRunClosed, isSessionUsed, rateItem, runEnd, saveQuestion, startRun } from '../api';
import { isChapterMissing } from '../chapter/chapterModel.mjs';
import { useLearnLinks } from '../links';
import { runAddressParams, sameAddress } from './address.mjs';
import RunEnd from './RunEnd';
import { BelowChip, EndKey, EndScreen, StopSheet, goToOptions, isChemistry, scrollToVerdict, watchBelow, watchMore } from '../stage';
import FreeUsed from '../stage/FreeUsed';
import { reachedPlace } from '../stage/endModel.mjs';
import { CardItem, LessonItem, QuestionItem, SaveKey, SessionPanel, TopBar } from './RunParts';
import { FLIGHT, minutesLeftLine, upNextLine } from './runMath';
import { answerTally, itemHeld, itemsFinished, placeReinsert, positionWords, runPiles } from './runView.mjs';
import { WORDS, backLine, chapterPlace } from '../../../../data/learn/words.js';
import '@/components/keycards/keycards.css';
import './run.css';

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const onControl = (el) => el && (el.tagName === 'BUTTON' || el.tagName === 'A');
const ROUND = 20;
const SKIP_LINES = {
  question_changed: 'This question was just updated, so we skipped it.',
  question_held: "This question is in a Mob paper that's still open, so we skipped it for now.",
};

// A11: each first-run coach line shows once per student, then never again (R4 owner-eye#15: per student, not per run; this
// browser, keyed by the student's id; nothing that must persist is kept here).
export const coachKeyOf = (userId) => `mm:learn2:coach:v2:${userId || 'anon'}`;
function readCoach(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
function markCoach(key, name) { try { const seen = readCoach(key); if (!seen[name]) localStorage.setItem(key, JSON.stringify({ ...seen, [name]: 1 })); } catch { /* shown again next time */ } }
function useCoach(key, name, wanted) {
  const [seen, setSeen] = useState(() => (typeof window === 'undefined' ? {} : readCoach(key)));
  const [readFor, setReadFor] = useState(key);
  if (readFor !== key) { setReadFor(key); setSeen(typeof window === 'undefined' ? {} : readCoach(key)); }
  const show = Boolean(wanted && !seen[name]);
  useEffect(() => { if (show) markCoach(key, name); }, [show, key, name]);
  return show;
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FLIGHT_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const later = (ms) => new Promise((done) => { setTimeout(done, ms); });
const buzz = (pattern) => { try { if (!isMotionReduced()) navigator.vibrate?.(pattern); } catch { /* no vibration */ } };
/** The glyph that is on screen: the panel's from 1200 px, the top bar's below. */
const visible = (...els) => els.find((el) => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0) || null;

/**
 * A4: the card's way out after a rating the server accepted. A copy of the card (a ghost above the whole player) makes the
 * flight, so the next item can rise while it is still in the air: lift 4 px and 0.96 (100 ms), then an arc into the Revise
 * pile to 0.18 and out (320 ms; Easy 280). A missed card tilts, drops 64 px and fades (260 ms).
 * Returns { handoff, landed }: `handoff` is when the next item may rise (220 ms), `landed` when the flight has ended.
 */
function launch(card, pile, kind) {
  const none = { handoff: Promise.resolve(), landed: Promise.resolve() };
  if (!card || typeof card.animate !== 'function') return none;
  if (isMotionReduced()) {
    const fade = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' }).finished.catch(() => {});
    return { handoff: fade, landed: fade };
  }
  // LK137: a card rated by a swipe is measured where it sits in the layout (its held transform cleared first), then leaves from
  // where it was let go, on along the way it was going (never back across the stage into the pile).
  const pose = swipePose(card);
  if (pose) clearPose(card);
  const root = card.closest('.lr') || document.body;
  const a = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('lr-ghost');
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  root.appendChild(ghost);
  card.style.visibility = 'hidden';
  const done = (anim) => anim.finished.catch(() => {}).then(() => ghost.remove());
  if (pose) {
    const anim = ghost.animate([
      { offset: 0, transform: poseTransform(pose), opacity: 1 },
      { offset: 0.4, opacity: 0.85 },
      { offset: 1, transform: poseTransform(swipeLeaveTo(pose, a.width)), opacity: 0 },
    ], { duration: 280, easing: EASE_OUT, fill: 'forwards' });
    return { handoff: later(160), landed: done(anim) };
  }
  if (kind === 'missed' || !pile) {
    const anim = ghost.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(64px) rotate(-3deg)', opacity: 0 },
    ], { duration: 260, easing: FLIGHT_EASE, fill: 'forwards' });
    return { handoff: later(160), landed: done(anim) };
  }
  const b = pile.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const lift = Math.min(90, Math.abs(dy) * 0.28 + 36);
  const fly = kind === 'easy' ? 280 : 320;
  const anim = ghost.animate([
    { offset: 0, transform: 'none', opacity: 1, easing: EASE_OUT },
    { offset: 100 / (100 + fly), transform: 'translateY(-4px) scale(0.96)', opacity: 1, easing: FLIGHT_EASE },
    { offset: (100 + fly * 0.45) / (100 + fly), transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) scale(0.52) rotate(3deg)`, opacity: 0.92 },
    { offset: 1, transform: `translate(${dx}px, ${dy}px) scale(0.18) rotate(6deg)`, opacity: 0 },
  ], { duration: 100 + fly, fill: 'forwards' });
  return { handoff: later(220), landed: done(anim) };
}

function useBodyLock() {
  useEffect(() => {
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = was; };
  }, []);
}

/** Pointer swipe for the recap: the card follows the finger 1:1; past 72 px (or a quick flick) it commits. */
function useSwipe(onPrev, onNext, enabled) {
  const s = useRef(null);
  const [dx, setDx] = useState(0);
  const handlers = enabled ? {
    onPointerDown(e) { if (e.pointerType === 'mouse' && e.button !== 0) return; if (e.target.closest('button, a')) return; s.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, lock: null }; },
    onPointerMove(e) {
      const st = s.current; if (!st || st.id !== e.pointerId) return;
      const mx = e.clientX - st.x; const my = e.clientY - st.y;
      if (!st.lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; st.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; if (st.lock === 'x') e.currentTarget.setPointerCapture?.(e.pointerId); }
      if (st.lock === 'x') setDx(mx);
    },
    onPointerUp(e) {
      const st = s.current; s.current = null; if (!st || st.lock !== 'x') { setDx(0); return; }
      const mx = e.clientX - st.x; const v = Math.abs(mx) / Math.max(1, performance.now() - st.t);
      setDx(0);
      if (mx < -72 || (mx < -24 && v > 0.7)) onNext(); else if (mx > 72 || (mx > 24 && v > 0.7)) onPrev();
    },
    onPointerCancel() { s.current = null; setDx(0); },
  } : {};
  return { dx, handlers };
}

// The player is a focus page above the whole shell, so it renders into the body, outside the shell's stacking contexts. The
// shell's tokens live on <html>, so Night and Day still apply.
const noop = () => () => {};
export default function RunPlayer(props) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? createPortal(<Player {...props} />, document.body) : null;
}

function Skeleton() {
  return (
    <div className="lr-body" aria-busy="true" aria-label="Getting your session ready">
      <div className="lr-frame lr-frame--skel">
        <aside className="lr-panel lr-panel--skel" aria-hidden="true">
          <span className="skeleton lr-skel__line lr-skel__line--t" />
          <span className="skeleton lr-skel__line" />
          <span className="skeleton lr-skel__line lr-skel__line--s" />
        </aside>
        <div className="lr-stagecol">
          <div className="lr-area" data-type="card"><span className="skeleton lr-skel__card" /></div>
          <div className="lr-bar"><div className="lr-bar__in"><span className="skeleton lr-skel__key" /><p className="lr-status" /></div></div>
        </div>
        <div className="lr-side" />
      </div>
    </div>
  );
}

function Player({ chapterKey, minutes = 10, kind = 'mix', leaveOut = [], cardIds = null, runId = null, resume = null, end: openEnd = false }) {
  useBodyLock();
  const links = useLearnLinks();
  const { user } = useAuth() || {};
  const coachKey = coachKeyOf(user?.id);
  const router = useRouter();
  const search = useSearchParams();
  const fresh = search?.get('fresh') === '1';
  const addNext = search?.get('next') === '1';
  const [params, setParams] = useState(() => ({ chapterKey, minutes, kind, leaveOut, cardIds: cardIds?.length ? cardIds : null, runId, resume, fresh, addNext, openEnd }));
  const [load, setLoad] = useState({ status: 'loading', error: null });
  const [run, setRun] = useState(null);
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState('play'); // play | round | recapEnd | end
  const [pile, setPile] = useState(0);
  const [pop, setPop] = useState(0);
  const [stamp, setStamp] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [lookLine, setLookLine] = useState(null);
  const [lookSaid, setLookSaid] = useState(false);
  const [answers, setAnswers] = useState({});
  const [turned, setTurned] = useState({});
  const [saved, setSaved] = useState({});
  const [reporting, setReporting] = useState(null);
  const [tally, setTally] = useState({ missed: 0, got: 0, easy: 0, right: 0, wrong: 0 });
  const [end, setEnd] = useState({ status: 'idle', data: null });
  const [stoppedAt, setStoppedAt] = useState(null);
  // The card on screen whose rating or look the server already holds while it flies away (it counts as done).
  const [actedId, setActedId] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [round, setRound] = useState(0);
  const cardRef = useRef(null);
  const topPileRef = useRef(null);
  const topPosRef = useRef(null);
  const panelPileRef = useRef(null);
  const flying = useRef(false);
  const stampTimer = useRef(null);
  const noteTimer = useRef(null);
  const nextKey = useRef(null);
  const pileNow = useRef(0);
  const answering = useRef(false);
  // client-code#10: each begin() takes a token; a response for an older one is dropped. `starting` holds the end keys while
  // a start is on its way, so a second tap never starts a second run (on Free that would orphan a counted run).
  const beginToken = useRef(0);
  const starting = useRef(false);
  // client-code#11: the first card into Revise is said through this live region, with the next item's words.
  const sayFirst = useRef('');

  const isRecap = run?.kind === 'recap' || params.kind === 'recap';
  // R5 LK45 fix 4: a run over several chapters (Revise, a Find set) belongs to no one chapter, so Close goes to Learn home.
  const closeHref = run?.chapter?.spans ? links.home() : links.chapter(params.chapterKey || run?.chapter?.key, params.minutes);

  // R4 client-code#1: the run the server gave is the address, ?run=<id> (no end=1, no fresh), replaced in place (no navigation,
  // no remount: the page keys the player by its first address). The preview keys its view by ?run=, so it keeps its own.
  const writeAddress = useCallback((data, p) => {
    if (links.preview || typeof window === 'undefined') return;
    const to = runAddressParams(data, p);
    if (!to) return;
    const href = links.run(to);
    try { if (!sameAddress(`${window.location.pathname}${window.location.search}`, href)) window.history.replaceState(null, '', href); } catch { /* no history API */ }
  }, [links]);

  const loadEnd = useCallback(async (id, { stop = false } = {}) => {
    setPhase('end');
    setEnd({ status: 'loading', data: null });
    // A stop part way keeps the run open on the server, so it can be picked up today (R2 ruling 6).
    try { setEnd({ status: 'ready', data: await runEnd(id, { stop }) }); } catch (e) { setEnd({ status: 'error', data: null, error: e }); }
  }, []);

  const begin = useCallback(async (p) => {
    const token = ++beginToken.current;
    const current = () => token === beginToken.current;
    setLoad({ status: 'loading', error: null });
    setRun(null); setItems([]); setAt(0); setOffset(0); setPhase('play'); setAnswers({}); setTurned({}); setLookLine(null); setLookSaid(false);
    setError(null); setNote(null); setBusy(null); setStoppedAt(null); setSheet(false); setActedId(null);
    setTally({ missed: 0, got: 0, easy: 0, right: 0, wrong: 0 }); setEnd({ status: 'idle', data: null }); setRound(0);
    // An end screen asked for by its link (?run=<id>&end=1): read it; the run is the server's.
    if (p.openEnd && p.runId) {
      starting.current = false;
      setRun({ id: p.runId, kind: p.kind, chapter: { key: p.chapterKey } });
      setLoad({ status: 'ready', error: null });
      loadEnd(p.runId);
      return;
    }
    try {
      const data = p.runId
        ? await getRun(p.runId)
        : await startRun({ chapterKey: p.chapterKey, cardIds: p.cardIds || undefined, minutes: p.minutes, leaveOut: p.leaveOut, kind: p.kind, resume: p.resume || undefined, fresh: p.fresh || undefined, addNext: p.addNext || undefined });
      if (!current()) return;
      starting.current = false;
      writeAddress(data, p);
      const list = Array.isArray(data?.items) ? data.items : [];
      setRun(data);
      setItems(list);
      setOffset(Number(data?.resumed?.done) || 0);
      pileNow.current = Number(data?.revisePile?.count) || 0;
      setPile(pileNow.current);
      if (data?.looks?.text) setLookLine(data.looks.text);
      setLoad({ status: 'ready', error: null });
      // A resumed run with nothing left is already done: its end.
      if (!list.length && data?.resumed && data?.id) loadEnd(data.id);
    } catch (e) {
      if (!current()) return;
      starting.current = false;
      if (p.runId && isRunClosed(e)) {
        setRun({ id: p.runId, kind: p.kind, chapter: { key: p.chapterKey } });
        setLoad({ status: 'ready', error: null });
        loadEnd(p.runId);
        return;
      }
      setLoad({ status: 'error', error: e });
    }
  }, [loadEnd, writeAddress]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the run is read once per set of params
  useEffect(() => { begin(params); }, [params]);

  const item = phase === 'play' ? items[at] || null : null;
  const answerState = item ? answers[item.id] : null;
  const answered = Boolean(answerState?.result) || answerState?.status === 'skipped';
  const isTurned = Boolean(item && (turned[item.id] || isRecap));
  const finished = itemsFinished({ phase, at, length: items.length, item, answered, acted: Boolean(item && actedId === item.id) });
  const total = offset + items.length;
  const position = offset + at + 1;
  // R5 LK45 fix 2: the stop sheet counts as the end does (the place of the last item the server holds an event for), not the items passed.
  const doneCount = phase === 'play' ? reachedPlace(items, (it, i) => itemHeld({ item: it, index: i, at, answers, actedId }), offset) : offset + finished;
  const look = Boolean(item?.type === 'card' && !isRecap && (item.look || (lookLine && lookSaid)));
  const chapter = run?.chapter || {};
  // R4 ruling N: the rail names the chapter by its roadmap place ("Chapter 5 of 14"); no place, no label (never "Part 1, Ch 2").
  const placeLine = chapterPlace(chapter.place) || null;
  const sci = isChemistry(null, chapter.key || params.chapterKey);

  // A11: the coach lines belong to the run's first card and its first question only.
  const firstCard = items.findIndex((x) => x.type === 'card' && !x.look);
  const firstQuestion = items.findIndex((x) => x.type === 'question');
  const onFirstCard = phase === 'play' && !isRecap && offset === 0 && at === firstCard;
  const coachFront = useCoach(coachKey, 'front2', onFirstCard && !isTurned);
  // R5 LK38: once per student, under the keys, on the first card they can rate: what Missed it and Easy do. It replaces R2's
  // "Got it: it comes back when it's due.", which the keys' own words now say for every card.
  const coachRate = useCoach(coachKey, 'ratings3', phase === 'play' && !isRecap && item?.type === 'card' && !item.look && Boolean(item.returns) && isTurned);
  // The question hint: once per student, on the first question they ever see (a run that serves an old mistake is not a first).
  const hasHistory = items.some((x) => x.origin === 'mistake');
  const coachPick = useCoach(coachKey, 'pick', phase === 'play' && !hasHistory && at === firstQuestion && !answered);
  const coachRecap = useCoach(coachKey, 'recap', phase === 'play' && isRecap);

  const turn = useCallback(() => {
    if (!item || item.type !== 'card' || flying.current || turned[item.id]) return;
    buzz(8);
    setTurned((r) => ({ ...r, [item.id]: true }));
    // A card past Free's ratings: its line shows once per run, after the first look is turned.
    if (item.look && lookLine) setLookSaid(true);
  }, [item, turned, lookLine]);

  const showStamp = useCallback((text) => {
    if (!text) return;
    clearTimeout(stampTimer.current);
    setStamp({ text, n: Date.now() });
    stampTimer.current = setTimeout(() => setStamp(null), isMotionReduced() ? 1500 : 900 + 220);
  }, []);
  const showNote = useCallback((text, ms = 3000) => {
    clearTimeout(noteTimer.current);
    setNote(text);
    if (ms) noteTimer.current = setTimeout(() => setNote(null), ms);
  }, []);
  useEffect(() => () => { clearTimeout(stampTimer.current); clearTimeout(noteTimer.current); }, []);

  const finish = useCallback((stopAt = null) => {
    setSheet(false);
    if (isRecap) { setPhase('recapEnd'); return; }
    setStoppedAt(stopAt);
    if (run?.id) loadEnd(run.id, { stop: stopAt !== null });
  }, [isRecap, run, loadEnd]);

  // The list as last rendered: an advance that follows an await sees a card re-inserted meanwhile.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const advance = useCallback(() => {
    setBusy(null); setError(null); setReporting(null); setActedId(null);
    const list = itemsRef.current;
    const next = at + 1;
    if (next >= list.length) { finish(); return; }
    if (run?.kind === 'cards' && list[at]?.type === 'card') {
      const rated = list.slice(0, next).filter((x) => x.type === 'card').length;
      if (rated % ROUND === 0 && list.slice(next).some((x) => x.type === 'card')) { setRound(rated / ROUND); setAt(next); setPhase('round'); return; }
    }
    setAt(next);
  }, [at, finish, run]);

  // Focus follows the item, so a keyboard or screen reader student lands on the new one; the live region names it.
  useEffect(() => {
    if (phase !== 'play' || !item) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`lr-q-${item.id}`);
      if (el) { el.tabIndex = -1; el.focus({ preventScroll: true }); }
      document.querySelector('.lr-body')?.scrollTo?.({ top: 0 });
    });
    const first = sayFirst.current;
    sayFirst.current = '';
    setAnnounce(`${first}${positionWords(item, offset + at + 1, offset + items.length)}`);
    return () => cancelAnimationFrame(raf);
  }, [at, phase, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Next takes focus once a question is answered (the options keep theirs: aria-disabled, never disabled; A8 F7).
  useEffect(() => { if (answered) nextKey.current?.focus({ preventScroll: true }); }, [answered, item?.id]);

  // After a wrong answer the student's own pick goes to the top of its scroll box (12 px clear), so what they chose, the verdict and
  // the line they needed read together; the box fades 24 px at its head while it is scrolled (M2).
  useEffect(() => {
    if (!answerState?.result || answerState.result.correct) return undefined;
    const t = setTimeout(() => {
      // R4 ui-correctness#7: only as far as the verdict and the line you needed; the head line and the stem's first line stay.
      scrollToVerdict(document.querySelector('.lr-q'), isMotionReduced() ? 'auto' : 'smooth', document.querySelector('.lr-bar'));
    }, 300);
    return () => clearTimeout(t);
  }, [answerState?.result]);

  // The two boxes that can scroll (the whole body on a phone, the item's area from tablet) fade at their head while scrolled.
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const offs = [document.querySelector('.lr-body'), document.querySelector('.lr-area')].map((el) => watchMore(el));
    return () => offs.forEach((off) => off());
  }, [phase, item?.id, item?.type]);

  // A long question whose first option waits below the fold says so: a quiet "Options below" chip above the bar (M10).
  const [optBelow, setOptBelow] = useState(false);
  useEffect(() => {
    const body = phase === 'play' && item?.type === 'question' ? document.querySelector('.lr-body') : null;
    if (!body) { setOptBelow(false); return undefined; }
    const area = document.querySelector('.lr-area');
    return watchBelow({ roots: [body, area], limits: [{ el: area, edge: 'bottom' }, { el: document.querySelector('.lr-bar'), edge: 'top' }], find: () => document.querySelector('.lr-q .lr-opt'), onChange: setOptBelow });
  }, [phase, item?.id, item?.type]);

  const reinsert = useCallback((r, base) => {
    if (!r?.itemId) return;
    setItems((list) => placeReinsert(list, { itemId: r.itemId, at: r.at, moved: Boolean(r.moved), item: r.item ? { ...base, ...r.item, returns: r.item.returns || null, again: r.item.reason !== 'line', stage: 'again' } : null }, { current: at, offset }));
  }, [at, offset]);

  // The Revise pile is the flight's target where it shows (the panel from 1200, the top bar from 1024); on a phone the card
  // flies into the counter "4 of 20" (R3-SPEC L4: no pile in a phone's bar).
  const flightTarget = () => visible(panelPileRef.current, topPileRef.current, topPosRef.current);

  const rate = useCallback(async (rating) => {
    if (!item || busy || flying.current || leaving) return false;
    setBusy(rating); setError(null);
    let res;
    try {
      res = await rateItem(run.id, { itemId: item.id, rating });
      if (!res?.ok) throw new Error('unconfirmed');
    } catch (e) {
      setBusy(null);
      if (isRunClosed(e)) { finish(); return false; }
      if (e?.status === 402) { setLookLine(e.data?.limit?.text || lookLine); setLookSaid(true); return false; }
      setError("That rating wasn't saved. Try again.");
      return false;
    }
    flying.current = true;
    setActedId(item.id);
    setLeaving(true);
    setBusy(null);
    const kindOf = FLIGHT[rating] || 'got';
    setTally((t) => ({ ...t, [kindOf]: t[kindOf] + 1 }));
    if (res.limit?.text) { setLookLine(res.limit.text); }
    if (res.look) setLookSaid(true);
    reinsert(res.reinsert, item);
    showStamp(res.stamp);
    // client-code#11: the first card into Revise is said with the next item's words (the tip is only seen on desktop).
    if (pileNow.current === 0 && Number(res.revisePile?.count) > 0) sayFirst.current = `${WORDS.inRevise}. `;
    // A rating the server could not count (Free's 11th) finishes the card as a look: it drops away, no flight.
    const flight = launch(cardRef.current, flightTarget(), res.look ? 'missed' : kindOf);
    const nextCount = Number(res.revisePile?.count);
    flight.landed.then(() => {
      if (!Number.isFinite(nextCount) || nextCount === pileNow.current) return;
      pileNow.current = nextCount;
      setPile(nextCount);
      if (!isMotionReduced()) setPop((p) => p + 1);
    });
    await flight.handoff;
    flying.current = false;
    setLeaving(false);
    advance();
    return true;
  }, [item, busy, leaving, run, reinsert, showStamp, advance, finish, lookLine]);

  // A look (a recap card, a card past Free's ratings, a lesson read or skipped) is logged; the run does not wait for it.
  const logLook = useCallback((it) => { if (run?.id && it?.id) rateItem(run.id, { itemId: it.id, rating: 3 }).catch(() => {}); }, [run]);
  const lookNext = useCallback(async () => {
    if (flying.current || !item) return;
    logLook(item);
    flying.current = true; setActedId(item.id); setLeaving(true);
    await launch(cardRef.current, null, 'missed').handoff;
    flying.current = false; setLeaving(false);
    advance();
  }, [advance, logLook, item]);

  const pick = useCallback(async (choice) => {
    if (!item || item.type !== 'question' || answering.current) return;
    const prior = answers[item.id];
    if (prior?.status === 'sending' || prior?.result || prior?.status === 'skipped') return;
    answering.current = true;
    const id = item.id;
    setAnswers((a) => ({ ...a, [id]: { choice, status: 'sending' } }));
    try {
      const res = await answerItem(run.id, { itemId: id, choice });
      setAnswers((a) => ({ ...a, [id]: { choice: res?.choice || choice, status: 'done', result: res } }));
      setTally((t) => ({ ...t, [res.correct ? 'right' : 'wrong']: t[res.correct ? 'right' : 'wrong'] + 1 }));
      buzz(res.correct ? 12 : [8, 40, 8]);
      reinsert(res.reinsert, { type: 'card', card: res.line?.card });
      setAnnounce(res.correct ? (res.fixedText || 'Right.') : `Not quite. The answer is ${res.key}.${res.line?.card && !res.line.locked ? ' The line you needed is shown below.' : ''}`);
    } catch (e) {
      if (isQuestionSkipped(e)) {
        const line = SKIP_LINES[e.kind];
        setAnswers((a) => ({ ...a, [id]: { choice: null, status: 'skipped', note: line } }));
        showNote(line, 3000);
      } else if (isRunClosed(e)) {
        finish();
      } else if (isSessionUsed(e)) {
        // Free, a second tab: the day's session belongs to another run. This one ends calmly with the line (BUILD 1.6).
        finish(doneCount);
      } else {
        setAnswers((a) => ({ ...a, [id]: { choice, status: 'failed' } }));
      }
    } finally {
      answering.current = false;
    }
  }, [item, answers, run, reinsert, showNote, finish, doneCount]);

  // A quiet Skip on a question not answered yet (MAIN 03:55): it moves on and is never a mistake. The server has no skip
  // event yet, so nothing is written; the item stays not done (a resumed run offers it again).
  const skip = useCallback(() => {
    if (!item || item.type !== 'question' || answering.current) return;
    if (answers[item.id]?.result || answers[item.id]?.status === 'sending') return;
    setAnswers((a) => ({ ...a, [item.id]: { choice: null, status: 'skipped', byStudent: true, note: null } }));
    advance();
  }, [item, answers, advance]);

  const save = useCallback(async () => {
    const q = item?.question;
    if (!q?.id) return;
    const now = saved[q.id];
    if (now === 'saved' || now === 'busy') return;
    if (now === 'pro') { openUpgrade({ trigger: 'saved', opener: document.activeElement }); return; }
    setSaved((s) => ({ ...s, [q.id]: 'busy' }));
    try {
      await saveQuestion(q.id);
      setSaved((s) => ({ ...s, [q.id]: 'saved' }));
    } catch (e) {
      setSaved((s) => ({ ...s, [q.id]: e?.status === 402 ? 'pro' : null }));
      if (e?.status !== 402) showNote("That question wasn't saved. Try again.", 3000);
    }
  }, [item, saved, showNote]);

  const goRecap = useCallback((step) => {
    if (step > 0) { logLook(items[at]); if (at + 1 >= items.length) setPhase('recapEnd'); else setAt(at + 1); }
    else if (at > 0) setAt(at - 1);
  }, [at, items, logLook]);

  // Close and Stop here: with nothing done, leave at once; else the "Stop for now?" sheet (A4 3.3.10).
  const askStop = useCallback((e) => {
    if (doneCount <= 0 || phase !== 'play') return false;
    e?.preventDefault?.();
    setSheet(true);
    return true;
  }, [doneCount, phase]);

  // The lesson opens on its own page; it counts as read (A4 3.3.9). Coming back, the run resumes at the next item.
  const lessonHref = item?.type === 'lesson' ? links.lesson(item.lesson?.id) : null;
  const readLesson = () => { if (!item) return; logLook(item); if (lessonHref) router.push(lessonHref); };

  // Keys (A4 3.3.12): Space or Enter turn; 1 2 3 rate; A to F or 1 to 6 answer; S saves a question; Enter goes on; arrows move a
  // recap; Escape and Close stop (the one stop rule: after one item done the "Stop for now?" sheet, before it they leave).
  useEffect(() => {
    if (phase !== 'play' || !item || sheet) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || reporting) return;
      if (e.key === 'Escape') {
        if (document.querySelector('.kc-menu__list')) return;
        e.preventDefault();
        if (!askStop()) router.push(closeHref);
        return;
      }
      if (isRecap) {
        if (e.key === 'ArrowRight' || (e.key === 'Enter' && !onControl(e.target))) { e.preventDefault(); goRecap(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); goRecap(-1); }
        return;
      }
      if (item.type === 'card' && !isTurned) {
        if (e.key === ' ' || (e.key === 'Enter' && !onControl(e.target))) { e.preventDefault(); turn(); }
        return;
      }
      if (item.type === 'card') {
        if (look) { if (e.key === 'Enter' && !onControl(e.target)) { e.preventDefault(); lookNext(); } return; }
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) { e.preventDefault(); rate(r.rating); }
        return;
      }
      if (item.type === 'lesson') {
        if (e.key === 'Enter' && !onControl(e.target)) { e.preventDefault(); readLesson(); }
        return;
      }
      if (item.type === 'question') {
        if ((e.key === 's' || e.key === 'S') && answerState?.status !== 'skipped') { e.preventDefault(); save(); return; }
        if (answered && e.key === 'Enter' && !onControl(e.target)) { e.preventDefault(); advance(); return; }
        if (!answered && (!answerState || answerState.status === 'failed')) {
          // 1 to 6 and A to F by the place drawn (the letters are the order, whatever the option's own key is).
          const opts = item.question.options || [];
          const slot = '123456'.indexOf(e.key) >= 0 ? '123456'.indexOf(e.key) : e.key.length === 1 ? 'ABCDEF'.indexOf(e.key.toUpperCase()) : -1;
          const choice = slot >= 0 && slot < opts.length ? opts[slot].key : null;
          if (choice) { e.preventDefault(); pick(choice); }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const swipe = useSwipe(() => goRecap(-1), () => goRecap(1), isRecap && phase === 'play');
  // LK137: drag a turned card to rate it (not a recap card, not a look past Free's ratings).
  const canDrag = phase === 'play' && item?.type === 'card' && isTurned && !look && !isRecap;
  const drag = useRateSwipe({ enabled: canDrag && !busy && !leaving && !reporting && !sheet, onRate: rate });
  const dragRef = drag.ref;
  const setCard = useCallback((node) => { cardRef.current = node; dragRef(node); }, [dragRef]);
  const coachDrag = useCoach(coachKey, 'swipe1', canDrag && drag.live && !coachRate);
  const coarse = (() => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } })();

  const left = phase === 'play' ? minutesLeftLine(items, finished, run?.kind) : null;
  const upNext = phase === 'play' && !isRecap ? upNextLine(items, at) : null;
  const piles = useMemo(() => runPiles(items, finished, { at, resumed: offset > 0 }), [items, finished, at, offset]);
  const answerT = useMemo(() => answerTally(items, answers), [items, answers]);

  // The one status line (A4 3.3.5): an error, a skip note, the stamp, a first-run coach line, Free's look line; else empty.
  const status = error ? { text: error, tone: 'bad' }
    : note ? { text: note }
      : stamp ? { text: stamp.text, stamp: true, key: stamp.n }
        : coachFront && item?.type === 'card' && !isTurned ? { text: WORDS.turnCue, cue: true }
          : coachRate && item?.type === 'card' && isTurned && !look ? { text: WORDS.coachRatings }
            : coachDrag && canDrag ? { text: swipeHint({ down: drag.downOk || !coarse, touch: coarse }) }
            : coachRecap ? { text: "Answers are shown. This won't change when your cards come back." }
                : look && isTurned && lookLine && item?.look ? { text: lookLine } : null;

  const live = <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>;
  const frame = (body, extra = {}) => (
    <div className="lr st kc" data-phase={phase} data-recap={isRecap || undefined} data-leaving={leaving || undefined} {...extra}>
      {live}
      {body}
    </div>
  );

  if (load.status === 'loading') return frame(<><header className="lr-top lr-top--skel"><span className="skeleton lr-skel__close" /><span className="lr-top__ticks"><span className="skeleton lr-skel__ticks" /></span></header><Skeleton /></>);
  if (load.status === 'error' || !run) {
    const missing = isChapterMissing(load.error);
    const used = isSessionUsed(load.error);
    return frame(
      <div className="lr-body"><div className={`lr-state${used ? ' lr-state--free' : ''}`} role="alert">
        {missing ? (
          <>
            <h1 className="lr-state__title">This chapter is not in your book list.</h1>
            <div className="lr-state__keys"><Link className="kc-btn kc-btn--line" href={links.home(String(params.chapterKey || '').split('.')[0] || null)}>Back to Learn</Link></div>
          </>
        ) : used ? (
          <>
            <div className="st-endx__top"><Link href={closeHref} className="lr-close lr-close--end" aria-label="Close"><X size={22} strokeWidth={2.2} aria-hidden="true" /><span className="lr-close__word">Close</span></Link></div>
            <FreeUsed data={load.error.data || {}} links={links} chapterKey={params.chapterKey} />
          </>
        ) : (
          <>
            <h1 className="lr-state__title">This session didn&apos;t start</h1>
            <p>Nothing was lost. Check your connection and try again.</p>
            <div className="lr-state__keys">
              <button type="button" className="kc-btn kc-btn--volt" onClick={() => begin(params)}>Try again</button>
              <Link className="kc-btn kc-btn--quiet" href={closeHref}>Back to the chapter</Link>
            </div>
          </>
        )}
      </div></div>,
    );
  }
  if (!items.length && phase === 'play') {
    return frame(
      <div className="lr-body"><div className="lr-state">
        <h1 className="lr-state__title">Nothing here yet</h1>
        <p>This chapter has no cards or questions for this session.</p>
        <div className="lr-state__keys"><Link className="kc-btn kc-btn--line" href={closeHref}>Back to the chapter</Link></div>
      </div></div>,
    );
  }

  if (phase === 'end') {
    return frame(
      <div className="lr-body lr-body--end">
        <RunEnd state={end} tally={tally} kind={run.kind} chapter={chapter} closeHref={closeHref} links={links}
          stoppedAt={stoppedAt} total={total} onRetry={() => loadEnd(run.id, { stop: stoppedAt !== null })}
          onStart={(r) => {
            // client-code#10: one start at a time; the end gives way to the loading frame at once.
            if (starting.current) return;
            starting.current = true;
            setParams({
              // R3-SPEC L5: Continue resumes the stopped run by its id; every other key starts a new run (`fresh`).
              chapterKey: r.chapterKey || params.chapterKey, minutes: r.minutes || 10, kind: r.kind || 'mix', leaveOut: r.leaveOut || [],
              cardIds: r.cardIds?.length ? r.cardIds : null, runId: r.resume || null, resume: null, fresh: Boolean(r.fresh), addNext: false, openEnd: false,
            });
          }} />
      </div>,
    );
  }

  if (phase === 'recapEnd') {
    const ids = [...new Set(items.map((x) => x.card?.id).filter(Boolean))];
    return frame(
      <div className="lr-body lr-body--end">
        <EndScreen close={<Link href={closeHref} className="lr-close lr-close--end" aria-label="Close"><X size={22} strokeWidth={2.2} aria-hidden="true" /><span className="lr-close__word">Close</span></Link>}
          chapter={chapter.title || null} headline={`That was all ${ids.length} Must-know ${ids.length === 1 ? 'line' : 'lines'}`} mobi="nod"
          main={<EndKey onClick={() => { if (starting.current) return; starting.current = true; setParams({ chapterKey: params.chapterKey || chapter.key, cardIds: ids, minutes: Math.max(5, Math.ceil((ids.length * 15 * 1.1) / 60)), leaveOut: [], kind: 'cards' }); }}>{`Study these ${ids.length}`}</EndKey>}
          quiet={<button type="button" className="lr-textkey" onClick={() => { setAt(0); setPhase('play'); }}>Quick recap again</button>} />
      </div>,
    );
  }

  if (phase === 'round') {
    const leftCards = items.slice(at).filter((x) => x.type === 'card').length;
    return frame(
      <>
        <TopBar title={chapter.title} position={null} total={total} done={at} current={at} offset={offset} left={minutesLeftLine(items, at, run.kind)} pile={pile} pop={pop} pileRef={topPileRef} posRef={topPosRef} closeHref={closeHref} onClose={askStop} />
        <div className="lr-body">
          <section className="lr-round" aria-labelledby="lr-round-h">
            <p className="lr-round__n" id="lr-round-h">{ROUND}<span>cards rated</span></p>
            <p className="lr-round__line">{leftCards} more to go.</p>
            <div className="lr-round__keys">
              <button type="button" className="kc-btn kc-btn--volt" autoFocus onClick={() => setPhase('play')}>Next round</button>
              <button type="button" className="kc-btn kc-btn--line" onClick={() => finish(offset + at)}>Finish here</button>
            </div>
          </section>
        </div>
      </>,
      { 'data-round': round },
    );
  }

  // ---------------------------------------------------------------- the play view
  const last = at + 1 >= items.length;
  const nextLabel = last ? 'See how it went' : 'Next';
  const qid = item.question?.id;
  const saveState = qid ? saved[qid] || null : null;
  const keys = (() => {
    if (isRecap && item.type === 'card') {
      return (
        <div className="lr-keys lr-keys--two">
          <button type="button" className="kc-btn kc-btn--line" onClick={() => goRecap(-1)} disabled={at === 0}>Previous</button>
          <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={() => goRecap(1)}>{last ? 'Finish' : 'Next'}<kbd className="kc-kbd" aria-hidden="true">Enter</kbd></button>
        </div>
      );
    }
    if (item.type === 'card' && !isTurned) {
      return <div className="lr-keys"><button type="button" className="kc-btn kc-btn--volt" data-page-primary="" disabled={leaving} onClick={turn}>{WORDS.turnOver}<kbd className="kc-kbd" aria-hidden="true">Space</kbd></button></div>;
    }
    if (item.type === 'card' && look) {
      return <div className="lr-keys"><button type="button" className="kc-btn kc-btn--volt" data-page-primary="" disabled={leaving} onClick={lookNext}>{nextLabel}<kbd className="kc-kbd" aria-hidden="true">Enter</kbd></button></div>;
    }
    if (item.type === 'card') {
      return (
        <div className="lr-keys lr-keys--rate" role="group" aria-label="How well did you know it?">
          {RATINGS.map((r) => {
            // R5 LK38: each key says when the card would come back (the server's `returns`, from FSRS); none when it has no words.
            const when = item.returns?.[FLIGHT[r.rating]] || null;
            return (
              <button key={r.rating} type="button" className="kc-rate__btn lr-rate" data-rating={r.rating} data-lit={drag.intent && SWIPE_RATINGS[drag.intent] === r.rating ? '' : undefined} data-page-primary={r.rating === 3 ? '' : undefined} disabled={Boolean(busy) || leaving} aria-busy={busy === r.rating || undefined} onClick={() => rate(r.rating)}>
                <span className="lr-rate__name">
                  {busy === r.rating ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
                  <span>{r.rating === 1 ? WORDS.missedIt : r.label}</span>
                  <kbd className="kc-kbd" aria-hidden="true">{r.key}</kbd>
                </span>
                {when ? <span className="lr-rate__when">{backLine(when)}</span> : null}
              </button>
            );
          })}
        </div>
      );
    }
    if (item.type === 'lesson') {
      return (
        <div className="lr-keys lr-keys--lesson">
          <button type="button" className="kc-btn kc-btn--line" onClick={() => { logLook(item); advance(); }}>Skip it</button>
          <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={readLesson}>Read the lesson<kbd className="kc-kbd" aria-hidden="true">Enter</kbd></button>
        </div>
      );
    }
    if (!answered) {
      return (
        <div className="lr-keys lr-keys--skip">
          <button type="button" className="kc-btn kc-btn--quiet lr-skip" disabled={answerState?.status === 'sending'} onClick={skip}>Skip</button>
        </div>
      );
    }
    return (
      <div className="lr-keys lr-keys--next">
        {answerState?.status !== 'skipped' ? <SaveKey state={saveState} onSave={save} compact /> : null}
        <button type="button" ref={nextKey} className="kc-btn kc-btn--volt" data-page-primary="" onClick={advance}>{nextLabel}<kbd className="kc-kbd" aria-hidden="true">Enter</kbd></button>
      </div>
    );
  })();

  const recapCard = isRecap && item.type === 'card';
  return frame(
    <>
      <TopBar title={chapter.title} position={position} total={total} done={finished} current={at} offset={offset} left={left} pile={pile} pop={pop}
        pileRef={topPileRef} posRef={topPosRef} closeHref={closeHref} onClose={askStop} showPile={!isRecap} />
      <div className="lr-body">
        <div className="lr-frame" data-type={item.type}>
          <SessionPanel chapter={chapter.title} placeLine={placeLine} position={position} total={total} left={left} upNext={upNext} piles={piles}
            pile={pile} pop={pop} pileRef={panelPileRef} stamp={stamp} tally={answerT} recap={isRecap}
            mustKnow={isRecap ? `${items.length} Must-know ${items.length === 1 ? 'line' : 'lines'}` : null}
            onStop={(e) => { if (!askStop(e)) router.push(closeHref); }} />
          <div className="lr-stagecol">
            <div className="lr-area" data-type={item.type}>
              <div key={item.id} data-id={item.id} className="lr-enter" style={recapCard && swipe.dx ? { transform: `translateX(${swipe.dx}px)`, transition: 'none' } : undefined} {...(recapCard ? swipe.handlers : {})}>
                {item.type === 'card' ? (
                  <CardItem item={item} turned={isTurned} recap={isRecap} still={isRecap} cardRef={setCard} swipe={!isRecap} onTurn={turn} onReport={() => setReporting(item.id)} sci={sci} />
                ) : item.type === 'question' ? (
                  <QuestionItem item={item} state={answerState} streak={answerT.streak} cardRef={cardRef} onPick={pick} place={`${position} of ${total}`}
                    hint={coachPick && !answered ? WORDS.pickHint : null} sci={sci}
                    onSeePro={(e) => openUpgrade({ trigger: 'keycards', opener: e?.currentTarget })} />
                ) : (
                  <LessonItem item={item} cardRef={cardRef} />
                )}
                {reporting === item.id ? <div className="lr-report"><ReportForm card={item.card} onClose={() => setReporting(null)} /></div> : null}
              </div>
            </div>
            <div className="lr-bar">
              {optBelow && item.type === 'question' && !answered ? <BelowChip show onClick={() => goToOptions(document.querySelector('.lr-q .lr-opt'))} /> : null}
              <div className="lr-bar__in" data-keys={item.type === 'card' && isTurned && !look && !isRecap ? 'rate' : item.type}>
                {keys}
                <p className="lr-status" data-tone={status?.tone} data-stamp={status?.stamp || undefined} data-cue={status?.cue || undefined} role={status?.tone === 'bad' ? 'alert' : undefined}>
                  {status ? <span key={status.key || status.text}>{status.text}</span> : null}
                </p>
              </div>
            </div>
          </div>
          <div className="lr-side">
            {item.type === 'question' && answerState?.status !== 'skipped' ? <SaveKey state={saveState} onSave={save} /> : null}
          </div>
        </div>
      </div>
      {sheet ? <StopSheet done={doneCount} of={total} onEnd={() => finish(doneCount)} onKeepGoing={() => setSheet(false)} /> : null}
    </>,
  );
}

