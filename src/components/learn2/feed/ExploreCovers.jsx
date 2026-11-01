'use client';
// The way into the Explore feed (FEED-2 section 6; rebuilt to A2-explore-covers.md 4.2-4.9 as BUILD-1101 B7 decides): a row of
// chapter covers. Each cover is the chapter's own: its media is the first Key card its feed opens with (the hook, set in display
// type on the lit card surface), with the small ref line ("Part 1, Ch 2") above it; under a hairline, the title, the student's
// one true line, the mix for the picked length and the key ("Play 10 minutes"). No subject object on covers (LK21), no big
// numeral (numerals repeat on neighbours). The whole cover is one link. Only the lead cover's key is volt, and it never moves
// with scrolling; it is the page's primary (data-page-primary quiets the sidebar's and the dock's Start).
// The row: arrows in the section head on a computer, a "1 of 14" pager under the row on a phone, one tab stop with Left, Right,
// Home and End. The length is the site's SegmentedControl, remembered per viewer. Every state is drawn: loading (skeleton at
// the real size), error (a line and Try again), empty, Free at 20 (the capped line), Free at the day's limit (keys open the
// chapter's questions on this page, no feed start), resume ("Continue · 4 min", R3 ruling W).
// The words live in coverModel.js (tested). Hidden on the real site until Learn v2 is on (NEXT_PUBLIC_LEARN2 = 'on').
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { feedCovers, useLearnRead } from '../api';
import { useLearnLinks } from '../links';
import {
  COVER_START_KEY, LENGTHS, hasHistory, hookTier, isFreePlan, keyLabelOf, leadLine, mediaOf, mixLineOf, opensQuestions, readLength, refLineOf, studentLineOf,
} from './coverModel';
import { useL2Off } from '../flag';
import { WORDS } from '../../../../data/learn/words.js';
import { FREE_DONE_HEADLINE } from '../../../../data/learn/allowance.js';
import '@/components/keycards/keycards.css';
import './covers.css';

// ---- The picked length, remembered per viewer (A2 4.7: mm:explore:feedMinutes; a failed read means 10) -----------------------
const LENGTH_KEY = 'mm:explore:feedMinutes';
const lengthListeners = new Set();
let lengthMemory = null;
function subscribeLength(cb) {
  lengthListeners.add(cb);
  const onStorage = (e) => { if (e.key === LENGTH_KEY) { lengthMemory = null; cb(); } };
  window.addEventListener('storage', onStorage);
  return () => { lengthListeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
function lengthSnapshot() {
  if (lengthMemory) return lengthMemory;
  try { return readLength(window.localStorage.getItem(LENGTH_KEY)); } catch { return 10; }
}
function storeLength(m) {
  lengthMemory = m;
  try { window.localStorage.setItem(LENGTH_KEY, String(m)); } catch { /* the choice still holds for this visit */ }
  lengthListeners.forEach((f) => f());
}
// "5 min", "10 min", "20 min"; on a narrow row the first two drop "min" ("5 | 10 | 20 min") so the title keeps its line.
const LENGTH_OPTIONS = LENGTHS.map((m, i) => ({ value: m, label: <>{m}<span className={i < LENGTHS.length - 1 ? 'fxc-min fxc-min--drop' : 'fxc-min'}> min</span></> }));

const reducedMotion = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced');
const leftKey = (subject) => `mm:fxc:left:${subject}`;
// First-time cue (R2 ruling 7, phone-clarity 17): on the first visit, once the covers land, the row slides 24 px toward the next
// cover and settles back (420 ms out, 380 ms back), so a first-timer sees that covers page sideways. Once per student (this
// device), never with reduced motion, and a touch, wheel or scroll first cancels it.
const NUDGE_KEY = 'mm:fxc:nudged';
const NUDGE = { delay: 900, px: 24, out: 420, back: 380 };
const nudgedBefore = () => { try { return window.localStorage.getItem(NUDGE_KEY) === '1'; } catch { return true; } };
const markNudged = () => { try { window.localStorage.setItem(NUDGE_KEY, '1'); } catch { /* it may play once more */ } };
// Where a feed was started from (BUILD-1101 B7 item 4, A2 F19): the cover link cannot carry it, so the tap leaves it for the
// feed for a minute; the feed sends it with its start as { source: 'explore_cover', forYou, position } (startRun options).

const noteStart = (c, index) => {
  try { window.sessionStorage.setItem(COVER_START_KEY, JSON.stringify({ chapterKey: c.key, forYou: Boolean(c.forYou), position: index, at: Date.now() })); } catch { /* the feed starts without it */ }
};

function Skeleton() {
  return (
    <div className="fxc-row fxc-row--skel" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="fxc-cover" data-skel="">
          <span className="fxc-media">
            <span className="skeleton fxc-sk" style={{ width: 72, height: 12 }} />
            <span className="fxc-sk-hook">
              <span className="skeleton fxc-sk" style={{ width: '85%', height: 20 }} />
              <span className="skeleton fxc-sk" style={{ width: '60%', height: 20 }} />
            </span>
          </span>
          <span className="fxc-body">
            <span className="skeleton fxc-sk" style={{ width: '80%', height: 16 }} />
            <span className="skeleton fxc-sk" style={{ width: '55%', height: 16 }} />
            <span className="skeleton fxc-sk" style={{ width: '45%', height: 12, marginTop: 4 }} />
            <span className="fxc-foot">
              <span className="skeleton fxc-sk" style={{ width: '38%', height: 12 }} />
              <span className="skeleton fxc-sk fxc-sk--key" />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Cover({ c, index, minutes, lead, history, free, freeDone, swap, tabIndex, href, feedHref, onFocus, onQuestions }) {
  const id = useId().replace(/:/g, '');
  const media = mediaOf(c, minutes);
  const ref = refLineOf(c);
  const top = lead ? leadLine(c, { history }) : null;
  const line = lead ? null : studentLineOf(c, { history });
  const toQuestions = opensQuestions(c, { freeDone });
  const mix = toQuestions ? '' : mixLineOf(c, minutes, { free, history });
  const label = keyLabelOf(c, minutes, { freeDone });
  const ids = { t: `${id}t`, k: `${id}k`, l: `${id}l`, m: `${id}m`, h: `${id}h` };
  const describedBy = [(top || line) ? ids.l : null, mix ? ids.m : null, ids.h].filter(Boolean).join(' ');
  const props = {
    className: 'fxc-cover', 'data-lead': lead || undefined, 'data-index': index, tabIndex, onFocus,
    'aria-labelledby': `${ids.t} ${ids.k}`, 'aria-describedby': describedBy,
  };
  const inner = (
    <>
      <span className="fxc-media" data-kind={media.kind}>
        {ref ? <span className="fxc-ref">{ref}</span> : <span className="fxc-ref" aria-hidden="true" />}
        {media.kind === 'card' ? <span className="fxc-hook" id={ids.h} data-tier={hookTier(media.text)}>{media.text}</span> : null}
        {media.kind === 'locked' ? <span className="fxc-hook fxc-hook--note" id={ids.h}><span className="fxc-hook__kind">{media.label}</span><span className="fxc-hook__note">Opens with a Pro card</span></span> : null}
        {media.kind === 'questions' ? <span className="fxc-hook fxc-hook--note" id={ids.h}><span className="fxc-hook__big">{media.text}</span><span className="fxc-hook__note">{media.note}</span></span> : null}
      </span>
      <span className="fxc-body">
        <h3 className="fxc-name" id={ids.t} data-long={c.title && c.title.length > 48 ? '' : undefined}>{c.title}</h3>
        {top ? <span className="fxc-line fxc-line--lead" id={ids.l}><b className="fxc-for">{top.prefix}</b> {top.text}</span> : null}
        {line ? <span className="fxc-line" id={ids.l}>{line}</span> : null}
        <span className="fxc-foot">
          {mix ? <span className={swap ? 'fxc-mix fxc-swap' : 'fxc-mix'} key={swap ? `m${minutes}` : 'm'} id={ids.m}>{mix}</span> : null}
          <span className={`kc-btn ${lead ? 'kc-btn--volt' : 'kc-btn--line'} fxc-key`} id={ids.k} data-page-primary={lead ? '' : undefined}>
            {toQuestions ? null : <Play size={16} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />}
            <span className={swap ? 'fxc-swap' : undefined} key={swap ? `k${minutes}` : 'k'}>{label}</span>
          </span>
        </span>
      </span>
    </>
  );
  if (toQuestions) return <button type="button" {...props} onClick={() => onQuestions?.(c)}>{inner}</button>;
  // A cover with a feed to pick up opens that run by its id (Free at the day's limit can still finish its own feed).
  return <Link href={c.resume?.runId ? feedHref(c, { runId: c.resume.runId }) : href} {...props} onClick={() => { if (!c.resume?.runId) noteStart(c, index); }}>{inner}</Link>;
}

/**
 * Props: subject (id), subjectName (the page's name for it, used before the covers load), enabled (the page's own flag; default:
 * the preview or NEXT_PUBLIC_LEARN2), onQuestions(cover) (Free at the day's limit: open this chapter's questions on the page),
 * onCovers(data | null) (the page reads the covers' chapter titles for its labels).
 */
export default function ExploreCovers({ subject, subjectName = null, enabled, onQuestions, onCovers }) {
  const links = useLearnLinks();
  const l2Off = useL2Off(); // R3 X7: false on the server and while hydrating, then the address's answer
  // The preview always shows them, except with &l2=off (the live page with the flag off, for side-by-side checks).
  const on = enabled ?? ((links.preview && !l2Off) || process.env.NEXT_PUBLIC_LEARN2 === 'on');
  const minutes = useSyncExternalStore(subscribeLength, lengthSnapshot, () => 10);
  const [swap, setSwap] = useState(false);
  const [status, setStatus] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const [pos, setPos] = useState({ start: true, end: true, index: 0, overflow: false });
  const rowRef = useRef(null);
  const prevRef = useRef(null);
  const lastArrow = useRef(null); // the arrow last used, so focus can move off it when it reaches its end
  const nextRef = useRef(null);
  const restored = useRef(false);
  const hId = useId().replace(/:/g, '');
  const read = useLearnRead(() => (on && subject ? feedCovers(subject) : Promise.resolve(null)), [on, subject]);

  const data = read.data;
  const stale = Boolean(data && subject && data.subject?.id && data.subject.id !== subject);
  const phase = !subject ? 'loading'
    : read.status === 'error' || (stale && read.status === 'ready' && read.error) ? 'error'
      : read.status === 'loading' || stale || !data ? 'loading'
        : !data.covers?.length ? 'empty' : 'ready';
  const covers = phase === 'ready' ? data.covers : [];
  const name = (!stale && data?.subject?.name) || subjectName || null;
  const history = phase === 'ready' ? hasHistory(data) : true;
  const free = phase === 'ready' && isFreePlan(data);
  const freeDone = phase === 'ready' && Boolean(data.free);
  const n = covers.length;

  useEffect(() => { onCovers?.(phase === 'ready' ? data : null); }, [phase, data, onCovers]);

  // Where the row is: its ends (for the arrows) and the cover in view (for the phone pager).
  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const first = row.firstElementChild;
    const step = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap || '0') : 1;
    const max = row.scrollWidth - row.clientWidth;
    const left = row.scrollLeft;
    const end = left >= max - 2;
    const index = end && max > 2 ? row.children.length - 1 : Math.max(0, Math.min(row.children.length - 1, Math.round(left / step)));
    setPos((p) => (p.start === left <= 2 && p.end === end && p.index === index && p.overflow === max > 2 ? p : { start: left <= 2, end, index, overflow: max > 2 }));
  }, []);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (phase !== 'ready' || !row) return undefined;
    if (!restored.current) {
      restored.current = true;
      try { const left = Number(window.sessionStorage.getItem(leftKey(subject))); if (left > 0) row.scrollLeft = left; } catch { /* none */ }
    }
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
        try { window.sessionStorage.setItem(leftKey(subject), String(Math.round(row.scrollLeft))); } catch { /* none */ }
      });
    };
    row.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    ro?.observe(row);
    measure();
    return () => { row.removeEventListener('scroll', onScroll); ro?.disconnect(); cancelAnimationFrame(frame); };
  }, [phase, subject, n, measure]);

  // The first-visit nudge (above): only when a cover waits past the right edge.
  useEffect(() => {
    const row = rowRef.current;
    if (phase !== 'ready' || !row || nudgedBefore() || reducedMotion()) return undefined;
    let run = null;
    let done = false;
    const timer = window.setTimeout(() => {
      if (done || row.scrollLeft > 2 || row.scrollWidth - row.clientWidth <= 2 || !row.getClientRects().length) return;
      markNudged();
      const total = NUDGE.out + NUDGE.back;
      run = row.animate([
        { transform: 'translate3d(0, 0, 0)', easing: 'cubic-bezier(.2, .8, .2, 1)' },
        { transform: `translate3d(${-NUDGE.px}px, 0, 0)`, offset: NUDGE.out / total, easing: 'cubic-bezier(.23, 1, .32, 1)' },
        { transform: 'translate3d(0, 0, 0)' },
      ], { duration: total });
    }, NUDGE.delay);
    const stop = () => { done = true; window.clearTimeout(timer); try { run?.cancel(); } catch { /* finished */ } };
    const opts = { passive: true };
    row.addEventListener('pointerdown', stop, opts);
    row.addEventListener('wheel', stop, opts);
    row.addEventListener('touchstart', stop, opts);
    row.addEventListener('scroll', stop, opts);
    return () => {
      stop();
      row.removeEventListener('pointerdown', stop);
      row.removeEventListener('wheel', stop);
      row.removeEventListener('touchstart', stop);
      row.removeEventListener('scroll', stop);
    };
  }, [phase]);

  // An arrow that reaches its end is disabled; if it held focus, focus moves to the other arrow (A2 4.5).
  useEffect(() => {
    // A disabled button has already dropped focus to the page, so the arrow last used is what counts.
    const active = document.activeElement;
    const held = (el) => active === el || ((!active || active === document.body || active.id === 'app-main') && lastArrow.current === el);
    if (pos.start && held(prevRef.current) && !pos.end) nextRef.current?.focus();
    if (pos.end && held(nextRef.current) && !pos.start) prevRef.current?.focus();
  }, [pos.start, pos.end]);

  const behavior = () => (reducedMotion() ? 'auto' : 'smooth');
  const stepOf = (row) => {
    const first = row.firstElementChild;
    const gap = parseFloat(getComputedStyle(row).columnGap || '0');
    const w = first ? first.getBoundingClientRect().width : row.clientWidth;
    const perView = Math.max(1, Math.floor((row.clientWidth + gap + 1) / (w + gap)));
    return { one: w + gap, page: perView * (w + gap) };
  };
  const page = (dir) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: dir * stepOf(row).page, behavior: behavior() });
  };
  const goTo = (index) => {
    const row = rowRef.current;
    const item = row?.children[index];
    if (!row || !item) return;
    const pad = parseFloat(getComputedStyle(row).scrollPaddingLeft || '0') || 0;
    row.scrollTo({ left: item.offsetLeft - row.offsetLeft - pad - (row.clientLeft || 0), behavior: behavior() });
  };

  // One tab stop for the row: Left and Right move between covers, Home and End to the ends (A2 4.5).
  const onRowKey = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
    if (!(event.key in keys)) return;
    const k = keys[event.key];
    const target = k === 'first' ? 0 : k === 'last' ? n - 1 : Math.max(0, Math.min(n - 1, focusIndex + k));
    event.preventDefault();
    const node = rowRef.current?.querySelectorAll('.fxc-cover')[target];
    if (!node) return;
    setFocusIndex(target);
    node.focus({ preventScroll: true });
    node.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: behavior() });
  };

  const chooseLength = (m) => {
    storeLength(m);
    setSwap(true);
    setStatus(`Showing ${m} minute feeds.`);
  };

  if (!on) return null;

  const sub = freeDone
    ? <p className="fxc-sub fxc-sub--free"><span>{FREE_DONE_HEADLINE} Single questions stay free.</span> <button type="button" className="fxc-textkey" onClick={(e) => openUpgrade({ trigger: 'learn_feed', opener: e.currentTarget })}>{WORDS.seePro}</button></p>
    : free && minutes === 20
      ? <p className="fxc-sub fxc-sub--free">Free sessions are up to 10 minutes. Pro has any length.</p>
      : <p className="fxc-sub fxc-sub--wide">Key cards and questions, one at a time.</p>;
  const arrowsOff = phase !== 'ready' || !pos.overflow;

  return (
    <section className="fxc" aria-labelledby={hId} data-phase={phase}>
      <div className="fxc-head">
        <div className="fxc-headline">
          <h2 className="fxc-title" id={hId}>Chapter feeds</h2>
          {phase === 'ready' ? <span className="fxc-count">{n.toLocaleString('en-IN')} {n === 1 ? 'chapter' : 'chapters'}</span> : null}
        </div>
        <div className="fxc-tools">
          <SegmentedControl size="sm" label="Feed length in minutes" value={minutes} onChange={chooseLength} options={LENGTH_OPTIONS} className="fxc-len" />
          <div className="fxc-arrows">
            <button ref={prevRef} type="button" className="fxc-arrow" aria-label="Previous chapters" disabled={arrowsOff || pos.start} onClick={(e) => { lastArrow.current = e.currentTarget; page(-1); }}><ChevronLeft size={18} aria-hidden="true" /></button>
            <button ref={nextRef} type="button" className="fxc-arrow" aria-label="Next chapters" disabled={arrowsOff || pos.end} onClick={(e) => { lastArrow.current = e.currentTarget; page(1); }}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
        </div>
        {phase === 'error' || phase === 'empty' ? null : sub}
      </div>

      {phase === 'loading' ? <><Skeleton /><span className="fxc-pager fxc-pager--skel" aria-hidden="true" /></> : null}
      {phase === 'error' ? (
        <div className="fxc-msg">
          <p>Chapter feeds did not load.</p>
          <button type="button" className="fxc-textkey" onClick={() => read.refresh()}>Try again</button>
        </div>
      ) : null}
      {phase === 'empty' ? <div className="fxc-msg"><p>No chapter feeds for {name || 'this subject'} yet. The questions below still work.</p></div> : null}
      {phase === 'ready' ? (
        <>
          <ul ref={rowRef} className="fxc-row" aria-label={`${name || data.subject?.name || 'Subject'} chapter feeds`} onKeyDown={onRowKey}>
            {covers.map((c, i) => (
              <li key={c.key} className="fxc-item">
                <Cover
                  c={c} index={i} minutes={minutes} lead={Boolean(c.forYou)} history={history} free={free} freeDone={freeDone} swap={swap}
                  tabIndex={i === Math.min(focusIndex, n - 1) ? 0 : -1} href={links.feed(c.key, minutes)} feedHref={(cv, o) => links.feed(cv.key, minutes, o)}
                  onFocus={() => setFocusIndex(i)} onQuestions={onQuestions}
                />
              </li>
            ))}
          </ul>
          <div className="fxc-pager">
            <button type="button" className="fxc-arrow" aria-label="Previous chapter" disabled={pos.index <= 0} onClick={() => goTo(pos.index - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <span className="fxc-pager__at" aria-hidden="true">{(pos.index + 1).toLocaleString('en-IN')} of {n.toLocaleString('en-IN')}</span>
            <button type="button" className="fxc-arrow" aria-label="Next chapter" disabled={pos.index >= n - 1} onClick={() => goTo(pos.index + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
        </>
      ) : null}
      <span className="sr-only" role="status">{phase === 'loading' ? 'Loading chapter feeds' : status}</span>
    </section>
  );
}
