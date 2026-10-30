import { Suspense } from 'react';
import KeycardsHome from '@/components/keycards/KeycardsHome';

export const metadata = {
  title: 'Key cards | MockMob',
  description: "NCERT's exact lines for CUET, chapter by chapter, each with its book page, on a schedule in Revise.",
};

// Key cards home (KEYCARDS-BUILD-SPEC.md section 3). Inside Practice, reached from Learn and from Review's chapters; no tab of its own.
export default function CardsPage() {
  return <div className="student-page student-page--cards"><Suspense fallback={null}><KeycardsHome /></Suspense></div>;
}
