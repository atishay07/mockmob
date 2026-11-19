"use client";

// Search, the one place to jump anywhere in the signed-in website (lane palette, 18 Nov 2026; Spotlight form, 20 Nov).
//
// A native modal <dialog> (the page behind is inert and holds still: html[data-search-open] in search.css, set while the panel is
// drawn), holding one panel: the input (a combobox: focus stays in it, aria-activedescendant names the active row), a hairline,
// the results grouped as Go to, Start, Chapters and Colleges and courses (src/lib/search/searchModel.mjs ranks them), and on
// desktop a foot of key hints.
// Desktop (768 px and wider), after Apple's Spotlight (owner, 20 Nov): one large glass bar, min(640px, 92vw) wide, its top at about
// 18% of the window, that grows as results arrive; the empty query offers six suggestions; the first result is the top hit (a
// taller row with the Enter cap), and when its name begins with what was typed, the rest of the name shows in muted text after
// the caret and Tab takes it. Below 768 px: today's full-height sheet from the top with a Close key at the input's right.
//
// Keys: the arrows move the active row (wrapping) and keep it in view, Enter runs it, Escape closes, Tab takes the completion or
// goes through the active row's own links (Key cards, Learn) and back to the input; focus returns to whatever opened Search. A
// pointer that really moves over a row makes it active (a list that shifts under a resting pointer never takes the selection),
// a click runs it. Nothing is asked of the server while typing: the pages and actions come from the shell, the chapters from the
// syllabus module and the colleges from a small static index, both imported the first time the panel opens.
//
// Motion (WAAPI here; search.css has none). Desktop: the panel opens in 140 ms (opacity, and scale from 0.98) and closes in
// 100 ms; the scrim fades with it; when the results change, the glass follows the new height in 160 ms (a scaleY on the glass
// layer and a clip on the content, measured once per change by a ResizeObserver, never layout per frame). The phone sheet keeps
// its own: 160 ms in while rising 8 px, a 120 ms fade out. One curve, cubic-bezier(0.23, 1, 0.32, 1). Reduced motion: no scale,
// no rise, no resize motion, 1 ms fades.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { AppIcon } from '@/components/ui/Glyph';
import { BrandIcon, MobiMark } from '@/components/brand/BrandIcon';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { EMPTY_LIMIT, completionFor, flatRows, moveActive, nothingLine, prepare, searchKeyAction, searchResults, searchShortcut, titleParts } from '@/lib/search/searchModel.mjs';
import { EMPTY_GOTO, SEARCH_INTRO, chapterItems, collegeItems, emptyStartIds, runMode } from '@/lib/search/searchSources.mjs';
import { macNow } from './SearchButtons';
import { setSearchCloser } from './searchStore';
import './search.css';

// The phone sheet's motion (unchanged since 18 Nov).
export const OPEN_MS = 160;
export const CLOSE_MS = 120;
export const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const RISE_PX = 8;
// The desktop panel's motion (20 Nov, Spotlight form).
export const DESK_OPEN_MS = 140;
export const DESK_CLOSE_MS = 100;
export const DESK_SCALE = 0.98;
export const RESIZE_MS = 160;

// The first-use intro (19 Nov 2026): the first time Search opens on a device, one short note sits under the input, part of the
// panel's own surface (no pop-up of its own, no scrim). It never takes focus from the input; it leaves on the first typed
// character or on its Got it key (a 160 ms fade) and never returns: it is marked seen as it shows, in this device's storage
// (a private window, where storage is refused, simply shows it again).
export const INTRO_KEY = 'mm:search-intro:v1';
export const INTRO_FADE_MS = 160;
function introSeen() {
  try { return window.localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; }
}
function markIntroSeen() {
  try { window.localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage refused: it shows again next time */ }
}

const FOCUSABLE = 'input:not([disabled]), a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

// The chapters (the syllabus module) and the colleges (the static index), read once per page load, the first time the panel
// opens. A failed read is forgotten, so the next open tries again; pages and actions work meanwhile.
const extra = { value: null, promise: null };
function loadExtra() {
  if (extra.value) return Promise.resolve(extra.value);
  extra.promise ??= Promise.all([import('@/../data/cuet_syllabus.js'), import('@/lib/search/searchIndex.json')])
    .then(([syllabus, index]) => {
      const data = index.default || index;
      extra.value = { chapters: syllabus.CHAPTERS, index: data, decks: new Set(data.decks || []) };
      return extra.value;
    })
    .catch((error) => { extra.promise = null; throw error; });
  return extra.promise;
}

// A pointer that cannot hover (a phone, a tablet): it cannot make a row active without running it, so every chapter row shows its
// Key cards and Learn links, not only the active one. Read after mount; the server and the first render draw the desktop rows.
const noSubscription = () => () => {};
const touchNow = () => { try { return !window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// The desktop panel (768 px and wider), followed live, so a window resized across it redraws the right form.
const DESK_QUERY = '(min-width: 768px)';
const deskNow = () => { try { return window.matchMedia(DESK_QUERY).matches; } catch { return true; } };
const deskSubscribe = (fn) => {
  try {
    const mq = window.matchMedia(DESK_QUERY);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  } catch { return () => {}; }
};

function RowIcon({ row }) {
  if (row.subject) return <SubjectObject id={row.subject} size={20} framed={false} className="srch-row__obj" />;
  if (row.icon === 'mobi') return <MobiMark size={20} />;
  if (String(row.icon || '').startsWith('brand:')) return <BrandIcon name={row.icon.slice(6)} size={20} />;
  return <AppIcon name={row.icon} size={20} />;
}

function Title({ row }) {
  return (
    <span className="srch-row__title">
      {titleParts(row.title, row.ranges).map((part, i) => (part.hit ? <b key={i}>{part.text}</b> : <span key={i}>{part.text}</span>))}
    </span>
  );
}

/**
 * pages, actions: prepared-ready items (searchSources pageItems / startItems). userSubjects: the student's subjects (their
 * chapters lead). linkFor: the address drawn for where the student is (the preview keeps its fixtures). path: the route the
 * shell draws now. opener: () => the element to give focus back to. onClosed: called once the panel has left.
 */
export default function SearchPalette({ pages = [], actions = [], userSubjects = [], learn2 = false, path = '', linkFor = (h) => h, opener = () => null, onClosed = () => {} }) {
  const router = useRouter();
  const dialog = useRef(null);
  const input = useRef(null);
  const list = useRef(null);
  const body = useRef(null);
  const glass = useRef(null);
  const ghost = useRef(null);
  const closing = useRef(false);
  const leaving = useRef(false);
  const byKeys = useRef(false);
  const pointerAt = useRef(null);
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const listId = `srch-list-${ids}`;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState(() => extra.value);
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  const [composing, setComposing] = useState(false);
  const [ghostFits, setGhostFits] = useState(true);
  const touch = useSyncExternalStore(noSubscription, touchNow, () => false);
  const mac = useSyncExternalStore(noSubscription, macNow, () => false);
  const desk = useSyncExternalStore(deskSubscribe, deskNow, () => true);
  const shortcut = searchShortcut({ mac });
  const introId = `srch-intro-${ids}`;
  const introRef = useRef(null);
  const [intro, setIntro] = useState(() => !introSeen());
  useEffect(() => { if (intro) markIntroSeen(); }, [intro]);
  const dismissIntro = useCallback(() => {
    const el = introRef.current;
    if (!el || el.dataset.leaving) return;
    el.dataset.leaving = '1';
    if (typeof el.animate !== 'function') { setIntro(false); return; }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion() ? 1 : INTRO_FADE_MS, easing: EASE, fill: 'forwards' })
      .finished.catch(() => {}).finally(() => setIntro(false));
  }, []);

  useEffect(() => {
    let alive = true;
    if (!data) loadExtra().then((value) => { if (alive) setData(value); }, () => {});
    return () => { alive = false; };
  }, [data]);

  const sources = useMemo(() => ({
    goto: pages.map(prepare),
    start: actions.map(prepare),
    chapters: data ? chapterItems(data.chapters, { userSubjects, decks: data.decks, learn2 }).map(prepare) : [],
    colleges: data ? collegeItems(data.index).map(prepare) : [],
  }), [pages, actions, data, userSubjects, learn2]);
  // The desktop panel suggests six for the empty query; the phone sheet keeps its fuller lists.
  const empty = useMemo(() => ({ goto: EMPTY_GOTO, start: emptyStartIds(userSubjects), limit: desk ? EMPTY_LIMIT : 0 }), [userSubjects, desk]);
  const results = useMemo(() => searchResults(query, sources, { empty }), [query, sources, empty]);
  const rows = useMemo(() => flatRows(results), [results]);
  const activeIndex = rows.length ? Math.min(active, rows.length - 1) : -1;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;
  const optionId = (i) => `${listId}-o${i}`;
  const typed = query.trim().length > 0;
  // While the chapters and colleges are still arriving, an unmatched query says nothing yet, never a false "Nothing matches".
  const nothing = typed && rows.length === 0 && Boolean(data);
  // The top hit (desktop): the first result of a typed query. Its completion shows only with the caret at the end of the field,
  // outside composition, on a desktop with a fine pointer, and only while the whole name fits in the field.
  const topHit = typed && rows.length ? rows[0] : null;
  const completion = topHit && desk && !touch && !composing && caretAtEnd ? completionFor(query, topHit.title) : '';
  const showGhost = Boolean(completion) && ghostFits;

  // Measured once per change (never per frame): the typed text must not already scroll the field, and the ghost must fit.
  useLayoutEffect(() => {
    if (!completion) return;
    const field = input.current;
    const g = ghost.current;
    const fits = Boolean(field && g) && field.scrollWidth <= field.clientWidth && g.scrollWidth <= g.clientWidth;
    setGhostFits((was) => (was === fits ? was : fits));
  }, [completion, query]);

  const requestClose = useCallback(({ navigating = false } = {}) => {
    const el = dialog.current;
    if (!el || closing.current) return;
    closing.current = true;
    leaving.current = navigating;
    el.dataset.state = 'closing';
    const finish = () => {
      if (el.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
      onClosed();
    };
    if (typeof el.animate !== 'function') { finish(); return; }
    const reduced = reducedMotion();
    const isDesk = deskNow();
    const duration = reduced ? 1 : (isDesk ? DESK_CLOSE_MS : CLOSE_MS);
    const scrim = el.querySelector('.srch-scrim');
    const panel = el.querySelector('.srch-panel');
    const parts = [
      scrim?.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: EASE, fill: 'forwards' }),
      panel?.animate(isDesk && !reduced
        ? [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `scale(${DESK_SCALE})` }]
        : [{ opacity: 1 }, { opacity: 0 }], { duration, easing: EASE, fill: 'forwards' }),
    ].filter(Boolean);
    Promise.all(parts.map((a) => a.finished)).catch(() => {}).finally(finish);
  }, [onClosed]);

  // A key the host hears (Shift tapped twice) closes the panel the way Escape does.
  useEffect(() => setSearchCloser(() => requestClose()), [requestClose]);

  // Opens as a modal when mounted, with the caret in the input; focus goes back to the opener when it has left. The page under
  // it holds still (html[data-search-open], one attribute instead of a :has() over the whole document).
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    closing.current = false;
    el.dataset.state = 'open';
    const root = document.documentElement;
    root.setAttribute('data-search-open', '');
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    input.current?.focus({ preventScroll: true });
    if (typeof el.animate === 'function') {
      const reduced = reducedMotion();
      const isDesk = deskNow();
      const duration = reduced ? 1 : (isDesk ? DESK_OPEN_MS : OPEN_MS);
      el.querySelector('.srch-scrim')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE });
      let frames = [{ opacity: 0 }, { opacity: 1 }];
      if (!reduced && isDesk) frames = [{ opacity: 0, transform: `scale(${DESK_SCALE})` }, { opacity: 1, transform: 'scale(1)' }];
      else if (!reduced) frames = [{ opacity: 0, transform: `translate3d(0, ${RISE_PX}px, 0)` }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }];
      el.querySelector('.srch-panel')?.animate(frames, { duration, easing: EASE });
    }
    return () => {
      root.removeAttribute('data-search-open');
      const back = opener();
      if (!leaving.current && back?.isConnected && back.getClientRects().length) back.focus({ preventScroll: true });
    };
  // Read once, as the panel opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The glass follows the panel's height as results change (desktop): a ResizeObserver hands over each new height once; the
  // glass layer scales from the height it shows now to the new one, and the content is clipped to the glass while it grows.
  // Transform and clip only, never a layout per frame. The first height (the open) and reduced motion get none.
  useEffect(() => {
    const content = body.current;
    const layer = glass.current;
    if (!content || !layer || typeof ResizeObserver !== 'function') return undefined;
    let last = 0;
    let anims = [];
    const ro = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1];
      const next = box.borderBoxSize?.[0]?.blockSize ?? box.contentRect.height;
      const prev = last;
      last = next;
      if (!prev || Math.abs(next - prev) < 2 || !deskNow() || reducedMotion() || closing.current || typeof layer.animate !== 'function') return;
      // From what shows now: mid-way through a change, the glass's current scale.
      let shown = prev;
      if (anims.some((a) => a.playState === 'running')) {
        try { shown = prev * new DOMMatrixReadOnly(getComputedStyle(layer).transform).d; } catch { /* keep prev */ }
      }
      anims.forEach((a) => a.cancel());
      const timing = { duration: RESIZE_MS, easing: EASE };
      anims = [layer.animate([{ transform: `scaleY(${shown / next})` }, { transform: 'scaleY(1)' }], timing)];
      if (next > shown) anims.push(content.animate([{ clipPath: `inset(0 0 ${next - shown}px 0)` }, { clipPath: 'inset(0 0 0 0)' }], timing));
    });
    ro.observe(content);
    return () => { ro.disconnect(); anims.forEach((a) => a.cancel()); };
  }, []);

  // Escape (the dialog's cancel, animated) and a native close.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    const onCancel = (event) => { event.preventDefault(); requestClose(); };
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClosed(); } };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    return () => { el.removeEventListener('cancel', onCancel); el.removeEventListener('close', onNativeClose); };
  }, [requestClose, onClosed]);

  // The active row stays in view when the keys move it (a pointer moving it is already where the student looks).
  useEffect(() => {
    if (!byKeys.current || activeIndex < 0) return;
    byKeys.current = false;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  // optionId is derived from listId, which never changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Runs a row (searchSources runMode): this very address only closes the panel, so focus goes back to its opener; a course
  // while Colleges is open loads Colleges afresh (it reads ?course= only as it loads); everything else is a soft navigation.
  const go = (row) => {
    if (!row?.href || closing.current) return;
    const target = linkFor(row.href);
    const mode = runMode({ kind: row.kind, href: row.href, target, path, current: `${window.location.pathname}${window.location.search}` });
    if (mode === 'stay') { requestClose(); return; }
    requestClose({ navigating: true });
    if (mode === 'reload') window.location.assign(target);
    else router.push(target);
  };

  const readCaret = (field) => {
    const end = field.value.length;
    setCaretAtEnd(field.selectionStart === end && field.selectionEnd === end);
  };

  const onKeyDown = (event) => {
    const el = dialog.current;
    if (!el) return;
    // Ctrl+Space (Windows, Linux) closes it with the press that opened it; the host's window listener sees it handled.
    if (searchKeyAction({ key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey, repeat: event.repeat, isComposing: event.nativeEvent?.isComposing }, { open: true, mac: macNow() }) === 'close') {
      event.preventDefault();
      requestClose();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') { event.preventDefault(); return; }
    if (event.key === 'Tab') {
      // Tab takes the completion: the field becomes the top hit's whole name.
      if (!event.shiftKey && showGhost && event.target === input.current) {
        event.preventDefault();
        setQuery(topHit.title);
        setActive(0);
        return;
      }
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0 && n.tabIndex >= 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const now = document.activeElement;
      if (event.shiftKey && (now === first || !el.contains(now))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (now === last || !el.contains(now))) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!rows.length) return;
      event.preventDefault();
      byKeys.current = true;
      setActive(moveActive(activeIndex, event.key === 'ArrowDown' ? 1 : -1, rows.length));
      if (event.target !== input.current) input.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key === 'Enter' && event.target === input.current) {
      if (event.isComposing) return;
      event.preventDefault();
      if (activeRow) go(activeRow);
    }
  };

  const onScrimClick = () => requestClose();

  // Each group's first row's place in the whole list (the arrow keys walk the groups as one list).
  const starts = results.map((_, g) => results.slice(0, g).reduce((n, group) => n + group.rows.length, 0));
  return (
    <dialog ref={dialog} className="srch" aria-label="Search" onKeyDown={onKeyDown}>
      <div className="srch-scrim" aria-hidden="true" onClick={onScrimClick} />
      <div className="srch-panel">
        <div ref={glass} className="srch-glass" aria-hidden="true" />
        <div ref={body} className="srch-body">
          <div className="srch-head">
            <Search className="srch-head__icon" size={20} strokeWidth={2} aria-hidden="true" />
            <div className="srch-entry">
              <input
                ref={input}
                className="srch-input"
                type="text"
                inputMode="search"
                enterKeyHint="go"
                role="combobox"
                aria-label="Search pages, chapters and colleges"
                aria-expanded={rows.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                aria-describedby={intro ? introId : undefined}
                placeholder="Search pages, chapters and colleges"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActive(0); readCaret(event.target); if (list.current) list.current.scrollTop = 0; if (intro && event.target.value) dismissIntro(); }}
                onSelect={(event) => readCaret(event.currentTarget)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
              />
              {/* The completion: decoration over the field (the typed part drawn invisibly so the rest lands after it). */}
              {completion ? (
                <span ref={ghost} className="srch-ghost" aria-hidden="true" data-fits={showGhost ? 'true' : 'false'}>
                  <span className="srch-ghost__typed">{query}</span>{completion}
                </span>
              ) : null}
            </div>
            <button type="button" className="srch-esc" tabIndex={-1} aria-label="Close" onClick={() => requestClose()}><kbd>Esc</kbd></button>
            <button type="button" className="srch-close mk-press" onClick={() => requestClose()}>Close</button>
          </div>

          {intro ? (
            <div ref={introRef} className="srch-intro" id={introId}>
              {touch ? (
                <div className="srch-intro__text">
                  <p className="srch-intro__title">{SEARCH_INTRO.title}</p>
                  <p className="srch-intro__line">{SEARCH_INTRO.line}</p>
                </div>
              ) : (
                // One quiet line on a desktop: what Search is, and its key in words for this device.
                <p className="srch-intro__one"><b>{SEARCH_INTRO.title}</b> {shortcut.line}</p>
              )}
              <button
                type="button"
                className="srch-intro__ok mk-press"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { dismissIntro(); input.current?.focus({ preventScroll: true }); }}
              >
                Got it
              </button>
            </div>
          ) : null}

          <div ref={list} className="srch-list" id={listId} role="listbox" aria-label="Results">
            {results.map((group, g) => (
              <div key={group.id} className="srch-group" role="group" aria-labelledby={`${listId}-${group.id}`}>
                <div id={`${listId}-${group.id}`} className="srch-group__label" role="presentation">{group.label}</div>
                {group.rows.map((row, j) => {
                  const i = starts[g] + j;
                  const on = i === activeIndex;
                  const top = Boolean(topHit) && i === 0;
                  const links = row.kind === 'chapter' && (on || touch) ? [row.cardsHref && { label: 'Key cards', href: row.cardsHref }, row.learnHref && { label: 'Learn', href: row.learnHref }].filter(Boolean) : [];
                  return (
                    <div
                      key={row.id}
                      id={optionId(i)}
                      className="srch-row"
                      role="option"
                      aria-selected={on}
                      aria-label={row.hint ? `${row.title}, ${row.hint}` : row.title}
                      data-active={on || undefined}
                      data-top={top || undefined}
                      data-hint={row.hint ? '' : undefined}
                      data-kind={row.kind}
                      // Only a pointer that really moved: a list that shifts or scrolls under a resting pointer sends moves at the
                      // same place (and the first move the panel hears is only remembered).
                      onPointerMove={(event) => {
                        const at = pointerAt.current;
                        pointerAt.current = { x: event.clientX, y: event.clientY };
                        if (on || !at || (at.x === event.clientX && at.y === event.clientY)) return;
                        setActive(i);
                      }}
                      onClick={() => go(row)}
                    >
                      <span className="srch-row__icon" aria-hidden="true"><RowIcon row={row} /></span>
                      <span className="srch-row__text">
                        <Title row={row} />
                        {row.hint ? <span className="srch-row__hint">{row.hint}</span> : null}
                      </span>
                      {links.length || on ? (
                        <span className="srch-row__end">
                          {links.map((link) => (
                            <Link
                              key={link.label}
                              className="srch-row__link"
                              href={linkFor(link.href)}
                              tabIndex={on ? 0 : -1}
                              onClick={(event) => { event.stopPropagation(); requestClose({ navigating: true }); }}
                            >
                              {link.label}
                            </Link>
                          ))}
                          {on ? <span className="srch-row__enter" aria-hidden="true">{row.enter}<kbd>Enter</kbd></span> : null}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
            {nothing ? <p className="srch-none">{nothingLine(query)}</p> : null}
          </div>
          <p className="sr-only" role="status" aria-live="polite">{typed ? (rows.length ? `${rows.length} ${rows.length === 1 ? 'result' : 'results'}` : nothing ? nothingLine(query) : '') : ''}</p>

          <div className="srch-foot" aria-hidden="true">
            <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
            <span><kbd>Enter</kbd> to open</span>
            {showGhost ? <span><kbd>Tab</kbd> to complete</span> : null}
            <span><kbd>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
