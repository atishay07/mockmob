"use client";

// Explore questions: untimed practice, one question at a time (web redesign W2.4).
// The feed logic is the same as components/feed/DiscoveryFeed.jsx, which nothing renders any more
// (the development preview uses this page too; delete it in W4.3). This page adds the kit page
// head, kit fields and states, and a side column without kickers or arrow glyphs. Held questions
// stay out of practice; votes never certify an answer.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/ui/PageHead';
import { Field, Select } from '@/components/ui/Input';
import { EmptyState, ErrorState, SkeletonLines } from '@/components/ui/Skeleton';
import { AppIcon } from '@/components/ui/Glyph';
import { QuestionCard } from '@/components/feed/QuestionCard';
import { appendUniqueQuestions, chapterGroups } from '@/../data/explore_feed';
import { plural } from '../review/reviewModel.mjs';

const PAGE_SIZE = 12;
const EMPTY_PAGE = { questions: [], nextOffset: 0, hasMore: false, state: 'idle', error: null };

export default function ExplorePageClient() {
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
    if (!filters.subject) return undefined;
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
    if (!filters.subject) return undefined;
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

  const subjectName = subjects.find((subject) => subject.id === filters.subject)?.name || 'Your subject';
  const busy = page.state === 'loading';
  const hasFilters = Boolean(filters.chapter || filters.difficulty);
  const clearFilters = () => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }));
  const solved = summary?.subject === filters.subject ? summary.data?.solvedTotal : null;

  return (
    <div className="ex-page">
      <PageHead
        title="Explore questions"
        lead="Untimed practice, one question at a time. Answer first, check the reasoning, and save what needs another go. It does not count toward your mock scores."
      />
      <div className="ex-layout">
        <div className="ex-main">
          <form className="ex-filters" aria-label="Filter practice questions" onSubmit={(event) => event.preventDefault()}>
            <Field label="Subject" className="ex-filters__subject">
              <Select value={filters.subject} disabled={subjectState !== 'ready'} placeholder={subjectState === 'loading' ? 'Loading subjects' : 'Choose a subject'}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(event) => { setChapterState('loading'); setChapters([]); setFilters({ subject: event.target.value, chapter: '', difficulty: '' }); }} />
            </Field>
            <Field label="Chapter">
              <Select value={filters.chapter} disabled={chapterState !== 'ready'} onChange={(event) => setFilters((current) => ({ ...current, chapter: event.target.value }))}>
                <option value="">{chapterState === 'loading' ? 'Loading chapters' : 'All chapters'}</option>
                {chapters.map((group) => <optgroup key={group.name} label={group.name}>{group.chapters.map((chapter) => <option key={chapter.id || chapter.name} value={chapter.name}>{chapter.name}</option>)}</optgroup>)}
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={filters.difficulty} onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}
                options={[{ value: '', label: 'All levels' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
            </Field>
          </form>
          {subjectState === 'error' && <ErrorState title="Subjects did not load" message="Check your connection and try again." onRetry={() => { setSubjectState('loading'); setSubjectRetry((count) => count + 1); }} />}
          {chapterState === 'error' && <ErrorState title="Chapter filters did not load" message="You can still practice all chapters." onRetry={() => { setChapterState('loading'); setChapterRetry((count) => count + 1); }} />}
          <div className="ex-listhead">
            <h2>{subjectName}</h2>
            {hasFilters && <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={clearFilters}><span className="ui-btn__label">Clear filters</span></button>}
            <span className="sr-only" role="status">{busy ? 'Loading questions' : `${plural(page.questions.length, 'question')} loaded`}</span>
          </div>
          <div aria-busy={busy}>
            {page.questions.map((question) => <QuestionCard key={`${filters.subject}-${question.id}`} row={question} onProgressChange={refreshSummary} />)}
            {busy && <div className="ex-loading" role="status"><span>Finding questions</span><SkeletonLines count={4} /></div>}
          </div>
          {page.state === 'error' && <ErrorState title="Questions did not load" message="Your answers above are still here. Try loading this page again." onRetry={() => loadPage(page.error.offset, page.error.reset)} />}
          {page.state === 'ready' && !page.questions.length && (
            <EmptyState
              mascot={false}
              title={page.hasMore ? 'No ready questions on this page' : 'No questions for these filters yet'}
              message={page.hasMore ? 'Some questions are held while their answers are checked. Load the next page.' : 'Try all chapters or another subject. Questions held for checks stay out of practice.'}
              actionLabel={page.hasMore ? 'Load the next page' : hasFilters ? 'Clear filters' : undefined}
              onAction={page.hasMore ? () => loadPage(page.nextOffset) : clearFilters}
            />
          )}
          {page.hasMore && page.questions.length > 0 && (
            <button ref={moreButton} type="button" className="ui-btn ui-btn--secondary btn-outline ui-btn--block ex-more" aria-disabled={busy || undefined} data-loading={busy ? 'true' : undefined} onClick={() => { if (!busy) loadPage(page.nextOffset); }}>
              {busy ? <span className="ui-spinner" aria-hidden="true" /> : null}
              <span className="ui-btn__label">Load more questions</span>
            </button>
          )}
          {page.state === 'ready' && !page.hasMore && page.questions.length > 0 && <p ref={endStatus} tabIndex={-1} className="ex-end" role="status">That is every ready question for these filters. Your saved ones are waiting in Saved.</p>}
        </div>
        <aside className="ex-aside" aria-labelledby="ex-aside-title">
          <h2 id="ex-aside-title">Answer first. Then ask why.</h2>
          <p>A wrong answer with a clear reason is worth coming back to. Save those and they wait for you.</p>
          <nav className="ex-routes" aria-label="Related pages">
            <Link href="/saved" className="ex-route"><AppIcon name="saved" size={18} /><span>Saved questions</span></Link>
            <Link href="/review" className="ex-route"><AppIcon name="review" size={18} /><span>Review your timed sessions</span></Link>
          </nav>
          {Number.isFinite(solved) && <p className="ex-record"><b>{solved}</b> {solved === 1 ? 'question' : 'questions'} solved in your untimed practice. <Link href="/progress">See progress</Link></p>}
          <p className="ex-footnote">Votes from other students help sort the feed. They do not decide the correct answer.</p>
        </aside>
      </div>
    </div>
  );
}
