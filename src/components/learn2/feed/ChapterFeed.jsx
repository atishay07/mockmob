'use client';
// The Explore feed (BUILD-1101 B3 with B7; A1-feed.md 3.1-3.18; A8 F1-F18): one chapter's Key cards and questions, one item
// at a time, on the shared study stage (src/components/learn2/stage). A focus place over the whole shell.
//   Phone     top bar (close, title, kept count, "3 of 21" that opens "This feed"), the item, the action bar (Keep or Save,
//             the one volt step key, Chapter)
//   Tablet    one 600 px column: the top bar with the ticks, time left and Up next, the item with the rail beside it, the bar
//   Desktop   the session panel (chapter, place, time left, questions, old mistakes, kept pile, Up next, Stop here), the item
//             with the ticks above it and the action bar under it (Previous on the left, the step key on the right), the rail
//   Moving    a real pager (usePager): one wheel gesture, one drag past 18%, or one key moves one item; the step key names the
//             next step (Turn over, Next, See how it went, Keep going); Skip waits on an unanswered question
//   End       its own layer: the chapter title and the done line, the kept pile, the lines, the keys (dueOffer included)
// Data: POST /api/learn/runs (kind 'feed') or GET /api/learn/runs/:id (?run=), .../answer, .../rate {keep}, GET .../end,
// POST /api/bookmarks (learn2/api.js). The run id goes into the URL after a start, so a reload resumes it.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Bookmark, Check, ChevronUp, X } from 'lucide-react';
import { WORDS } from '@/../data/learn/words.js';
import MobiReact from '@/components/brand/MobiReact';
import { cardFace } from '@/components/keycards/kinds';
import { refreshHome } from '@/components/keycards/api';
import { feedSlots } from '@/../data/learn/feed.js';
import { answerItem, getRun, isQuestionSkipped, isRunClosed, isSessionUsed, keepItem, runEnd, saveQuestion, startRun } from '../api';
import { useLearnLinks } from '../links';
import {
  Stage, Ticks, TopBar, Panel, MiniPile, KeptCount, CardStack, RailKey, ActionBar, PrevKey, StepKey, SkipKey, KeysList, buzz, flyTo, visible, seePro, still, watchMore, watchBelow, BelowChip, goToOptions,
} from '../stage/Stage';
import { CardFace } from '../stage/CardFace';
import { QuestionView, letterOf } from '../stage/Question';
import { EndKey, EndScreen, KeptFan } from '../stage/EndForm';
import FreeUsed from '../stage/FreeUsed';
import { endHeadline, endNumbers, endProgress, reviseLabel } from '../stage/endModel.mjs';
import { Sheet, StopSheet } from '../stage/Sheet';
import { usePager } from '../stage/usePager';
import { keyAction, scrollerThatCanMove } from '../stage/pagerModel.mjs';
import { chapterRef, optionTexts, speakable, timeLeft } from '../stage/stageText.mjs';
import { checkpointText, feedNumbers, secondsFrom, sheetRows, spliceReinsert, upNextText } from './feedModel.mjs';
import './feed.css';

// The first feed's cue (R2 ruling 7): a chip with Mobi's head until the student moves once, by any means. Marked seen only
// after that first move, never when it is shown.
const NUDGE = 'learn2.feed.nudge.v2';
const LEFT_OUT = {
  question_changed: 'This question changed a moment ago, so it is left out.',
  question_held: 'This question is in an open Mob paper, so it is left out for now.',
};
const CLOSED_LINE = 'This feed is finished, so this one is not counted.';
const seenFlag = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return true; } };
const markFlag = (k) => { try { localStorage.setItem(k, '1'); } catch { /* shown again next time */ } };
const typing = (el) => Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
const fine = () => { try { return window.matchMedia('(pointer: fine)').matches; } catch { return false; } };

// A feed the page already holds, by run id: putting ?run= in the URL may mount the feed again (the preview keys it by run),
// and Back from the chapter page returns to it. The server stays the truth on a real reload (GET /api/learn/runs/:id).
const held = new Map();

/** The end's chapter title: the server's chapter, else the title of "10 minutes on X". */
const endTitle = (data, run) => data?.chapter?.title || run?.chapter?.title || String(data?.feed?.title || data?.title || '').replace(/^.*?\bminutes?\s+on\s+/i, '') || 'This feed';

const noop = () => () => {};
export default function ChapterFeed(props) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? createPortal(<Feed {...props} />, document.body) : null;
}

function Feed({ chapterKey = null, minutes = 10, runId = null, end: endAsked = false }) {
  const links = useLearnLinks();
  const router = useRouter();
  const kept0 = runId ? held.get(runId) : null;
  const [load, setLoad] = useState(() => (kept0 ? { status: 'ready', run: kept0.run } : { status: 'loading', run: null }));
  const [list, setList] = useState(() => kept0?.list || []);
  const [states, setStates] = useState(() => kept0?.states || {});
  const [active, setActive] = useState(() => kept0?.active || 0);
  const [base, setBase] = useState(() => kept0?.base || 0);
  const [streak, setStreak] = useState(() => kept0?.streak || 0);
  const [closed, setClosed] = useState(() => kept0?.closed || false);
  const [end, setEnd] = useState({ status: 'idle', data: null, version: -1 });
  const [dirty, setDirty] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [say, setSay] = useState('');
  const [note, setNote] = useState(null);
  const [slow, setSlow] = useState(false);
  const [again, setAgain] = useState(false);
  const [hints, setHints] = useState({ nudge: false, leaving: false, desk: false });
  const stopping = useRef(false);
  const [stoppedHere, setStoppedHere] = useState(false);
  const [furthest, setFurthest] = useState(() => kept0?.furthest || 0);
  const rootRef = useRef(null);
  const viewRef = useRef(null);
  const trackRef = useRef(null);
  const cardEls = useRef({});
  const pileEl = useRef(null);
  const countEl = useRef(null);
  const endTitleEl = useRef(null);
  const sent = useRef(new Set());
  const started = useRef(false);

  const run = load.run;
  const items = useMemo(() => list.filter((i) => i.type === 'card' || i.type === 'question'), [list]);
  const slots = useMemo(() => feedSlots(items), [items]);
  const endAt = slots.length;
  const of = base + items.length;
  const numbers = useMemo(() => feedNumbers(items, states), [items, states]);
  const hasCards = items.some((i) => i.type === 'card');
  const title = run?.chapter?.title || '';
  const key = chapterKey || run?.chapter?.key || null;
  const patch = useCallback((id, p) => setStates((s) => ({ ...s, [id]: { ...(s[id] || {}), ...(typeof p === 'function' ? p(s[id] || {}) : p) } })), []);
  const speak = useCallback((text) => setSay((prev) => (prev === text ? `${text} ` : text)), []);

  // ------------------------------------------------------------ start, resume, end
  const adopt = useCallback((r, { fresh = false } = {}) => {
    const all = (r.items || []).filter((i) => i.type === 'card' || i.type === 'question');
    const done = Number(r.resumed?.done) || 0;
    sent.current = new Set();
    stopping.current = false;
    setStoppedHere(false);
    setList(all);
    setStates(all[0]?.type === 'card' ? { [all[0].id]: { seen: true } } : {});
    setBase(done);
    setActive(0);
    setFurthest(0);
    setStreak(0);
    setClosed(false);
    setEnd({ status: 'idle', data: null, version: -1 });
    setDirty(0);
    setLoad({ status: all.length || done ? 'ready' : 'empty', run: r });
    if (done > 0 && all.length) {
      setNote(`Picked up at ${done + 1} of ${done + all.length}`);
      setTimeout(() => setNote((n) => (n && n.startsWith('Picked up') && window.innerWidth < 1200 ? null : n)), 2400);
    } else setNote(null);
    if (!r.id) return;
    held.set(r.id, { run: r, list: all, states: all[0]?.type === 'card' ? { [all[0].id]: { seen: true } } : {}, active: 0, base: done, streak: 0, closed: false, furthest: 0 });
    // The run's id in the URL, so a reload picks it up (BUILD-1101 1.3). No navigation: the history entry is replaced. The
    // preview keys its view by ?run= (a new mount), so there the page's kept request key does the same job on a reload.
    if (links.preview) return;
    try {
      if (!window.location.search.includes(`run=${encodeURIComponent(r.id)}`) || fresh) window.history.replaceState(null, '', links.feed(r.chapter?.key || chapterKey, minutes, { runId: r.id }));
    } catch { /* no history API */ }
  }, [links, chapterKey, minutes]);

  const readEnd = useCallback(async (id, version, { stop = false } = {}) => {
    setEnd((e) => ({ ...e, status: e.data && e.version === version ? 'ready' : 'loading' }));
    try {
      // A stop part way keeps the feed open on the server, to pick up today (R2 ruling 6).
      const data = await runEnd(id, { stop });
      setEnd({ status: 'ready', data, version });
      setClosed(true);
    } catch {
      setEnd((e) => ({ status: 'error', data: e.data, version: e.version }));
    }
  }, []);

  const begin = useCallback(async ({ fresh = false } = {}) => {
    setLoad((l) => ({ ...l, status: 'loading' }));
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 8000);
    try {
      const r = runId && !fresh ? await getRun(runId) : await startRun({ chapterKey, minutes, kind: 'feed', leaveOut: ['lesson'], fresh });
      adopt(r, { fresh });
      if ((!r.items || !r.items.length) && Number(r.resumed?.done) > 0) { setActive(0); readEnd(r.id, 0); setLoad({ status: 'ready', run: r, onlyEnd: true }); }
    } catch (e) {
      if (isSessionUsed(e)) setLoad({ status: 'free', run: null, free: { line: e.data?.line, options: e.data?.options || [], resume: e.data?.resume || null } });
      else if (isRunClosed(e) && runId) { setLoad({ status: 'ready', run: { id: runId, chapter: { key: chapterKey }, items: [] }, onlyEnd: true }); readEnd(runId, 0); }
      else if (e.status === 404) setLoad({ status: 'notfound', run: null });
      else setLoad({ status: 'error', run: null });
    } finally {
      clearTimeout(t);
    }
  }, [runId, chapterKey, minutes, adopt, readEnd]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (kept0) return;
    if (endAsked && runId) {
      queueMicrotask(() => { setLoad({ status: 'ready', run: { id: runId, chapter: { key: chapterKey }, items: [] }, onlyEnd: true }); readEnd(runId, 0); });
      return;
    }
    queueMicrotask(() => begin());
  }, [begin, readEnd, endAsked, runId, chapterKey, kept0]);

  // First-time cue (R2 ruling 7): the chip on the first feed, phone and desktop words by the pointer; read once.
  useEffect(() => { queueMicrotask(() => setHints({ nudge: !seenFlag(NUDGE), leaving: false, desk: fine() })); }, []);

  // What the page holds for this run, for a second mount of the same feed.
  useEffect(() => {
    if (run?.id && load.status === 'ready' && !load.onlyEnd) held.set(run.id, { run, list, states, active, base, streak, closed, furthest });
  }, [run, load.status, load.onlyEnd, list, states, active, base, streak, closed, furthest]);

  const onlyEnd = Boolean(load.onlyEnd);
  const mode = onlyEnd || (load.status === 'ready' && active >= endAt) ? 'end' : 'items';

  // ------------------------------------------------------------ moving
  const slotOf = (i) => (i >= endAt ? { type: 'end' } : slots[i]);
  const announce = useCallback((i) => {
    if (i >= endAt) { speak('The end of the feed'); return; }
    const s = slots[i];
    if (!s) return;
    if (s.type === 'checkpoint') { speak(`Checkpoint after ${base + s.after} of ${of}`); return; }
    const pos = base + s.n;
    if (s.item.type === 'card') {
      const f = cardFace(s.item.card);
      speak(`Card ${pos} of ${of}. ${f.label}. ${speakable(f.front)}`);
    } else {
      const head = s.item.origin === 'mistake' ? `${s.item.mistake?.label || 'An open mistake'}. ` : '';
      speak(`Question ${pos} of ${of}. ${head}${String(s.item.question?.body || '').slice(0, 160)}`);
    }
  }, [slots, endAt, base, of, speak]);

  const go = useCallback((i) => {
    const n = Math.max(0, Math.min(endAt, i));
    setActive(n);
    setNote((t) => (t && t.startsWith('Picked up') ? null : t));
    const s = n < endAt ? slots[n] : null;
    if (s?.type === 'item') {
      setFurthest((f) => Math.max(f, s.n));
      if (s.item.type === 'card') patch(s.item.id, { seen: true });
    }
    if (s?.type === 'checkpoint') setFurthest((f) => Math.max(f, s.after));
    if (n >= endAt && run?.id) {
      const stop = stopping.current;
      if (!stop) setFurthest(items.length);
      if (end.status !== 'ready' || end.version !== dirty) readEnd(run.id, dirty, { stop });
    }
    // The first move of the first feed: the chip fades out (160 ms) and only now is the cue marked seen.
    if (n !== active && hints.nudge && !hints.leaving) {
      markFlag(NUDGE);
      setHints((h) => ({ ...h, leaving: true }));
      setTimeout(() => setHints((h) => ({ ...h, nudge: false })), still() ? 0 : 160);
    }
    announce(n);
  }, [endAt, slots, patch, run, items.length, end.status, end.version, dirty, readEnd, announce, active, hints.nudge, hints.leaving]);
  const stopHere = useCallback(() => { stopping.current = true; setStoppedHere(true); setSheet(null); go(endAt); }, [go, endAt]);

  usePager({ rootRef, viewRef, trackRef, index: active, count: endAt + 1, go, enabled: load.status === 'ready' && !onlyEnd && sheet !== 'feed' && sheet !== 'stop' });

  // A long question shows that it goes on: its page fades at the foot while more waits below.
  useEffect(() => watchMore(mode === 'items' ? trackRef.current?.querySelector('.st-page--q:not([inert])') : null), [active, mode, list, load.status]);

  // A long question whose first option waits below the fold says so: a quiet "Options below" chip above the bar (M10).
  const [optBelow, setOptBelow] = useState(false);
  useEffect(() => {
    const page = mode === 'items' ? trackRef.current?.querySelector('.st-page--q:not([inert])') : null;
    if (!page) { setOptBelow(false); return undefined; }
    const bar = rootRef.current?.querySelector('.st-bar');
    return watchBelow({ roots: [page], limits: [{ el: page, edge: 'bottom' }, { el: bar, edge: 'top' }], find: () => page.querySelector('.st-opt'), onChange: setOptBelow });
  }, [active, mode, list, load.status]);

  // The end title takes focus when the end comes into view (the summary is read first).
  useEffect(() => {
    if (mode !== 'end' || end.status !== 'ready') return undefined;
    const f = requestAnimationFrame(() => { try { endTitleEl.current?.focus({ preventScroll: true }); } catch { /* none */ } });
    return () => cancelAnimationFrame(f);
  }, [mode, end.status]);

  // ------------------------------------------------------------ actions
  const turn = useCallback((item) => {
    const st = states[item.id] || {};
    patch(item.id, { turned: !st.turned });
    buzz(8);
    if (!st.turned) {
      setTimeout(() => patch(item.id, { seenBack: true }), still() ? 0 : 170);
      speak(`NCERT's line. ${String(item.card?.back || '').slice(0, 600)}`);
    } else speak('The card side.');
  }, [states, patch, speak]);

  const keep = useCallback(async (item) => {
    const st = states[item.id] || {};
    if (st.keepPro) { seePro('keycards', null, router.push); return; }
    if (st.kept || st.keeping || !run || item.look) return;
    patch(item.id, { keeping: true, stamp: null });
    try {
      const res = await keepItem(run.id, item.id);
      patch(item.id, { kept: true, keeping: false, stamp: { text: WORDS.inRevise } });
      setDirty((d) => d + 1);
      speak(`${WORDS.inRevise}. ${res.line || ''}`.trim());
      requestAnimationFrame(() => requestAnimationFrame(() => flyTo(cardEls.current[item.id], visible([pileEl.current, countEl.current]))));
      refreshHome();
    } catch (e) {
      if (isRunClosed(e)) { patch(item.id, { keeping: false }); setClosed(true); go(endAt); return; }
      const pro = e.status === 402;
      patch(item.id, { keeping: false, keepPro: pro, stamp: pro ? { text: 'This card is on Pro.' } : { text: 'Not added. Try again.', bad: true } });
      speak(pro ? 'This card is on Pro.' : 'Could not add that card to Revise. Try again.');
    }
  }, [states, run, patch, speak, router, go, endAt]);

  const save = useCallback(async (item) => {
    const st = states[item.id] || {};
    if (st.savePro) { seePro('saved', null, router.push); return; }
    if (st.saved || st.saving) return;
    patch(item.id, { saving: true });
    try { await saveQuestion(item.question.id); patch(item.id, { saved: true, saving: false }); speak('Saved.'); } catch (e) { patch(item.id, { saving: false, savePro: e.status === 402 }); speak(e.status === 402 ? 'Saving more questions is on Pro.' : 'Could not save that question. Try again.'); }
  }, [states, patch, speak, router]);

  const choose = useCallback(async (item, choice) => {
    const st = states[item.id] || {};
    if (st.answer || st.skipped || closed || !run || sent.current.has(item.id)) return;
    sent.current.add(item.id);
    patch(item.id, { answer: { choice, pending: true }, error: null });
    try {
      const res = await answerItem(run.id, { itemId: item.id, choice });
      const picked = res.choice || choice;
      patch(item.id, { answer: { choice: picked, res } });
      const nextStreak = res.correct ? streak + 1 : 0;
      setStreak(nextStreak);
      setDirty((d) => d + 1);
      if (res.correct) buzz(12);
      if (res.reinsert) setList((l) => spliceReinsert(l, { answeredId: item.id, reinsert: res.reinsert, resumed: base > 0 }));
      const letter = letterOf(item.question.options, res.key);
      if (res.correct) speak(res.fixedText || (nextStreak >= 3 ? `Right. ${nextStreak} in a row.` : 'Right.'));
      else {
        const text = optionTexts(item.question.options)[item.question.options.findIndex((o) => o.key === res.key)] || '';
        const line = res.line?.card && !res.line.locked ? ` The line you needed: ${String(res.line.card.back || '').slice(0, 400)}` : '';
        speak(`Not quite. The answer is ${letter}, ${text}.${line}`);
      }
    } catch (e) {
      sent.current.delete(item.id);
      if (isQuestionSkipped(e)) { patch(item.id, { answer: null, skipped: LEFT_OUT[e.kind] }); speak(LEFT_OUT[e.kind]); return; }
      if (isRunClosed(e)) { patch(item.id, { answer: null }); setClosed(true); go(endAt); return; }
      if (isSessionUsed(e)) { patch(item.id, { answer: null, skipped: e.data?.line || 'Your free Learn session for today is done.' }); setClosed(true); speak(e.data?.line || ''); return; }
      patch(item.id, { answer: null, error: 'That answer was not saved. Try again.' });
    }
  }, [states, closed, run, patch, streak, base, speak, go, endAt]);

  const close = useCallback(() => (window.history.length > 1 ? router.back() : router.push(links.explore())), [router, links]);
  // The one stop rule (critic 2 row 9): before any item is done, Close leaves; after at least one, Close and Escape open the
  // "Stop for now?" sheet. The end is past the items, so its own Close leaves.
  const itemsDone = base + items.reduce((n, i) => {
    const st = states[i.id] || {};
    return n + (i.type === 'card' ? (st.seenBack || st.kept ? 1 : 0) : st.answer?.res ? 1 : 0);
  }, 0);
  const askClose = useCallback(() => {
    if (mode === 'items' && itemsDone > 0) setSheet('stop');
    else close();
  }, [mode, itemsDone, close]);
  // R3-SPEC L5: a stopped feed's "Continue · N min" picks the same run up where it stopped (the server's own run, by its id).
  const resumeFeed = useCallback(async (id) => {
    held.delete(id);
    setAgain(true);
    try { adopt(await getRun(id)); } catch (e) {
      if (isRunClosed(e)) readEnd(id, dirty); else setLoad({ status: 'error', run: null });
    } finally { setAgain(false); }
  }, [adopt, readEnd, dirty]);
  const again10 = useCallback(async () => {
    setAgain(true);
    try {
      const r = await startRun({ chapterKey: key, minutes, kind: 'feed', leaveOut: ['lesson'], fresh: true });
      adopt(r, { fresh: true });
    } catch (e) {
      if (isSessionUsed(e)) setLoad({ status: 'free', run: null, free: { line: e.data?.line, options: e.data?.options || [], resume: e.data?.resume || null } });
    } finally { setAgain(false); }
  }, [key, minutes, adopt]);

  // ------------------------------------------------------------ keys (A1 3.7)
  useEffect(() => {
    if (load.status !== 'ready' || onlyEnd) return undefined;
    const onKey = (e) => {
      if (sheet === 'feed' || sheet === 'stop') return;
      const root = rootRef.current;
      const t = e.target;
      const s = slotOf(active);
      const st = s?.type === 'item' ? states[s.item.id] || {} : {};
      const action = keyAction(e.key, {
        typing: typing(t),
        mods: e.metaKey || e.ctrlKey || e.altKey,
        onControl: Boolean(t?.closest?.('button, a, [role="button"]')),
        foreign: Boolean(t?.closest?.('a, .st-iconkey, .st-closekey, .st-counter, .st-panel, .st-end')),
        scrollable: (dir) => Boolean(root && t && t !== root && scrollerThatCanMove(t, dir, root, (el) => getComputedStyle(el))),
        turnable: s?.type === 'item' && s.item.type === 'card' && !st.seenBack,
        answerable: s?.type === 'item' && s.item.type === 'question' && !st.answer && !st.skipped && !closed,
        saveable: s?.type === 'item' && (s.item.type === 'card' ? !s.item.look : !st.skipped),
        options: s?.item?.question?.options?.length || 0,
      });
      if (!action) return;
      if (action === 'escape') {
        if (sheet === 'keys') { e.preventDefault(); setSheet(null); return; }
        if (mode === 'items' && !document.querySelector('.st-drawer, .kc-menu__list')) { e.preventDefault(); askClose(); }
        return;
      }
      if (action === 'help') { if (fine()) { e.preventDefault(); setSheet((x) => (x === 'keys' ? null : 'keys')); } return; }
      if (mode === 'end' && action !== 'prev' && action !== 'first') return;
      e.preventDefault();
      if (action === 'next') go(active + 1);
      else if (action === 'prev') go(active - 1);
      else if (action === 'first') go(0);
      else if (action === 'last') go(endAt);
      else if (action === 'turn') turn(s.item);
      else if (action === 'save') { if (s.item.type === 'card') keep(s.item); else save(s.item); }
      else if (action.answer !== undefined) choose(s.item, s.item.question.options[action.answer].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });


  // ------------------------------------------------------------ the frame
  const chapterHref = key ? links.chapter(key) : links.explore();
  const book = chapterRef(run?.chapter);
  const s = load.status === 'ready' ? slotOf(active) : null;
  const pos = s?.type === 'item' ? base + s.n : s?.type === 'checkpoint' ? base + s.after : of;
  const doneCount = s?.type === 'item' ? base + s.n - 1 : s?.type === 'checkpoint' ? base + s.after : of;
  const current = s?.type === 'item' ? base + s.n - 1 : -1;
  const itemIndex = s?.type === 'item' ? s.n - 1 : s?.type === 'checkpoint' ? s.after : items.length;
  const left = timeLeft(secondsFrom(items, itemIndex));
  const nextLine = load.status === 'ready' ? upNextText(active + 1 >= endAt ? { type: 'end' } : slots[active + 1]) : null;
  const ticks = load.status === 'ready' && of ? <Ticks total={of} done={doneCount} current={current} /> : load.status === 'loading' ? <Ticks total={0} /> : <div className="st-ticks" />;
  const keptCount = numbers.kept;
  const counter = load.status === 'ready' && of ? <><b>{pos}</b>&nbsp;of {of}</> : null;
  const panelRows = [];
  // Never a zero (R2 ruling 1): "0 of 1 right" reads "1 tried".
  if (numbers.answered) panelRows.push({ label: 'Questions', value: numbers.right ? `${numbers.right} of ${numbers.answered} right` : `${numbers.answered} tried`, sub: streak >= 3 ? `${streak} in a row` : null });
  if (numbers.mistakes) panelRows.push({ label: 'Open mistakes', value: numbers.fixed ? `${numbers.fixed} of ${numbers.mistakes} fixed` : `${numbers.mistakes} tried` });
  if (keptCount) panelRows.push({ label: WORDS.inRevise, value: keptCount, extra: <MiniPile refEl={pileEl} /> });

  const top = (
    <TopBar onClose={askClose} closeLabel="Close the feed" title={title} titleNote={note}
      kept={<KeptCount count={keptCount} refEl={countEl} />} ticks={ticks}
      counter={counter} counterLabel={of ? `${pos} of ${of}. Open the list of this feed` : undefined} onCounter={of ? () => setSheet('feed') : undefined}
      meta={load.status === 'ready' ? left : null} next={nextLine} />
  );
  const panel = (
    <Panel onClose={askClose} closeLabel="Close the feed" title={title} bookRef={book} loading={load.status === 'loading'}
      position={load.status === 'ready' && of ? pos : null} of={of || null} time={load.status === 'ready' ? left : null}
      note={note} rows={panelRows} next={nextLine}
      foot={load.status === 'ready' && items.length ? <button type="button" className="st-textkey" onClick={() => { if (itemsDone > 0) setSheet('stop'); else close(); }}>Stop here</button> : null} />
  );

  // ------------------------------------------------------------ states without items
  const centerState = (body, { bar = null } = {}) => (
    <Stage label={`${title || 'Chapter'} feed`} rootRef={rootRef} viewRef={viewRef} trackRef={trackRef} panel={panel} top={top} ticks={ticks} bar={bar} say={say}>
      <article className="st-page st-page--center" style={{ '--p': 0 }}>{body}</article>
    </Stage>
  );

  if (load.status === 'loading') {
    return (
      <Stage label="Starting the feed" rootRef={rootRef} viewRef={viewRef} trackRef={trackRef} busy panel={panel} top={top} ticks={ticks} say={say}
        rail={<><span className="skeleton st-skel-glyph" /><span className="skeleton st-skel-glyph" /></>}
        bar={<ActionBar left={<span className="skeleton st-skel-glyph" />} right={<span className="skeleton st-skel-glyph" />} prev={<span className="skeleton st-skel-key" style={{ width: 140, height: 48 }} />}><span className="skeleton st-skel-key" style={{ minWidth: 220 }} /></ActionBar>}>
        <article className="st-page st-page--card" style={{ '--p': 0 }} role="status" aria-label="Starting the feed">
          <div className="st-skel-card"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
          <p className="st-stamp" />
          {slow ? <p className="st-state__line" style={{ textAlign: 'center', marginInline: 'auto' }}>Taking longer than usual. <button type="button" className="st-textkey" onClick={() => begin()}>Try again</button></p> : null}
        </article>
      </Stage>
    );
  }
  if (load.status === 'error') {
    return centerState(
      <div className="st-state">
        <h2 className="st-state__title">The feed did not start</h2>
        <p className="st-state__line">Check your connection and try again.</p>
        <div className="st-state__keys">
          <button type="button" className="kc-btn kc-btn--volt" onClick={() => begin()}>Try again</button>
          <Link className="st-textkey st-textkey--quiet" style={{ justifySelf: 'center' }} href={links.explore()}>Back to Explore</Link>
        </div>
      </div>,
    );
  }
  if (load.status === 'notfound') {
    return centerState(
      <div className="st-state">
        <h2 className="st-state__title">This chapter is not in your book list</h2>
        <p className="st-state__line">The link may be old. Your chapters are on Explore.</p>
        <div className="st-state__keys"><Link className="kc-btn kc-btn--volt" href={links.explore()}>Back to Explore</Link></div>
      </div>,
    );
  }
  if (load.status === 'empty') {
    return centerState(
      <div className="st-state">
        <h2 className="st-state__title">Nothing to play here yet</h2>
        <p className="st-state__line">This chapter&apos;s cards and questions are still being checked.</p>
        <div className="st-state__keys">
          <Link className="kc-btn kc-btn--volt" href={links.explore()}>Back to Explore</Link>
          {key ? <Link className="kc-btn kc-btn--line" href={links.chapter(key)}>Open the chapter</Link> : null}
        </div>
      </div>,
    );
  }
  if (load.status === 'free') {
    return (
      <Stage label="That was today's free session" rootRef={rootRef} viewRef={viewRef} trackRef={trackRef} mode="end" say={say}
        end={(
          <div className="st-end">
            <div className="st-endx-wrap">
              <div className="st-endx__top"><button type="button" className="st-closekey" onClick={close} aria-label="Close"><X size={20} strokeWidth={2.2} aria-hidden="true" />Close</button></div>
              <FreeUsed data={load.free || {}} links={links} chapterKey={key} minutes={minutes} />
            </div>
          </div>
        )} />
    );
  }

  // ------------------------------------------------------------ the feed
  const item = s?.type === 'item' ? s.item : null;
  const st = item ? states[item.id] || {} : {};
  const last = active === endAt - 1;
  const nextLabel = last ? 'See how it went' : 'Next';
  let step = null;
  let wide = false;
  if (s?.type === 'checkpoint') {
    wide = true;
    step = closed
      ? <StepKey onClick={() => go(endAt)}>See how it went</StepKey>
      : (
        <>
          <button type="button" className="kc-btn kc-btn--line st-step" onClick={stopHere}>Stop here</button>
          <StepKey onClick={() => go(active + 1)}>Keep going</StepKey>
        </>
      );
  } else if (item?.type === 'card') {
    step = st.seenBack ? <StepKey onClick={() => go(active + 1)}>{nextLabel}</StepKey> : <StepKey onClick={() => turn(item)}>Turn over</StepKey>;
  } else if (item?.type === 'question') {
    if (st.answer?.res || st.skipped || closed) step = <StepKey onClick={() => go(active + 1)} later={Boolean(st.answer?.res)}>{nextLabel}</StepKey>;
    else step = <SkipKey onClick={() => go(active + 1)} disabled={Boolean(st.answer?.pending)} />;
  }
  const keepKey = (it, place) => {
    const s2 = states[it.id] || {};
    const look = Boolean(it.look);
    // R3-SPEC W, L4: "Revise later" with the card-stack glyph; "In Revise" with a check only once the server confirms.
    const inRevise = look || s2.kept;
    return <RailKey key={`keep-${place}`} icon={inRevise ? Check : CardStack} filled={false} label={inRevise ? WORDS.inRevise : s2.keepPro ? 'Pro' : WORDS.reviseLater} on={inRevise} busy={s2.keeping} pop={s2.kept} disabled={closed && !s2.kept} onClick={() => keep(it)} />;
  };
  const saveKey = (it, place) => {
    const s2 = states[it.id] || {};
    return <RailKey key={`save-${place}`} icon={Bookmark} label={s2.saved ? WORDS.saved : s2.savePro ? 'Pro' : WORDS.save} on={s2.saved} busy={s2.saving} pop={s2.saved} onClick={() => save(it)} />;
  };
  const sideKey = (place) => (item?.type === 'card' ? keepKey(item, place) : item?.type === 'question' && !st.skipped ? saveKey(item, place) : null);
  const chapterKeyEl = (place) => (item ? <RailKey key={`ch-${place}`} icon={BookOpen} label="Chapter" href={chapterHref} /> : null);
  const below = optBelow && item?.type === 'question' && !st.answer && !st.skipped;
  // The chip sits in the peek strip, so it shows only while a next item peeks (R3-SPEC L3).
  const chip = hints.nudge && mode === 'items' && !below && active + 1 < endAt ? (
    <p className="st-cue" data-leaving={hints.leaving || undefined} role="note">
      <span className="st-cue__in">
        <span className="st-cue__mobi" aria-hidden="true"><MobiReact act="idle" size={34} still /></span>
        <span>{hints.desk ? 'Scroll or press \u2193 for the next one' : 'Swipe up for the next one'}</span>
        {hints.desk ? null : <ChevronUp size={16} strokeWidth={2.4} aria-hidden="true" />}
      </span>
    </p>
  ) : null;
  const bar = mode === 'items' ? (
    <ActionBar left={wide ? null : sideKey('bar')} right={wide ? null : chapterKeyEl('bar')} wide={wide}
      prev={<PrevKey onClick={() => go(active - 1)} disabled={active === 0} />}
      extra={<>{below ? <BelowChip show onClick={() => goToOptions(trackRef.current?.querySelector('.st-page--q:not([inert]) .st-opt'))} /> : null}{sheet === 'keys' ? <KeysList onClose={() => setSheet(null)} /> : null}</>}>
      {step}
    </ActionBar>
  ) : null;
  const rail = null; // R2 screens 19: Revise later and Chapter sit in the action bar at every width

  const f = end.data?.feed || null;
  const d = end.data || null;
  const closeKey = <button type="button" className="st-closekey" onClick={close} aria-label="Close the feed"><X size={20} strokeWidth={2.2} aria-hidden="true" />Close</button>;
  let endView = null;
  if (mode === 'end') {
    const stopped = stoppedHere;
    const reached = onlyEnd ? f?.done?.reached || 0 : stopped ? Math.min(of, base + furthest) : of;
    const qLine = (f?.lines || []).find((l) => l.label === 'Questions')?.text || '';
    const n = onlyEnd
      ? { answered: Number((qLine.match(/of (\d+)/) || [])[1]) || 0, right: Number((qLine.match(/^(\d+) of/) || [])[1]) || 0, mistakes: Number(d?.numbers?.mistakes) || 0, fixed: Number(d?.numbers?.fixed) || 0, seen: 0 }
      : numbers;
    const kept = f?.kept?.count || 0;
    // Cards this feed showed for the first time count as seen on the chapter's bar (R2 ruling 3: turned feed cards are seen).
    const freshSeen = onlyEnd ? 0 : items.filter((i) => i.type === 'card' && i.stage === 'new' && states[i.id]?.seen && !states[i.id]?.kept).length;
    const prog = d?.progress ? endProgress({ ...d.progress, seen: Math.min(d.progress.of, (d.progress.seen || 0) + freshSeen) }) : null;
    // The keys are the server's, word for word (W): "Keep going · 10 min" (a new feed of this chapter, here), "Next chapter
    // · 10 min" (its feed), a stopped feed's "Continue · N min" (this run, picked up here), "Fix 3 open mistakes · 3 min" (a
    // NEW mistakes-only chapter run), Free's "Quick recap · 1 min" and See Pro.
    const lead = d?.lead || null;
    const quietOpt = (d?.options || []).find((o) => o && o !== lead) || null;
    const runHref = (r) => {
      const href = links.run({ chapterKey: r.chapterKey || key, minutes: r.minutes, kind: r.kind, cardIds: r.cardIds || [], leaveOut: r.leaveOut || [] });
      return r.fresh ? `${href}${href.includes('?') ? '&' : '?'}fresh=1` : href;
    };
    // What a key does, as data: { label, sub, href } for a link, { label, act: 'pro' | 'again' | 'resume', id } for a button.
    const specOf = (o, isMain) => {
      if (!o) return null;
      const label = o.label || o.title;
      const r = o.run || null;
      const sub = isMain && o.kind === 'next' ? o.chapterTitle || null : null;
      if (o.go === 'pro') return { label, act: 'pro' };
      if (o.href) return { label, sub, href: links.resolve(o.href) };
      if (r?.kind === 'feed' && r.resume) return { label, act: 'resume', id: r.resume };
      if (r?.kind === 'feed' && r.chapterKey === key && r.fresh) return { label, act: 'again' };
      if (r?.kind === 'feed') return { label, sub, href: links.feed(r.chapterKey, r.minutes || minutes) };
      if (r) return { label, sub, href: runHref(r) };
      return null;
    };
    const mainSpec = specOf(lead, true);
    const quietSpec = specOf(quietOpt, false);
    const onAct = (spec, e) => {
      if (spec.act === 'pro') seePro('learn_feed', e.currentTarget, router.push);
      else if (spec.act === 'resume') resumeFeed(spec.id);
      else if (spec.act === 'again') again10();
    };
    const main = !mainSpec ? null : mainSpec.href
      ? <EndKey as={Link} href={mainSpec.href} sub={mainSpec.sub}>{mainSpec.label}</EndKey>
      : <EndKey onClick={(e) => onAct(mainSpec, e)} disabled={again && mainSpec.act !== 'pro'}>{again && mainSpec.act !== 'pro' ? 'Starting' : mainSpec.label}</EndKey>;
    const quiet = !quietSpec ? null : quietSpec.href
      ? <Link className="st-textkey" href={quietSpec.href}>{quietSpec.label}</Link>
      : <button type="button" className="st-textkey" onClick={(e) => onAct(quietSpec, e)}>{quietSpec.label}</button>;
    const freeLine = lead?.line ? { line: lead.line } : null;
    endView = (
      <div className="st-end" data-pager-ignore={onlyEnd || undefined}>
        <EndScreen
          close={closeKey}
          titleRef={endTitleEl}
          loading={end.status === 'loading' || end.status === 'idle'}
          error={end.status === 'error' ? { title: 'Your feed is saved', line: 'Its summary did not load.' } : null}
          onRetry={() => run?.id && readEnd(run.id, dirty, { stop: stoppedHere })}
          retryKeys={<Link className="st-textkey st-textkey--quiet" href={links.explore()}>Back to Explore</Link>}
          chapter={endTitle(d, run)}
          headline={endHeadline({ reached, of: onlyEnd ? f?.done?.of || 0 : of, minutes: f?.done?.minutes, stopped: stopped || Boolean(d?.stopped) })}
          mobi="nod"
          pile={kept ? f.kept.cards || [] : null}
          numbers={endNumbers({ revise: kept, reviseText: reviseLabel(f?.kept?.groups), answered: n.answered, right: n.right, mistakes: n.mistakes, fixed: n.fixed })}
          progress={prog}
          free={freeLine}
          main={main}
          quiet={quiet}
        />
      </div>
    );
  }

  const rows = sheet === 'feed' ? sheetRows(items, states, base) : [];
  const overlay = sheet === 'stop' ? (
    <StopSheet done={Math.min(itemsDone, of)} of={of} onEnd={stopHere} onKeepGoing={() => setSheet(null)} />
  ) : sheet === 'feed' ? (
    <Sheet title="This feed" bottom onClose={() => setSheet(null)}>
      <ol className="st-list">
        {rows.map((r) => {
          const slotIndex = slots.findIndex((x) => x.type === 'item' && x.item.id === r.id);
          const now = slotIndex === active;
          return (
            <li key={r.id}>
              <button type="button" onClick={() => { setSheet(null); go(slotIndex); }} aria-current={now ? 'step' : undefined} data-state={r.state || undefined} data-autofocus={now ? '' : undefined}>
                <span className="st-list__n">{r.n}</span>
                <span className="st-list__w"><small>{r.kind}</small>{r.words}</span>
                {now ? <span className="st-list__now">Now</span> : r.state === 'right' ? <Check size={16} strokeWidth={2.6} aria-label="Right" /> : r.state === 'wrong' ? <X size={16} strokeWidth={2.6} aria-label="Not right" /> : r.state === 'kept' ? <span role="img" aria-label={WORDS.inRevise}><CardStack size={16} strokeWidth={2} /></span> : r.state === 'seen' ? <span className="st-list__dot" aria-label="Seen" /> : <span />}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="st-drawer__keys"><button type="button" className="st-textkey" onClick={stopHere}>Stop here</button></div>
    </Sheet>
  ) : null;

  const trackAt = Math.min(active, Math.max(0, slots.length - 1));
  return (
    <Stage label={`${title || 'Chapter'} feed`} rootRef={rootRef} viewRef={viewRef} trackRef={trackRef} mode={mode} busy={again}
      panel={panel} top={top} ticks={ticks} rail={rail} bar={bar} end={endView} overlay={overlay} say={say} chip={chip}
      feedLabel={`${title || 'Chapter'}, ${of} items`}>
      {slots.map((slot, i) => {
        const far = Math.abs(i - trackAt) > 2;
        const here = i === trackAt && mode === 'items';
        // R3-SPEC L3: the page under the one in view peeks as a card edge with its type label (the cap).
        const next = i === trackAt + 1 && mode === 'items';
        const common = { style: { '--p': i }, 'data-far': far || undefined, 'data-next': next || undefined, inert: !here || undefined, 'aria-hidden': !here || undefined };
        const capLabel = slot.type === 'checkpoint' ? 'So far' : slot.item.type === 'card' ? cardFace(slot.item.card).label : slot.item.origin === 'mistake' ? (slot.item.mistake?.label || 'Question') : 'Question';
        const cap = Math.abs(i - trackAt) <= 2 ? <div className="st-cap" aria-hidden="true"><span className="st-cap__label">{capLabel}</span></div> : null;
        if (slot.type === 'checkpoint') {
          const cp = checkpointText(numbers, { done: base + slot.after, of, seconds: secondsFrom(items, slot.after) });
          const keptCards = items.filter((x) => x.type === 'card' && states[x.id]?.kept).map((x) => x.card).filter(Boolean);
          return (
            <article key={slot.id} className="st-page st-page--cp" {...common} aria-label={`Checkpoint after ${base + slot.after} of ${of}`}>
              {cap}
              <div className="st-cp">
                <p className="st-cp__n" key={here ? 'here' : 'away'}>{cp.big}</p>
                <p className="st-cp__status">{cp.status}</p>
                {keptCards.length ? <div className="st-cp__fan"><KeptFan cards={keptCards} small /></div> : null}
              </div>
            </article>
          );
        }
        const it = slot.item;
        const s2 = states[it.id] || {};
        const n = base + slot.n;
        if (it.type === 'card') {
          const extra = it.reason === 'earlier' ? 'Back from earlier' : it.reason === 'line' ? 'The line you needed' : null;
          const stamp = s2.stamp || (it.look ? { text: 'In Revise' } : null);
          return (
            <article key={it.id} className="st-page st-page--card" {...common} aria-posinset={n} aria-setsize={of} aria-label={`Card ${n} of ${of}`} tabIndex={-1}>
              {cap}
              <CardFace card={it.card} turned={Boolean(s2.turned)} onTurn={() => turn(it)} refEl={(el) => { cardEls.current[it.id] = el; }} stamp={stamp} extraKind={extra} />
            </article>
          );
        }
        // One counter only (the top bar's "5 of 16"): a question's head is its kind, like a card's (phone clarity 11).
        const head = it.origin === 'mistake' ? (it.mistake?.label || 'You missed this before') : 'Question';
        return (
          <article key={it.id} className="st-page st-page--q" {...common} aria-posinset={n} aria-setsize={of} aria-label={`Question ${n} of ${of}`} tabIndex={-1}>
            {cap}
            <QuestionView head={head} mistake={it.origin === 'mistake'} stem={it.question?.body || ''} options={it.question?.options || []}
              answer={s2.answer || null} onChoose={(k) => choose(it, k)} streak={streak} skipped={s2.skipped || null}
              locked={closed && !s2.answer ? CLOSED_LINE : null} error={s2.error || null}
              onSeePro={(e) => seePro('keycards', e?.currentTarget, router.push)} />
          </article>
        );
      })}
    </Stage>
  );
}
