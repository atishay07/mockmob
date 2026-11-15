'use client';

// A crash in the paper runner, mid-paper: the costliest place for one. The runner writes its draft (questions, answers,
// marks, the question it is on, the clock's end) to this browser's storage after every change, in an effect, and React runs
// that effect before it starts the next render, so every answer the student saw on screen is stored before a later render
// can fail (TestPageClient.jsx, the draft effect). "Reopen your paper" draws the runner again from scratch (reset, no network
// needed); on mounting it finds that draft and resumes the same paper on the same question while its time runs
// (data/session_draft.js resumableDraft). The runner draws no navigation, so this page carries the wordmark like the
// not-found page; Go to Practice leaves.
import { Logo } from '@/components/Logo';
import ErrorState from '@/components/errors/ErrorState';
import { ERROR_COPY } from '@/components/errors/errorCopy.mjs';

export default function PaperError({ error, reset, unstable_retry: retry }) {
  return (
    <div className="mm-err-paper">
      <div className="mm-err-paper__bar"><Logo /></div>
      <div className="mm-err-paper__main">
        <ErrorState
          error={error}
          reset={reset}
          retry={retry}
          where="paper"
          line={ERROR_COPY.paperLine}
          retryLabel={ERROR_COPY.paperRetry}
          href="/dashboard"
          linkLabel={ERROR_COPY.toPractice}
        />
      </div>
    </div>
  );
}
