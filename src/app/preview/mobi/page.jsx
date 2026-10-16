import { notFound } from 'next/navigation';
import MobiPreview from './MobiPreview';

export const metadata = { robots: { index: false, follow: false } };

// Development only: every Mobi emotion (mood) and every act, in Night and Day, from the same rig table
// the app plays (data/mobi_rig.v2.json). For captures and for checking a change to his motion.
export default function MobiPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MobiPreview />;
}
