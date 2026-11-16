'use client';

// Development only (src/app/preview/crash/page.jsx). A page that crashes once per load on purpose, and, for the Arena preview,
// a boundary and a switch that crash a signed-in screen inside the real shell. Never imported by a production route.
import { Component, useEffect, useState } from 'react';
import Link from 'next/link';

let crashedThisLoad = false;

// A plain error, or one marked for the root error page to pass on to global-error.js (development only, see src/app/error.js).
function previewError(at) {
  const error = new Error(`Preview crash (${at || 'page'})`);
  if (at === 'global') error.mmPreviewGlobal = true;
  return error;
}

export default function CrashPreview({ at }) {
  const [crash, setCrash] = useState(false);
  useEffect(() => {
    if ((at !== 'page' && at !== 'global') || crashedThisLoad) return undefined;
    crashedThisLoad = true;
    // Not cleared on cleanup: React's development double mount would otherwise cancel the one crash of this load.
    window.setTimeout(() => setCrash(true), 0);
    return undefined;
  }, [at]);
  if (crash) throw previewError(at);
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      <h1 data-crash-preview-ok="" style={{ fontSize: 28, margin: 0 }}>The page drew again.</h1>
      <p>Development preview of the error pages. Each link crashes once.</p>
      <ul>
        <li><a href="/preview/crash?at=page">Crash this page in the browser</a></li>
        {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full request is the point: the server must render (and crash) it */}
        <li><a href="/preview/crash?at=server" onClick={(event) => { event.preventDefault(); window.location.href = `/preview/crash?at=server&n=${Date.now().toString(36)}`; }}>Crash it on the server</a></li>
        <li><a href="/preview/crash?at=global">Crash the root error page too (global error)</a></li>
        <li><Link href="/preview/arena?view=today&crash=app">A signed-in screen, inside the shell</Link></li>
        <li><Link href="/preview/arena?view=test&crash=paper&subject=accountancy&mode=quick&count=10&generationKey=previewcrash01">The paper runner</Link></li>
      </ul>
    </main>
  );
}

// ---- the Arena preview: crash a screen inside the real shell ----------------------------------------------------------

const CRASH_EVENT = 'mm-preview-crash';

/** The preview bar's key: asks the screen below to crash. */
export function PreviewCrashKey() {
  return (
    <button type="button" className="arena-chip" data-preview-crash="" onClick={() => window.dispatchEvent(new Event(CRASH_EVENT))}>
      Crash this screen
    </button>
  );
}

function CrashOnEvent() {
  const [crash, setCrash] = useState(false);
  useEffect(() => {
    const on = () => setCrash(true);
    window.addEventListener(CRASH_EVENT, on);
    return () => window.removeEventListener(CRASH_EVENT, on);
  }, []);
  if (crash) throw previewError('arena');
  return null;
}

// Next's error boundary in miniature: the same props (error, reset, unstable_retry) to the same error page component.
class PreviewCrashBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = () => this.setState({ error: null });
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { fallback: Fallback, children } = this.props;
    if (this.state.error) return <Fallback error={this.state.error} reset={this.reset} unstable_retry={this.reset} />;
    return children;
  }
}

/** Wraps a preview screen so the preview bar's key can crash it; `fallback` is the real error page of that route. */
export function withPreviewCrash(enabled, fallback, screen) {
  if (!enabled || !fallback) return screen;
  return (
    <PreviewCrashBoundary fallback={fallback}>
      <CrashOnEvent />
      {screen}
    </PreviewCrashBoundary>
  );
}
