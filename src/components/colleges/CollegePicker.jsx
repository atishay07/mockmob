"use client";
// Pick target colleges: a course first ("bcom", "B.Com", "eco"), then the colleges that teach it, each with DU's 2026
// Round 1 unreserved cutoff. Every tap saves to My colleges (the one list Today, Compass, Account and the app share)
// and shows as saved only once the server has confirmed it. Used inside onboarding (owner, 16 Oct: "Add the Colleges
// needs to be incorporated into the onboarding section") and on Account's My colleges list.
// The DU data is the static 2026 files (public/du/2026), so nothing here estimates a chance.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { loadIndex, loadOfferings, formatScore } from '@/lib/du/client';
import { duSearch } from '@/lib/du/collegeSearch.mjs';
import { effectiveCutoff } from '@/lib/du/eligibility';
import { useMyColleges } from './useMyColleges';
import { MAX_COLLEGES, entryKey, hasEntry } from '@/lib/colleges/model.mjs';
import './colleges.css';

// The courses most commerce students start from, shown before anything is typed.
const QUICK = ['b-com-hons', 'b-com', 'b-a-hons-economics', 'bachelor-of-management-studies-bms', 'b-a-hons-business-economics', 'b-a-programme'];

/** `userId`: the signed-in student. `compact`: the Account variant (no lede, fewer quick courses). `initialCourseId`: a course the student
 *  already chose (the subjects step's course search), opened here once its colleges can be listed. */
export default function CollegePicker({ userId, compact = false, initialCourseId = null }) {
  const mine = useMyColleges(userId);
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [course, setCourse] = useState(null);
  const [rows, setRows] = useState({ id: null, list: null, failed: false });
  const [filter, setFilter] = useState('');
  const listRef = useRef(null);
  const opened = useRef(null);

  useEffect(() => {
    let alive = true;
    loadIndex().then((data) => { if (alive) setIndex(data); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // Only courses DU actually offers in a college (some groups have no 2026 rows).
  const courses = useMemo(() => (index?.groups || []).filter((g) => g.offerings > 0), [index]);
  // The course asked for on arrival opens once (a student who then picks another course keeps that one).
  useEffect(() => {
    if (!initialCourseId || opened.current === initialCourseId || !courses.length) return;
    const group = courses.find((g) => g.id === initialCourseId);
    opened.current = initialCourseId;
    if (group) window.setTimeout(() => setCourse((now) => now || group), 0);
  }, [initialCourseId, courses]);
  const found = useMemo(() => {
    if (!courses.length) return [];
    if (!deferred.trim()) return QUICK.map((id) => courses.find((g) => g.id === id)).filter(Boolean).slice(0, compact ? 4 : 6);
    return duSearch(deferred, courses, (g) => g.name, { weight: (g) => g.offerings || 0 }).slice(0, 8);
  }, [courses, deferred, compact]);

  useEffect(() => {
    if (!course) return undefined;
    let alive = true;
    loadOfferings(course.id)
      .then((data) => {
        if (!alive) return;
        const urIndex = Math.max(0, (data.categories || ['UR']).indexOf('UR'));
        const list = (data.rows || []).map((r) => ({ college: r[0], programme: r[1], cut: effectiveCutoff(r[2], urIndex) }))
          .sort((a, b) => (b.cut ?? -1) - (a.cut ?? -1));
        setRows({ id: course.id, list, failed: false });
      })
      .catch(() => { if (alive) setRows({ id: course.id, list: null, failed: true }); });
    return () => { alive = false; };
  }, [course]);

  const picked = mine.status === 'ready' ? mine.colleges : [];
  const full = picked.length >= MAX_COLLEGES;
  const shownRows = rows.id === course?.id && rows.list ? (filter.trim() ? duSearch(filter, rows.list, (r) => r.college) : rows.list) : null;

  const choose = (g) => {
    setCourse(g); setFilter('');
    window.requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const toggle = (r) => {
    if (mine.busy) return;
    const entry = { programmeId: course.id, programme: r.programme, college: r.college };
    if (hasEntry(picked, entry)) mine.remove(entry);
    else if (!full) mine.add(entry);
  };

  if (failed) return <p className="mc-note" role="status">The DU course list did not load. Check your connection and reload this page.</p>;

  return (
    <div className="mc-pick" data-compact={compact || undefined}>
      {/* What is chosen so far, in order. The first is the one Today shows. */}
      <div className="mc-pick__chosen" aria-live="polite">
        <p className="mc-pick__count"><b>{mine.status === 'ready' ? picked.length : '…'}</b> of {MAX_COLLEGES} chosen{picked.length ? '. The first one shows on Today with its cutoff.' : ''}</p>
        {picked.length ? (
          <ul className="mc-pick__tags">
            {picked.map((c) => (
              <li key={entryKey(c)}>
                <span>{c.college}</span>
                <button type="button" className="mc-pick__x" aria-label={`Remove ${c.college}`} aria-disabled={mine.busy || undefined} onClick={() => { if (!mine.busy) mine.remove(c); }}><X size={15} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <label className="mc-pick__field">
        <span className="sr-only">Search a course</span>
        <Search size={18} aria-hidden="true" />
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a course, like bcom or economics" autoComplete="off" spellCheck={false} enterKeyHint="search"
          data-du-search=""
        />
      </label>

      {!index ? <div className="mc-pick__courses" aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="mc-pick__course mc-pick__course--wait" />)}</div> : (
        found.length ? (
          <div className="mc-pick__courses" role="group" aria-label={query.trim() ? 'Matching courses' : 'Popular courses'}>
            {found.map((g) => (
              <button key={g.id} type="button" className="mc-pick__course" aria-pressed={course?.id === g.id} onClick={() => choose(g)}>
                <b>{g.name}</b>
                <span>{g.colleges} {g.colleges === 1 ? 'college' : 'colleges'}</span>
              </button>
            ))}
          </div>
        ) : <p className="mc-note">No DU course matches “{query.trim()}”. Try bcom, economics or BMS.</p>
      )}

      {course ? (
        <section className="mc-pick__colleges" ref={listRef} aria-label={`Colleges for ${course.name}`}>
          <header className="mc-pick__head">
            <h3>{course.name}</h3>
            <span>2026 Round 1, unreserved</span>
          </header>
          {rows.id === course.id && rows.failed ? <p className="mc-note" role="status">These colleges did not load. <button type="button" className="mc-link" onClick={() => setCourse({ ...course })}>Try again</button></p> : null}
          {rows.id === course.id && rows.list && rows.list.length > 6 ? (
            <label className="mc-pick__field mc-pick__field--small">
              <span className="sr-only">Find a college</span>
              <Search size={16} aria-hidden="true" />
              <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a college, like SRCC" autoComplete="off" spellCheck={false} data-du-search="" />
            </label>
          ) : null}
          {!shownRows && !(rows.id === course.id && rows.failed) ? <ul className="mc-list" aria-busy="true">{[0, 1, 2].map((i) => <li key={i} className="mc-row mc-row--quiet"><span className="mc-bar" /></li>)}</ul> : null}
          {shownRows ? (
            <ul className="mc-list mc-pick__list">
              {shownRows.map((r) => {
                const on = hasEntry(picked, { programmeId: course.id, college: r.college });
                const blocked = !on && full;
                return (
                  <li key={r.college} className="mc-row">
                    <span className="mc-name"><b>{r.college}</b><span>{r.cut != null ? `${formatScore(r.cut)} of 1000` : 'No Round 1 cutoff published'}</span></span>
                    <button type="button" className="mc-add" data-on={on || undefined} aria-pressed={on} aria-disabled={blocked || mine.busy || mine.status !== 'ready' || undefined} onClick={() => { if (!blocked && mine.status === 'ready') toggle(r); }}>
                      {on ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                      <span>{on ? 'Chosen' : blocked ? 'List full' : 'Choose'}</span>
                      <span className="sr-only">{`, ${r.college}`}</span>
                    </button>
                  </li>
                );
              })}
              {!shownRows.length ? <li className="mc-row"><span className="mc-note">No college for {course.name} matches “{filter.trim()}”.</span></li> : null}
            </ul>
          ) : null}
        </section>
      ) : null}
      {mine.notice ? <p className="mc-pick__notice" role="status">{mine.notice}</p> : null}
    </div>
  );
}
