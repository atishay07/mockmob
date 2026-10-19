import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import ChainsPageClient from './ChainsPageClient';

export const metadata = { title: 'Chains', robots: { index: false, follow: false } };

// Chains (MOB-BUILD-SPEC-V3 5.3 C1, C2, P5): your daily chain and your Mob's weekly one. Behind MOB_ENABLED, like the Mob.
export default async function ChainsRoute() {
  await connection();
  if (process.env.MOB_ENABLED !== 'true') notFound();
  return <Suspense fallback={null}><ChainsPageClient /></Suspense>;
}
