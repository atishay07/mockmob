"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';
import { EmptyState, ErrorState, SkeletonLines } from '@/components/ui/Skeleton';
import { QuestionCard } from './QuestionCard';
import { appendUniqueQuestions, chapterGroups } from '@/../data/explore_feed';

const PAGE_SIZE = 12;
const EMPTY_PAGE = { questions: [], nextOffset: 0, hasMore: false, state: 'idle', error: null };

export function DiscoveryFeed() {
  const [subjects, setSubjects] = useState([]);
  const [subjectState, setSubjectState] = useState('loading');
  const [subjectRetry, setSubjectRetry] = useState(0);
  const [filters, setFilters] = useState({ subject: '', chapter: '', difficulty: '' });
  const [chapters, setChapters] = useState([]);
  const [chapterState, setChapterState] = useState('idle');
  const [chapterRetry, setChapterRetry] = useState(0);
  const [page, setPage] = useState(EMPTY_PAGE);
  const [summary, setSummary] = useState(null);
  const request = useRef({ sequence: 0, controller: null });
  const summaryRequest = useRef({ sequence: 0, controller: null });
  const moreButton = useRef(null);
  const endStatus = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error('subjects_unavailable');
      const available = data.filter((subject) => subject.practice !== 'merged' && !subject.mergedInto);
      setSubjects(available);
      setFilters((current) => current.subject ? current : { ...current, subject: available.find((s) => s.id === 'accountancy')?.id || available[0]?.id || '' });
      setSubjectState('ready');
    }).catch((error) => { if (error.name !== 'AbortError') setSubjectState('error'); });
    return () => controller.abort();
  }, [subjectRetry]);

  useEffect(() => {
    if (!filters.subject) return;
    const controller = new AbortController();
    fetch(`/api/chapters?subject=${encodeURIComponent(filters.subject)}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error('chapters_unavailable');
      setChapters(chapterGroups(data));
      setChapterState('ready');
    }).catch((error) => { if (error.name !== 'AbortError') setChapterState('error'); });
    return () => controller.abort();
  }, [filters.subject, chapterRetry]);

  const loadPage = useCallback(async (offset = 0, reset = false) => {
    if (!filters.subject) return;
    request.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++request.current.sequence;
    request.current.controller = controller;
    setPage((current) => ({ ...(reset ? EMPTY_PAGE : current), state: 'loading', error: null }));
    const query = new URLSearchParams({ subject: filters.subject, limit: String(PAGE_SIZE), offset: String(offset) });
    if (filters.chapter) query.set('chapter', filters.chapter);
    if (filters.difficulty) query.set('difficulty', filters.difficulty);
    try {
      const response = await fetch(`/api/questions/feed?${query}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.questions)) throw new Error('feed_unavailable');
      if (sequence !== request.current.sequence) return;
      // The server advances across raw rows before evidence quarantine, even for a held page.
      const nextOffset = Number.isFinite(data.nextOffset) ? data.nextOffset : offset + PAGE_SIZE;
      const hasMore = Boolean(data.hasMore && nextOffset > offset);
      const finishesFocusedControl = !reset && !hasMore && document.activeElement === moreButton.current;
      setPage((current) => ({ questions: appendUniqueQuestions(reset ? [] : current.questions, data.questions), nextOffset, hasMore, state: 'ready', error: null }));
      if (finishesFocusedControl) requestAnimationFrame(() => { if (document.activeElement === document.body) endStatus.current?.focus({ preventScroll: true }); });
    } catch (error) {
      if (error.name !== 'AbortError' && sequence === request.current.sequence) setPage((current) => ({ ...current, state: 'error', error: { offset, reset } }));
    }
  }, [filters]);

  useEffect(() => {
    let active = true;
    const currentRequest = request.current;
    queueMicrotask(() => { if (active) loadPage(0, true); });
    return () => { active = false; currentRequest.sequence += 1; currentRequest.controller?.abort(); };
  }, [loadPage]);

  const refreshSummary = useCallback(() => {
    if (!filters.subject) return;
    summaryRequest.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++summaryRequest.current.sequence;
    summaryRequest.current.controller = controller;
    fetch(`/api/learning/summary?subject=${encodeURIComponent(filters.subject)}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (response.ok && sequence === summaryRequest.current.sequence) setSummary({ subject: filters.subject, data });
    }).catch(() => {});
    return controller;
  }, [filters.subject]);
  useEffect(() => { const currentRequest = summaryRequest.current; refreshSummary(); return () => { currentRequest.sequence += 1; currentRequest.controller?.abort(); }; }, [refreshSummary]);

  const subjectName = subjects.find((subject) => subject.id === filters.subject)?.name || 'your subject';
  const busy = page.state === 'loading';
  const hasFilters = Boolean(filters.chapter || filters.difficulty);
  const solved = summary?.subject === filters.subject ? summary.data?.solvedTotal : null;

  return (
    <div className="ex-page">
      <ArenaHead eyebrow="Explore · untimed practice" title="One question. One useful step." lede="Try it, check the reasoning, save what needs another go. This is practice, separate from your timed mock score." />
      <div className="ex-layout">
        <div className="ex-main">
          <form className="ex-filters" aria-label="Filter practice questions" onSubmit={(event) => event.preventDefault()}>
            <label>Subject<select value={filters.subject} disabled={subjectState !== 'ready'} onChange={(event) => { setChapterState('loading'); setChapters([]); setFilters({ subject: event.target.value, chapter: '', difficulty: '' }); }}><option value="" disabled>{subjectState === 'loading' ? 'Loading subjects…' : 'Choose a subject'}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label>Chapter<select value={filters.chapter} disabled={chapterState !== 'ready'} onChange={(event) => setFilters((current) => ({ ...current, chapter: event.target.value }))}><option value="">{chapterState === 'loading' ? 'Loading chapters…' : 'All chapters'}</option>{chapters.map((group) => <optgroup key={group.name} label={group.name}>{group.chapters.map((chapter) => <option key={chapter.id || chapter.name} value={chapter.name}>{chapter.name}</option>)}</optgroup>)}</select></label>
            <label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}><option value="">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          </form>
          {subjectState === 'error' && <ErrorState message="Subjects did not load. Check your connection and try again." onRetry={() => setSubjectRetry((count) => count + 1)} />}
          {chapterState === 'error' && <ErrorState title="Chapter filters did not load" message="You can still practise all chapters." onRetry={() => setChapterRetry((count) => count + 1)} />}
          <div className="ex-listhead"><h2>{subjectName}</h2>{hasFilters && <button type="button" className="ex-action" onClick={() => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }))}>Clear filters</button>}<span className="sr-only" role="status">{busy ? 'Loading questions' : `${page.questions.length} questions loaded`}</span></div>
          <div aria-busy={busy}>
            {page.questions.map((question) => <QuestionCard key={`${filters.subject}-${question.id}`} row={question} onProgressChange={refreshSummary} />)}
            {busy && <div className="ex-loading" role="status"><span>Finding questions…</span><SkeletonLines count={4} /></div>}
          </div>
          {page.state === 'error' && <ErrorState title="Questions did not load" message="Your answers above are still here. Try loading this page again." onRetry={() => loadPage(page.error.offset, page.error.reset)} />}
          {page.state === 'ready' && !page.questions.length && <EmptyState title={page.hasMore ? 'No ready questions on this page.' : 'No questions for these filters yet.'} message={page.hasMore ? 'Some questions are held for checks. Continue to the next page.' : 'Try all chapters or another subject. Held questions stay out of practice.'} actionLabel={hasFilters ? 'Clear filters' : undefined} onAction={() => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }))} />}
          {page.hasMore && <button ref={moreButton} type="button" className="ex-more" aria-disabled={busy} onClick={() => { if (!busy) loadPage(page.nextOffset); }}>{busy ? 'Loading…' : 'Load more questions'}</button>}
          {page.state === 'ready' && !page.hasMore && page.questions.length > 0 && <p ref={endStatus} tabIndex={-1} className="ex-end" role="status">You’re up to date for these filters. Saved questions are ready for your next round.</p>}
        </div>
        <aside className="ex-aside" aria-label="Make practice count">
          <span className="mono-label">Tonight’s rule</span><h2>Answer first.<br />Then ask why.</h2><p>A wrong answer with a clear reason is worth coming back to. Keep those questions close.</p>
          <Link href="/saved" className="ex-route">Open saved questions <span aria-hidden="true">↗</span></Link><Link href="/review" className="ex-route">Review your timed sessions <span aria-hidden="true">↗</span></Link>
          {Number.isFinite(solved) && <p className="ex-record"><b>{solved}</b> questions solved in your recorded untimed practice. <Link href="/progress">See progress</Link></p>}
          <p className="ex-footnote">Community votes help organise the feed. They do not certify an answer.</p>
        </aside>
      </div>
    </div>
  );
}
