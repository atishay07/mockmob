import { notFound } from 'next/navigation';
import NtaBackendPreview from './NtaBackendPreview';

export const metadata = { robots: { index: false, follow: false } };

// Development-only. The real NTA runner (TestPageClient inside the Arena preview shell), with its
// session and submit calls sent to the local test backend in data/tests/nta_e2e_server.mjs, which runs
// the real /api/sessions and /api/attempts handlers over fixtures. Never available in production.
export default function NtaBackendPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <NtaBackendPreview />;
}
