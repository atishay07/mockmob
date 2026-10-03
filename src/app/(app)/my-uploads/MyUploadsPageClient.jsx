"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import ArenaHead, { ArenaStats } from '@/components/arena/ArenaHead';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/Skeleton';
import { contributionState } from '@/../data/contribution_ui';

const STATES = { pending: { label: 'Awaiting checks', detail: 'This question is held until the required checks pass.' }, live: { label: 'Live', detail: 'The contribution API reports this question as live.' }, held: { label: 'Held', detail: 'This question has not passed its checks. It is not ready for practice.' } };

export default function MyUploadsPageClient() {
  const [questions, setQuestions] = useState([]);
  const [state, setState] = useState('loading');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    try {
      // Own-account endpoint includes live submissions; the moderation queue does not.
      const data = await apiGet('/api/questions/mine');
      if (!Array.isArray(data)) throw new Error('uploads_unavailable');
      setQuestions(data);
      setState('ready');
    } catch { setState('error'); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const refresh = () => { setState('loading'); load(); };
  const filtered = questions.filter((question) => filter === 'all' || contributionState(question.status) === filter);
  const count = (key) => questions.filter((question) => contributionState(question.status) === key).length;
  return <div className="con-page student-page student-page--my-uploads">
    <ArenaHead eyebrow="My uploads" title="Your questions, and where they stand." lede="Your latest 20 contributions. Awaiting checks means held, not published." aside={<Link href="/upload" className="ex-action">Contribute a question ↗</Link>} />
    {state === 'ready' && <ArenaStats items={Object.entries(STATES).map(([key, value]) => ({ label: value.label, value: count(key) }))} />}
    <div className="con-filters" role="group" aria-label="Filter contributions">{['all', 'pending', 'live', 'held'].map((key) => <button key={key} type="button" className="ex-action" aria-pressed={filter === key} onClick={() => setFilter(key)}>{key === 'all' ? 'All' : STATES[key].label}</button>)}<button type="button" className="ex-action" disabled={state === 'loading'} onClick={refresh}>Refresh</button></div>
    {state === 'loading' && <SkeletonCard lines={5} />}
    {state === 'error' && <ErrorState message="Your uploads did not load. Check your connection and try again." onRetry={refresh} />}
    {state === 'ready' && !filtered.length && <EmptyState title={filter === 'all' ? 'No contributions yet.' : 'No questions in this group.'} message={filter === 'all' ? 'Start with one original question and the reasoning behind it.' : 'Try All to see your other submissions.'} actionLabel={filter === 'all' ? undefined : 'Show all'} onAction={() => setFilter('all')} />}
    {state === 'ready' && <div className="con-list">{filtered.map((question) => {
      const status = contributionState(question.status);
      return <details key={question.id} className="con-upload" data-state={status}><summary><span><b>{question.question || question.body || 'Question text unavailable'}</b><small>{question.subject?.replaceAll('_', ' ')} · {question.chapter || 'Chapter unavailable'}</small></span><em>{STATES[status].label}</em></summary><div className="con-upload__detail"><p>{STATES[status].detail}</p><dl><div><dt>Submitted</dt><dd>{question.createdAt ? new Date(question.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date unavailable'}</dd></div><div><dt>Question ID</dt><dd>{question.id}</dd></div></dl></div></details>;
    })}</div>}
  </div>;
}
