import { notFound } from 'next/navigation';
import MobLivePreviewClient from './MobLivePreviewClient';

export const metadata = { title: 'Mob live room preview', robots: { index: false, follow: false } };

// Development-only fixture for a Mob v3 live room (lobby, countdown, the live ruler race, a friend finishing, the
// hand-off to the podium). Every /api call is answered in the browser, and the room's channel is the in-memory fake
// hub with scripted friends, so no session, game, answer or Realtime connection is touched. Never in production.
export default function MobLivePreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MobLivePreviewClient />;
}
