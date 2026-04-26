"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { QuestionCard } from '@/components/feed/QuestionCard';
import { Button } from '@/components/ui/Button';
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
      <div className="container-narrow flex flex-col gap-4">
        <div>
          <div className="eyebrow mb-2">{'// Saved'}</div>
          <div className="h-10 w-72 max-w-full skeleton mb-2" />
          <div className="h-4 w-64 max-w-full skeleton" />
        </div>
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={loadSaved} />;
  }

  return (
    <div className="container-narrow view">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow mb-2">{'// Saved'}</div>
          <h1 className="display-md">Saved <span className="text-volt italic">questions</span></h1>
          <p className="text-sm text-zinc-500 mt-2">Everything you save from Explore lands here for review.</p>
        </div>
        <Link href="/explore">
          <Button variant="outline" size="sm">
            <Icon name="radar" /> Explore
          </Button>
        </Link>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          eyebrow="// Nothing saved"
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
