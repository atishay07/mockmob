import { notFound } from 'next/navigation';
import MobPlayPreviewClient from './MobPlayPreviewClient';

export const metadata = { title: 'Mob game preview', robots: { index: false, follow: false } };

// Development-only fixture for the Mob v3 game screens (the run, the podium, everyone's moment, Fix it together).
// Every /api call is answered in the browser from data/tests/fixtures/mob_v3 (the server's real response shapes),
// so no session, game or answer is touched. Never available in production.
export default function MobPlayPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MobPlayPreviewClient />;
}
