import { notFound } from 'next/navigation';
import BadgeSpecimen from './BadgeSpecimen';

export const metadata = { robots: { index: false, follow: false } };

// Development-only: every badge's mark in its three states on one sheet (lane "badges", 16 Nov 2026). Never in production.
export default function BadgesPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <BadgeSpecimen />;
}
