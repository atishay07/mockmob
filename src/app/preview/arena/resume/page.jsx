import { notFound } from 'next/navigation';
import ResumePreview from './ResumePreview';

export const metadata = { robots: { index: false, follow: false } };

// Development-only. Practice (the Arena preview's dashboard) with "Resume your paper" drawn where it is meant to be mounted,
// under Practice's heading, reading the drafts the preview runner (/preview/arena?view=test) left in this browser.
// ?seed=1 writes two illustrative drafts first (one running, one inside the upload grace). Never available in production.
export default function ResumePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ResumePreview />;
}
