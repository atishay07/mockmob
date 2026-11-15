'use client';

// A crash while a public page draws (the front page, pricing, a subject page, the sign-in pages), or while the signed-in
// shell itself draws (its own error page, src/app/(app)/error.js, sits inside the shell and cannot catch that). Before this
// file, any such crash showed Next's bare "Application error" page. It wears the not-found page's frame (SiteNotFound: the
// wordmark, the arena ground, Night or Day as chosen) and its keys: Try again, and a quiet way to the front page (a signed-in
// student is sent on from there to Today, so the link says so).
import { useContext } from 'react';
import { Logo } from '@/components/Logo';
import { AuthContext } from '@/components/AuthProvider';
import ErrorState from '@/components/errors/ErrorState';
import { ERROR_COPY } from '@/components/errors/errorCopy.mjs';
import '@/app/(app)/arena.css';
import '@/app/(app)/student-pages.css';
import '@/components/site-not-found.css';

export default function RootError({ error, reset, unstable_retry: retry }) {
  // The context, not useAuth(): an error page must never throw on its own.
  const auth = useContext(AuthContext);
  const signedIn = auth?.status === 'authenticated';
  // Development only: the crash preview (src/app/preview/crash) hands a marked error on to global-error.js, the one way to see
  // that page without breaking the root layout. The production build drops this line.
  if (process.env.NODE_ENV !== 'production' && error?.mmPreviewGlobal) throw error;
  return (
    <div className="view app-shell snf">
      <header className="snf__bar"><Logo /></header>
      <main id="app-main" className="snf__main" tabIndex={-1}>
        <ErrorState
          error={error}
          reset={reset}
          retry={retry}
          where="root"
          href="/"
          linkLabel={signedIn ? ERROR_COPY.toToday : ERROR_COPY.toHome}
        />
      </main>
    </div>
  );
}
