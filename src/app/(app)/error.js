'use client';

// A crash while a signed-in page draws (Today, Practice, a result, Learn, the Mob, You). This boundary sits inside the app's
// shell (src/app/(app)/layout.js), so the sidebar, the top bar and the dock stay and only the content area shows the message,
// in the signed-in not-found page's look (src/app/(app)/not-found.js). Try again draws the page again; Go to Today leaves.
// The paper runner has its own page (src/app/(app)/test/error.js).
import ErrorState from '@/components/errors/ErrorState';
import { ERROR_COPY } from '@/components/errors/errorCopy.mjs';

export default function AppError({ error, reset, unstable_retry: retry }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      retry={retry}
      where="app"
      href="/today"
      linkLabel={ERROR_COPY.toToday}
      className="mm-err--app"
    />
  );
}
