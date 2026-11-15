'use client';

// The message of every error page that draws inside the app's own styles (src/app/error.js, src/app/(app)/error.js,
// src/app/(app)/test/error.js; global-error.js carries its own copy of this look because the app's CSS may be gone there).
// It is the not-found page's look (AppNotFound, SiteNotFound): the arena headline, one plain line, one volt key and one quiet
// way out, then Next's digest in small quiet text when there is one, so support can find the server log.
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ERROR_COPY, SUPPORT_EMAIL, referenceOf, supportHref, tryAgain } from './errorCopy.mjs';
import { reportError } from './errorReport.mjs';
import './error-state.css';

// The support address in a line becomes a mail link (the reference rides in its subject).
function LineWithSupport({ text, reference }) {
  const at = text.indexOf(SUPPORT_EMAIL);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a className="mm-err__mail" href={supportHref(reference)}>{SUPPORT_EMAIL}</a>
      {text.slice(at + SUPPORT_EMAIL.length)}
    </>
  );
}

export default function ErrorState({
  error,
  reset,
  retry,
  where,
  line = ERROR_COPY.line,
  retryLabel = ERROR_COPY.retry,
  href,
  linkLabel,
  className = '',
}) {
  const headingRef = useRef(null);
  const reference = referenceOf(error);

  // Reported once (the reporter remembers each error, so React's development double effects send one report).
  useEffect(() => { reportError(error, where); }, [error, where]);

  // The screen the student was using is gone: the heading takes focus, so a screen reader says what happened and the next
  // Tab reaches the key. Scrolls it into view when the crash happened far down a page.
  useEffect(() => {
    try { headingRef.current?.focus(); } catch { /* focus is a courtesy */ }
  }, []);

  const onRetry = () => tryAgain(error, { retry, reset, reload: () => window.location.reload() });

  return (
    <div className={`student-page mm-err ${className}`.trim()}>
      <header className="pr-head pr-head--solo">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="display-md mm-err__title">{ERROR_COPY.heading}</h1>
          <p className="mm-err__line"><LineWithSupport text={line} reference={reference} /></p>
        </div>
      </header>
      <p className="ui-state__actions mm-err__actions">
        <button type="button" className="ui-state__action ui-state__action--primary mk-press" data-page-primary="" onClick={onRetry}>{retryLabel}</button>
        <Link href={href} className="ui-state__action mk-press">{linkLabel}</Link>
      </p>
      {reference ? <p className="mm-err__ref">{ERROR_COPY.referenceLabel}: {reference}</p> : null}
    </div>
  );
}
