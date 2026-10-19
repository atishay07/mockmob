import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import ShelfPageClient from './ShelfPageClient';

export const metadata = { title: 'Your shelf', robots: { index: false, follow: false } };

// Your shelf (MOB-BUILD-SPEC-V3 5.3 S1): every Fold earned, the rest as silhouettes with their rule. Behind MOB_ENABLED.
export default async function ShelfRoute() {
  await connection();
  if (process.env.MOB_ENABLED !== 'true') notFound();
  return <ShelfPageClient />;
}
