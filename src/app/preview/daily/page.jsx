import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import '@/app/marketing.css';
import '@/app/landing.css';
import '@/app/hero-scene.css';
import '@/app/r10-sample.css';
import '@/app/r13-motion.css';
import DailyPreviewClient from './DailyPreviewClient';

export const metadata = { robots: { index: false, follow: false } };

// Development-only fixture for /daily as a signed-in student (lane daily, 15 Nov 2026): the real page components (the public
// bar, the Daily Five card, the footer) with a fixture student and the Daily Five routes answered in this tab
// (../arena/previewDaily.js). No production session, read or write. Never in production. The sheets are the /daily page's.
//   /preview/daily?daily=none|played|other|error&crowd=some|none&save=ok|fail&auth=out&fresh=1
export default function DailyPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense fallback={null}><DailyPreviewClient /></Suspense>;
}
