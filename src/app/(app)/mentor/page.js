import { redirect } from 'next/navigation';
import AIMentorTerminal from '@/components/ai/AIMentorTerminal';
import { mentorTabTarget } from '@/components/ai/askMobiModel.mjs';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ask Mobi | MockMob', description: 'Ask about your own record. Questions about your record are free.' };

// /mentor is Ask Mobi only. The old Next step, Your record and tools tabs moved: old links (the app's
// ActionRouter, the result page) land on the place that now holds them.
export default async function MentorPage({ searchParams }) {
  const moved = mentorTabTarget((await searchParams)?.tab);
  if (moved) redirect(moved);
  return <div className="student-page student-page--mentor"><AIMentorTerminal /></div>;
}
