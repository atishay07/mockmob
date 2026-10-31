'use client';
// Learn home (B 3.1 and 3.2, DESIGN-SPEC A7 and A8): the place the owner's LK10 flow starts.
//   Header     "Learn"
//   Subjects   the student's own subjects as the Practice loop (lamp-lit objects)
//   Search     "Search 868 Key cards" (FEED-2 section 7): focusing it opens Find in place (FindView, scoped to the subject: the
//              shelves until the student types, then the results); Cancel returns to the chapters
//   Chapters   the subject's heading and counts, the three suggestions (the first leads, with the page's one volt key), then the
//              chapter map in book order with its sort, its live filter and the part switch, then the foot row
// Every number and line comes from GET /api/learn/subject (API-CONTRACT.md); nothing is made up here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CalendarCheck, ChevronRight, Search, TrendingUp, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openUpgrade } from '@/components/pro';
import { useLearnLinks } from '../links';
import { learnSubject, useLearnRead } from '../api';
import FindView from '../cards/FindView';
import SubjectShelf from './SubjectShelf';
import Suggestions, { SuggestionsSkeleton } from './Suggestions';
import ChapterMap, { MapError, MapSkeleton } from './ChapterMap';
import { displayTitle, subjectLine } from './homeModel.mjs';
import './learn-home.css';

const STORE_SUBJECT = 'mm:learn:subject:v1';
const STORE_FREE = 'mm:learn:free-note:v1';
const NAMES = { accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English', biology: 'Biology', political_science: 'Political Science', mathematics: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', computer_science: 'Computer Science', history: 'History', geography: 'Geography' };

const read = (key) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* it is only a convenience */ } };

/**
 * The search field under the subject row (FEED-2 section 7, in place of the Chapters | Find switch): "Search 868 Key cards".
 * Focusing it opens Find in place (the shelves until the student types, then the results); Cancel returns to the chapters.
 */
function SearchField({ count, text, open, onText, onOpen, onCancel, inputRef }) {
  return (
    <div className="lh-find" data-open={open || undefined}>
      <div className="l2f-search" role="search">
        <Search size={20} strokeWidth={2} aria-hidden="true" />
        <input ref={inputRef} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} value={text}
          onChange={(e) => onText(e.target.value)} onFocus={onOpen}
          placeholder={Number.isFinite(count) && count > 0 ? `Search ${count} Key cards` : 'Search Key cards'} aria-label={Number.isFinite(count) && count > 0 ? `Search ${count} Key cards` : 'Search Key cards'}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} />
        {text ? <button type="button" className="l2f-clear" aria-label="Clear the search" onClick={() => { onText(''); inputRef.current?.focus(); }}><X size={18} strokeWidth={2.2} aria-hidden="true" /></button> : null}
      </div>
      {open ? <button type="button" className="lh-find__cancel" onClick={onCancel}>Cancel</button> : null}
    </div>
  );
}

/** Free: one quiet line under the subject, dismissable, never a modal. */
function FreeNote({ text }) {
  const [gone, setGone] = useState(false);
  useEffect(() => { queueMicrotask(() => setGone(read(STORE_FREE) === '1')); }, []);
  if (!text || gone) return null;
  return (
    <p className="lh-free">
      <span>{text}</span>
      <button type="button" className="lh-free__link" onClick={(e) => openUpgrade({ trigger: 'learn_home', opener: e.currentTarget })}>See Pro</button>
      <button type="button" className="lh-free__x" aria-label="Dismiss" onClick={() => { write(STORE_FREE, '1'); setGone(true); }}><X size={16} strokeWidth={2.2} aria-hidden="true" /></button>
    </p>
  );
}

/** The foot row: Study plan and Your record, one tap each. In the development preview they open the preview's own views. */
function FootRow() {
  const params = useSearchParams();
  const pathname = usePathname() || '';
  const to = (view, path) => {
    if (!pathname.startsWith('/preview/')) return path;
    const next = new URLSearchParams({ view });
    for (const k of ['plan', 'data', 'decks', 'student', 'kcs', 'theme', 'study']) if (params?.get(k)) next.set(k, params.get(k));
    return `/preview/arena?${next.toString()}`;
  };
  return (
    <nav className="lh-foot" aria-label="More about your study">
      <Link className="lh-foot__link" href={to('today', '/today')}>
        <CalendarCheck className="lh-foot__icon" size={20} strokeWidth={1.9} aria-hidden="true" />
        <span className="lh-foot__text"><b>Study plan</b><span>What to do today, in order</span></span>
        <ChevronRight className="lh-foot__chev" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
      <Link className="lh-foot__link" href={to('progress', '/progress')}>
        <TrendingUp className="lh-foot__icon" size={20} strokeWidth={1.9} aria-hidden="true" />
        <span className="lh-foot__text"><b>Your record</b><span>How each subject is going</span></span>
        <ChevronRight className="lh-foot__chev" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
    </nav>
  );
}

export default function LearnHome({ subject: subjectProp = null, initialView = 'chapters', navAlt = false }) {
  const links = useLearnLinks();
  const { user } = useAuth() || {};
  const [subject, setSubject] = useState(subjectProp);
  const [view, setView] = useState(initialView === 'find' ? 'find' : 'chapters');
  const [text, setText] = useState('');
  const field = useRef(null);
  const [booted, setBooted] = useState(false);

  // The remembered subject (per device) when the link names none; the link's own subject always wins. The first read waits for it, so a
  // student who last chose Economics never sees the first subject flash by.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the remembered subject is read once after mount (no storage on the server)
    if (subjectProp) setSubject(subjectProp);
    else if (!booted) { const saved = read(STORE_SUBJECT); if (saved) setSubject(saved); }
    setBooted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectProp]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new link (Chapters or Find) resets the switch
  useEffect(() => { setView(initialView === 'find' ? 'find' : 'chapters'); }, [initialView]);

  const body = useLearnRead(() => (booted ? learnSubject(subject) : Promise.resolve(null)), [subject, booted]);
  const data = body.data;
  const active = data?.subject?.id || subject;
  const stale = body.status === 'refreshing' && data && subject && data.subject?.id !== subject;

  // The subjects loop is drawn at once from the profile; the server's own list (the student's subjects, their order) replaces it.
  const profile = useMemo(() => (user?.subjects || []).map((id) => ({ id, name: NAMES[id] || id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) })), [user?.subjects]);
  const subjects = data?.subjects?.length ? data.subjects : profile;

  const pick = useCallback((id) => {
    if (id === active) return;
    write(STORE_SUBJECT, id);
    setSubject(id);
    try { const url = new URL(window.location.href); url.searchParams.set('subject', id); window.history.replaceState(window.history.state, '', url); } catch { /* the address is only a convenience */ }
  }, [active]);

  const changeView = useCallback((next) => {
    setView(next);
    if (next !== 'find') { setText(''); field.current?.blur(); }
    try { const url = new URL(window.location.href); if (next === 'find') url.searchParams.set('lv', 'find'); else url.searchParams.delete('lv'); window.history.replaceState(window.history.state, '', url); } catch { /* the address is only a convenience */ }
  }, []);

  const ready = body.status !== 'loading' && body.status !== 'error' && data && !stale;
  const failed = body.status === 'error';

  return (
    <div className="lh" data-nav={navAlt ? 'n1' : undefined} data-view={view}>
      <header className="lh-head">
        <h1 className="lh-title">Learn</h1>
      </header>

      <SubjectShelf subjects={subjects} current={active} onPick={pick} busy={!ready && !failed} line={ready ? subjectLine(data.subject) : ''} />

      <SearchField count={data?.subject?.cards} text={text} open={view === 'find'} inputRef={field}
        onText={(v) => { setText(v); if (view !== 'find') changeView('find'); }} onOpen={() => { if (view !== 'find') changeView('find'); }} onCancel={() => changeView('chapters')} />

      <div id="lh-panel" className="lh-panel" key={view} aria-label={view === 'find' ? 'Find' : 'Chapters'} role="region">
        {view === 'find' ? (
          <FindView subject={active} text={text} box={false} />
        ) : (
          <>
            <div className="lh-subject">
              <h2 className="lh-subject__name">{displayTitle(data?.subject?.name || subjects.find((s) => s.id === active)?.name) || ' '}</h2>
              {ready ? <p className="lh-subject__line">{subjectLine(data.subject)}</p> : failed ? null : <span className="skeleton lh-sk lh-sk--line" aria-hidden="true" />}
            </div>
            {ready && data.subject?.note ? <p className="lh-note">{data.subject.note}</p> : null}
            {ready && data.plan === 'free' ? <FreeNote text={data.freeNote} /> : null}

            {failed ? (
              <MapError onRetry={body.refresh} busy={body.status === 'refreshing'} />
            ) : ready ? (
              <>
                <Suggestions suggestions={data.suggestions} links={links} subject={active} />
                <ChapterMap key={data.subject.id} parts={data.parts || []} subjectId={data.subject.id} links={links} refresh={body.refresh} />
                <FootRow />
              </>
            ) : (
              <div role="status" aria-label="Loading Learn" className="lh-loading">
                <SuggestionsSkeleton />
                <MapSkeleton />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
