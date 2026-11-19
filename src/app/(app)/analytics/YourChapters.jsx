"use client";
// Your chapters (Marks trend, lane insight 18 Nov 2026): the page's anchor. One group per subject the student picked, its
// desk object and name at the head with "8 of 15 chapters tried", then every chapter as a tile in book order: its short name
// (two lines at most; the book's full name is in the tile's spoken name and the panel's title) and its state as a shape and a
// word, the states and words Learn and Key cards print. A tile is a button: it opens the chapter's panel, inside the right
// column under the tile's row from 720 px (180 ms fade, 8 px rise) and the arena's sheet below that (TodaySheet's own rise).
// Esc and Close close it and the focus goes back to the tile. Fed only by GET /api/analytics insight.chapters
// (src/lib/insight/chapters.mjs says which stored fields feed each figure). Tiles never animate in.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronDown, RefreshCw, X } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import TodaySheet from '@/components/today/TodaySheet';
import { useKeycardsHome } from '@/components/keycards/api';
import { findChapter } from '@/components/keycards/kinds';
import { useCardsLinks } from '@/components/keycards/links';
import { useLearn2On } from '@/components/learn2/flag';
import { useLearnLinks } from '@/components/learn2/links';
import { useInView } from '@/lib/motion';
import {
  FAILED, MAP_COPY, TRY_AGAIN, bookTitle, countLine, dayLabel, lostLine, mapIsEmpty, practiseHref, rightLine, tileName, triedLine,
} from '@/lib/insight/words.mjs';

// The panel sits in the page from 720 px (TodaySheet's own phone width); a phone gets the sheet.
const WIDE = '(min-width: 720px)';
const wideSubscribe = (onChange) => {
  let query;
  try { query = window.matchMedia(WIDE); } catch { return () => {}; }
  query.addEventListener?.('change', onChange);
  return () => query.removeEventListener?.('change', onChange);
};
const wideSnapshot = () => { try { return window.matchMedia(WIDE).matches; } catch { return true; } };
const useWide = () => useSyncExternalStore(wideSubscribe, wideSnapshot, () => true);

/** The shape beside a state word (Key cards' StateGlyph and Learn's StateRing draw the same one): the word says it first. */
function Glyph({ state }) {
  const r = 6.25;
  const c = 8;
  const fill = { thin: 0, weak: 0.25, mid: 0.5, strong: 1 }[state] ?? 0;
  let pie = null;
  if (fill >= 1) pie = <circle cx={c} cy={c} r={r} fill="currentColor" />;
  else if (fill > 0) {
    const a = fill * 2 * Math.PI;
    pie = <path d={`M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${fill > 0.5 ? 1 : 0} 1 ${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)} Z`} fill="currentColor" />;
  }
  return (
    <svg className="ych-glyph" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={state === 'none' ? '2.2 2.2' : undefined} />
      {pie}
    </svg>
  );
}

/** "Open Key cards": the chapter's deck, only when Key cards are on, read, and the chapter has cards (as Your papers' link). */
function KeycardsKey({ subject, chapter, read }) {
  const links = useCardsLinks();
  const v2 = useLearn2On();
  const learn = useLearnLinks();
  if (read.state !== 'ready') return null;
  const row = findChapter(read.data, subject, chapter.name);
  if (!row || !(Number(row.cards) > 0)) return null;
  return <Link className="btn-outline md ych-key" href={v2 ? learn.cards(row.key) : links.deck(row.key)}>{MAP_COPY.keycards}</Link>;
}

/** What the panel says about one chapter: its state, the answers, the marks, the day, and the two keys. */
function Detail({ subject, chapter, read }) {
  const lost = lostLine(chapter.lost, chapter.papers);
  const last = chapter.lastAt ? dayLabel(chapter.lastAt) : null;
  return (
    <div className="ych-detail">
      <p className="ych-detail__state" data-state={chapter.state}><Glyph state={chapter.state} />{chapter.label}</p>
      {chapter.n > 0 ? (
        <p className="ych-detail__right"><b>{rightLine(chapter.right, chapter.n)}</b><span>{MAP_COPY.basis}</span></p>
      ) : null}
      {lost || last ? (
        <dl className="ych-detail__facts">
          {lost ? <div><dt>{MAP_COPY.lost}</dt><dd>{lost}</dd></div> : null}
          {last ? <div><dt>{MAP_COPY.last}</dt><dd>{last}</dd></div> : null}
        </dl>
      ) : null}
      <div className="ych-detail__keys">
        <Link className="btn-volt md mk-press ych-key" data-page-primary="" href={practiseHref(subject.id, chapter.name)}>{MAP_COPY.practise}</Link>
        <KeycardsKey subject={subject.id} chapter={chapter} read={read} />
      </div>
    </div>
  );
}

/** The panel in the page (720 px and wider): under the tile's row, across the grid. Esc or Close closes it. */
function InlinePanel({ id, subject, chapter, read, onClose }) {
  const head = useRef(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [chapter.key]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ych-panel" id={id} role="region" aria-labelledby={`${id}-t`}>
      <div className="ych-panel__head">
        <div>
          <h3 id={`${id}-t`} tabIndex={-1} ref={head}>{bookTitle(chapter.title)}</h3>
          <span>{subject.name}</span>
        </div>
        <button type="button" className="ych-close" onClick={onClose} aria-label={MAP_COPY.close}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
      </div>
      <Detail subject={subject} chapter={chapter} read={read} />
    </div>
  );
}

/** How many tiles a row of this grid holds, from its own laid-out columns. */
function columnsOf(grid) {
  try {
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').filter((t) => t && t !== 'none');
    return Math.max(1, tracks.length);
  } catch { return 1; }
}

function SubjectGroup({ subject, open, onOpen, tileRefs, wide, panelId, read, onClose, showTiles }) {
  const grid = useRef(null);
  const [cols, setCols] = useState(4);
  // The panel goes after the last tile of the open tile's row: the row is counted from the grid's own columns, again on resize.
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return undefined;
    const measure = () => setCols(columnsOf(el));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showTiles]);
  const at = open ? subject.chapters.findIndex((c) => c.key === open) : -1;
  const after = at < 0 ? -1 : Math.min(subject.chapters.length - 1, Math.floor(at / cols) * cols + cols - 1);
  const line = countLine(subject.counts);
  const headId = useId();
  return (
    <div className="ych-group" role="group" aria-labelledby={headId}>
      <div className="ych-group__head">
        <span className="ych-group__obj" aria-hidden="true"><SubjectObject id={subject.id} size={40} framed={false} /></span>
        <span className="ych-group__name"><b id={headId}>{subject.name}</b><span>{triedLine(subject.tried, subject.total)}</span></span>
      </div>
      {showTiles ? (
        <>
          <div className="ych-grid" ref={grid}>
            {subject.chapters.map((c, i) => {
              const isOpen = c.key === open;
              const tile = (
                <button
                  key={c.key}
                  type="button"
                  className="ych-tile"
                  data-state={c.state}
                  aria-expanded={isOpen}
                  aria-controls={isOpen && wide ? panelId : undefined}
                  aria-label={tileName(c)}
                  ref={(el) => { if (el) tileRefs.current.set(c.key, el); else tileRefs.current.delete(c.key); }}
                  onClick={() => onOpen(subject.id, c.key)}
                >
                  <span className="ych-tile__name">{c.name}</span>
                  <span className="ych-tile__state"><Glyph state={c.state} />{c.label}</span>
                  {/* Wide lane (owner, 19 Nov 2026, "a bit more interactive"): a mouse or the focus on a tile shows the small arrow of
                      what it does, opening the chapter's panel (its Practise key and Key cards) under its row. Touch: unchanged. */}
                  <ChevronDown className="ych-tile__go" size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
              );
              if (i !== after || !wide) return tile;
              const chapter = subject.chapters[at];
              return [tile, <InlinePanel key={`panel-${chapter.key}`} id={panelId} subject={subject} chapter={chapter} read={read} onClose={onClose} />];
            })}
          </div>
          {line ? <p className="ych-count">{line}</p> : null}
        </>
      ) : null}
    </div>
  );
}

/** The map before its data, at its final shape: the head, the sub, and a subject's head and tiles. */
function MapWait() {
  return (
    <div className="ych-wait" aria-hidden="true">
      <span className="skeleton ych-wait__head" />
      <div className="ych-grid">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="skeleton ych-wait__tile" />)}</div>
    </div>
  );
}

/**
 * status   the analytics read: 'loading' | 'error' | 'ready'
 * map      insight.chapters: { state: 'ready', subjects } | { state: 'error' }
 * onRetry  reads the analytics again
 */
export default function YourChapters({ status, map, onRetry }) {
  const [open, setOpen] = useState(null); // { subject, key } | null
  const wide = useWide();
  const tileRefs = useRef(new Map());
  const panelId = useId();
  // Key cards' shared read (one a page, as Your papers'), started only once the map is in view: it says which chapters have a deck.
  const [seenRef, seen] = useInView({ threshold: 0.05 });
  const read = useKeycardsHome({ enabled: seen && status === 'ready' });

  const close = useCallback(() => {
    setOpen((was) => {
      if (was) window.setTimeout(() => tileRefs.current.get(was.key)?.focus({ preventScroll: true }), 0);
      return null;
    });
  }, []);
  const toggle = useCallback((subject, key) => {
    setOpen((was) => (was?.key === key ? null : { subject, key }));
  }, []);

  const failed = status === 'error' || (status === 'ready' && map?.state !== 'ready');
  const subjects = status === 'ready' && map?.state === 'ready' ? map.subjects : [];
  if (status === 'ready' && !failed && !subjects.length) return null; // no subject picked: nothing to map
  const showTiles = !mapIsEmpty(map);
  const sheetSubject = open && !wide ? subjects.find((s) => s.id === open.subject) : null;
  const sheetChapter = sheetSubject ? sheetSubject.chapters.find((c) => c.key === open.key) : null;

  return (
    <section className="ins ych" aria-labelledby="ych-h" ref={seenRef}>
      <h2 id="ych-h" className="pp-h">{MAP_COPY.title}</h2>
      <p className="ins-sub">{MAP_COPY.sub}</p>
      {status === 'loading' ? <MapWait /> : failed ? (
        <p className="ins-fail" role="status">{FAILED} <button type="button" onClick={onRetry}><RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />{TRY_AGAIN}</button></p>
      ) : (
        <div className="ych-groups">
          {subjects.map((s) => (
            <SubjectGroup key={s.id} subject={s} open={open?.subject === s.id ? open.key : null} onOpen={toggle} onClose={close} tileRefs={tileRefs} wide={wide} panelId={panelId} read={read} showTiles={showTiles} />
          ))}
        </div>
      )}
      {sheetChapter ? (
        <TodaySheet open onClose={close} id={`${panelId}-sheet`} title={bookTitle(sheetChapter.title)} lede={sheetSubject.name}>
          <Detail subject={sheetSubject} chapter={sheetChapter} read={read} />
        </TodaySheet>
      ) : null}
    </section>
  );
}
