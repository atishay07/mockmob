'use client';

// The last net: a crash in the root layout itself (the providers every page shares) or in the root error page. Next draws
// this file instead of the root layout, so none of the app's CSS, fonts or theme script can be counted on here. It carries
// its own small stylesheet and the site's two palettes (Day and Night, the arena tokens' values), sets the theme the way
// src/app/layout.js does before paint (mm:theme:v1, Day unless the visitor chose Night), and draws the wordmark from its own
// paths. The words and keys are the other error pages' (ErrorState.jsx). The home link is a plain link: a full page load is
// the surest way back when the whole app has failed.
import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { ERROR_COPY, SUPPORT_EMAIL, referenceOf, supportHref, tryAgain } from '@/components/errors/errorCopy.mjs';
import { reportError } from '@/components/errors/errorReport.mjs';

const THEME_KEY = 'mm:theme:v1';
const THEME_SCRIPT = `(function(){var d=document.documentElement;try{d.dataset.theme=localStorage.getItem('${THEME_KEY}')==='dark'?'dark':'light'}catch(e){d.dataset.theme='light'}})()`;

function storedTheme() {
  if (typeof window === 'undefined') return 'light';
  try { return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

// Night is the arena's charcoal and warm ink; Day its paper and dark ink (src/app/(app)/arena.css). Every selector is a class
// of this page, so whatever of the app's CSS is still in the document cannot restyle it.
const STYLES = `
:root{--ge-bg:#f3efe6;--ge-ink:#17150f;--ge-ink-2:#454036;--ge-ink-3:#655f53;--ge-line:#bdb4a2;--ge-hover:#9a917f;--ge-volt:#d2f000;--ge-volt-hover:#e8ff4a;--ge-on-volt:#0b1000;--ge-focus:#526700;--ge-dot:#526700;color-scheme:light}
:root[data-theme='dark']{--ge-bg:#12110e;--ge-ink:#f4f0e6;--ge-ink-2:#bdb6a6;--ge-ink-3:#a09989;--ge-line:#4a453b;--ge-hover:rgba(244,240,230,.32);--ge-focus:#d2f000;--ge-dot:#d2f000;color-scheme:dark}
.ge-body{margin:0;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
.ge-bar{padding:14px clamp(16px,4vw,40px)}
.ge-home{display:inline-flex;align-items:center;min-height:44px;color:var(--ge-ink);border-radius:6px}
.ge-logo{display:block;flex:none;height:26px;width:175.6px;overflow:visible}
.ge-logo .logo-b__dot{color:var(--ge-dot)}
.ge-main{flex:1;box-sizing:border-box;width:100%;max-width:680px;margin:0 auto;padding:clamp(28px,10vh,112px) clamp(16px,4vw,40px) 56px}
.ge-title{margin:0;max-width:24ch;font-size:clamp(26px,3.5vw,40px);font-weight:800;line-height:1.05;letter-spacing:-.03em;text-wrap:balance;color:var(--ge-ink)}
.ge-title:focus{outline:none}
.ge-line{margin:12px 0 0;max-width:46ch;font-size:15px;line-height:1.5;color:var(--ge-ink-2);text-wrap:pretty}
.ge-mail{color:inherit;text-decoration:underline;text-decoration-color:var(--ge-line);text-underline-offset:3px;overflow-wrap:anywhere}
.ge-actions{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0 0}
.ge-key{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin:0;padding:0 20px;border:1px solid var(--ge-line);border-radius:12px;background:transparent;color:var(--ge-ink);font-family:inherit;font-size:15px;font-weight:600;line-height:1.2;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color 160ms ease-out,border-color 160ms ease-out,transform 100ms ease-out}
.ge-key--volt{border-color:transparent;background:var(--ge-volt);color:var(--ge-on-volt)}
.ge-key:active{transform:translateY(1px)}
.ge-home:focus-visible,.ge-mail:focus-visible,.ge-key:focus-visible{outline:2px solid var(--ge-focus);outline-offset:2px}
@media (hover:hover) and (pointer:fine){.ge-key--volt:hover{background:var(--ge-volt-hover)}.ge-key:not(.ge-key--volt):hover{border-color:var(--ge-hover)}.ge-mail:hover{text-decoration-color:currentColor}}
@media (max-width:479px){.ge-key{flex:1 1 100%}}
@media (prefers-reduced-motion:reduce){.ge-key{transition:none}.ge-key:active{transform:none}}
.ge-ref{margin:20px 0 0;font-size:13px;color:var(--ge-ink-3);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
`;

export default function GlobalError({ error, reset, unstable_retry: retry }) {
  const [theme] = useState(storedTheme);
  // The theme script matters only when the server drew this page (the root layout failed there): it sets the theme before
  // paint. Drawn in the browser, the state above already has the theme, and React would only warn about a script it never
  // runs; so the script is kept exactly when the server's copy is in the document (hydration then matches).
  const [serverDrawn] = useState(() => typeof document === 'undefined' || Boolean(document.getElementById('ge-theme')));
  const headingRef = useRef(null);
  const reference = referenceOf(error);

  useEffect(() => { reportError(error, 'global'); }, [error]);
  useEffect(() => {
    try { headingRef.current?.focus(); } catch { /* focus is a courtesy */ }
  }, []);

  const at = ERROR_COPY.line.indexOf(SUPPORT_EMAIL);
  const onRetry = () => tryAgain(error, { retry, reset, reload: () => window.location.reload() });

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Something broke | MockMob</title>
        {serverDrawn ? <script id="ge-theme" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /> : null}
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body className="ge-body" style={{ background: 'var(--ge-bg)', color: 'var(--ge-ink)' }}>
        <header className="ge-bar">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load is the surest way back when the whole app failed */}
          <a className="ge-home" href="/" aria-label="MockMob home"><LogoMark height={26} className="ge-logo" /></a>
        </header>
        <main className="ge-main">
          <h1 ref={headingRef} tabIndex={-1} className="ge-title">{ERROR_COPY.heading}</h1>
          <p className="ge-line">
            {ERROR_COPY.line.slice(0, at)}
            <a className="ge-mail" href={supportHref(reference)}>{SUPPORT_EMAIL}</a>
            {ERROR_COPY.line.slice(at + SUPPORT_EMAIL.length)}
          </p>
          <p className="ge-actions">
            <button type="button" className="ge-key ge-key--volt" onClick={onRetry}>{ERROR_COPY.retry}</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- as above: a full load, not a client navigation */}
            <a className="ge-key" href="/">{ERROR_COPY.toHome}</a>
          </p>
          {reference ? <p className="ge-ref">{ERROR_COPY.referenceLabel}: {reference}</p> : null}
        </main>
      </body>
    </html>
  );
}
