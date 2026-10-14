"use client";

// Saved: questions the student kept from Explore for another look (web redesign W2.4).
// Answering or unsaving a card never reloads the list: the card keeps its answer and its place,
// so an unsave can be undone with the same Save button, and the count follows what is saved now.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/ui/PageHead';
import { QuestionCard } from '@/components/feed/QuestionCard';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/Skeleton';
import { RecordSkeleton, looksOffline } from '../review/RecordParts';
import { plural } from '../review/reviewModel.mjs';

export default function SavedPageClient() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [unsaved, setUnsaved] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bookmarks', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'saved_unavailable');
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setUnsaved(new Set());
      setStatus('ready');
    } catch (e) {
      setStatus(looksOffline(e) ? 'offline' : 'error');
    }
  }, []);

  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const retry = () => { setStatus('loading'); load(); };

  const onProgressChange = useCallback((event) => {
    if (!event?.questionId || (event.type !== 'save' && event.type !== 'unsave')) return;
    setUnsaved((current) => {
      const next = new Set(current);
      if (event.type === 'unsave') next.add(event.questionId); else next.delete(event.questionId);
      return next;
    });
  }, []);

  const count = questions.filter((row) => !unsaved.has((row?.questions ?? row)?.id)).length;
  const head = (
    <PageHead
      title="Saved"
      lead={status === 'ready' && questions.length
        ? `Questions you kept from Explore for another look. ${plural(count, 'question')} saved.`
        : 'Questions you kept from Explore for another look.'}
      actions={<Link href="/explore" className="ui-btn ui-btn--secondary btn-outline ui-btn--sm"><span className="ui-btn__label">Explore questions</span></Link>}
    />
  );

  return (
    <div className="container-narrow student-page student-page--saved svx">
      {head}
      {status === 'loading' ? <RecordSkeleton label="Loading your saved questions" thread={false} rows={3} /> : null}
      {status === 'offline' ? <OfflineState message="Your saved questions load again once you are back online. Nothing is lost." onRetry={retry} /> : null}
      {status === 'error' ? <ErrorState title="Your saved questions did not load" message="They are still saved. Try again in a moment." onRetry={retry} /> : null}
      {status === 'ready' && questions.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          message="In Explore, press Save on any question worth another look. It lands here, ready when you are."
          actionLabel="Explore questions"
          onAction={() => router.push('/explore')}
        />
      ) : null}
      {status === 'ready' && questions.length > 0 ? (
        <div className="svx-list">
          {questions.map((question) => (
            <QuestionCard key={(question?.questions ?? question)?.id} row={question} onProgressChange={onProgressChange} />
          ))}
          {unsaved.size > 0 ? <p className="ex-end" role="status">{plural(unsaved.size, 'question')} removed from Saved. Press Save on a card to keep it.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
