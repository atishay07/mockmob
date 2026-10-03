import { readFileSync } from 'node:fs';
import { notFound } from 'next/navigation';
import ArenaPreviewClient from './ArenaPreviewClient';

export const metadata = { robots: { index: false, follow: false } };

// Development-only visual fixture for the signed-in Arena. It renders the real app
// shell, dashboard and test runner with a mock user and stubbed account APIs, so no
// production session, credit or attempt is touched. Never available in production.
export default function ArenaPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  // The unreleased candidate pathway (with keys) is read on the server in development only,
  // so it never ships in a client bundle. ?recovery=candidate uses it in the recovery view.
  const candidatePathway = JSON.parse(readFileSync(`${process.cwd()}/data/recovery_candidates/sacrificing_gaining.pathway.json`, 'utf8'));
  return <ArenaPreviewClient candidatePathway={candidatePathway} />;
}
