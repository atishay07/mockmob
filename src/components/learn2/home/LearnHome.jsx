'use client';
// Learn home (B 3.1 and 3.2, DESIGN-SPEC A7 and A8): the place the owner's LK10 flow starts.
//   Header     "Learn" and the Chapters | Find switch (one sliding indicator); Find is FindView, scoped to the subject
//   Subjects   the student's own subjects as the Practice loop (lamp-lit objects)
//   Chapters   the subject's heading and counts, the three suggestions (the first leads, with the page's one volt key), then the
//              chapter map in book order with its sort, its live filter and the part switch, then the foot row
// Every number and line comes from GET /api/learn/subject (API-CONTRACT.md); nothing is made up here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CalendarCheck, ChevronRight, TrendingUp, X } from 'lucide-react';
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

/** The view switch: two views, one sliding indicator (N5). */
function ViewSwitch({ view, onChange }) {
  const items = [{ id: 'chapters', label: 'Chapters' }, { id: 'find', label: 'Find' }];
  const index = items.findIndex((i) => i.id === view);
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + 1) % items.length;
    onChange(items[next].id);
    e.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return (
    <div className="lh-seg" role="tablist" aria-label="Learn views" style={{ '--i': index }}>
      <span className="lh-seg__thumb" aria-hidden="true" />
      {items.map((item, i) => (
        <button key={item.id} id={`lh-tab-${item.id}`} type="button" role="tab" aria-selected={view === item.id} aria-controls="lh-panel" tabIndex={view === item.id ? 0 : -1} className="lh-seg__btn" onKeyDown={(e) => onKey(e, i)} onClick={() => onChange(item.id)}>{item.label}</button>
      ))}
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
    try { const url = new URL(window.location.href); if (next === 'find') url.searchParams.set('lv', 'find'); else url.searchParams.delete('lv'); window.history.replaceState(window.history.state, '', url); } catch { /* the address is only a convenience */ }
  }, []);

  const ready = body.status !== 'loading' && body.status !== 'error' && data && !stale;
  const failed = body.status === 'error';

  return (
    <div className="lh" data-nav={navAlt ? 'n1' : undefined} data-view={view}>
      <header className="lh-head">
        <h1 className="lh-title">Learn</h1>
        <ViewSwitch view={view} onChange={changeView} />
      </header>

      <SubjectShelf subjects={subjects} current={active} onPick={pick} busy={!ready && !failed} line={ready ? subjectLine(data.subject) : ''} />

      <div id="lh-panel" role="tabpanel" aria-labelledby={`lh-tab-${view}`} className="lh-panel" key={view}>
        {view === 'find' ? (
          <FindView subject={active} />
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
