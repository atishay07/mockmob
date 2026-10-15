import { notFound } from 'next/navigation';
import { SeoContentPage } from '@/components/SeoContentPage';
import { seoMetadata } from '@/lib/seo';
import { SUBJECT_HUBS, getSubjectHub } from '@/lib/subjectHubs';

export function generateStaticParams() {
  return SUBJECT_HUBS.map((hub) => ({ subject: hub.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  if (!hub) return {};
  return seoMetadata({
    title: hub.title,
    description: hub.description,
    path: `/cuet/${hub.slug}`,
  });
}

export default async function SubjectHubPage({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  if (!hub) notFound();

  const otherHubs = SUBJECT_HUBS.filter((other) => other.slug !== hub.slug);

  const page = {
    slug: `cuet-${hub.slug}`,
    path: `/cuet/${hub.slug}`,
    breadcrumb: `CUET ${hub.name}`,
    eyebrow: hub.eyebrow,
    h1: hub.h1,
    intro: hub.intro,
    description: hub.description,
    sections: [
      ...hub.sections,
      {
        heading: `Practise CUET ${hub.name} on MockMob`,
        body: [
          `Take a Quick practice set in ${hub.name}, then read your record to see which chapters cost you marks. NTA mode, the exam screen, comes with Pro and uses original practice questions. CUET UG 2027 rules stay provisional until NTA publishes its bulletin.`,
        ],
        links: [
          { href: '/signup', label: `Start free with ${hub.name}` },
          { href: '/cuet-2027', label: 'CUET 2027 exam guide' },
          { href: '/pricing', label: 'See pricing' },
        ],
      },
      {
        heading: 'More CUET subject practice',
        body: ['Explore the published subject guides below. Confirm the final 2027 paper choices with NTA and check programme requirements with the university:'],
        links: otherHubs.map((other) => ({
          href: `/cuet/${other.slug}`,
          label: `CUET ${other.name}`,
        })),
      },
    ],
    faqs: hub.faqs,
  };

  return <SeoContentPage page={page} />;
}
