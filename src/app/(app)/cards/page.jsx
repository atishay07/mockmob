import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import KeycardsHome from '@/components/keycards/KeycardsHome';
import { learn2On } from '../learn/params';
import { cardsHomeTarget } from './redirects';

export const metadata = {
  title: 'Key cards | MockMob',
  description: "NCERT's exact lines for CUET, chapter by chapter, each with its book page, on a schedule in Revise.",
};

// Key cards home (KEYCARDS-BUILD-SPEC.md section 3). Inside Practice, reached from Learn and from Review's chapters; no tab of its own.
// Learn v2 on: Key cards live in Learn (LK23), so this old home sends the student there. Off, the page is exactly what it was.
export default async function CardsPage({ searchParams }) {
  if (learn2On()) redirect(cardsHomeTarget(await searchParams));
  return <div className="student-page student-page--cards"><Suspense fallback={null}><KeycardsHome /></Suspense></div>;
}
