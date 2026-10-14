import { notFound } from 'next/navigation';
import UiKitClient from './UiKitClient';

// Development-only inspection page for the W2.1 tokens and components, so the merge step can
// screenshot every state in Night and Daylight at each size (owner D7). Not linked, not indexed,
// and a 404 in production.
export const metadata = { title: 'UI kit', robots: { index: false, follow: false } };

export default function UiKitPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UiKitClient />;
}
