import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'CUET 2027: Exam Pattern, Expected Dates, Syllabus & Preparation | MockMob',
  description:
    'CUET UG 2027 guide: dates and rules remain pending. Use the latest completed cycle only as a reference, and check this page as NTA publishes official updates.',
  path: '/cuet-2027',
});

// Cornerstone page for the 2027 cycle. Facts below reflect the CUET UG 2026
// pattern (the latest NTA has conducted); anything not yet announced for 2027
// is labelled expected. Update this page the day NTA publishes the 2027
// bulletin — announcement weeks are when this page earns links.
const page = {
  slug: 'cuet-2027',
  path: '/cuet-2027',
  breadcrumb: 'CUET 2027 Guide',
  eyebrow: '// CUET 2027',
  h1: 'CUET 2027: Pattern, Expected Dates, and a Plan That Works',
  intro:
    'A planning guide for CUET UG 2027. NTA has not announced the 2027 bulletin, so dates, paper rules, and marking details remain provisional until the official notice is published.',
  description:
    'CUET UG 2027 exam guide with expected dates, CBT pattern, subject selection rules, marking scheme, and preparation strategy.',
  sections: [
    {
      heading: 'CUET 2027 expected timeline',
      body: [
        'NTA has not released the CUET UG 2027 bulletin yet. Based on the 2026 cycle, registration is expected around February to March 2027, the exam in May 2027, and results by late June or early July, followed by university counselling such as DU CSAS.',
        'What that means practically: the syllabus year starts now. Students who begin timed practice in Class 12 autumn walk into May with two full revision cycles; students who start after the bulletin get one at best.',
      ],
    },
    {
      heading: 'Exam pattern: use the latest cycle as a reference',
      body: [
        'The 2027 exam format has not been confirmed. Use the latest completed cycle to understand the kind of preparation to expect, then check the NTA bulletin for the final papers, duration, and question rules before you plan around them.',
        'Subject choices and marking rules can affect your preparation. Confirm both in the official 2027 bulletin when it is published; do not treat historical rules as a guarantee of the next cycle.',
      ],
    },
    {
      heading: 'Choosing your five subjects',
      body: [
        'Work backwards from the course and check each university’s current eligibility rules before choosing papers. Programme requirements can differ, and the 2027 rules may change when institutions publish their bulletins.',
        'MockMob Admission Compass checks sourced DU programme eligibility and historical cutoffs. It does not predict admission, and its historical data does not replace the official 2027 requirements.',
      ],
      links: [
        { href: '/cuet-subject-combination', label: 'Plan your CUET subject combination' },
        { href: '/features', label: 'How Admission Compass works' },
      ],
    },
    {
      heading: 'A month-by-month CUET 2027 plan',
      body: [
        'Now to December: finish the NCERT baseline alongside boards prep, and run one short timed drill per subject each week to build format familiarity early.',
        'January to February: add more timed practice as your syllabus coverage grows. Review incorrect and skipped answers, then choose a chapter or question pattern to revisit.',
        'As the exam approaches, use timed practice that matches the official format once NTA publishes the 2027 rules. Keep a separate block for targeted chapter review.',
      ],
      links: [
        { href: '/signup', label: 'Start free CUET 2027 practice' },
        { href: '/cuet-mock-test-free', label: 'Free CUET mock tests' },
        { href: '/cuet-previous-year-questions', label: 'CUET previous year questions' },
      ],
    },
    {
      heading: 'Subject-wise practice lanes',
      body: ['Chapter-tagged question banks with timed drills and weakness analytics, per subject:'],
      links: [
        { href: '/cuet/english', label: 'CUET English' },
        { href: '/cuet/accountancy', label: 'CUET Accountancy' },
        { href: '/cuet/economics', label: 'CUET Economics' },
        { href: '/cuet/business-studies', label: 'CUET Business Studies' },
        { href: '/cuet/history', label: 'CUET History' },
        { href: '/cuet/political-science', label: 'CUET Political Science' },
      ],
    },
  ],
  faqs: [
    {
      question: 'When will CUET 2027 be held?',
      answer:
        'NTA has not announced 2027 dates yet. Based on the 2026 cycle, the exam is expected in May 2027 with registration around February to March 2027. This page is updated when the official bulletin releases.',
    },
    {
      question: 'How many subjects can I take in CUET 2027?',
      answer:
        'The 2027 subject-selection rules have not been published. Check the official bulletin when it is released and confirm programme-specific requirements with each university.',
    },
    {
      question: 'Is CUET 2027 online or offline?',
      answer:
        'NTA has not confirmed the 2027 delivery format. Check the official 2027 bulletin for the final details.',
    },
    {
      question: 'What is the CUET marking scheme?',
      answer:
        'The 2027 marking scheme has not been announced. Check the official bulletin before using a historical marking scheme to calculate practice scores.',
    },
    {
      question: 'When should I start preparing for CUET 2027?',
      answer:
        'Start with the subjects and syllabus that apply to your target programmes. Add timed practice as you cover topics, then update your plan when NTA and universities publish the 2027 details.',
    },
  ],
};

export default function Cuet2027Page() {
  return <SeoContentPage page={page} />;
}
