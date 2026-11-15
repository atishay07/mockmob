export const dynamic = "force-dynamic";

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import ModerationPageClient from './ModerationPageClient';

// The same rule the moderation API routes use (src/app/api/questions/moderate/route.js canModerate): moderator or admin.
// The client keeps its own check; this one means a non-moderator never receives the page at all.
const canModerate = (user) => user?.role === 'moderator' || user?.role === 'admin';

export default async function ModerationPage() {
  let user = null;
  try {
    user = (await auth())?.user || null;
  } catch (error) {
    console.error('[moderation] failed to resolve user:', error);
  }
  if (!user) redirect('/login');
  if (!canModerate(user)) redirect('/dashboard');
  return <ModerationPageClient />;
}
