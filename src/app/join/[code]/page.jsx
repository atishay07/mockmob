import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { playBillingEnabled } from '@/lib/payments/playBilling';
import JoinMobClient from '@/components/mob/JoinMob';
import { mobInviteMetadata } from '@/lib/seo';

// The public invite page: never indexed, never a name (SOCIAL-SPEC P1, P3). Behind MOB_ENABLED.
// Its link preview says a friend invited you to their Mob, with the site's share card and its own URL as canonical (P8,
// 15 Nov 2026: it previewed as the home page). Nothing about the Mob is read for the preview: no name, no database call.
export async function generateMetadata({ params }) {
  const code = String((await params)?.code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  return mobInviteMetadata(`/join/${code}`);
}

export default async function JoinMobPage({ params }) {
  await connection();
  if (process.env.MOB_ENABLED !== 'true') notFound();
  const { code } = await params;
  return <JoinMobClient code={String(code || '').slice(0, 16)} billingOn={playBillingEnabled()} />;
}
