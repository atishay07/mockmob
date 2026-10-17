export const dynamic = "force-dynamic";

import { notFound } from 'next/navigation';
import MyUploadsPageClient from './MyUploadsPageClient';
import { contributeEnabled } from '@/lib/contribute';

// Hidden with Contribute (COMMUNITY-1018): the data stays, and the route answers the not-found page while the flag is off.
export default function MyUploadsPage() {
  if (!contributeEnabled()) notFound();
  return <MyUploadsPageClient />;
}
