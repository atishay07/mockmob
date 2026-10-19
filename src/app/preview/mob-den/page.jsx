import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import DenPreviewClient from './DenPreviewClient';

export const metadata = { robots: { index: false, follow: false } };

// Development-only fixture for the web den (Mob v3): the real app shell and the real den components against the server's
// v3 fixtures, with every account route stubbed. No production session, write or credit is touched. Never in production.
export default function DenPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense fallback={null}><DenPreviewClient /></Suspense>;
}
