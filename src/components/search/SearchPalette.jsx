"use client";

// Search, the one place to jump anywhere in the signed-in website (lane palette, 18 Nov 2026).
//
// A native modal <dialog> (the page behind is inert and holds still, html:has(.srch[open]) in search.css), holding one panel:
// the input (a combobox: focus stays in it, aria-activedescendant names the active row), a hairline, the results grouped as
// Go to, Start, Chapters and Colleges and courses (src/lib/search/searchModel.mjs ranks them), and on desktop a foot of key
// hints. Desktop: a centred 640 px dialog 14vh from the top over a dim scrim. Below 900 px: a full-height sheet from the top
// with a Close key at the input's right.
//
// Keys: the arrows move the active row (wrapping), Enter runs it, Escape closes, Tab goes through the active row's own links
// (Key cards, Learn) and back to the input; focus returns to whatever opened Search. A pointer over a row makes it active, a
// click runs it. Nothing is asked of the server while typing: the pages and actions come from the shell, the chapters from the
// syllabus module and the colleges from a small static index, both imported the first time the panel opens.
//
// Motion (exact, from the brief): the scrim fades in over 160 ms; the panel fades in over 160 ms while rising 8 px
// (cubic-bezier(0.23, 1, 0.32, 1)); it leaves in 120 ms, a fade only. The active row's background moves with no transition.
// Reduced motion: no rise, 1 ms fades.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { AppIcon } from '@/components/ui/Glyph';
import { BrandIcon, MobiMark } from '@/components/brand/BrandIcon';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { flatRows, moveActive, nothingLine, prepare, searchResults, titleParts } from '@/lib/search/searchModel.mjs';
import { EMPTY_GOTO, chapterItems, collegeItems, emptyStartIds, runMode } from '@/lib/search/searchSources.mjs';
import './search.css';

export const OPEN_MS = 160;
export const CLOSE_MS = 120;
export const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const RISE_PX = 8;

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
  const closing = useRef(false);
  const leaving = useRef(false);
  const byKeys = useRef(false);
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const listId = `srch-list-${ids}`;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState(() => extra.value);
  const touch = useSyncExternalStore(noSubscription, touchNow, () => false);

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
  const empty = useMemo(() => ({ goto: EMPTY_GOTO, start: emptyStartIds(userSubjects) }), [userSubjects]);
  const results = useMemo(() => searchResults(query, sources, { empty }), [query, sources, empty]);
  const rows = useMemo(() => flatRows(results), [results]);
  const activeIndex = rows.length ? Math.min(active, rows.length - 1) : -1;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;
  const optionId = (i) => `${listId}-o${i}`;
  const typed = query.trim().length > 0;
  // While the chapters and colleges are still arriving, an unmatched query says nothing yet, never a false "Nothing matches".
  const nothing = typed && rows.length === 0 && Boolean(data);

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
    const duration = reducedMotion() ? 1 : CLOSE_MS;
    const parts = [el.querySelector('.srch-scrim'), el.querySelector('.srch-panel')].filter(Boolean);
    Promise.all(parts.map((part) => part.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: EASE, fill: 'forwards' }).finished))
      .catch(() => {})
      .finally(finish);
  }, [onClosed]);

  // Opens as a modal when mounted, with the caret in the input; focus goes back to the opener when it has left.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    closing.current = false;
    el.dataset.state = 'open';
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    input.current?.focus({ preventScroll: true });
    if (typeof el.animate === 'function') {
      const reduced = reducedMotion();
      const duration = reduced ? 1 : OPEN_MS;
      el.querySelector('.srch-scrim')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE });
      el.querySelector('.srch-panel')?.animate(reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: `translate3d(0, ${RISE_PX}px, 0)` }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }], { duration, easing: EASE });
    }
    return () => {
      const back = opener();
      if (!leaving.current && back?.isConnected && back.getClientRects().length) back.focus({ preventScroll: true });
    };
  // Read once, as the panel opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onKeyDown = (event) => {
    const el = dialog.current;
    if (!el) return;
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') { event.preventDefault(); return; }
    if (event.key === 'Tab') {
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
        <div className="srch-head">
          <Search className="srch-head__icon" size={20} strokeWidth={2} aria-hidden="true" />
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
            placeholder="Search pages, chapters and colleges"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); if (list.current) list.current.scrollTop = 0; }}
          />
          <button type="button" className="srch-close mk-press" onClick={() => requestClose()}>Close</button>
        </div>

        <div ref={list} className="srch-list" id={listId} role="listbox" aria-label="Results">
          {results.map((group, g) => (
            <div key={group.id} className="srch-group" role="group" aria-labelledby={`${listId}-${group.id}`}>
              <div id={`${listId}-${group.id}`} className="srch-group__label" role="presentation">{group.label}</div>
              {group.rows.map((row, j) => {
                const i = starts[g] + j;
                const on = i === activeIndex;
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
                    data-kind={row.kind}
                    onPointerMove={() => { if (!on) setActive(i); }}
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
                        {on ? <span className="srch-row__enter" aria-hidden="true">{row.enter}</span> : null}
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
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </dialog>
  );
}
