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
import { BookOpen, Bookmark, Check, X } from 'lucide-react';
import { cardFace } from '@/components/keycards/kinds';
import { refreshHome } from '@/components/keycards/api';
import { feedSlots } from '@/../data/learn/feed.js';
import { answerItem, getRun, isQuestionSkipped, isRunClosed, isSessionUsed, keepItem, runEnd, saveQuestion, startRun } from '../api';
import { useLearnLinks } from '../links';
import {
  Stage, Ticks, TopBar, Panel, MiniPile, KeptCount, RailKey, ActionBar, PrevKey, StepKey, SkipKey, KeysList, buzz, flyTo, visible, seePro, still, watchMore,
} from '../stage/Stage';
import { CardFace } from '../stage/CardFace';
import { QuestionView, letterOf } from '../stage/Question';
import { EndForm } from '../stage/EndForm';
import { Sheet, StopSheet } from '../stage/Sheet';
import { usePager } from '../stage/usePager';
import { keyAction, scrollerThatCanMove } from '../stage/pagerModel.mjs';
import { chapterRef, doneLine, optionTexts, speakable, timeLeft } from '../stage/stageText.mjs';
import { checkpointText, feedNumbers, questionPlaces, secondsFrom, sheetRows, spliceReinsert, upNextText } from './feedModel.mjs';
import './feed.css';

const KEYS_HINT = 'learn2.feed.keys.v1';
const NUDGE = 'learn2.feed.nudge.v1';
const LEFT_OUT = {
  question_changed: 'This question changed a moment ago, so it is left out.',
  question_held: 'This question is in an open Mob paper, so it is left out for now.',
};
const CLOSED_LINE = 'This feed is finished, so this one is not counted.';
const seenFlag = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return true; } };
const markFlag = (k) => { try { localStorage.setItem(k, '1'); } catch { /* shown again next time */ } };
const typing = (el) => Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
const fine = () => { try { return window.matchMedia('(pointer: fine)').matches; } catch { return false; } };
const coarse = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } };

// A feed the page already holds, by run id: putting ?run= in the URL may mount the feed again (the preview keys it by run),
// and Back from the chapter page returns to it. The server stays the truth on a real reload (GET /api/learn/runs/:id).
const held = new Map();

/** The end's chapter title: the server's chapter, else the title of "10 minutes on X". */
const endTitle = (data, run) => data?.chapter?.title || run?.chapter?.title || String(data?.feed?.title || data?.title || '').replace(/^.*?\bminutes?\s+on\s+/i, '') || 'This feed';

/** The end's lines in A1's order: Cards, Questions, Old mistakes (B7 G: one definition). */
function endLines(f, { seen, kept, hasCards }) {
  const out = [];
  if (hasCards && (seen || kept)) out.push({ label: 'Cards', text: `${Math.max(seen, kept)} seen, ${kept} kept` });
  for (const l of f?.lines || []) {
    if (l.label === 'Questions') out.push(l);
    else if (l.label === 'Fixed') {
      const all = String(l.text).match(/^(\d+) old mistakes?$/);
      const some = String(l.text).match(/^(\d+) of (\d+) old mistakes?$/);
      out.push({ label: 'Old mistakes', text: all ? `${all[1]} of ${all[1]} fixed` : some ? `${some[1]} of ${some[2]} fixed` : l.text });
    } else out.push(l);
  }
  return out;
}

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
  const [hints, setHints] = useState({ keys: false, nudge: false });
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
  const places = useMemo(() => questionPlaces(items), [items]);
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

  const readEnd = useCallback(async (id, version) => {
    setEnd((e) => ({ ...e, status: e.data && e.version === version ? 'ready' : 'loading' }));
    try {
      const data = await runEnd(id);
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

  // First-time affordances (A1 3.7): the keys line on desktop, the nudge on a phone; read once.
  useEffect(() => { queueMicrotask(() => setHints({ keys: !seenFlag(KEYS_HINT), nudge: !seenFlag(NUDGE) })); }, []);

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
      const head = s.item.origin === 'mistake' ? `${s.item.mistake?.label || 'An old mistake'}. ` : '';
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
      setFurthest(items.length);
      if (end.status !== 'ready' || end.version !== dirty) readEnd(run.id, dirty);
    }
    announce(n);
  }, [endAt, slots, patch, run, items.length, end.status, end.version, dirty, readEnd, announce]);

  usePager({ rootRef, viewRef, trackRef, index: active, count: endAt + 1, go, enabled: load.status === 'ready' && !onlyEnd && sheet !== 'feed' && sheet !== 'stop' });

  // A long question shows that it goes on: its page fades at the foot while more waits below.
  useEffect(() => watchMore(mode === 'items' ? trackRef.current?.querySelector('.st-page--q:not([inert])') : null), [active, mode, list, load.status]);

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
      // The first feed's nudge on a phone (P2): the track shows that the next item waits below, once.
      if (hints.nudge && coarse() && !still()) {
        setHints((h) => ({ ...h, nudge: false }));
        markFlag(NUDGE);
        setTimeout(() => {
          try { trackRef.current?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-24px)' }, { transform: 'translateY(0)' }], { duration: 360, easing: 'ease-out', composite: 'add' }); } catch { /* no WAAPI */ }
        }, 700);
      }
    } else speak('The card side.');
  }, [states, patch, speak, hints.nudge]);

  const keep = useCallback(async (item) => {
    const st = states[item.id] || {};
    if (st.keepPro) { seePro('keycards', null, router.push); return; }
    if (st.kept || st.keeping || !run || item.look) return;
    patch(item.id, { keeping: true, stamp: null });
    try {
      const res = await keepItem(run.id, item.id);
      patch(item.id, { kept: true, keeping: false, stamp: { text: res.line || 'In Revise' } });
      setDirty((d) => d + 1);
      speak(`Kept. ${res.line || 'In Revise'}.`);
      requestAnimationFrame(() => requestAnimationFrame(() => flyTo(cardEls.current[item.id], visible([pileEl.current, countEl.current]))));
      refreshHome();
    } catch (e) {
      if (isRunClosed(e)) { patch(item.id, { keeping: false }); setClosed(true); go(endAt); return; }
      const pro = e.status === 402;
      patch(item.id, { keeping: false, keepPro: pro, stamp: pro ? { text: 'This card is on Pro.' } : { text: 'Not kept. Try again.', bad: true } });
      speak(pro ? 'This card is on Pro.' : 'Could not keep that card. Try again.');
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

  // The keys line (desktop, the first feed): marked as seen once the third item is passed.
  useEffect(() => { if (hints.keys && active >= 3) markFlag(KEYS_HINT); }, [hints.keys, active]);

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
  if (numbers.answered) panelRows.push({ label: 'Questions', value: `${numbers.right} of ${numbers.answered} right`, sub: streak >= 3 ? `${streak} in a row` : null });
  if (numbers.mistakes) panelRows.push({ label: 'Old mistakes', value: `${numbers.fixed} of ${numbers.mistakes} fixed` });
  if (keptCount) panelRows.push({ label: 'Kept', value: keptCount, extra: <MiniPile refEl={pileEl} /> });

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
      foot={load.status === 'ready' && items.length ? <button type="button" className="st-textkey" onClick={() => go(endAt)}>Stop here</button> : null} />
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
    const f = load.free || {};
    const r = f.resume;
    const resumeHref = r ? (r.kind === 'feed' ? links.feed(r.chapterKey, minutes, { runId: r.id }) : links.run({ chapterKey: r.chapterKey, runId: r.id })) : null;
    const optionHref = (o) => {
      if (o.href) return links.resolve(o.href);
      if (o.run) return links.run({ chapterKey: o.run.chapterKey, minutes: o.run.minutes, kind: o.run.kind, cardIds: o.run.cardIds || [] });
      return links.explore();
    };
    const evidence = (o) => o.evidence || (o.run?.minutes ? `About ${o.run.minutes} min.` : null);
    return centerState(
      <div className="st-state">
        <h2 className="st-state__title">Today&apos;s free session is used</h2>
        <p className="st-state__line">{f.line || 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.'}</p>
        <div className="st-state__keys">
          {resumeHref ? (
            <Link className="kc-btn kc-btn--volt st-opt-key" href={resumeHref}>
              <span>{`Pick up where you stopped, ${r.done} of ${r.of}`}</span>
              {r.title && r.chapterKey !== key ? <small style={{ color: 'rgb(16 20 14 / 0.72)' }}>{r.title}</small> : null}
            </Link>
          ) : null}
          {(f.options || []).map((o) => (
            <Link key={o.label} className="kc-btn kc-btn--line st-opt-key" href={optionHref(o)}>
              <span>{o.label}</span>{evidence(o) ? <small>{evidence(o)}</small> : null}
            </Link>
          ))}
          <button type="button" className="st-textkey" style={{ justifySelf: 'center' }} onClick={(e) => seePro('learn_feed', e.currentTarget, router.push)}>See Pro</button>
        </div>
      </div>,
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
          <button type="button" className="kc-btn kc-btn--line st-step" onClick={() => go(endAt)}>Stop here</button>
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
    return <RailKey key={`keep-${place}`} icon={Bookmark} label={look ? 'In Revise' : s2.kept ? 'Kept' : s2.keepPro ? 'Pro' : 'Keep'} on={s2.kept || look} busy={s2.keeping} pop={s2.kept} disabled={closed && !s2.kept} onClick={() => keep(it)} />;
  };
  const saveKey = (it, place) => {
    const s2 = states[it.id] || {};
    return <RailKey key={`save-${place}`} icon={Bookmark} label={s2.saved ? 'Saved' : s2.savePro ? 'Pro' : 'Save'} on={s2.saved} busy={s2.saving} pop={s2.saved} onClick={() => save(it)} />;
  };
  const sideKey = (place) => (item?.type === 'card' ? keepKey(item, place) : item?.type === 'question' && !st.skipped ? saveKey(item, place) : null);
  const chapterKeyEl = (place) => (item ? <RailKey key={`ch-${place}`} icon={BookOpen} label="Chapter" href={chapterHref} /> : null);
  const showHint = hints.keys && active < 3 && mode === 'items';
  const bar = mode === 'items' ? (
    <ActionBar left={wide ? null : sideKey('bar')} right={wide ? null : chapterKeyEl('bar')} wide={wide}
      prev={<PrevKey onClick={() => go(active - 1)} disabled={active === 0} />}
      hint={showHint ? 'The mouse wheel and the arrow keys move between items too.' : null}
      extra={sheet === 'keys' ? <KeysList onClose={() => setSheet(null)} /> : null}>
      {step}
    </ActionBar>
  ) : null;
  const rail = item ? <>{sideKey('rail')}{chapterKeyEl('rail')}</> : null;

  const f = end.data?.feed || null;
  const endView = mode === 'end' ? (
    <div className="st-end" data-pager-ignore={onlyEnd || undefined}>
      <div className="st-endwrap">
        <div className="st-endtop">
          <button type="button" className="st-closekey" onClick={close} aria-label="Close the feed"><X size={18} strokeWidth={2.2} aria-hidden="true" />Close</button>
          {of && !onlyEnd ? <span className="st-counter st-endtop__n"><b>{Math.min(of, f?.done?.reached ?? base + furthest)}</b>&nbsp;of {of}</span> : null}
        </div>
        <EndForm
          titleRef={endTitleEl}
          loading={end.status === 'loading' || end.status === 'idle'}
          error={end.status === 'error' ? { title: 'Your feed is saved', line: 'Its summary did not load.' } : null}
          onRetry={() => run?.id && readEnd(run.id, dirty)}
          retryKeys={<Link className="st-textkey st-textkey--quiet" href={links.explore()}>Back to Explore</Link>}
          title={endTitle(end.data, run)}
          done={doneLine(f?.done ? { reached: f.done.reached, of: f.done.of, minutes: f.done.minutes } : { reached: onlyEnd ? 0 : Math.min(of, base + furthest), of: onlyEnd ? 0 : of })}
          pile={f ? { count: f.kept?.count || 0, cards: f.kept?.cards || [], line: String(f.kept?.line || '').replace(/^\d+ kept\.\s*/, '') || null, none: hasCards || onlyEnd ? 'Nothing kept this time. Keep a card and it comes back in Revise.' : null } : null}
          lines={f ? endLines(f, { seen: numbers.seen, kept: f.kept?.count || 0, hasCards: hasCards && !onlyEnd }) : []}
          note={f?.free ? <p className="st-endform__free"><span>{f.free.text}</span><button type="button" className="st-textkey" onClick={(e) => seePro('learn_feed', e.currentTarget, router.push)}>See Pro</button></p> : null}
          keys={f ? (
            <>
              {!f.free && f.lead ? <button type="button" className="kc-btn kc-btn--volt" onClick={again10} disabled={again}>{again ? 'Starting' : f.lead.label}</button> : null}
              {f.next ? <Link className="kc-btn kc-btn--line" href={f.next.run ? links.feed(f.next.key, minutes) : links.chapter(f.next.key)}>{f.next.label}</Link> : null}
              {f.dueOffer ? <Link className="kc-btn kc-btn--line" href={links.run({ chapterKey: f.dueOffer.run?.chapterKey || key, minutes: f.dueOffer.run?.minutes || f.dueOffer.minutes, kind: 'cards', cardIds: f.dueOffer.run?.cardIds || [] })}>{f.dueOffer.label}</Link> : null}
              <Link className="st-textkey st-textkey--quiet" href={links.explore()}>Back to Explore</Link>
            </>
          ) : null}
        />
      </div>
    </div>
  ) : null;

  const rows = sheet === 'feed' ? sheetRows(items, states, base) : [];
  const stopDetail = [
    numbers.answered ? `${numbers.right} of ${numbers.answered} ${numbers.answered === 1 ? 'question' : 'questions'} right.` : null,
    numbers.mistakes ? `${numbers.fixed} of ${numbers.mistakes} old ${numbers.mistakes === 1 ? 'mistake' : 'mistakes'} fixed.` : null,
    numbers.kept ? `${numbers.kept} kept in Revise.` : null,
  ].filter(Boolean).join(' ') || null;
  const overlay = sheet === 'stop' ? (
    <StopSheet done={Math.min(itemsDone, of)} of={of} detail={stopDetail} onEnd={() => { setSheet(null); go(endAt); }} onKeepGoing={() => setSheet(null)} onLeave={close} />
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
                {now ? <span className="st-list__now">Now</span> : r.state === 'right' ? <Check size={16} strokeWidth={2.6} aria-label="Right" /> : r.state === 'wrong' ? <X size={16} strokeWidth={2.6} aria-label="Not right" /> : r.state === 'kept' ? <Bookmark size={16} strokeWidth={2} fill="currentColor" aria-label="Kept" /> : r.state === 'seen' ? <span className="st-list__dot" aria-label="Seen" /> : <span />}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="st-drawer__keys"><button type="button" className="st-textkey" onClick={() => { setSheet(null); go(endAt); }}>Stop here and see how it went</button></div>
    </Sheet>
  ) : null;

  const trackAt = Math.min(active, Math.max(0, slots.length - 1));
  return (
    <Stage label={`${title || 'Chapter'} feed`} rootRef={rootRef} viewRef={viewRef} trackRef={trackRef} mode={mode} busy={again}
      panel={panel} top={top} ticks={ticks} rail={rail} bar={bar} end={endView} overlay={overlay} say={say}
      feedLabel={`${title || 'Chapter'}, ${of} items`}>
      {slots.map((slot, i) => {
        const far = Math.abs(i - trackAt) > 2;
        const here = i === trackAt && mode === 'items';
        const common = { style: { '--p': i }, 'data-far': far || undefined, inert: !here || undefined, 'aria-hidden': !here || undefined };
        if (slot.type === 'checkpoint') {
          const cp = checkpointText(numbers, { done: base + slot.after, of, seconds: secondsFrom(items, slot.after) });
          return (
            <article key={slot.id} className="st-page st-page--center" {...common} aria-label={`Checkpoint after ${base + slot.after} of ${of}`}>
              <div className="st-cp">
                {numbers.kept ? <span className="fx-cp-mini"><MiniPile /></span> : null}
                <p className="st-cp__n">{cp.big}</p>
                <p className="st-cp__status">{cp.status}</p>
                <p className="st-cp__line">{cp.line}</p>
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
              <CardFace card={it.card} turned={Boolean(s2.turned)} onTurn={() => turn(it)} refEl={(el) => { cardEls.current[it.id] = el; }} stamp={stamp} extraKind={extra} />
            </article>
          );
        }
        const place = places.get(it.id);
        const head = it.origin === 'mistake' ? (it.mistake?.label || 'You missed this before') : place && !base ? `Question ${place.n} of ${place.of}` : 'Question';
        return (
          <article key={it.id} className="st-page st-page--q" {...common} aria-posinset={n} aria-setsize={of} aria-label={`Question ${n} of ${of}`} tabIndex={-1}>
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
