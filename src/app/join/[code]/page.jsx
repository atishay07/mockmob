import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import JoinMobClient from '@/components/mob/JoinMob';

// The public invite page: never indexed, never a name (SOCIAL-SPEC P1, P3). Behind MOB_ENABLED.
export const metadata = { title: 'You are invited to a Mob', robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };

export default async function JoinMobPage({ params }) {
  await connection();
  if (process.env.MOB_ENABLED !== 'true') notFound();
  const { code } = await params;
  return <JoinMobClient code={String(code || '').slice(0, 16)} />;
}
