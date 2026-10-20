import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ExplainerPreviewClient from './ExplainerPreviewClient';

export const metadata = { robots: { index: false, follow: false } };

// Development-only fixture for the Mob explainer (D166) and its setup: the real app shell, D0, the explainer, the setup
// and the den against the server's v3 fixtures, with every account route stubbed. No sign-in, no write. Never in production.
export default function MobExplainerPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense fallback={null}><ExplainerPreviewClient /></Suspense>;
}
