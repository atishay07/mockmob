'use client';

// The root error page's sheets (src/app/error.js), loaded with the error page itself (21 Nov 2026 speed pass, owner LK353:
// the yardstick is a Rs 15,000 phone). Imported statically by error.js, these ~116 KB of CSS were preloaded on EVERY page's
// first visit, because Next preloads a root error boundary's styles everywhere. error.js now loads this module lazily inside
// a Suspense boundary, so the sheets arrive only when an error page is drawn, and the page waits for them (no unstyled flash).
import '@/app/(app)/arena.css';
import '@/app/(app)/student-pages.css';
import '@/components/site-not-found.css';

export default function RootErrorStyles() {
  return null;
}
