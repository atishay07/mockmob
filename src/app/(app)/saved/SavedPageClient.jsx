"use client";
/* eslint-disable react-hooks/set-state-in-effect */

// Saved questions. A removal only happens once the server has said so: the row then folds away,
// the rows below close the gap, and an Undo bar puts it back (a second server call, so Undo never
// claims more than the server confirmed). On a touch screen a row also swipes: left removes,
// right practises that chapter. Every swipe has a visible button, so keyboard and mouse users
// lose nothing. The slot meter is the real count against the free limit of 25.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ArenaHead from '@/components/arena/ArenaHead';
import { QuestionCard } from '@/components/feed/QuestionCard';
import MobiReact from '@/components/brand/MobiReact';
import { Icon } from '@/components/ui/Icons';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { setQuestionBookmark } from '@/lib/services/questionService';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { foldExit, useSwipeCommit } from '@/lib/motion';
import { SUBJECTS } from '@/../data/subjects';
import './saved.css';

const FREE_LIMIT = 25;
const UNDO_MS = 8000;
const FIRST_SAVE_KEY = 'mm:saved-first:v1';

const subjectName = (id) => SUBJECTS.find((s) => s.id === id)?.name || (id ? String(id) : 'Other');

export function practiseHref(question) {
  const params = new URLSearchParams({ subject: question.subject || '', mode: 'quick', count: '10' });
  if (question.chapter) params.set('chapter', question.chapter);
  return `/test?${params}`;
}

// Matches a touch screen. Mouse drags would fight text selection, so swiping stays off for them.
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    let query;
    try { query = window.matchMedia('(pointer: coarse)'); } catch { return undefined; }
    const read = () => setCoarse(Boolean(query.matches));
    read();
    try { query.addEventListener('change', read); } catch { /* Older engines keep the first read. */ }
    return () => { try { query.removeEventListener('change', read); } catch { /* ignore */ } };
  }, []);
  return coarse;
}

function SlotMeter({ count, limit, pop }) {
  const left = Math.max(0, limit - count);
  return (
    <section className="sv-meter" aria-label="Save slots">
      <div className="sv-meter__pips" role="img" aria-label={`${count} of ${limit} free save slots used`}>
        {Array.from({ length: limit }, (_, i) => {
          const changed = pop && pop.index === i;
          return <i key={changed ? `${i}-${pop.n}` : i} data-on={i < count ? 'true' : 'false'} data-pop={changed ? pop.dir : undefined} />;
        })}
      </div>
      <p className="sv-meter__text">
        <b>{count}</b> of {limit} free slots used.{' '}
        {left === 0 ? 'All full. Remove one to save another.' : `${left} left.`}
      </p>
    </section>
  );
}

function SavedRow({ question, coarse, pending, shake, onRemove, onPractise, rowRef, enter }) {
  const href = practiseHref(question);
  const { bind } = useSwipeCommit({
    disabled: !coarse || pending,
    onCommit: (dir) => { if (dir === 'left') onRemove(question); else onPractise(href); },
  });
  const hasChapter = Boolean(question.subject);
  return (
    <li
      ref={rowRef}
      className={`sv-row${enter ? ' mk-rise' : ''}`}
      data-pending={pending ? 'true' : undefined}
      data-shake={shake || undefined}
    >
      <div className="sv-under" aria-hidden="true">
        <span className="sv-under__go"><Icon name="target" /> Practise</span>
        <span className="sv-under__rm">Remove</span>
      </div>
      <div {...bind} className={`${bind.className} sv-card`}>
        <QuestionCard row={question} onProgressChange={(event) => { if (event?.type === 'unsave') onRemove(question, { confirmed: true }); }} />
      </div>
      <div className="sv-actions">
        {hasChapter ? <Link className="sv-act sv-act--go mk-press" href={href}><Icon name="target" /> Practise {question.chapter ? 'this chapter' : subjectName(question.subject)}</Link> : <span />}
        <button type="button" className="sv-act sv-act--rm mk-press" disabled={pending} onClick={() => onRemove(question)}>{pending ? 'Removing…' : 'Remove'}</button>
      </div>
    </li>
  );
}

export default function SavedPageClient() {
  const router = useRouter();
  const toast = useToast();
  const { user, status: authStatus } = useAuth();
  const prefs = useMobiPrefs();
  const coarse = useCoarsePointer();
  const [status, setStatus] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState(() => new Set());
  const [shake, setShake] = useState(null);
  const [undo, setUndo] = useState(null);
  const [live, setLive] = useState('');
  const [pop, setPop] = useState(null);
  const [entered, setEntered] = useState(null);
  const [firstSave, setFirstSave] = useState(false);
  const rows = useRef(new Map());
  const undoTimer = useRef(0);
  const questionsRef = useRef(questions);
  const countRef = useRef(0);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { countRef.current = count; }, [count]);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const loadSaved = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/bookmarks', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load saved questions');
      const list = Array.isArray(data.questions) ? data.questions : [];
      setQuestions(list);
      setCount(Number.isFinite(data.count) ? data.count : list.length);
      setStatus('ready');
      if (list.length) {
        try {
          if (!window.localStorage.getItem(FIRST_SAVE_KEY)) { window.localStorage.setItem(FIRST_SAVE_KEY, '1'); setFirstSave(true); }
        } catch { /* Without storage the hop simply does not play. */ }
      }
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const showUndo = useCallback((question, index) => {
    window.clearTimeout(undoTimer.current);
    setUndo({ question, index, n: Date.now() });
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  // The server has already agreed. Fold the row away, then close the gap in state.
  const finishRemoval = useCallback(async (question, serverCount) => {
    const index = questionsRef.current.findIndex((q) => q.id === question.id);
    await foldExit(rows.current.get(question.id));
    setQuestions((list) => list.filter((q) => q.id !== question.id));
    const next = Number.isFinite(serverCount) ? serverCount : Math.max(0, countRef.current - 1);
    setCount(next);
    setPop({ index: Math.min(next, FREE_LIMIT - 1), dir: 'out', n: Date.now() });
    setLive(`Removed from saved. ${next} saved.`);
    setPending((set) => { const next = new Set(set); next.delete(question.id); return next; });
    showUndo(question, Math.max(0, index));
  }, [showUndo]);

  const remove = useCallback(async (question, opts = {}) => {
    if (opts.confirmed) { finishRemoval(question); return; }
    setPending((set) => new Set(set).add(question.id));
    try {
      const result = await setQuestionBookmark(question.id, false);
      if (result?.saved !== false) throw new Error('Not removed');
      await finishRemoval(question, result.count);
    } catch {
      setPending((set) => { const next = new Set(set); next.delete(question.id); return next; });
      setShake(question.id);
      window.setTimeout(() => setShake(null), 480);
      toast.error('Could not remove that question. Check your connection and try again.');
    }
  }, [finishRemoval, toast]);

  const restore = useCallback(async () => {
    const item = undo;
    if (!item) return;
    window.clearTimeout(undoTimer.current);
    try {
      const result = await setQuestionBookmark(item.question.id, true);
      if (result?.saved !== true) throw new Error('Not saved');
      const next = Number.isFinite(result.count) ? result.count : count + 1;
      setQuestions((list) => {
        if (list.some((q) => q.id === item.question.id)) return list;
        const copy = list.slice();
        copy.splice(Math.min(item.index, copy.length), 0, item.question);
        return copy;
      });
      setEntered(item.question.id);
      setCount(next);
      setPop({ index: Math.min(Math.max(0, next - 1), FREE_LIMIT - 1), dir: 'in', n: Date.now() });
      setLive(`Put back. ${next} saved.`);
      setUndo(null);
    } catch (e) {
      setUndo(null);
      toast.error(e?.status === 402 ? 'Your 25 free save slots are full, so that one could not be put back.' : 'Could not put it back. Save it again from Explore.');
    }
  }, [undo, count, toast]);

  const subjects = useMemo(() => {
    const tally = new Map();
    questions.forEach((q) => tally.set(q.subject, (tally.get(q.subject) || 0) + 1));
    return [...tally.entries()].map(([id, n]) => ({ id, name: subjectName(id), n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [questions]);
  const activeFilter = filter !== 'all' && subjects.some((s) => s.id === filter) ? filter : 'all';
  const visible = activeFilter === 'all' ? questions : questions.filter((q) => q.subject === activeFilter);

  // Mobi reads, then points at the way to Explore. Reduced motion goes straight to the pointing pose.
  const [emptyAct, setEmptyAct] = useState('read');
  useEffect(() => {
    if (status !== 'ready' || questions.length) return undefined;
    if (prefs.reduced) { setEmptyAct('point'); return undefined; }
    setEmptyAct('read');
    const timer = window.setTimeout(() => setEmptyAct('point'), 1700);
    return () => window.clearTimeout(timer);
  }, [status, questions.length, prefs.reduced]);

  if (status === 'loading') {
    return (
      <div className="container-narrow student-page student-page--saved flex flex-col gap-4">
        <div>
          <div className="eyebrow mb-2">{'Saved'}</div>
          <div className="h-10 w-72 max-w-full skeleton mb-2" />
          <div className="h-4 w-64 max-w-full skeleton" />
        </div>
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="student-page student-page--saved">
        <div className="sv-fail" role="alert">
          <MobiReact act="oops" size={84} />
          <div>
            <b>Your saved questions did not load</b>
            <p>{error || 'Check your connection and try again.'} Nothing was removed.</p>
            <button type="button" className="ui-state__action ui-state__action--primary mk-press" onClick={loadSaved}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  const showMeter = authStatus !== 'loading' && !user?.isPremium;
  return (
    <div className="container-narrow view student-page student-page--saved">
      <div className="mb-6">
        <ArenaHead eyebrow="Saved" title="Saved questions" lede={`Everything you save from Explore lands here for another look.${count ? ` ${count} saved.` : ''}`}
          aside={<span className="saved-aside"><Link href="/explore" className="na__alt"><Icon name="radar" /> Explore questions</Link><Link href="/dashboard" className="na__alt"><Icon name="target" /> Choose practice</Link></span>} />
      </div>

      {showMeter ? <SlotMeter count={count} limit={FREE_LIMIT} pop={pop} /> : null}

      {firstSave && questions.length ? (
        <p className="sv-first" role="status"><MobiReact act="cheer" size={44} onDone={() => setFirstSave(false)} /><span>Your first saved question. It stays here until you remove it.</span></p>
      ) : null}

      {questions.length === 0 ? (
        <div className="sv-empty">
          <MobiReact act={emptyAct} size={104} />
          <div>
            <span className="ui-state__eyebrow">Nothing saved</span>
            <b>Save questions from Explore</b>
            <p>Tap Save on any question in the stream and it will wait for you here.</p>
            <Link href="/explore" className="ui-state__action ui-state__action--primary mk-press sv-empty__link" data-lit={emptyAct === 'point' ? 'true' : 'false'}>Open the question stream <Icon name="radar" /></Link>
          </div>
        </div>
      ) : (
        <>
          {subjects.length > 1 ? (
            <div className="sv-chips" role="group" aria-label="Filter by subject">
              <button type="button" className="sv-chip mk-press mk-rim" aria-pressed={activeFilter === 'all'} data-selected={activeFilter === 'all'} onClick={() => setFilter('all')}>All <i>{questions.length}</i></button>
              {subjects.map((s) => (
                <button key={s.id} type="button" className="sv-chip mk-press mk-rim" aria-pressed={activeFilter === s.id} data-selected={activeFilter === s.id} onClick={() => setFilter(s.id)}>{s.name} <i>{s.n}</i></button>
              ))}
            </div>
          ) : null}
          {coarse ? <p className="sv-hint">Swipe a question left to remove it, right to practise its chapter.</p> : null}
          <ul className="sv-list">
            {visible.map((question) => (
              <SavedRow
                key={question.id}
                question={question}
                coarse={coarse}
                pending={pending.has(question.id)}
                shake={shake === question.id}
                enter={entered === question.id}
                rowRef={(node) => { if (node) rows.current.set(question.id, node); else rows.current.delete(question.id); }}
                onRemove={remove}
                onPractise={(href) => router.push(href)}
              />
            ))}
          </ul>
        </>
      )}

      <div className="sv-live" role="status" aria-live="polite">{live}</div>

      {undo ? (
        <div className="sv-undo" role="group" aria-label="Undo removal" key={undo.n}>
          <span>Removed from saved.</span>
          <button type="button" className="mk-press" onClick={restore}>Undo</button>
          <i className="sv-undo__clock" style={{ '--sv-undo-ms': `${UNDO_MS}ms` }} aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
