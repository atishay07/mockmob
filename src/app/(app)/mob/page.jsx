import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { playBillingEnabled } from '@/lib/payments/playBilling';
import MobPageClient from './MobPageClient';

export const metadata = { title: 'Mob', robots: { index: false, follow: false } };

// The Mob (SOCIAL-SPEC section 7). Behind MOB_ENABLED: off, the page does not exist.
export default async function MobRoute() {
  await connection();
  if (process.env.MOB_ENABLED !== 'true') notFound();
  // The server's billing flag, read here so the explainer's slide 3 says the plan rule only when it is true.
  return <MobPageClient billingOn={playBillingEnabled()} />;
}
