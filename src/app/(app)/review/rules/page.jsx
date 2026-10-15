import RuleBook from '@/components/rules/RuleBook';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your rules | MockMob',
  description: 'Rules from your repairs and from how you take papers, and the one rule for your next mock.',
};

// The Rule book (spec tmp/mistake-lab-v4/SPEC.md 4.10), inside Review: reached from the Lab's Repair step and from Review.
export default function RulesPage() {
  return <div className="student-page student-page--review"><RuleBook /></div>;
}
