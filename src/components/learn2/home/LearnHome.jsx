'use client';
// Learn home (R2 rulings 1 to 3, LK27, LK24, LK30; was BUILD-1101 B5, A3): one start offer first, never a line of zeros.
//   Subjects   the student's own subjects as the Practice loop (compact on a phone)
//   The offer  the roadmap's headline, one line, the page's one volt key, at most two quiet "Or" rows (RoadmapHero)
//   Find       the one search field; under it the student's own sets as text keys, each drawn only when it holds cards. A key opens
//              that set in place; typing opens the results in place; Cancel returns. Focusing the field changes nothing (WCAG
//              3.2.1). The query and the open set live in the address (q, shelf), so Back returns to them. /learn/find (lv=find)
//              opens Find on its own: the offer and the roadmap step aside and the field leads.
//   Roadmap    "Your roadmap": the chapters in book order with their coverage (ChapterMap)
// Every number and line comes from ONE read, GET /api/learn/home (the /subject body plus the shelves, speed.md item 3), which the
// shell's due badge shares (learn2/api.js); nothing is made up here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLearnLinks } from '../links';
import { learnHome, useLearnRead } from '../api';
import FindView from '../cards/FindView';
import SubjectShelf from './SubjectShelf';
import ShelfKeys, { ShelfKeysSkeleton } from './ShelfKeys';
import RoadmapHero, { HeroSkeleton } from './RoadmapHero';
import FindHome from './FindHome';
import ChapterMap, { MapError, MapSkeleton } from './ChapterMap';
import { displayTitle, findHints, flatRows, nothingToPlay, setHead, shelfFromParam, subjectLine } from './homeModel.mjs';
import './learn-home.css';

const STORE_SUBJECT = 'mm:learn:subject:v1';
const STORE_RECENT = 'mm:learn:recent:v1';
const TOPBAR = 63;
const NAMES = { accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English', biology: 'Biology', political_science: 'Political Science', mathematics: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', computer_science: 'Computer Science', history: 'History', geography: 'Geography' };

const read = (key) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* it is only a convenience */ } };
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; } };
/** This subject's last five searches, kept on this device only (a convenience, never needed). */
const readRecent = (subject) => { try { const all = JSON.parse(read(STORE_RECENT) || '{}'); return Array.isArray(all[subject]) ? all[subject].filter((q) => typeof q === 'string').slice(0, 5) : []; } catch { return []; } };
const writeRecent = (subject, list) => { try { const all = JSON.parse(read(STORE_RECENT) || '{}'); all[subject] = list.slice(0, 5); write(STORE_RECENT, JSON.stringify(all)); } catch { /* it is only a convenience */ } };
const isTyping = (el) => Boolean(el) && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** True once the sentinel above the find band has scrolled under the top bar: the band is stuck, so it draws its one hairline. */
function useStuck(sentinel, active) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!active || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < TOPBAR + 1), { rootMargin: `-${TOPBAR + 1}px 0px 0px 0px`, threshold: [0, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinel, active]);
  return active && stuck;
}

/**
 * The search field (A3 3.2.3): 48 px, ink border and the soft ring on focus, a "/" hint where a keyboard is, a Clear key while there
 * is text, and a Cancel key beside it while there is text (and on a phone while it has focus, or while Find is open).
 */
function SearchField({ placeholder, text, focused, recent, finding, onText, onFocus, onBlur, onCancel, onKeyDown, onPickRecent, onClearRecent, inputRef }) {
  const [closed, setClosed] = useState(false);
  const open = focused && !text && recent.length > 0 && !closed;
  return (
    <div className="lh-find" data-active={text || focused ? '' : undefined}
      onFocus={(e) => { if (e.target === inputRef.current) setClosed(false); onFocus(e); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onBlur(e); }}
      onKeyDownCapture={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setClosed(true); inputRef.current?.focus(); } else if (e.key === 'ArrowDown' && open && e.target === inputRef.current) { e.preventDefault(); e.stopPropagation(); e.currentTarget.querySelector('.lh-recent__item')?.focus(); } }}>
      <div className="l2f-search lh-field" role="search">
        <Search size={20} strokeWidth={2} aria-hidden="true" />
        <input ref={inputRef} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} value={text}
          onChange={(e) => onText(e.target.value)} onKeyDown={onKeyDown}
          placeholder={placeholder} aria-label={placeholder} aria-keyshortcuts="/" />
        {text ? <button type="button" className="l2f-clear" aria-label="Clear the search" onClick={() => { onText(''); inputRef.current?.focus(); }}><X size={18} strokeWidth={2.2} aria-hidden="true" /></button>
          : <kbd className="lh-find__hint" aria-hidden="true">/</kbd>}
      </div>
      {text || focused || finding ? <button type="button" className="lh-find__cancel" data-empty={(!text && !finding) || undefined} onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>Cancel</button> : null}
      {open ? (
        <div className="lh-recent" role="group" aria-label="Recent searches">
          <div className="lh-recent__head"><span>Recent searches</span><button type="button" className="lh-textkey" onMouseDown={(e) => e.preventDefault()} onClick={() => { onClearRecent(); inputRef.current?.focus(); }}>Clear</button></div>
          <ul className="lh-recent__list">
            {recent.map((q) => <li key={q}><button type="button" className="lh-recent__item" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPickRecent(q); inputRef.current?.focus(); }}><Search size={16} strokeWidth={2} aria-hidden="true" /><span>{q}</span></button></li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function LearnHome({ subject: subjectProp = null, initialView = 'chapters', initialQuery = null, initialShelf = null, navAlt = false }) {
  const links = useLearnLinks();
  const { user } = useAuth() || {};
  const params = useSearchParams();
  const [subject, setSubject] = useState(subjectProp);
  const [text, setText] = useState(() => String(initialQuery ?? params?.get('q') ?? '').slice(0, 80));
  const [shelf, setShelf] = useState(() => (String(initialQuery ?? params?.get('q') ?? '').trim() ? null : shelfFromParam(initialShelf ?? params?.get('shelf'))));
  const [finding, setFinding] = useState(initialView === 'find');
  const [focused, setFocused] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [booted, setBooted] = useState(false);
  const [recent, setRecent] = useState([]);
  const field = useRef(null);
  const sentinel = useRef(null);
  const before = useRef(null); // the page's scroll before the field docked, restored on Cancel
  const fresh = useRef(false); // the next read skips the kept answer (a refresh after a change)

  // The remembered subject (per device) when the link names none; the link's own subject always wins. The first read waits for it, so a
  // student who last chose Economics never sees the first subject flash by.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the remembered subject is read once after mount (no storage on the server)
    if (subjectProp) setSubject(subjectProp);
    else if (!booted) { const saved = read(STORE_SUBJECT); if (saved) setSubject(saved); }
    setBooted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectProp]);

  // A new link to this same page (a different q or shelf from outside) replaces what is open; the student's own typing never does.
  const seen = useRef({ q: initialQuery, s: initialShelf, v: initialView });
  useEffect(() => {
    if (initialQuery !== seen.current.q) { seen.current.q = initialQuery; setText(String(initialQuery ?? '').slice(0, 80)); }
    if (initialShelf !== seen.current.s) { seen.current.s = initialShelf; setShelf(shelfFromParam(initialShelf)); }
    if (initialView !== seen.current.v) { seen.current.v = initialView; setFinding(initialView === 'find'); }
  }, [initialQuery, initialShelf, initialView]);

  // The find link (/learn/find) arrives with the field ready to type in.
  useEffect(() => { if (initialView === 'find' && !text && !shelf) field.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const home = useLearnRead(() => {
    if (!booted) return Promise.resolve(null);
    const out = learnHome(subject, { fresh: fresh.current });
    fresh.current = false;
    return out;
  }, [subject, booted]);
  const refresh = useCallback(() => { fresh.current = true; return home.refresh(); }, [home]);
  const data = home.data;
  const shelves = data?.shelves || null;
  const active = data?.subject?.id || subject;
  const stale = home.status === 'refreshing' && data && subject && data.subject?.id !== subject;

  // The subjects loop is drawn at once from the profile; the server's own list (the student's subjects, their order) replaces it.
  const profile = useMemo(() => (user?.subjects || []).map((id) => ({ id, name: NAMES[id] || id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) })), [user?.subjects]);
  // The server's list replaces the profile's only when it is a different set; the same subjects keep the order already drawn, so the
  // loop never swaps places under the student's finger when the read lands.
  const sameSet = profile.length > 0 && data?.subjects?.length === profile.length && data.subjects.every((s) => profile.some((p) => p.id === s.id));
  const subjects = sameSet ? profile.map((p) => ({ ...p, name: data.subjects.find((s) => s.id === p.id)?.name || p.name })) : data?.subjects?.length ? data.subjects : profile;
  const subjectName = displayTitle(data?.subject?.name || subjects.find((s) => s.id === active)?.name || '');

  const pick = useCallback((id) => {
    if (id === active) return;
    write(STORE_SUBJECT, id);
    setSubject(id);
    try { const url = new URL(window.location.href); url.searchParams.set('subject', id); window.history.replaceState(window.history.state, '', url); } catch { /* the address is only a convenience */ }
  }, [active]);

  // Recent searches live on this device, per subject: read when the subject is known, written when a search is acted on.
  useEffect(() => { if (active) setRecent(readRecent(active)); }, [active]); // eslint-disable-line react-hooks/set-state-in-effect -- device storage is read after mount
  const remember = useCallback(() => {
    const q = text.trim();
    if (q.length < 2 || !active) return;
    const next = [q, ...recent.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    setRecent(next);
    writeRecent(active, next);
  }, [text, active, recent]);

  const mode = text.trim() ? 'results' : shelf ? 'set' : finding ? 'find' : 'chapters';
  // The panel's own fade belongs to a swap (chapters to results and back); the first arrival keeps the offer's one load moment.
  const lastMode = useRef(mode);
  useEffect(() => { if (lastMode.current !== mode) { lastMode.current = mode; setSwapped(true); } }, [mode]);
  const stuck = useStuck(sentinel, mode !== 'chapters');

  // The address keeps what is open (q after typing settles, shelf at once), so Back from a result's chapter returns to it (A3-15).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        const q = text.trim();
        if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
        if (shelf && !q) url.searchParams.set('shelf', shelf); else url.searchParams.delete('shelf');
        if (!finding) url.searchParams.delete('lv');
        if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
      } catch { /* the address is only a convenience */ }
    }, 400);
    return () => clearTimeout(t);
  }, [text, shelf, finding]);

  // "/" focuses the search from anywhere on the page that is not a text field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      e.preventDefault();
      field.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // On a phone the field docks under the top bar when it takes focus, so the keyboard does not cover what follows.
  const dock = useCallback(() => {
    try {
      if (!window.matchMedia('(pointer: coarse)').matches) return;
      const el = field.current?.closest('.lh-find');
      if (!el) return;
      const target = el.getBoundingClientRect().top + window.scrollY - (TOPBAR + 8);
      if (target <= window.scrollY + 1) return;
      before.current = window.scrollY;
      window.scrollTo({ top: target, behavior: reduced() ? 'auto' : 'smooth' });
    } catch { /* the field simply stays where it is */ }
  }, []);

  // The panel is a new element once the chapters are back, so focus goes to it after the swap has been drawn.
  const toPanel = useCallback(() => { requestAnimationFrame(() => document.getElementById('lh-panel')?.focus({ preventScroll: true })); }, []);
  const cancel = useCallback(() => {
    const hadText = Boolean(text);
    setText('');
    setShelf(null);
    if (!hadText) setFinding(false);
    if (before.current !== null) { const top = before.current; before.current = null; window.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' }); }
    const fine = (() => { try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } })();
    if (hadText && fine) field.current?.focus(); else { field.current?.blur(); toPanel(); }
  }, [text, toPanel]);

  const onFieldKey = (e) => {
    if (e.key === 'Enter') remember();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (text || shelf || finding) cancel(); else { field.current?.blur(); toPanel(); }
    } else if (e.key === 'ArrowDown') {
      const first = document.querySelector('#lh-panel .l2c-hit-area');
      if (first) { e.preventDefault(); first.focus(); }
    }
  };

  const openShelf = useCallback((id) => { setText(''); setShelf(id); }, []);
  const backFromSet = useCallback(() => {
    const was = shelf;
    setShelf(null);
    requestAnimationFrame(() => { (document.querySelector(`[data-skey="${was}"]`) || field.current)?.focus({ preventScroll: true }); });
  }, [shelf]);
  const toRoadmap = useCallback(() => {
    const el = document.getElementById('lh-roadmap');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (TOPBAR + 8);
    window.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }, []);

  const ready = home.status !== 'loading' && home.status !== 'error' && data && !stale;
  const failed = home.status === 'error';
  const hasCards = !(ready && data.subject?.cards === 0);
  const routeRows = useMemo(() => (ready ? flatRows(data.parts || []).map(({ row }) => row).filter((row) => !nothingToPlay(row)) : []), [ready, data]);

  let keys = null;
  if (hasCards && mode !== 'find') {
    // A read for another subject keeps the old numbers on hand; they are never drawn under the new subject's name.
    if (ready && shelves) keys = <ShelfKeys shelves={shelves} subjectName={subjectName} selected={shelf} onSelect={(id) => (id ? openShelf(id) : backFromSet())} />;
    else if (!ready && !failed) keys = <ShelfKeysSkeleton />;
  }

  const panelName = mode === 'results' ? 'Results' : mode === 'set' ? setHead(shelf, {}).title : mode === 'find' ? 'Find' : 'Your roadmap';
  const offer = mode === 'chapters' ? (ready ? <RoadmapHero roadmap={data.roadmap} links={links} rows={routeRows} onRoute={toRoadmap} /> : failed ? null : <HeroSkeleton />) : null;
  const hint = findHints(active)[0];
  const placeholder = hint ? `Find a topic, like ${hint}` : 'Find a chapter or topic';

  return (
    <div className="lh" data-nav={navAlt ? 'n1' : undefined} data-panel={mode}>
      <header className="lh-head">
        <h1 className="lh-title">{mode === 'chapters' ? 'Learn' : 'Find'}</h1>
      </header>

      {mode === 'find' || mode === 'results' ? null : (
        <SubjectShelf subjects={subjects} current={active} onPick={pick} busy={!ready && !failed} line={ready ? subjectLine(data.subject) : ''} dues={shelves?.due?.bySubject || null} />
      )}
      <h2 className="lh-sr">{subjectName}</h2>

      {offer}

      <span className="lh-sentinel" ref={sentinel} aria-hidden="true" />
      <div className="lh-findband" data-stuck={stuck || undefined}>
        <SearchField placeholder={placeholder} text={text} focused={focused} inputRef={field} recent={recent} finding={finding}
          onPickRecent={(q) => setText(q)} onClearRecent={() => { setRecent([]); if (active) writeRecent(active, []); }}
          onText={(v) => { setText(v); if (v && shelf) setShelf(null); }}
          onFocus={() => { setFocused(true); dock(); }} onBlur={() => setFocused(false)} onCancel={cancel} onKeyDown={onFieldKey} />
        {keys}
      </div>

      {ready && data.subject?.note && mode === 'chapters' ? <p className="lh-note">{data.subject.note}</p> : null}

      <div id="lh-panel" className="lh-panel" key={mode} data-swap={swapped || undefined} tabIndex={-1} onClickCapture={(e) => { if (mode === 'results' && e.target.closest?.('a')) remember(); }} aria-label={panelName} role="region">
        {mode === 'results' || mode === 'set' ? (
          <FindView subject={active} text={text} shelf={shelf} shelves={shelves} onShelf={openShelf} onBack={backFromSet} />
        ) : failed ? (
          <MapError onRetry={home.refresh} busy={home.status === 'refreshing'} />
        ) : !ready ? (
          <div role="status" aria-label="Loading Learn" className="lh-loading"><MapSkeleton /></div>
        ) : mode === 'find' ? (
          <FindHome subject={active} shelves={shelves} onShelf={openShelf} onSearch={(w) => { setText(w); field.current?.focus({ preventScroll: true }); }} />
        ) : (
          <ChapterMap key={data.subject.id} id="lh-roadmap" parts={data.parts || []} subjectId={data.subject.id} links={links} refresh={refresh}
            isPro={data.plan === 'pro'} position={data.roadmap?.position?.chapterKey || null} isNew={data.roadmap?.mode === 'new'} />
        )}
      </div>
    </div>
  );
}
