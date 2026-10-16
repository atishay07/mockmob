import ReviseRun from '@/components/revise/ReviseRun';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Revise | MockMob',
  description: 'Your own wrong answers come back after 1, 3, 7 and 21 days. Same questions, so it checks memory.',
};

// Revise (feature wave F1; spec tmp/mistake-lab-v4/SPEC.md 4.8), inside Review: reached from the Lab's Prove step and from Review.
export default function RevisePage() {
  return <div className="student-page student-page--review"><ReviseRun /></div>;
}
