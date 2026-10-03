"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';
import { QuestionCard } from '@/components/feed/QuestionCard';
import { Icon } from '@/components/ui/Icons';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/Skeleton';

export default function SavedPageClient() {
  const [status, setStatus] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);

  async function loadSaved() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/bookmarks', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load saved questions');
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setStatus('ready');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadSaved();
  }, []);

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
    return <div className="student-page student-page--saved"><ErrorState mascot message={error} onRetry={loadSaved} /></div>;
  }

  return (
    <div className="container-narrow view student-page student-page--saved">
      <div className="mb-6">
        <ArenaHead eyebrow="Saved" title="Saved questions" lede={`Everything you save from Explore lands here for another look.${questions.length ? ` ${questions.length} saved.` : ''}`}
          aside={<span className="saved-aside"><Link href="/explore" className="na__alt"><Icon name="radar" /> Explore questions</Link><Link href="/dashboard" className="na__alt"><Icon name="target" /> Choose practice</Link></span>} />
      </div>

      {questions.length === 0 ? (
        <EmptyState
          eyebrow="Nothing saved"
          title="Save questions from Explore"
          message="Tap Save on any feed question and it will appear here."
          actionLabel="Go to Explore"
          onAction={() => { window.location.href = '/explore'; }}
        />
      ) : (
        <div>
          {questions.map((question) => (
            <QuestionCard key={question.id} row={question} onProgressChange={loadSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
