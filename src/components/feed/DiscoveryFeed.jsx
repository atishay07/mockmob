"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bookmark, ChevronRight } from 'lucide-react';
import ArenaHead from '@/components/arena/ArenaHead';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { EmptyState, ErrorState, SkeletonLines } from '@/components/ui/Skeleton';
import { QuestionCard } from './QuestionCard';
import { useContributeEnabled } from '@/components/contribute/ContributeFlag';
import { Listbox } from '@/components/ui/controls/Listbox';
import { appendUniqueQuestions, chapterGroups } from '@/../data/explore_feed';
import ExploreCovers from '@/components/learn2/feed/ExploreCovers';
import { useLearn2On } from '@/components/learn2/flag';
import { chapterNameOf } from '@/components/learn2/feed/coverModel';
import { useAuth } from '@/components/AuthProvider';
import { usePathname, useSearchParams } from 'next/navigation';
import { firstShown, moreShown, pickSingles, savedLabel, syllabusTitle } from './exploreModel.mjs';

const PAGE_SIZE = 12;
const EMPTY_PAGE = { questions: [], nextOffset: 0, hasMore: false, state: 'idle', error: null };
// Learn v2's Explore (A2-explore-covers.md 4.10 Option A, BUILD-1101 B7): the Subject control in the page head with the page's
// one subject object, the chapter covers full width under the head, a "Questions" heading with the Chapter and Difficulty
// filters, and the right column demoted to follow the questions. Only when Learn v2 is on (NEXT_PUBLIC_LEARN2 = 'on') and
// always in the development preview (where &l2=off shows the page exactly as the live site draws it with the flag off).
// With the flag off nothing below changes: the same effects, the same tree, the same look as before Learn v2.
// Round 2 (R2 ruling 11, LK24, LK26): the slogan head goes, so the covers start near the top under one row that holds the
// subject on the left and "Saved 2" on the right (Saved moved here from the phone's tab row: moved, not removed). Under the
// covers, "Single questions" shows 3 short questions, stem first (tap opens the options), then "More questions". The right column
// ("Answer first. Then ask why.", its two routes and the record line) goes: Saved is in the head, Your papers is a tab, and the
// record line read /api/learning/summary's solvedTotal, a field that never arrives (speed.md item 2), so that call is gone too.
const DIFFICULTY_OPTIONS = [{ value: '', label: 'All levels' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }];

export function DiscoveryFeed() {
  const contributeOn = useContributeEnabled();
  const pathname = usePathname() || '';
  const params = useSearchParams();
  const { user } = useAuth() || {};
  // R3 X7: the flag-dependent branch is the same on the server and in the first client render (flag.js reads &l2=off after hydration).
  const v2 = useLearn2On();
  const [entry] = useState(() => ({ subject: params?.get('subject') || '', chapter: params?.get('chapter') || '' }));
  const prefer = useRef({ v2: false, entry, mine: [] });
  const jump = useRef(false);
  const questionsHead = useRef(null);
  const [coverData, setCoverData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subjectState, setSubjectState] = useState('loading');
  const [subjectRetry, setSubjectRetry] = useState(0);
  const [filters, setFilters] = useState({ subject: '', chapter: '', difficulty: '' });
  const [chapters, setChapters] = useState([]);
  const [chapterState, setChapterState] = useState('idle');
  const [chapterRetry, setChapterRetry] = useState(0);
  const [page, setPage] = useState(EMPTY_PAGE);
  const [shown, setShown] = useState(() => firstShown());
  const [saved, setSaved] = useState(null);
  const request = useRef({ sequence: 0, controller: null });
  const moreButton = useRef(null);
  const endStatus = useRef(null);

  // What the v2 page prefers for its first subject and chapter: the link's ?subject=&chapter= (A2 F6), else the student's own
  // first subject (F16). Read by the subjects request below; updated every render, before that effect runs.
  useEffect(() => { prefer.current = { v2, entry, mine: user?.subjects || [] }; });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error('subjects_unavailable');
      const available = data.filter((subject) => subject.practice !== 'merged' && !subject.mergedInto);
      setSubjects(available);
      setFilters((current) => {
        if (current.subject) return current;
        const want = prefer.current;
        if (want.v2) {
          const has = (id) => available.some((s) => s.id === id);
          const subject = (has(want.entry.subject) && want.entry.subject) || want.mine.find(has) || available.find((s) => s.id === 'accountancy')?.id || available[0]?.id || '';
          const chapter = subject && subject === want.entry.subject ? want.entry.chapter : '';
          if (chapter) jump.current = true;
          return { ...current, subject, chapter };
        }
        return { ...current, subject: available.find((s) => s.id === 'accountancy')?.id || available[0]?.id || '' };
      });
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

  // v2: the head's "Saved 2" reads the count alone (?count=1: one head count, no question rows); a save or unsave below moves it.
  useEffect(() => {
    if (!v2) return undefined;
    const controller = new AbortController();
    fetch('/api/bookmarks?count=1', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (response.ok && Number.isFinite(data?.count)) setSaved((current) => (current === null ? data.count : current));
    }).catch(() => {});
    return () => controller.abort();
  }, [v2]);
  const onProgress = useCallback((event) => {
    if (event?.type === 'save') setSaved((n) => (Number(n) || 0) + 1);
    if (event?.type === 'unsave') setSaved((n) => Math.max(0, (Number(n) || 0) - 1));
  }, []);
  // A new subject or filter starts the short list again (state adjusted while rendering, React's documented pattern).
  const filterKey = `${filters.subject}|${filters.chapter}|${filters.difficulty}`;
  const [shownFor, setShownFor] = useState(filterKey);
  if (shownFor !== filterKey) { setShownFor(filterKey); setShown(firstShown()); }

  const subjectName = subjects.find((subject) => subject.id === filters.subject)?.name || 'your subject';
  const busy = page.state === 'loading';
  const hasFilters = Boolean(filters.chapter || filters.difficulty);
  // R3 X1: only syllabus chapters, no repeated stem, the first 3 from different chapters where the page allows.
  const singles = useMemo(() => pickSingles(page.questions, { subject: filters.subject }), [page.questions, filters.subject]);
  // A page whose rows were mostly out of syllabus or repeats leaves fewer than the 3 asked for: the next page is read (at most 5 in a row).
  const topUps = useRef(0);
  useEffect(() => {
    if (!v2 || page.state !== 'ready') return;
    if (singles.length >= shown) { topUps.current = 0; return; }
    if (!page.hasMore || topUps.current >= 5) return;
    topUps.current += 1;
    loadPage(page.nextOffset);
  }, [v2, page.state, page.hasMore, page.nextOffset, singles.length, shown, loadPage]);

  // v2: a link that named a chapter lands on the Questions heading once its first page is in.
  useEffect(() => {
    if (!v2 || !jump.current || page.state !== 'ready') return;
    jump.current = false;
    requestAnimationFrame(() => { questionsHead.current?.scrollIntoView({ block: 'start' }); questionsHead.current?.focus({ preventScroll: true }); });
  }, [v2, page.state]);

  const chapterNames = chapters.flatMap((group) => group.chapters.map((chapter) => chapter.name));
  // v2: the Chapter filter shows each chapter's title from the covers (F13), keeping the syllabus name as its value.
  const titles = new Map();
  for (const cover of (coverData?.subject?.id === filters.subject ? coverData.covers : null) || []) {
    const name = chapterNameOf(cover, chapterNames);
    if (name && cover.title) titles.set(name, cover.title);
  }
  // v2 (R9): a question's meta line says the chapter the cover above it says (its title), not the syllabus name the row carries. The covers'
  // titles first; a chapter without a cover falls back to the syllabus table's title, cleaned the way Learn cleans it; else the row's own name.
  const titleOf = (question) => {
    if (!v2 || !question?.chapter) return null;
    if (titles.has(question.chapter)) return titles.get(question.chapter);
    return syllabusTitle(question.subject || filters.subject, question.chapter);
  };
  // v2, Free at the day's limit: a cover's key sets the Chapter filter and brings the Questions heading into view.
  const openQuestions = (cover) => {
    setFilters((current) => ({ ...current, chapter: chapterNameOf(cover, chapterNames) || '' }));
    requestAnimationFrame(() => {
      questionsHead.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      questionsHead.current?.focus({ preventScroll: true });
    });
  };

  if (v2) {
    const realName = subjects.find((subject) => subject.id === filters.subject)?.name || null;
    const list = singles.slice(0, shown);
    const hidden = singles.length - list.length;
    const savedHref = pathname.startsWith('/preview/') ? previewHref(params, 'saved') : '/saved';
    const more = () => {
      if (busy) return;
      topUps.current = 0;
      setShown((n) => moreShown(n)); // the top-up effect above reads the next page when the 6 more are not all here yet
    };
    return (
      <div className="ex-page ex-page--v2">
        <h1 className="sr-only">Explore</h1>
        <div className="ex-top">
          <div className="ex-subject">
            <span className="ex-subject__obj" aria-hidden="true">{filters.subject ? <SubjectObject key={filters.subject} id={filters.subject} size={40} framed={false} lit className="mk-pop" /> : null}</span>
            <span className="ex-subject__field">
              <span id="ex-f-subject" className="sr-only">Subject</span>
              <Listbox labelledBy="ex-f-subject" sheetTitle="Subject" value={filters.subject} disabled={subjectState !== 'ready'} placeholder={subjectState === 'loading' ? 'Loading subjects…' : 'Choose a subject'} options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))} onChange={(value) => { setChapterState('loading'); setChapters([]); setFilters({ subject: value, chapter: '', difficulty: '' }); }} />
            </span>
          </div>
          <Link href={savedHref} className="ex-saved" aria-label={savedLabel(saved, { spoken: true })}>
            <Bookmark size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Saved</span>
            {saved > 0 ? <b className="ex-saved__n">{saved.toLocaleString('en-IN')}</b> : null}
          </Link>
        </div>
        {subjectState === 'error' && <ErrorState message="Subjects did not load. Check your connection and try again." onRetry={() => setSubjectRetry((count) => count + 1)} />}
        {subjectState !== 'error' ? <ExploreCovers enabled subject={filters.subject} subjectName={realName} onQuestions={openQuestions} onCovers={setCoverData} /> : null}
        <section className="ex-singles" aria-labelledby="ex-questions">
          <div className="ex-qhead">
            <h2 id="ex-questions" ref={questionsHead} tabIndex={-1}>Single questions</h2>
            <form className="ex-filters ex-filters--v2" aria-label="Filter single questions" onSubmit={(event) => event.preventDefault()}>
              <label><span id="ex-f-chapter">Chapter</span><Listbox labelledBy="ex-f-chapter" sheetTitle="Chapter" value={filters.chapter} disabled={chapterState !== 'ready'} options={[{ value: '', label: chapterState === 'loading' ? 'Loading chapters…' : 'All chapters' }, ...chapters.flatMap((group) => group.chapters.map((chapter) => ({ value: chapter.name, label: titles.get(chapter.name) || chapter.name, group: group.name })))]} onChange={(value) => setFilters((current) => ({ ...current, chapter: value }))} /></label>
              <label><span id="ex-f-difficulty">Difficulty</span><Listbox labelledBy="ex-f-difficulty" sheetTitle="Difficulty" value={filters.difficulty} options={DIFFICULTY_OPTIONS} onChange={(value) => setFilters((current) => ({ ...current, difficulty: value }))} /></label>
              {hasFilters ? <button type="button" className="ex-action ex-filters__clear" onClick={() => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }))}>Clear filters</button> : null}
            </form>
            <span className="sr-only" role="status">{busy ? 'Loading questions' : `${list.length} questions shown`}</span>
          </div>
          {chapterState === 'error' && <ErrorState title="Chapter filters did not load" message="You can still practise all chapters." onRetry={() => setChapterRetry((count) => count + 1)} />}
          <div aria-busy={busy}>
            {list.map((question) => <QuestionCard key={`${filters.subject}-${question.id}`} row={question} onProgressChange={onProgress} chapterTitle={titleOf(question)} closed />)}
            {busy && <div className="ex-loading" role="status"><span>Finding questions…</span><SkeletonLines count={3} /></div>}
          </div>
          {page.state === 'error' && <ErrorState scene="unreachable" title="Questions did not load" message="Your answers above are still here. Try loading this page again." onRetry={() => loadPage(page.error.offset, page.error.reset)} />}
          {page.state === 'ready' && !singles.length && <EmptyState scene={page.hasMore ? 'nothingYet' : 'noResults'} title={page.hasMore ? 'No ready questions on this page.' : 'No questions for these filters yet.'} message={page.hasMore ? 'Some questions are held for checks. Continue to the next page.' : 'Try all chapters or another subject. Held questions stay out of practice.'} actionLabel={hasFilters ? 'Clear filters' : undefined} onAction={() => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }))} />}
          {hidden > 0 || page.hasMore ? <button ref={moreButton} type="button" className="ex-more ex-more--quiet" aria-disabled={busy} onClick={more}>{busy ? 'Loading…' : 'More questions'}{busy ? null : <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />}</button> : null}
          {page.state === 'ready' && !page.hasMore && hidden <= 0 && singles.length > 0 && <p ref={endStatus} tabIndex={-1} className="ex-end" role="status">That is every question for these filters.</p>}
          {contributeOn ? <p className="ex-footnote">Community votes help organise the feed. They do not certify an answer.</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="ex-page">
      <ArenaHead eyebrow="Explore · untimed practice" title="One question. One useful step." lede="Try it, check the reasoning, save what needs another go. This is practice, separate from your timed mock score." />
      <div className="ex-layout">
        <div className="ex-main">
          <form className="ex-filters" aria-label="Filter practice questions" onSubmit={(event) => event.preventDefault()}>
            <label><span id="ex-f-subject">Subject</span><Listbox labelledBy="ex-f-subject" sheetTitle="Subject" value={filters.subject} disabled={subjectState !== 'ready'} placeholder={subjectState === 'loading' ? 'Loading subjects…' : 'Choose a subject'} options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))} onChange={(value) => { setChapterState('loading'); setChapters([]); setFilters({ subject: value, chapter: '', difficulty: '' }); }} /></label>
            <label><span id="ex-f-chapter">Chapter</span><Listbox labelledBy="ex-f-chapter" sheetTitle="Chapter" value={filters.chapter} disabled={chapterState !== 'ready'} options={[{ value: '', label: chapterState === 'loading' ? 'Loading chapters…' : 'All chapters' }, ...chapters.flatMap((group) => group.chapters.map((chapter) => ({ value: chapter.name, label: chapter.name, group: group.name })))]} onChange={(value) => setFilters((current) => ({ ...current, chapter: value }))} /></label>
            <label><span id="ex-f-difficulty">Difficulty</span><Listbox labelledBy="ex-f-difficulty" sheetTitle="Difficulty" value={filters.difficulty} options={DIFFICULTY_OPTIONS} onChange={(value) => setFilters((current) => ({ ...current, difficulty: value }))} /></label>
          </form>
          {subjectState === 'error' && <ErrorState message="Subjects did not load. Check your connection and try again." onRetry={() => setSubjectRetry((count) => count + 1)} />}
          {chapterState === 'error' && <ErrorState title="Chapter filters did not load" message="You can still practise all chapters." onRetry={() => setChapterRetry((count) => count + 1)} />}
          {subjectState !== 'error' ? <ExploreCovers subject={filters.subject} /> : null}
          <div className="ex-listhead"><span className="ex-listhead__obj" aria-hidden="true">{filters.subject ? <SubjectObject key={filters.subject} id={filters.subject} size={96} framed={false} lit className="mk-pop" /> : null}</span><h2>{subjectName}</h2>{hasFilters && <button type="button" className="ex-action" onClick={() => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }))}>Clear filters</button>}<span className="sr-only" role="status">{busy ? 'Loading questions' : `${page.questions.length} questions loaded`}</span></div>
          <div aria-busy={busy}>
            {page.questions.map((question) => <QuestionCard key={`${filters.subject}-${question.id}`} row={question} />)}
            {busy && <div className="ex-loading" role="status"><span>Finding questions…</span><SkeletonLines count={4} /></div>}
          </div>
          {page.state === 'error' && <ErrorState scene="unreachable" title="Questions did not load" message="Your answers above are still here. Try loading this page again." onRetry={() => loadPage(page.error.offset, page.error.reset)} />}
          {page.state === 'ready' && !page.questions.length && <EmptyState scene={page.hasMore ? 'nothingYet' : 'noResults'} title={page.hasMore ? 'No ready questions on this page.' : 'No questions for these filters yet.'} message={page.hasMore ? 'Some questions are held for checks. Continue to the next page.' : 'Try all chapters or another subject. Held questions stay out of practice.'} actionLabel={hasFilters ? 'Clear filters' : undefined} onAction={() => setFilters((current) => ({ ...current, chapter: '', difficulty: '' }))} />}
          {page.hasMore && <button ref={moreButton} type="button" className="ex-more" aria-disabled={busy} onClick={() => { if (!busy) loadPage(page.nextOffset); }}>{busy ? 'Loading…' : 'Load more questions'}</button>}
          {page.state === 'ready' && !page.hasMore && page.questions.length > 0 && <p ref={endStatus} tabIndex={-1} className="ex-end" role="status">You’re up to date for these filters. Saved questions are ready for your next round.</p>}
        </div>
        <aside className="ex-aside" aria-label="Make practice count">
          <span className="mono-label">Tonight’s rule</span><h2>Answer first.<br />Then ask why.</h2><p>A wrong answer with a clear reason is worth coming back to. Keep those questions close.</p>
          <Link href="/saved" className="ex-route">Open saved questions</Link><Link href="/review" className="ex-route">Review your timed sessions</Link>
          {contributeOn ? <p className="ex-footnote">Community votes help organise the feed. They do not certify an answer.</p> : null}
        </aside>
      </div>
    </div>
  );
}

/** The preview's own view for a page, keeping its fixture flags, so a walk never leaves the fixtures. */
function previewHref(params, view) {
  const next = new URLSearchParams({ view });
  for (const k of ['plan', 'data', 'decks', 'student', 'kcs', 'kcline', 'theme', 'nav', 'study']) if (params?.get(k)) next.set(k, params.get(k));
  return `/preview/arena?${next.toString()}`;
}
