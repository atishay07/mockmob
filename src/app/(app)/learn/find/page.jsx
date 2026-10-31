import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import LearnHome from '@/components/learn2/home/LearnHome';
import { learn2On, one } from '../params';
export const metadata = { title: 'Find — MockMob', robots: { index: false, follow: false } };
// /learn/find?subject=: Learn v2's Find (the sidebar's "Key cards to revise" row and the server's own search links point here).
// Same screen as /learn?find=1. Learn v2 off: no such page.
export default async function LearnFind({ searchParams }) {
  const params = await searchParams;
  if (!learn2On()) notFound();
  return <Suspense fallback={null}><LearnHome subject={one(params.subject) || null} initialView="find" /></Suspense>;
}
