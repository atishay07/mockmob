export const dynamic = "force-dynamic";

import { notFound } from 'next/navigation';
import UploadPageClient from './UploadPageClient';
import { contributeEnabled } from '@/lib/contribute';

// Contributions are hidden unless CONTRIBUTE_ENABLED=true (COMMUNITY-1018): the page, its API and its data stay, and the route
// answers the not-found page while the flag is off, so no link or bookmark leads to a feature that is not offered.
export default function UploadPage() {
  if (!contributeEnabled()) notFound();
  return <UploadPageClient />;
}
